from django.db import migrations, models


def approved_to_running(apps, schema_editor):
    """Existing 'approved' bookings are active rentals — move them to the new
    'running' status so they show up as running trips."""
    RentalRequest = apps.get_model('operations', 'RentalRequest')
    RentalRequest.objects.filter(status='approved').update(status='running')


def running_to_approved(apps, schema_editor):
    RentalRequest = apps.get_model('operations', 'RentalRequest')
    RentalRequest.objects.filter(status='running').update(status='approved')


class Migration(migrations.Migration):

    dependencies = [
        ('operations', '0015_alter_vehicle_insurance_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='rentalrequest',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('approved', 'Approved'),
                    ('running', 'Running'),
                    ('rejected', 'Rejected'),
                    ('cancelled', 'Cancelled'),
                    ('info_requested', 'Information requested'),
                    ('completed', 'Completed'),
                ],
                db_index=True,
                default='pending',
                max_length=20,
            ),
        ),
        migrations.RunPython(approved_to_running, running_to_approved),
    ]
