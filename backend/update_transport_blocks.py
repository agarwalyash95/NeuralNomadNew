import os
import django
from django.db import transaction

# Setup django environment if run directly
if not hasattr(django, 'apps'):
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    django.setup()

from apps.planner.models import PlannerTrip
from apps.reference.models import Airport, RailwayStation, BusStation, City

def resolve_hub(place_name, t_mode):
    if not place_name:
        return None, None, None
    city = City.objects.filter(name__icontains=place_name).first()
    if not city:
        return place_name, None, None
        
    if t_mode == "flight":
        hub = Airport.objects.filter(city=city).first()
        if hub:
            return f"{hub.name} ({hub.iata_code})", hub.latitude, hub.longitude
    elif t_mode == "train":
        hub = RailwayStation.objects.filter(city=city).first()
        if hub:
            return f"{hub.name} ({hub.code})", city.latitude, city.longitude
    elif t_mode == "bus":
        hub = BusStation.objects.filter(city=city).first()
        if hub:
            return hub.name, city.latitude, city.longitude
            
    return city.name, city.latitude, city.longitude

def update_trips():
    trips = PlannerTrip.objects.all()
    updated_count = 0
    
    with transaction.atomic():
        for trip in trips:
            changed = False
            for day in trip.days:
                city_name = day.get('city', '')
                city_obj = City.objects.filter(name__iexact=city_name).first() if city_name else None
                city_lat = city_obj.latitude if city_obj else None
                city_lng = city_obj.longitude if city_obj else None
                
                for block in day.get('activities', []):
                    category = block.get('category', '').lower()
                    if category in ('flight', 'train', 'bus', 'cab'):
                        metadata = block.get('metadata', {}).get('transport', {})
                        
                        origin = metadata.get('origin', '').strip() if metadata else ''
                        dest = metadata.get('destination', '').strip() if metadata else ''
                        
                        source_name, source_lat, source_lng = resolve_hub(origin, category)
                        dest_name, dest_lat, dest_lng = resolve_hub(dest, category)
                        
                        source_name = source_name or origin
                        dest_name = dest_name or dest or city_name
                        
                        is_arrival = False
                        if city_name:
                            is_arrival = (dest.lower() == city_name.lower() or city_name.lower() in dest.lower())
                            
                        if is_arrival:
                            display_lat = dest_lat
                            display_lng = dest_lng
                            display_name = dest_name
                        else:
                            display_lat = source_lat
                            display_lng = source_lng
                            display_name = source_name
                            
                        if not display_lat:
                            display_lat = city_lat
                            display_lng = city_lng
                            
                        # Update block
                        block['latitude'] = float(display_lat) if display_lat is not None else None
                        block['longitude'] = float(display_lng) if display_lng is not None else None
                        block['location_name'] = display_name or city_name
                        block.setdefault('metadata', {}).setdefault('transport', {}).update({
                            'resolved_source': source_name,
                            'resolved_destination': dest_name
                        })
                        
                        # Fix the title string too!
                        mode = category if category != "cab" else "cab"
                        title = f"{mode.title()} to {dest_name}" if dest_name else f"{mode.title()} transfer"
                        if source_name and dest_name:
                            title = f"{mode.title()}: {source_name} → {dest_name}"
                        block['title'] = title
                        
                        changed = True
                        
            if changed:
                trip.save(update_fields=['days'])
                updated_count += 1
                
    print(f"Updated {updated_count} trips.")

if __name__ == "__main__":
    update_trips()
