import requests
import datetime
from apps.reference.models import City, WeatherNormals

WMO_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
}

def fetch_live_weather(destination_text, start_date=None):
    """
    Fetches real-time/forecast weather from Open-Meteo API using city coordinates.
    Falls back to climate normals if coordinates are missing, API fails, or date is > 14 days out.
    """
    if not destination_text:
        return {
            "avg_temp_c": None,
            "precipitation_mm": None,
            "feels_like_bucket": "mild",
            "condition": "Unknown",
            "provenance": "unknown",
            "note": "No destination selected yet."
        }

    # Clean destination text
    city_name = destination_text.strip().split(",")[0]
    city_obj = City.objects.filter(name__iexact=city_name).first()
    
    # If city_obj is missing, try a broader search
    if not city_obj:
        city_obj = City.objects.filter(name__icontains=city_name).first()

    # Determine date object
    date_obj = None
    if start_date:
        if isinstance(start_date, (datetime.date, datetime.datetime)):
            date_obj = start_date
        elif isinstance(start_date, str):
            try:
                date_obj = datetime.date.fromisoformat(start_date)
            except ValueError:
                pass

    use_live = False
    if date_obj:
        today = datetime.date.today()
        # If the start_date is within next 13 days, we can get an accurate daily/current forecast
        days_out = (date_obj - today).days
        if 0 <= days_out <= 13:
            use_live = True

    # If coordinates are available and we should fetch live forecast
    if city_obj and city_obj.latitude and city_obj.longitude:
        lat = float(city_obj.latitude)
        lon = float(city_obj.longitude)
        
        if use_live:
            try:
                # Fetch live forecast
                url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code&timezone=auto"
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    current = data.get("current", {})
                    
                    avg_temp = current.get("temperature_2m")
                    feels_like = current.get("apparent_temperature")
                    precip = current.get("precipitation")
                    code = current.get("weather_code", 0)
                    condition = WMO_CODES.get(code, "Clear")
                    
                    # Compute appropriate bucket
                    if feels_like is not None:
                        if feels_like > 28:
                            bucket = "hot"
                        elif feels_like < 15:
                            bucket = "cold"
                        else:
                            bucket = "mild"
                    else:
                        bucket = "mild"

                    return {
                        "avg_temp_c": avg_temp,
                        "precipitation_mm": precip,
                        "feels_like_bucket": bucket,
                        "condition": condition,
                        "provenance": "live",
                        "note": f"Live weather forecast for {destination_text}: {avg_temp}°C (Feels like {feels_like}°C, {condition})."
                    }
            except Exception as e:
                print(f"[WeatherService] Live Open-Meteo call failed: {e}")

    # Fallback 1: Database Climate Normals
    travel_month = date_obj.month if date_obj else datetime.date.today().month
    if city_obj:
        normal = WeatherNormals.objects.filter(city=city_obj, month=travel_month).first()
        if normal:
            avg_temp = float(normal.avg_temp_c) if normal.avg_temp_c is not None else None
            precip = float(normal.precipitation_mm) if normal.precipitation_mm is not None else None
            return {
                "avg_temp_c": avg_temp,
                "precipitation_mm": precip,
                "feels_like_bucket": normal.feels_like_bucket,
                "condition": "Pleasant" if normal.feels_like_bucket == "mild" else ("Warm" if normal.feels_like_bucket == "hot" else "Chilly"),
                "provenance": "estimated",
                "note": f"Historical climate averages for {destination_text} in {datetime.date(2000, travel_month, 1).strftime('%B')}."
            }

    # Fallback 2: Absolute default baselines (no crashes)
    return {
        "avg_temp_c": 22.0,
        "precipitation_mm": 5.0,
        "feels_like_bucket": "mild",
        "condition": "Pleasant",
        "provenance": "estimated",
        "note": f"Baseline climate estimates for {destination_text}."
    }
