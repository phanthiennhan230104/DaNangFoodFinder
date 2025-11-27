import requests

def get_route(start, end):
    """
    start = { 'lat': .., 'lng': .. }
    end   = { 'lat': .., 'lng': .. }
    OSRM requires order: lng,lat
    """

    try:
        start_lnglat = f"{start['lng']},{start['lat']}"
        end_lnglat = f"{end['lng']},{end['lat']}"

        url = (
            "https://router.project-osrm.org/route/v1/driving/"
            f"{start_lnglat};{end_lnglat}"
            "?overview=full&geometries=geojson"
        )

        res = requests.get(url, timeout=10)

        if res.status_code != 200:
            return None

        data = res.json()

        if "routes" not in data or len(data["routes"]) == 0:
            return None

        geometry = data["routes"][0]["geometry"]["coordinates"]

        # Convert OSRM [lng, lat] → Leaflet [lat, lng]
        path = [[point[1], point[0]] for point in geometry]

        return path

    except Exception as e:
        print("Route error:", e)
        return None
