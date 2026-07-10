from django.db import models

# ==========================================
# GEOGRAPHY
# ==========================================

class Country(models.Model):
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=2, unique=True, help_text="ISO 3166-1 alpha-2 code")
    currency_code = models.CharField(max_length=3, blank=True, null=True)

    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name_plural = "Countries"

class State(models.Model):
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="states")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=10, blank=True, null=True)

    def __str__(self):
        return f"{self.name}, {self.country.code}"

class City(models.Model):
    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name="cities", blank=True, null=True)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="cities")
    name = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    timezone = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"{self.name}, {self.country.code}"
    
    class Meta:
        verbose_name_plural = "Cities"


# ==========================================
# TRANSPORT
# ==========================================

class Airport(models.Model):
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True, related_name="airports")
    name = models.CharField(max_length=255)
    iata_code = models.CharField(max_length=3, unique=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.iata_code})"

class Airline(models.Model):
    name = models.CharField(max_length=255)
    iata_code = models.CharField(max_length=2, unique=True)
    logo_url = models.URLField(blank=True, null=True)

    def __str__(self):
        return self.name

class AirportRoute(models.Model):
    source = models.ForeignKey(Airport, on_delete=models.CASCADE, related_name="departing_routes")
    destination = models.ForeignKey(Airport, on_delete=models.CASCADE, related_name="arriving_routes")
    airline = models.ForeignKey(Airline, on_delete=models.CASCADE)
    duration_mins = models.IntegerField(blank=True, null=True)

    def __str__(self):
        return f"{self.source.iata_code} -> {self.destination.iata_code} ({self.airline.iata_code})"

class RailwayStation(models.Model):
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=10, unique=True)

    def __str__(self):
        return f"{self.name} ({self.code})"

class TrainRoute(models.Model):
    source = models.ForeignKey(RailwayStation, on_delete=models.CASCADE, related_name="departing_trains")
    destination = models.ForeignKey(RailwayStation, on_delete=models.CASCADE, related_name="arriving_trains")
    train_name = models.CharField(max_length=255)
    train_number = models.CharField(max_length=20)
    duration_mins = models.IntegerField(blank=True, null=True)

    def __str__(self):
        return f"{self.train_number} - {self.train_name}"

class BusStation(models.Model):
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

class BusRoute(models.Model):
    source = models.ForeignKey(BusStation, on_delete=models.CASCADE, related_name="departing_buses")
    destination = models.ForeignKey(BusStation, on_delete=models.CASCADE, related_name="arriving_buses")
    operator_name = models.CharField(max_length=255)
    duration_mins = models.IntegerField(blank=True, null=True)

    def __str__(self):
        return f"{self.operator_name}: {self.source} -> {self.destination}"

class MetroStation(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    line_color = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.city.name})"


# ==========================================
# ENTITIES (Hotels, Restaurants, Attractions)
# ==========================================

class HotelMaster(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    place_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    name = models.CharField(max_length=255)
    star_rating = models.DecimalField(max_digits=2, decimal_places=1, blank=True, null=True)
    primary_type = models.CharField(max_length=100, blank=True, null=True)
    price_range = models.CharField(max_length=10, blank=True, null=True)  # e.g. $$, when Google reports one
    user_rating = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)
    user_ratings_total = models.IntegerField(default=0)
    address = models.TextField(blank=True, null=True)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    # Deep Details (Google Places), mirroring RestaurantMaster/AttractionMaster
    parking_options = models.JSONField(default=list, blank=True)
    payment_options = models.JSONField(default=list, blank=True)
    reviews = models.JSONField(default=list, blank=True)
    secondary_images = models.JSONField(default=list, blank=True)
    opening_hours = models.JSONField(default=list, blank=True)

    national_phone_number = models.CharField(max_length=50, blank=True, null=True)
    website_uri = models.URLField(max_length=1000, blank=True, null=True)
    editorial_summary = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class RestaurantMaster(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    place_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    name = models.CharField(max_length=255)
    cuisine = models.CharField(max_length=255, blank=True, null=True)
    primary_type = models.CharField(max_length=100, blank=True, null=True)
    price_range = models.CharField(max_length=10, blank=True, null=True) # e.g. $$
    price_level = models.IntegerField(null=True, blank=True)
    user_rating = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)
    user_ratings_total = models.IntegerField(default=0)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    # Deep Details
    outdoor_seating = models.BooleanField(null=True, blank=True)
    good_for_groups = models.BooleanField(null=True, blank=True)
    allows_dogs = models.BooleanField(null=True, blank=True)
    good_for_children = models.BooleanField(null=True, blank=True)
    menu_for_children = models.BooleanField(null=True, blank=True)
    serves_vegetarian_food = models.BooleanField(null=True, blank=True)
    dine_in = models.BooleanField(null=True, blank=True)
    takeout = models.BooleanField(null=True, blank=True)
    delivery = models.BooleanField(null=True, blank=True)

    parking_options = models.JSONField(default=list, blank=True)
    payment_options = models.JSONField(default=list, blank=True)
    reviews = models.JSONField(default=list, blank=True)
    secondary_images = models.JSONField(default=list, blank=True)
    opening_hours = models.JSONField(default=list, blank=True)
    
    national_phone_number = models.CharField(max_length=50, blank=True, null=True)
    website_uri = models.URLField(max_length=1000, blank=True, null=True)
    editorial_summary = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class AttractionMaster(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    place_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True, null=True) # e.g. Temple, Museum
    primary_type = models.CharField(max_length=100, blank=True, null=True)
    user_rating = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)
    user_ratings_total = models.IntegerField(default=0)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    suggested_duration_mins = models.IntegerField(blank=True, null=True)
    ticket_price_estimate = models.CharField(max_length=100, blank=True, null=True)

    # Deep Details
    good_for_children = models.BooleanField(null=True, blank=True)
    wheelchair_accessible = models.BooleanField(null=True, blank=True)
    good_for_groups = models.BooleanField(null=True, blank=True)

    parking_options = models.JSONField(default=list, blank=True)
    reviews = models.JSONField(default=list, blank=True)
    secondary_images = models.JSONField(default=list, blank=True)
    opening_hours = models.JSONField(default=list, blank=True)

    national_phone_number = models.CharField(max_length=50, blank=True, null=True)
    website_uri = models.URLField(max_length=1000, blank=True, null=True)
    editorial_summary = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class ActivityMaster(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    place_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True, null=True) # e.g. Adventure, Sports
    primary_type = models.CharField(max_length=100, blank=True, null=True)
    price_estimate = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    user_rating = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)
    user_ratings_total = models.IntegerField(default=0)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    suggested_duration = models.CharField(max_length=100, blank=True, null=True)
    difficulty_level = models.CharField(max_length=50, blank=True, null=True)

    # Deep Details
    good_for_children = models.BooleanField(null=True, blank=True)
    good_for_groups = models.BooleanField(null=True, blank=True)
    guided_tour = models.BooleanField(null=True, blank=True)
    equipment_included = models.BooleanField(null=True, blank=True)

    reviews = models.JSONField(default=list, blank=True)
    secondary_images = models.JSONField(default=list, blank=True)
    opening_hours = models.JSONField(default=list, blank=True)

    national_phone_number = models.CharField(max_length=50, blank=True, null=True)
    website_uri = models.URLField(max_length=1000, blank=True, null=True)
    editorial_summary = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


