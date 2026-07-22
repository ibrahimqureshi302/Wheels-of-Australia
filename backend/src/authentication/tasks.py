"""
Celery tasks for authentication app.
"""

from celery import shared_task
from celery.utils.log import get_task_logger
from django.core.mail import send_mail
from django.conf import settings

logger = get_task_logger(__name__)


@shared_task
def send_welcome_email(user_email):
    """
    Send a welcome email to newly registered users.
    """
    try:
        subject = 'Welcome to our platform!'
        message = f'Hello {user_email},\n\nWelcome to our platform! Thank you for registering.'
        from_email = settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@example.com'
        
        send_mail(
            subject,
            message,
            from_email,
            [user_email],
            fail_silently=False,
        )
        logger.info(f'Welcome email sent to {user_email}')
        return f'Welcome email sent to {user_email}'
    except Exception as e:
        logger.error(f'Failed to send welcome email to {user_email}: {str(e)}')
        raise


def _from_email():
    return getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'noreply@example.com'


@shared_task
def send_registration_approved_email(email, password, role, login_url=''):
    """
    Email a newly-approved user their generated login credentials.
    Safe to call synchronously (no .delay) in the admin action.
    """
    role_label = role.capitalize()
    subject = 'Your Wheels of Australia account has been approved'
    lines = [
        f'Hello,',
        '',
        f'Good news — your {role_label} registration has been approved.',
        'You can now log in to Wheels of Australia with the credentials below:',
        '',
        f'    Email:    {email}',
        f'    Password: {password}',
        '',
        'For your security, please change this password after your first login.',
    ]
    if login_url:
        lines += ['', f'Log in here: {login_url}']
    lines += ['', 'Thank you,', 'The Wheels of Australia Team']
    try:
        send_mail(subject, '\n'.join(lines), _from_email(), [email], fail_silently=False)
        logger.info(f'Approval email sent to {email}')
        return f'Approval email sent to {email}'
    except Exception as e:
        logger.error(f'Failed to send approval email to {email}: {str(e)}')
        raise


@shared_task
def send_registration_rejected_email(email, role, reason=''):
    """Email a user that their registration was rejected (optional reason)."""
    role_label = role.capitalize()
    subject = 'Update on your Wheels of Australia registration'
    lines = [
        'Hello,',
        '',
        f'Thank you for your interest in Wheels of Australia. After review, we are '
        f'unable to approve your {role_label} registration at this time.',
    ]
    if reason:
        lines += ['', f'Reason: {reason}']
    lines += ['', 'You are welcome to re-apply with updated details.', '',
              'Thank you,', 'The Wheels of Australia Team']
    try:
        send_mail(subject, '\n'.join(lines), _from_email(), [email], fail_silently=False)
        logger.info(f'Rejection email sent to {email}')
        return f'Rejection email sent to {email}'
    except Exception as e:
        logger.error(f'Failed to send rejection email to {email}: {str(e)}')
        raise


@shared_task
def cleanup_inactive_users():
    """
    Periodic task to log inactive users count.
    This is an example task that could be expanded to actually clean up old accounts.
    """
    from .models import User
    
    inactive_count = User.objects.filter(is_suspended=True).count()
    logger.info(f'Found {inactive_count} inactive users')
    return f'Found {inactive_count} inactive users'


@shared_task
def generate_user_stats():
    """
    Periodic task to generate user statistics.
    """
    from .models import User
    from django.utils import timezone
    from datetime import timedelta
    
    total_users = User.objects.count()
    active_users = User.objects.filter(is_active=True).count()
    
    # Users registered in the last 30 days
    thirty_days_ago = timezone.now() - timedelta(days=30)
    recent_users = User.objects.filter(date_joined__gte=thirty_days_ago).count()
    
    stats = {
        'total_users': total_users,
        'active_users': active_users,
        'recent_users': recent_users,
        'generated_at': timezone.now().isoformat()
    }
    
    logger.info(f'User stats: {stats}')
    return stats
