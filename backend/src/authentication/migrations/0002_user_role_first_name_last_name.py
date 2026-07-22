# Generated migration for role, first_name, last_name, phone_number, allowed_nav_paths

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[('admin', 'Admin'), ('driver', 'Driver'), ('rental', 'Rental'), ('mechanic', 'Mechanic')],
                db_index=True,
                default='driver',
                help_text='User role for RBAC (admin, driver, rental, mechanic).',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='first_name',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='user',
            name='last_name',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='user',
            name='phone_number',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='user',
            name='allowed_nav_paths',
            field=models.JSONField(
                blank=True,
                help_text='For rental staff: list of nav paths they can access. Main rental has null.',
                null=True,
            ),
        ),
    ]
