# Frontend Plan: Fully Animated & Beautiful UI

This document maps **requirement.md** to frontend scope and defines **ordered steps** to deliver a fully animated, high-quality UI for the Wheels of Australia app.

---

## 1. Frontend scope from requirement.md

| Epic | Frontend relevance |
|------|--------------------|
| **EPIC 1 – RBAC** | Role-based UI: show/hide modules and actions by role (Admin, Driver, Rental, Mechanic). Unauthorized access blocked in UI; permission violations visible (e.g. redirect or message). |
| **EPIC 2 – Driver registration & KYC** | Driver registration (OTP), document upload (PDF/JPG/PNG), OCR result display (editable fields), face verification flow (consent, capture, retry/lock), consent and retention messaging. |
| **EPIC 3 – Rental & fleet** | Rental registration (company/individual, certificate upload), fleet management (add/edit vehicles, images, rego/insurance), vehicle browsing and rental request workflow (list, request, approve/reject, notifications). |
| **EPIC 4 – GPS** | Live map for rental view, driver location; location-permission onboarding; graceful “GPS lost” and “location disabled” states; distance/summary views. |
| **EPIC 5 – Maintenance** | Oil/rego reminders UI, weekly odometer upload, service slip upload and OCR result display. |
| **EPIC 6 – Notifications** | In-app notification centre: list, mark as read, timestamps, types (oil, rego, payment, rental decision, location disabled, suspension). |
| **EPIC 9 – Admin theme** | Admin-controlled branding: logo upload, primary colour, theme (e.g. light/dark). Changes reflected across the app (theme + layout). |
| **EPIC 10 – Performance** | Vehicle list & heavy views: loading states, skeleton UIs, target &lt; 3s perceived load. |

---

## 2. “Fully animated & most beautiful” – what we will do

- **Motion**
  - Page/route transitions (e.g. fade/slide).
  - List and card enter/exit (stagger, fade, slight slide).
  - Buttons, chips, toasts: subtle hover/active and success/error feedback.
  - Loading: skeletons, spinners, or progress with smooth transitions.
  - Modals/drawers: open/close with duration and easing.
- **Visual polish**
  - Consistent design system: typography, spacing, radius, shadows (extend existing MUI theme).
  - Distinctive but professional palette; optional dark mode (aligned with EPIC 9).
  - Micro-interactions: focus states, hover elevation, clear disabled states.
  - Empty states and error states with clear copy and optional illustration/icon.
- **Beauty**
  - One cohesive visual language (no random “AI slop”).
  - Clear hierarchy, readable text, sufficient contrast.
  - Thoughtful use of colour (e.g. status: success/warning/error/suspension).
  - Optional: custom font pairings and subtle background treatments (gradients/texture) where they add value.

---

## 3. Ordered steps (what we will do)

### Phase A – Foundation (design system & motion)

| Step | What we will do | Outcome |
|------|------------------|--------|
| **A1** | Add an animation/motion library (e.g. Framer Motion) and define shared variants (page, list, card, modal). | Reusable motion primitives; no one-off CSS keyframes everywhere. |
| **A2** | Extend MUI theme: transitions (duration, easing), optional dark palette, refined shadows and radius. | Single source of truth for motion and shape; ready for EPIC 9. |
| **A3** | Add global layout transitions (e.g. AnimatePresence + route-based transition). | Every route change feels smooth and consistent. |
| **A4** | Create shared components: AnimatedPage, AnimatedCard, AnimatedList, AnimatedModal/Drawer. | All new screens use the same motion language. |

### Phase B – Core shell & RBAC (EPIC 1)

| Step | What we will do | Outcome |
|------|------------------|--------|
| **B1** | Implement role-aware layout: sidebar/nav and menu items driven by user role (Admin, Driver, Rental). | Only permitted modules/actions visible. |
| **B2** | Add route guards that redirect or show “no access” with an animated, clear message. | Unauthorized access blocked in UI. |
| **B3** | Apply motion to shell: nav expand/collapse, mobile drawer, header. | Shell feels responsive and polished. |

### Phase C – Auth & onboarding (EPIC 2 start)

