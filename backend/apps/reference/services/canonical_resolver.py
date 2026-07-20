from django.db.models import Q
from apps.reference.models import City, CityAlias, MetroArea, MetroAreaAlias, Locality, LocalityAlias
from apps.reference.services.geo import haversine_km
from apps.reference.utils import normalize_search_name

def calculate_distance(lat1, lon1, lat2, lon2):
    """Compatibility wrapper around the reference-owned geo implementation."""
    return haversine_km(lat1, lon1, lat2, lon2)

def score_city_candidate(city, country_context=None, state_context=None, coordinates_context=None, metro_context=None):
    """
    Scores a candidate City object based on contextual helper information 
    to resolve search ambiguities.
    """
    score = 0.0
    
    # 1. Country context match
    if country_context:
        # Match by name or code
        cc = country_context.strip().upper()
        if city.country.code == cc or city.country.name.upper() == cc:
            score += 1000.0
            
    # 2. State context match
    if state_context and city.state:
        sc = state_context.strip().lower()
        if city.state.name.lower() == sc or (city.state.code and city.state.code.lower() == sc):
            score += 500.0
            
    # 3. Metro context match
    if metro_context:
        # Check if city is member of the metro area
        mc = metro_context.strip().lower()
        has_membership = city.metro_memberships.filter(
            Q(metro_area__name__iexact=mc) | Q(metro_area__normalized_name=normalize_search_name(mc))
        ).exists()
        if has_membership:
            score += 300.0
            
    # 4. Proximity context match
    if coordinates_context:
        lat, lon = coordinates_context
        dist = calculate_distance(city.latitude, city.longitude, lat, lon)
        if dist != float('inf') and dist < 200.0:  # within 200km
            score += 100.0 / (1.0 + dist)
            
    return score

def resolve_canonical_city(text, country_context=None, state_context=None, coordinates_context=None, metro_context=None):
    """
    Resolves city text to a single canonical City object using exact matching,
    alias definitions, and contextual tie-breakers.
    """
    norm = normalize_search_name(text)
    if not norm:
        return None
        
    candidates = set()
    
    # 1. Direct match on City name
    cities = City.objects.filter(normalized_name=norm)
    for c in cities:
        candidates.add(c)
        
    # 2. Match on CityAlias
    aliases = CityAlias.objects.filter(normalized_alias=norm, verification_status="verified")
    for a in aliases:
        candidates.add(a.city)
        
    if not candidates:
        # Try unverified aliases if no verified matches found
        unverified_aliases = CityAlias.objects.filter(normalized_alias=norm).exclude(verification_status="verified")
        for a in unverified_aliases:
            candidates.add(a.city)
            
    if not candidates:
        return None
        
    if len(candidates) == 1:
        return list(candidates)[0]
        
    # Ambiguity detected: score candidates using context
    scored = []
    for cand in candidates:
        score = score_city_candidate(cand, country_context, state_context, coordinates_context, metro_context)
        scored.append((score, cand))
        
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]

def resolve_canonical_locality(text, city_obj, coordinates_context=None):
    """
    Resolves locality text inside a given City to a single canonical Locality.
    """
    norm = normalize_search_name(text)
    if not norm or not city_obj:
        return None
        
    candidates = set()
    
    # 1. Direct match on Locality
    localities = Locality.objects.filter(city=city_obj, normalized_name=norm)
    for loc in localities:
        candidates.add(loc)
        
    # 2. Match on LocalityAlias
    aliases = LocalityAlias.objects.filter(locality__city=city_obj, normalized_alias=norm)
    for a in aliases:
        candidates.add(a.locality)
        
    if not candidates:
        return None
        
    if len(candidates) == 1:
        return list(candidates)[0]
        
    # Proximity context match for localities
    scored = []
    for cand in candidates:
        score = 0.0
        if coordinates_context:
            lat, lon = coordinates_context
            dist = calculate_distance(cand.latitude, cand.longitude, lat, lon)
            if dist != float('inf'):
                score += 100.0 / (1.0 + dist)
        scored.append((score, cand))
        
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]

def resolve_canonical_metro(text, country_obj):
    """
    Resolves metropolitan name to a single MetroArea.
    """
    norm = normalize_search_name(text)
    if not norm or not country_obj:
        return None
        
    # 1. Direct match
    metro = MetroArea.objects.filter(country=country_obj, normalized_name=norm).first()
    if metro:
        return metro
        
    # 2. Match on MetroAreaAlias
    alias = MetroAreaAlias.objects.filter(metro_area__country=country_obj, normalized_alias=norm).first()
    if alias:
        return alias.metro_area
        
    return None
