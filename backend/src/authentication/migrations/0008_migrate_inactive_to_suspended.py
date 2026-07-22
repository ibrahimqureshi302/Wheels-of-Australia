from django.db import migrations


DEFAULT_REASON = 'Your account has been deactivated by an administrator.'


def inactive_to_suspended(apps, schema_editor):
    """Existing accounts were 'deactivated' via is_active=False (which blocked
    login). The new model lets them log in but locks them to their profile, so
    convert them: is_active=True + is_suspended=True with a default message.
    Superusers are left untouched."""
    User = apps.get_model('authentication', 'User')
    for user in User.objects.filter(is_active=False, is_superuser=False):
        user.is_active = True
        user.is_suspended = True
        if not (user.suspension_reason or '').strip():
            user.suspension_reason = DEFAULT_REASON
        user.save(update_fields=['is_active', 'is_suspended', 'suspension_reason'])


def suspended_to_inactive(apps, schema_editor):
    """Reverse: a suspended account becomes is_active=False again."""
    User = apps.get_model('authentication', 'User')
    User.objects.filter(is_suspended=True).update(is_active=False, is_suspended=False)


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0007_user_is_suspended_user_suspension_reason'),
    ]

    operations = [
        migrations.RunPython(inactive_to_suspended, suspended_to_inactive),
    ]
