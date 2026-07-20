import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reference", "0012_airport_hub_importance_airport_normalized_code_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="city",
            name="coordinate_confidence",
            field=models.FloatField(
                blank=True,
                null=True,
                validators=[
                    django.core.validators.MinValueValidator(0.0),
                    django.core.validators.MaxValueValidator(1.0),
                ],
            ),
        ),
        migrations.AddField(
            model_name="city",
            name="is_publishable",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="metrostation",
            name="latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="metrostation",
            name="longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddIndex(
            model_name="city",
            index=models.Index(fields=["latitude", "longitude"], name="ref_city_lat_lon_idx"),
        ),
        migrations.AddIndex(
            model_name="airport",
            index=models.Index(fields=["latitude", "longitude"], name="ref_airport_lat_lon_idx"),
        ),
        migrations.AddIndex(
            model_name="railwaystation",
            index=models.Index(fields=["latitude", "longitude"], name="ref_rail_lat_lon_idx"),
        ),
        migrations.AddIndex(
            model_name="busstation",
            index=models.Index(fields=["latitude", "longitude"], name="ref_bus_lat_lon_idx"),
        ),
        migrations.AddIndex(
            model_name="hotelmaster",
            index=models.Index(fields=["latitude", "longitude"], name="ref_hotel_lat_lon_idx"),
        ),
        migrations.AddIndex(
            model_name="restaurantmaster",
            index=models.Index(fields=["latitude", "longitude"], name="ref_rest_lat_lon_idx"),
        ),
        migrations.AddIndex(
            model_name="attractionmaster",
            index=models.Index(fields=["latitude", "longitude"], name="ref_attr_lat_lon_idx"),
        ),
        migrations.AddIndex(
            model_name="activitymaster",
            index=models.Index(fields=["latitude", "longitude"], name="ref_act_lat_lon_idx"),
        ),
    ]
