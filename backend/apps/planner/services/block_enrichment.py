from apps.reference.models import Airport, City

def enrich_transport_block(trip, block):
    """
    Given a transport block (flight, train, bus) without originCode/destinationCode,
    try to infer the cities and look up their corresponding Airport or RailwayStation.
    Populates originCode, destinationCode, latitude, and longitude on the block.
    """
    kind = block.get('type') or block.get('category')
    if kind not in ('flight', 'train', 'bus', 'cab', 'taxi'):
        return

    # Check if it already has codes
    if block.get('originCode') and block.get('destinationCode') and block.get('latitude') and block.get('longitude'):
        return

    title = block.get('title') or ''
    subtitle = block.get('subtitle') or ''
    
    parts = (subtitle or title).split(' to ')
    origin_name = None
    dest_name = None
    
    if len(parts) > 1:
        origin_name = parts[0].replace('Flight from ', '').replace('Flight', '').strip()
        dest_name = parts[1].strip()
    else:
        # Fallback to finding context in the trip
        block_day = None
        for day in trip.days or []:
            if any(i.get('id') == block.get('id') for i in day.get('items', []) or []):
                block_day = day
                break
        
        if block_day:
            day_number = block_day.get('day_number')
            current_city = None
            for city in trip.cities or []:
                if any(d.get('day_number') == day_number for d in city.get('days', []) or []):
                    current_city = city
                    break
            
            if current_city:
                origin_name = current_city.get('cityName')
                # Find the next city as the destination
                dest_name = current_city.get('cityName') # default
                cities_list = trip.cities or []
                try:
                    c_idx = next(i for i, c in enumerate(cities_list) if c.get('id') == current_city.get('id'))
                    if c_idx + 1 < len(cities_list):
                        dest_name = cities_list[c_idx + 1].get('cityName')
                except StopIteration:
                    pass

    if not origin_name or not dest_name:
        return

    # Lookup Airports
    if kind == 'flight':
        origin_airport = Airport.objects.filter(city__name__icontains=origin_name).first()
        dest_airport = Airport.objects.filter(city__name__icontains=dest_name).first()
        
        if origin_airport:
            block['originCode'] = origin_airport.iata_code
        if dest_airport:
            block['destinationCode'] = dest_airport.iata_code
            if dest_airport.latitude and dest_airport.longitude:
                block['latitude'] = float(dest_airport.latitude)
                block['longitude'] = float(dest_airport.longitude)
