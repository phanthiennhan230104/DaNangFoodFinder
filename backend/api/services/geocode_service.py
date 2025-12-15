import requests
import re
from django.conf import settings

# =============================
# CHUẨN HÓA ĐỊA CHỈ ĐÀ NẴNG
# =============================

def normalize_danang_address(address: str) -> str:
    """Chuẩn hóa địa chỉ Đà Nẵng để tăng tỷ lệ tìm tọa độ thành công."""

    if not address or not isinstance(address, str):
        return ""

    addr = address.strip()
    addr = addr.replace("\n", " ").replace("\t", " ")
    addr = re.sub(r"\s{2,}", " ", addr)

    addr_low = addr.lower()

    # --- Thay thế từ viết tắt ---
    replacements = {
        r"\bp\.\s*": "phường ",
        r"\bq\.\s*": "quận ",
        r"\bh\.\s*": "huyện ",
        r"\btp\.\s*": "thành phố ",
        r"\blk\b": "lô ",
        r"\blô\b": "lô ",
        r"\btầng\b": "tầng ",
        r"\bđ\b": "đường ",
        r"\bng\b": "ngõ ",
        r"\bhg\b": "hẻm ",
    }

    for pattern, full in replacements.items():
        addr_low = re.sub(pattern, full, addr_low, flags=re.IGNORECASE)

    # Chuẩn hóa phường / quận bị dính chữ
    addr_low = re.sub(r"(phường|phuong)(?=[a-z])", r"\1 ", addr_low)
    addr_low = re.sub(r"(quận|quan)(?=[a-z])", r"\1 ", addr_low)

    # Chuẩn hóa dấu phẩy
    addr_low = re.sub(r"\s*,\s*", ", ", addr_low)
    addr_low = re.sub(r"\s{2,}", " ", addr_low)

    # BẮT BUỘC thêm "Đà Nẵng" nếu thiếu
    if "đà nẵng" not in addr_low and "da nang" not in addr_low:
        addr_low += ", đà nẵng"

    # BẮT BUỘC thêm Việt Nam
    if "vietnam" not in addr_low and "việt nam" not in addr_low:
        addr_low += ", vietnam"

    # Viết hoa từng ký tự đầu cho đẹp
    addr_final = " ".join([w.capitalize() for w in addr_low.split(" ")])

    return addr_final


# =============================
# API GEOCODING
# =============================