# ==========================================
# UTILITIES
# ==========================================

class VisaRequirement(models.Model):
    nationality = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="visa_requirements")
    destination = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="visa_policies")
    status = models.CharField(max_length=100) # e.g. Visa Required, Visa Free, eVisa
    allowed_stay_days = models.IntegerField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.nationality.code} -> {self.destination.code}: {self.status}"

class Currency(models.Model):
    code = models.CharField(max_length=3, unique=True)
    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=10, blank=True, null=True)
    exchange_rate_to_usd = models.DecimalField(max_digits=20, decimal_places=6, blank=True, null=True)

    def __str__(self):
        return f"{self.code} - {self.name}"
    
    class Meta:
        verbose_name_plural = "Currencies"

class HolidayCalendar(models.Model):
    country = models.ForeignKey(Country, on_delete=models.CASCADE)
    date = models.DateField()
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=50, blank=True, null=True) # e.g. National, Regional

    def __str__(self):
        return f"{self.date}: {self.name} ({self.country.code})"

class WeatherNormals(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    month = models.IntegerField() # 1-12
    avg_temp_c = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    precipitation_mm = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)

    def __str__(self):
        return f"{self.city.name} - Month {self.month}"

class TravelSeason(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    month = models.IntegerField() # 1-12
    season_type = models.CharField(max_length=50) # Peak, Shoulder, Off-Peak

    def __str__(self):
        return f"{self.city.name} - Month {self.month}: {self.season_type}"

class GooglePlaceCache(models.Model):
    place_id = models.CharField(max_length=255, unique=True)
    name = models.CharField(max_length=255)
    data = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class TravelPriceHistory(models.Model):
    """
    Historical and live travel price database (covering the last 3 years).
    Uses ForeignKeys linking to the existing master reference tables.
    """
    service_type = models.CharField(max_length=20, choices=[
        ('flight', 'Flight'),
        ('train', 'Train'),
        ('bus', 'Bus'),
        ('hotel', 'Hotel'),
        ('cab', 'Cab'),
    ], db_index=True)
    
    date = models.DateField(db_index=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    provider = models.CharField(max_length=100, db_index=True)
    code = models.CharField(max_length=50, blank=True, help_text='Flight number, train number, room type, cab type')
    
    # ForeignKeys linking to reference master tables
    airport_route = models.ForeignKey(AirportRoute, on_delete=models.CASCADE, null=True, blank=True, related_name='historical_prices')
    train_route = models.ForeignKey(TrainRoute, on_delete=models.CASCADE, null=True, blank=True, related_name='historical_prices')
    bus_route = models.ForeignKey(BusRoute, on_delete=models.CASCADE, null=True, blank=True, related_name='historical_prices')
    hotel = models.ForeignKey(HotelMaster, on_delete=models.CASCADE, null=True, blank=True, related_name='historical_prices')
    city = models.ForeignKey(City, on_delete=models.CASCADE, null=True, blank=True, related_name='cab_historical_prices')
    
    details = models.JSONField(default=dict, blank=True, help_text='Extra details like class breakdown, seat availability, duration, departure/arrival times')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date', 'service_type', 'provider']
        verbose_name = 'Travel Price History'
        verbose_name_plural = 'Travel Price History'
        indexes = [
            models.Index(fields=['service_type', 'date']),
        ]

    def __str__(self):
        return f"[{self.service_type.upper()}] {self.provider} on {self.date}: INR {self.price}"

