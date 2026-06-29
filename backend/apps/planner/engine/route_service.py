class RouteService:
    """
    Handles geographical routing, distances, and mapping between cities/activities.
    In a real app, this would wrap Google Maps Distance Matrix API.
    """
    @staticmethod
    def get_distance_between_cities(city_a, city_b):
        # Mock distance calculation
        # In reality, use Google Maps API
        return {
            'distance_km': 0,
            'duration_mins': 0,
            'modes': ['flight', 'train']
        }
