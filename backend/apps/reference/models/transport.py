"""
Transport reference models: Airport, Airline, AirportRoute,
RailwayStation, TrainRoute, BusStation, BusRoute, MetroStation
"""

from django.db import models
from apps.common.models import BaseModel


class Airport(BaseModel):
    """Airport master data."""
    city = models.ForeignKey('reference.City', on_delete=models.CASCADE, related_name='airports')
    iata_code = models.CharField(max_length=3, unique=True, help_text="IATA 3-letter code")
    icao_code = models.CharField(max_length=4, blank=True, help_text="ICAO 4-letter code")
    name = models.CharField(max_length=200)
    display_name = models.CharField(max_length=200, blank=True, help_text="User-friendly name")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    timezone = models.CharField(max_length=50, blank=True)
    is_international = models.BooleanField(default=False)

    class Meta:
        ordering = ['iata_code']

    def __str__(self):
        return f"{self.iata_code} — {self.display_name or self.name}"


class Airline(BaseModel):
    """Airline master data."""
    iata_code = models.CharField(max_length=3, unique=True, help_text="IATA 2-letter code")
    name = models.CharField(max_length=150)
    logo_url = models.URLField(max_length=500, blank=True)
    country = models.ForeignKey(
        'reference.Country', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='airlines',
    )
    alliance = models.CharField(
        max_length=30,
        choices=[
            ('star_alliance', 'Star Alliance'),
            ('oneworld', 'Oneworld'),
            ('skyteam', 'SkyTeam'),
            ('none', 'None'),
        ],
        default='none',
    )
    is_low_cost = models.BooleanField(default=False)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.iata_code} — {self.name}"


class AirportRoute(BaseModel):
    """Known flight routes between airports with avg stats."""
    from_airport = models.ForeignKey(Airport, on_delete=models.CASCADE, related_name='routes_from')
    to_airport = models.ForeignKey(Airport, on_delete=models.CASCADE, related_name='routes_to')
    airlines = models.ManyToManyField(Airline, blank=True, related_name='routes')
    avg_duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    avg_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    price_currency = models.CharField(max_length=3, default='INR')
    distance_km = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)

    class Meta:
        unique_together = [('from_airport', 'to_airport')]
        ordering = ['from_airport__iata_code', 'to_airport__iata_code']

    def __str__(self):
        return f"{self.from_airport.iata_code} → {self.to_airport.iata_code}"


class RailwayStation(BaseModel):
    """Railway station master data."""
    city = models.ForeignKey('reference.City', on_delete=models.CASCADE, related_name='railway_stations')
    code = models.CharField(max_length=10, unique=True, help_text="Station code")
    name = models.CharField(max_length=200)
    station_type = models.CharField(
        max_length=20,
        choices=[
            ('junction', 'Junction'),
            ('terminal', 'Terminal'),
            ('halt', 'Halt'),
            ('junction_terminal', 'Junction Terminal'),
        ],
        default='junction',
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    zone = models.CharField(max_length=20, blank=True, help_text="Railway zone")

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f"{self.code} — {self.name}"


class TrainRoute(BaseModel):
    """Known train services between stations."""
    from_station = models.ForeignKey(RailwayStation, on_delete=models.CASCADE, related_name='routes_from')
    to_station = models.ForeignKey(RailwayStation, on_delete=models.CASCADE, related_name='routes_to')
    train_name = models.CharField(max_length=150)
    train_number = models.CharField(max_length=10)
    avg_duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    distance_km = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    days_of_week = models.JSONField(default=list, blank=True, help_text="e.g. ['Mon','Wed','Fri']")
    classes = models.JSONField(default=list, blank=True, help_text="e.g. ['1A','2A','3A','SL']")

    class Meta:
        ordering = ['train_number']

    def __str__(self):
        return f"{self.train_number} {self.train_name}"


class BusStation(BaseModel):
    """Bus station / terminal master data."""
    city = models.ForeignKey('reference.City', on_delete=models.CASCADE, related_name='bus_stations')
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, blank=True)
    station_type = models.CharField(
        max_length=20,
        choices=[
            ('isbt', 'ISBT'),
            ('depot', 'Depot'),
            ('stand', 'Stand'),
            ('terminal', 'Terminal'),
        ],
        default='stand',
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class BusRoute(BaseModel):
    """Known bus services between stations."""
    from_station = models.ForeignKey(BusStation, on_delete=models.CASCADE, related_name='routes_from')
    to_station = models.ForeignKey(BusStation, on_delete=models.CASCADE, related_name='routes_to')
    operator = models.CharField(max_length=150, blank=True)
    avg_duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    distance_km = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    bus_type = models.CharField(
        max_length=30,
        choices=[
            ('ordinary', 'Ordinary'),
            ('express', 'Express'),
            ('deluxe', 'Deluxe'),
            ('ac_sleeper', 'AC Sleeper'),
            ('volvo', 'Volvo'),
            ('semi_sleeper', 'Semi Sleeper'),
        ],
        default='ordinary',
    )

    class Meta:
        ordering = ['from_station__name']

    def __str__(self):
        return f"{self.from_station} → {self.to_station} ({self.operator})"


class MetroStation(BaseModel):
    """Metro / subway station data."""
    city = models.ForeignKey('reference.City', on_delete=models.CASCADE, related_name='metro_stations')
    name = models.CharField(max_length=150)
    line = models.CharField(max_length=100, help_text="Line name e.g. Blue Line")
    line_color = models.CharField(max_length=7, blank=True, help_text="Hex color e.g. #0000FF")
    order = models.PositiveIntegerField(default=0, help_text="Order on the line")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    class Meta:
        ordering = ['city', 'line', 'order']

    def __str__(self):
        return f"{self.name} ({self.line})"
