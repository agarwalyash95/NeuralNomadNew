from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("planner", "0015_plannerworkspace_revision")]
    operations = [
        migrations.AddField(
            model_name="plannerchatmessage", name="turn_id",
            field=models.CharField(blank=True, max_length=64, null=True, unique=True),
        ),
    ]
