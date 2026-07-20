from django.contrib.contenttypes.models import ContentType
from django.test import TestCase
from rest_framework.test import APIClient

from apps.knowledge.models import LocalTip
from apps.reference.models import City, Country, TravelSeason, WeatherNormals


class CityBriefingApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        country = Country.objects.create(name="Japan", code="JP")
        self.kyoto = City.objects.create(name="Kyoto", country=country, latitude=35.0116, longitude=135.7681)

        WeatherNormals.objects.create(
            city=self.kyoto, month=4, avg_temp_c=15.5, precipitation_mm=120.3,
            feels_like_bucket="mild", packing_note="Light layers, a rain shell.",
        )
        TravelSeason.objects.create(
            city=self.kyoto, month=4, season_type="Peak",
            natural_phenomena=[{"name": "cherry blossom", "typical_window": ["03-25", "04-10"], "year_variability_days": 7}],
        )

        content_type = ContentType.objects.get_for_model(City)
        LocalTip.objects.create(
            content_type=content_type, object_id=str(self.kyoto.pk),
            category="etiquette", tip_text="Remove shoes before entering a temple hall.",
            source="llm-researched", confidence="suggested", needs_human_review=False,
        )
        # Unreviewed — must never surface.
        LocalTip.objects.create(
            content_type=content_type, object_id=str(self.kyoto.pk),
            category="scam_warning", tip_text="Unreviewed scam claim.",
            source="llm-researched", confidence="suggested", needs_human_review=True,
        )

    def test_requires_name(self):
        response = self.client.get("/api/reference/city-briefing/")
        self.assertEqual(response.status_code, 400)

    def test_unknown_city_404s(self):
        response = self.client.get("/api/reference/city-briefing/", {"name": "Nowhereville"})
        self.assertEqual(response.status_code, 404)

    def test_returns_weather_season_and_reviewed_tips_only(self):
        response = self.client.get("/api/reference/city-briefing/", {"name": "kyoto", "month": "4"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["city"], "Kyoto")
        self.assertEqual(data["weather"]["avg_temp_c"], 15.5)
        self.assertEqual(data["weather"]["packing_note"], "Light layers, a rain shell.")
        self.assertEqual(data["season"]["season_type"], "Peak")
        self.assertEqual(len(data["local_tips"]), 1)
        self.assertEqual(data["local_tips"][0]["category"], "etiquette")

    def test_omits_weather_and_season_without_month(self):
        response = self.client.get("/api/reference/city-briefing/", {"name": "Kyoto"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsNone(data["weather"])
        self.assertIsNone(data["season"])
        # Tips aren't month-scoped — still present.
        self.assertEqual(len(data["local_tips"]), 1)

    def test_no_weather_on_file_for_month_returns_null_not_placeholder(self):
        response = self.client.get("/api/reference/city-briefing/", {"name": "Kyoto", "month": "11"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsNone(data["weather"])
        self.assertIsNone(data["season"])