| Step | What we will do | Outcome |
|------|------------------|--------|
| **C1** | Redesign login/register screens: clear layout, animated form (focus, error), OTP input with subtle feedback. | Beautiful, trustworthy first touch. |
| **C2** | Driver onboarding flow: stepped wizard with progress and step transitions (document upload, OCR display, face verification). | Clear progress; each step animated. |
| **C3** | Document upload UI: drag-and-drop, progress, success/error with motion. | Upload feels reliable and polished. |
| **C4** | Face verification UI: consent screen, capture flow, retry/lock states with clear copy and motion. | Compliance-friendly and understandable. |

### Phase D – Rental & fleet (EPIC 3)

| Step | What we will do | Outcome |
|------|------------------|--------|
| **D1** | Rental registration: company/individual choice, certificate upload, animated form and success state. | Aligned with EPIC 3.1. |
| **D2** | Fleet management: vehicle list (animated list/cards), add/edit vehicle form (images, rego, insurance), loading and empty states. | EPIC 3.2; ready for &lt; 3s target (EPIC 10). |
| **D3** | Vehicle browsing (driver): grid/list of vehicles with hover and transition; rental request CTA and confirmation with motion. | EPIC 3.3. |
| **D4** | Rental request workflow (rental side): list of requests, approve/reject/request-info with clear feedback and optional notification badge. | EPIC 3.3. |

### Phase E – GPS & maintenance (EPIC 4 & 5)

| Step | What we will do | Outcome |
|------|------------------|--------|
| **E1** | GPS/live map view: map component, driver marker, “live” pulse or subtle animation; permission prompt and “GPS lost” / “disabled” states. | EPIC 4.1, 4.2. |
| **E2** | Distance/summary view for rental with loading and empty states. | EPIC 4.3. |
| **E3** | Maintenance UI: oil/rego reminders (cards or list with status), weekly odometer upload (upload + success), service slip upload and OCR result display with motion. | EPIC 5.1, 5.2, 5.3. |

### Phase F – Notifications & admin theme (EPIC 6 & 9)

| Step | What we will do | Outcome |
|------|------------------|--------|
| **F1** | In-app notification centre: list (animated), mark as read, timestamps, type-specific icons/colours; badge on header. | EPIC 6.1. |
| **F2** | Admin theme/branding: UI for logo upload, primary colour, theme (light/dark); apply to theme and layout so changes reflect across the app. | EPIC 9.1. |

### Phase G – Polish & performance (EPIC 10)

| Step | What we will do | Outcome |
|------|------------------|--------|
| **G1** | Loading and skeletons for heavy lists (e.g. vehicle list) with smooth transition to content. | Perceived performance &lt; 3s. |
| **G2** | Empty states and error states: copy, illustration or icon, CTA where relevant; consistent motion. | Every state feels intentional. |
| **G3** | Final pass: focus states, reduced motion preference (respect `prefers-reduced-motion`), contrast and a11y. | Accessible and robust. |

---

## 4. Suggested execution order

1. **Phase A** (A1 → A4) – Foundation first.
2. **Phase B** (B1 → B3) – Shell and RBAC so every new screen lives in the right layout.
3. **Phase C** (C1 → C4) – Auth and driver onboarding.
4. **Phase D** (D1 → D4) – Rental and fleet.
5. **Phase E** (E1 → E3) – GPS and maintenance.
6. **Phase F** (F1, F2) – Notifications and admin theme.
7. **Phase G** (G1 → G3) – Polish and performance.

---

## 5. Tech choices (aligned with current stack)

- **React 19 + TypeScript + Vite** – unchanged.
- **MUI (Material-UI)** – keep; extend theme and use MUI + motion together.
- **Motion** – add **Framer Motion** (or React Spring) for layout and component animations.
- **Maps** – add a map library when implementing GPS (e.g. Mapbox GL or Leaflet).
- **No new ad or tracking libraries** – per project rules.

---

## 6. Next action

Start with **Phase A, Step A1**: add the motion library and define shared animation variants, then proceed through A2 → A4. Each step can be implemented and verified before moving to the next, with your explicit approval at each phase.
