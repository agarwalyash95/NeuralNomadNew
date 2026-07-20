from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("planner", "0014_plannertrip_scorecard"),
    ]

    operations = [
        migrations.AddField(
            model_name="plannerworkspace",
            name="revision",
            field=models.PositiveBigIntegerField(default=0),
        ),
    ]