def geocode_address(address: str, restaurant_name: str = "", save_instance=None):
    """Geocode 1 địa chỉ bằng OpenStreetMap (Nominatim)."""

    if not address:
        return None

    # Chuẩn hóa địa chỉ TRƯỚC
    normalized = normalize_danang_address(address)

    print("\n==========================")
    print("📌 GEOCODE REQUEST")
    print("Original:", address)
    print("Normalized:", normalized)
    print("==========================\n")

    url = "https://nominatim.openstreetmap.org/search"

    # Prepare a list of progressively simpler queries to improve match rate
    def make_variants(q: str):
        variants = []
        variants.append(q)

        # try with restaurant name first (more specific)
        if restaurant_name:
            rn = f"{restaurant_name}, {q}"
            if rn not in variants:
                variants.insert(0, rn)

        # remove ward (Phường ...) if present
        v1 = re.sub(r",?\s*(phường|phuong)\s+[\w\s\-]+,?", ", ", q, flags=re.IGNORECASE)
        v1 = re.sub(r"\s{2,}", " ", v1).strip().strip(',')
        if v1 and v1 not in variants:
            variants.append(v1)

        # remove district (Quận ...) if present
        v2 = re.sub(r",?\s*(quận|quan)\s+[\w\s\-]+,?", ", ", q, flags=re.IGNORECASE)
        v2 = re.sub(r"\s{2,}", " ", v2).strip().strip(',')
        if v2 and v2 not in variants:
            variants.append(v2)

        # only street + city
        parts = [p.strip() for p in q.split(',') if p.strip()]
        if parts:
            street = parts[0]
            city_variant = None
            for p in reversed(parts):
                if 'đà nẵng' in p.lower() or 'da nang' in p.lower():
                    city_variant = p
                    break
            if city_variant:
                v3 = f"{street}, {city_variant}"
                if v3 not in variants:
                    variants.append(v3)

        # finally, try without diacritics / simpler english 'Da Nang' form
        v4 = q.replace('Đà Nẵng', 'Da Nang').replace('đà nẵng', 'Da Nang')
        if v4 and v4 not in variants:
            variants.append(v4)

        return variants

    headers = {
        "User-Agent": "DaNangFoodFinder/1.0 (danangfoodfinder.app@gmail.com)",
        "Accept-Language": "vi"
    }

    # Bounding box for Đà Nẵng (lon/lat) to bias/restrict Nominatim results
    # Format for viewbox: left,top,right,bottom (lon_max/lat order)
    # We'll use a slightly generous bbox around central Đà Nẵng
    min_lat = 15.95
    max_lat = 16.20
    min_lon = 108.10
    max_lon = 108.34
    viewbox = f"{min_lon},{max_lat},{max_lon},{min_lat}"

    tried_query = None

    def _maybe_save(result):
        """If a model instance was passed, persist lat/lng to DB."""
        if not save_instance or not result:
            return
        try:
            # local import to avoid potential circular imports at module import time
            from api.models import Restaurant

            lat = result.get("lat")
            lng = result.get("lng")
            if lat is None or lng is None:
                return

            # If a Restaurant instance (or any model instance with id/PK) was given,
            # update it safely using queryset.update to avoid race conditions.
            if hasattr(save_instance, "id") and save_instance.id:
                Restaurant.objects.filter(id=save_instance.id).update(latitude=lat, longitude=lng)
            else:
                # Fallback: try setting attributes and saving
                setattr(save_instance, "latitude", lat)
                setattr(save_instance, "longitude", lng)
                try:
                    save_instance.save()
                except Exception:
                    pass
            print(f"[GEOCODE] ✅ Saved geocode to DB for instance id={getattr(save_instance, 'id', None)}")
        except Exception as e:
            print("[GEOCODE] ⚠️ Failed to save geocode to DB:", e)
    try:
        queries = make_variants(normalized)
        for q in queries:
            params = {
                "format": "json",
                "q": q,
                "addressdetails": 1,
                "limit": 1,
                "countrycodes": "vn",
                "viewbox": viewbox,
                "bounded": 1,
            }
            try:
                res = requests.get(url, params=params, headers=headers, timeout=10)
                data = res.json()
            except Exception as e:
                print("❌ Nominatim request error for query=", q, e)
                data = None

            tried_query = q
            if data:
                result = {
                    "lat": float(data[0]["lat"]),
                    "lng": float(data[0]["lon"]),
                    "display_name": data[0].get("display_name", ""),
                    "confidence": 7,
                    "_queried": q,
                }
                _maybe_save(result)
                if save_instance:
                    result["saved"] = True
                return result

        # nothing found from Nominatim
        print("ℹ️ Nominatim returned no results for queries:", queries)
        data = None

    except Exception as e:
        print("❌ GEOCODE ERROR:", e)
        # if Nominatim failed for any reason, we'll try Google Geocoding as a fallback
        data = None

    # --- Google Geocoding fallback ---
    try:
        google_key = getattr(settings, "GOOGLE_GEOCODE_API_KEY", None)
        if not google_key:
            return None

        g_url = "https://maps.googleapis.com/maps/api/geocode/json"
        g_params = {"address": normalized, "key": google_key, "language": "vi"}
        g_res = requests.get(g_url, params=g_params, timeout=10)
        g_json = g_res.json()

        if g_json.get("status") == "OK" and g_json.get("results"):
            first = g_json["results"][0]
            loc = first["geometry"]["location"]
            display = first.get("formatted_address", "")
            result = {"lat": float(loc["lat"]), "lng": float(loc["lng"]), "display_name": display, "confidence": 6}
            _maybe_save(result)
            if save_instance:
                result["saved"] = True
            return result

        print("ℹ️ Google Geocoding returned status:", g_json.get("status"))
        return None
    except Exception as e:
        print("❌ Google geocode error:", e)
        return None
