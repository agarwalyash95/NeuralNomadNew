from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("reference", "0009_reference_provenance")]
    operations = [
        migrations.AddField(
            model_name="city",
            name="image_url",
            field=models.URLField(blank=True, max_length=1000, null=True),
        ),
    ]
