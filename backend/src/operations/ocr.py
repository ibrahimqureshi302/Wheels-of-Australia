"""
Identity-document OCR via Google Gemini.

The frontend uploads a photo/scan of a passport, CNIC or driving licence; we
ask Gemini (a vision model) to (a) classify which kind of document it is and
(b) extract the holder's details, returning a small JSON object the user then
reviews and confirms. The Gemini API key lives only on the server (settings.
GEMINI_API_KEY) so it is never exposed to the browser.

We call the REST API with the Python standard library (urllib) to avoid adding
an SDK / extra dependency to the image.
"""
import base64
import json
import time
import urllib.request
import urllib.error

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser


GEMINI_URL = (
    'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
)

# What the model must return. Keeping the contract tight (fixed keys, ISO dates,
# blanks instead of guesses) makes the response safe to drop straight into the
# review form.
_PROMPT = (
    'You are an identity-document OCR system. The attached image (or PDF) is a '
    'photo or scan of an identity document. Identify the document type and read '
    "the holder's details. Respond with ONLY a JSON object (no markdown, no prose) "
    'using exactly these keys:\n'
    '- "doc_type": one of "passport", "licence", "cnic", or "unknown". '
    'Use "cnic" for any national identity card (e.g. Pakistan CNIC/National ID), '
    '"licence" for a driving licence/driver license, "passport" for a passport, '
    'and "unknown" only if the image is not an identity document at all.\n'
    '- "looks_like_id": boolean — true if this really is an identity document, '
    'false if it is a random photo or unrelated image.\n'
    '- "full_name": the holder\'s full name exactly as printed, else "".\n'
    '- "date_of_birth": the date of birth as YYYY-MM-DD, else "".\n'
    '- "document_number": the passport/licence/CNIC number as printed, else "". '
    'For a CNIC keep the 13 digits formatted xxxxx-xxxxxxx-x.\n'
    '- "expiry_date": the expiry/valid-until date as YYYY-MM-DD, else "".\n'
    '- "nationality": the nationality or issuing country as printed, else "".\n'
    'Normalise every date to YYYY-MM-DD. Do not invent values — leave a field as '
    '"" when you cannot read it confidently.'
)

_ALLOWED_DOC_TYPES = {'passport', 'licence', 'cnic', 'unknown'}


class OcrError(Exception):
    """A problem calling Gemini or parsing its response."""


def _call_gemini(image_bytes: bytes, mime_type: str) -> dict:
    key = settings.GEMINI_API_KEY
    if not key:
        raise OcrError('GEMINI_API_KEY is not configured on the server.')

    body = {
        'contents': [{
            'parts': [
                {'text': _PROMPT},
                {'inline_data': {'mime_type': mime_type, 'data': base64.b64encode(image_bytes).decode()}},
            ],
        }],
        # Force a JSON object back, and 0 temperature for deterministic reads.
        'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0},
    }
    url = GEMINI_URL.format(model=settings.GEMINI_MODEL, key=key)
    data = json.dumps(body).encode('utf-8')

    # Gemini's flash models intermittently return 503 (overloaded) or 429
    # (per-minute rate limit). Both are transient, so retry a few times with a
    # short backoff before giving up.
    payload = None
    last_error = None
    for attempt in range(4):
        req = urllib.request.Request(
            url, data=data, headers={'Content-Type': 'application/json'}, method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                payload = json.loads(resp.read().decode('utf-8'))
            break
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode('utf-8', errors='ignore')
            last_error = OcrError(f'Gemini API returned {exc.code}: {detail[:400]}')
            # 500/503 are transient overloads — a quick retry usually clears them.
            # 429 is a quota/rate limit whose retry window is long (tens of
            # seconds); retrying just burns more of the (small) quota, so fail
            # fast and let the caller surface a "try again shortly" message.
            if exc.code in (500, 503) and attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise last_error
        except urllib.error.URLError as exc:
            last_error = OcrError(f'Could not reach the Gemini API: {exc.reason}')
            if attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise last_error
        except (ValueError, TimeoutError) as exc:
            raise OcrError(f'Unexpected Gemini response: {exc}')

    if payload is None:
        raise last_error or OcrError('Gemini API call failed.')

    try:
        text = payload['candidates'][0]['content']['parts'][0]['text']
    except (KeyError, IndexError, TypeError):
        # Most often a safety block or empty candidate.
        raise OcrError('Gemini did not return any readable content for this image.')

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        raise OcrError('Gemini response was not valid JSON.')


def _normalise(raw: dict) -> dict:
    """Coerce Gemini's object into our fixed, frontend-friendly shape."""
    def s(key):
        v = raw.get(key, '')
        return v.strip() if isinstance(v, str) else ''

    doc_type = s('doc_type').lower()
    if doc_type not in _ALLOWED_DOC_TYPES:
        # Accept a couple of common synonyms before giving up.
        doc_type = {'license': 'licence', 'driving_licence': 'licence',
                    'driving_license': 'licence', 'id': 'cnic',
                    'national_id': 'cnic'}.get(doc_type, 'unknown')

    return {
        'doc_type': doc_type,
        'looks_like_id': bool(raw.get('looks_like_id', doc_type != 'unknown')),
        'full_name': s('full_name'),
        'date_of_birth': s('date_of_birth'),
        'document_number': s('document_number'),
        'expiry_date': s('expiry_date'),
        'nationality': s('nationality'),
    }


class IdDocumentOcrView(APIView):
    """POST an ID document image → Gemini classifies it and extracts the fields.

    Open to unauthenticated callers because identity documents are uploaded
    during public registration (before any account/token exists).

    Accepts either a multipart file field named ``document`` (preferred) or a
    JSON body ``{"image": "<data-url-or-base64>", "mime_type": "image/jpeg"}``.
    """

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    # Gemini vision accepts these; reject anything else early.
    _ALLOWED_MIME = {'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'}
    _MAX_BYTES = 12 * 1024 * 1024  # 12 MB — matches the frontend's upload cap.

    def post(self, request):
        image_bytes, mime_type = self._read_upload(request)
        if image_bytes is None:
            return Response(
                {'detail': 'No document supplied. Send a file in the "document" field or an "image" data URL.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(image_bytes) > self._MAX_BYTES:
            return Response({'detail': 'Document is too large (max 12 MB).'}, status=status.HTTP_400_BAD_REQUEST)
        if mime_type not in self._ALLOWED_MIME:
            return Response(
                {'detail': f'Unsupported file type "{mime_type}". Upload a JPG, PNG, WEBP or PDF.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = _normalise(_call_gemini(image_bytes, mime_type))
        except OcrError as exc:
            # 502: the upstream OCR provider failed, not the caller's fault.
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(result, status=status.HTTP_200_OK)

    def _read_upload(self, request):
        """Return (bytes, mime_type) from either a multipart file or a JSON data URL."""
        upload = request.FILES.get('document') or request.FILES.get('file')
        if upload is not None:
            return upload.read(), (upload.content_type or 'image/jpeg')

        image = request.data.get('image')
        if isinstance(image, str) and image:
            mime = request.data.get('mime_type') or 'image/jpeg'
            if image.startswith('data:'):
                header, _, b64 = image.partition(',')
                if ';base64' in header and header.startswith('data:'):
                    mime = header[5:].split(';', 1)[0] or mime
                image = b64
            try:
                return base64.b64decode(image), mime
            except (ValueError, TypeError):
                return None, None
        return None, None
