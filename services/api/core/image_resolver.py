import requests
from typing import Optional
from core.config import settings

GENERIC_TRAVEL_PHOTO = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&auto=format&fit=crop&q=80"

# In-memory TTL cache (dict, per-process) to avoid duplicate search queries during a session
_image_cache = {}

def resolve_destination_photo(name: str, region: Optional[str] = None) -> str:
    """
    Resolves a beautiful travel photo URL for a destination using Unsplash search API.
    If the key is missing, or the request fails, it gracefully falls back to GENERIC_TRAVEL_PHOTO.
    """
    if not settings.UNSPLASH_ACCESS_KEY:
        return GENERIC_TRAVEL_PHOTO
        
    cache_key = (name.lower().strip(), region.lower().strip() if region else None)
    if cache_key in _image_cache:
        return _image_cache[cache_key]
        
    query = f"{name} {region} travel" if region else f"{name} travel"
    try:
        headers = {"Authorization": f"Client-ID {settings.UNSPLASH_ACCESS_KEY}"}
        url = "https://api.unsplash.com/search/photos"
        params = {"query": query, "per_page": 1}
        
        # 3.0 seconds timeout to prevent blocking agent turns on API lags
        resp = requests.get(url, headers=headers, params=params, timeout=3.0)
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            if results:
                photo_url = results[0].get("urls", {}).get("regular")
                if photo_url:
                    # Clean and format URL parameter for responsive loading
                    if "?" in photo_url:
                        photo_url = photo_url.split("?")[0]
                    photo_url = f"{photo_url}?w=800&auto=format&fit=crop&q=80"
                    
                    _image_cache[cache_key] = photo_url
                    print(f"Successfully resolved Unsplash photo for {name}: {photo_url}")
                    return photo_url
            print(f"Unsplash query for '{query}' returned no results. Using generic fallback.")
        else:
            print(f"Unsplash API returned HTTP {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"Error resolving Unsplash photo for {name}: {e}")
        
    return GENERIC_TRAVEL_PHOTO
