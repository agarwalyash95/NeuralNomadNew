from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("reference", "0010_city_image_url")]

    operations = [
        migrations.AddField(
            model_name="railwaystation",
            name="latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="railwaystation",
            name="longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
    ]
