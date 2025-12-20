import re
import math
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import CrawledData, Restaurant, RestaurantSourceStats

import json
from typing import Optional, Tuple, Dict, Any

FEATURED_MIN_RATING = 4.0
FEATURED_MIN_REVIEWS = 50

MIN_RATING_RG = 4.5
MIN_REVIEW_COUNT = 30

FEATURED_MIN_RATING_RG = 4.7
FEATURED_MIN_REVIEWS_RG = 50

def _safe_text(x) -> Optional[str]:
    if not x:
        return None
    try:
        t = x.get_text(" ", strip=True)
        return t or None
    except Exception:
        return str(x).strip() or None


def extract_rg_from_jsonld(soup: BeautifulSoup) -> Dict[str, Any]:
    """
    Extract restaurant data from JSON-LD structured data.
    Returns dict with: address, opening_hours, cuisine_type, price_range, 
                       rating_value, rating_count, latitude, longitude
    """
    result = {
        "address": None,
        "opening_hours": None,
        "cuisine_type": None,
        "price_range": None,
        "rating_value": None,
        "rating_count": None,
        "latitude": None,
        "longitude": None,
    }
    
    scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    if not scripts:
        return result

    def pick_restaurant_obj(obj):
        if not isinstance(obj, dict):
            return None
        t = obj.get("@type")
        # @type can be "Restaurant" or ["Thing","Restaurant",...]
        if t == "Restaurant" or (isinstance(t, list) and any(x == "Restaurant" for x in t)):
            return obj
        # Some pages wrap in {"@graph":[...]}
        if "@graph" in obj and isinstance(obj["@graph"], list):
            for it in obj["@graph"]:
                r = pick_restaurant_obj(it)
                if r:
                    return r
        return None

    for sc in scripts:
        raw = (sc.string or "").strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue

        # data may be dict or list
        candidates = data if isinstance(data, list) else [data]
        for c in candidates:
            robj = pick_restaurant_obj(c)
            if not robj:
                continue

            # Address
            addr = robj.get("address")
            if isinstance(addr, dict):
                parts = [
                    addr.get("streetAddress"),
                    addr.get("addressLocality"),
                    addr.get("addressRegion"),
                    addr.get("addressCountry"),
                ]
                result["address"] = ", ".join([p for p in parts if p]) or None
            elif isinstance(addr, str):
                result["address"] = addr.strip() or None

            # Opening hours
            oh = robj.get("openingHours") or robj.get("openingHoursSpecification")
            if isinstance(oh, list):
                if oh and isinstance(oh[0], str):
                    # Format: ["Mo 10:00-23:00", "Tu 10:00-23:00", ...]
                    result["opening_hours"] = " | ".join([x.strip() for x in oh if isinstance(x, str) and x.strip()]) or None
                elif oh and isinstance(oh[0], dict):
                    chunks = []
                    for it in oh:
                        if not isinstance(it, dict):
                            continue
                        day = it.get("dayOfWeek")
                        if isinstance(day, list):
                            day = ",".join([str(d).split("/")[-1] for d in day])
                        elif isinstance(day, str):
                            day = day.split("/")[-1]
                        opens = it.get("opens")
                        closes = it.get("closes")
                        if day and opens and closes:
                            chunks.append(f"{day} {opens}-{closes}")
                    result["opening_hours"] = " | ".join(chunks) or None
            elif isinstance(oh, str):
                result["opening_hours"] = oh.strip() or None

            # Cuisine - get all types
            scui = robj.get("servesCuisine")
            if isinstance(scui, list):
                result["cuisine_type"] = ", ".join([x.strip() for x in scui if isinstance(x, str) and x.strip()]) or None
            elif isinstance(scui, str):
                result["cuisine_type"] = scui.strip() or None

            # Price range
            pr = robj.get("priceRange")
            result["price_range"] = pr.strip() if isinstance(pr, str) and pr.strip() else None

            # Rating + votes
            agg = robj.get("aggregateRating")
            if isinstance(agg, dict):
                try:
                    result["rating_value"] = float(agg.get("ratingValue")) if agg.get("ratingValue") is not None else None
                except Exception:
                    pass
                try:
                    rc = agg.get("ratingCount") or agg.get("reviewCount")
                    result["rating_count"] = int(str(rc).replace(",", "")) if rc is not None else None
                except Exception:
                    pass

            # Geo coordinates (latitude, longitude)
            geo = robj.get("geo")
            if isinstance(geo, dict):
                try:
                    result["latitude"] = float(geo.get("latitude")) if geo.get("latitude") is not None else None
                except Exception:
                    pass
                try:
                    result["longitude"] = float(geo.get("longitude")) if geo.get("longitude") is not None else None
                except Exception:
                    pass

            return result

    return result


class Command(BaseCommand):
    help = "Parse RestaurantGuru detail HTML từ CrawledData.linked_restaurant và update Restaurant"

    def handle(self, *args, **options):
        items = CrawledData.objects.filter(
            status=CrawledData.StatusChoices.PENDING,
            linked_restaurant__isnull=False,
            source__name="RestaurantGuru",
        ).select_related("linked_restaurant")

        if not items.exists():
            print("No pending RestaurantGuru detail data found.")
            return

        updated_count = 0
        deleted_count = 0

        with transaction.atomic():
            for item in items:
                rest: Restaurant = item.linked_restaurant

                if not rest or not (rest.name and rest.detail_url):
                    rest_name = rest.name if rest else "Unknown"
                    print(f"[RESTAURANT_FAIL] {rest_name} (Reason: Missing basic information)")
                    if rest:
                        rest.delete()
                    item.delete()
                    deleted_count += 1
                    continue

                soup = BeautifulSoup(item.raw_html or "", "lxml")

                # Extract data from JSON-LD (primary source)
                jsonld_data = extract_rg_from_jsonld(soup)
                
                # Get values from JSON-LD
                address = jsonld_data.get("address")
                opening_hours = jsonld_data.get("opening_hours")
                cuisine_type = jsonld_data.get("cuisine_type")
                price_range = jsonld_data.get("price_range")
                average_rating = jsonld_data.get("rating_value")
                rating_count = jsonld_data.get("rating_count")
                latitude = jsonld_data.get("latitude")
                longitude = jsonld_data.get("longitude")

                # Fallback: Extract from HTML if JSON-LD is missing data
                
                # Fallback for address
                if not address:
                    addr_section = soup.select_one("div.info_address__wrap") or soup.select_one("div.address")
                    if addr_section:
                        address = addr_section.get_text(strip=True)
                        # Remove "Address" prefix if exists
                        address = re.sub(r'^Address\s*', '', address)

                # Fallback for opening hours from HTML
                if not opening_hours:
                    hours_div = soup.select_one("div.work_time")
                    if hours_div:
                        # Try to extract structured hours
                        hours_text = hours_div.get_text(" ", strip=True)
                        hours_text = re.sub(r'^Opening hours\s*', '', hours_text)
                        if hours_text:
                            opening_hours = hours_text[:200]  # Limit length

                # Fallback for cuisine type - try multiple selectors
                if not cuisine_type:
                    # Try different selectors
                    cuisine_selectors = [
                        "div.rest-card__cuisine",
                        "div.cuisine", 
                        "span.cuisine",
                        "[class*='cuisine']",
                    ]
                    for selector in cuisine_selectors:
                        cuisine_section = soup.select_one(selector)
                        if cuisine_section:
                            text = cuisine_section.get_text(strip=True)
                            # Filter out invalid values
                            if text and text.lower() not in ['restaurant', 'restaurants', '']:
                                cuisine_type = text
                                break
                
                # If still no cuisine, try to extract from breadcrumb or categories
                if not cuisine_type:
                    # Look for category links in breadcrumb
                    breadcrumb_links = soup.select('div.breadcrumb a, [class*=breadcrumb] a')
                    for link in breadcrumb_links:
                        text = link.get_text(strip=True)
                        # Skip generic terms
                        if text.lower() not in ['home', 'vietnam', 'da nang', 'restaurants', '']:
                            cuisine_type = text
                            break

                # Extract specific price (Price range per person) from HTML
                # ALWAYS try to get VND format first (override JSON-LD $ symbols)
                specific_price = None
                
                # Method 1: Search entire HTML for VND range pattern (most reliable)
                vnd_pattern = re.search(r'VND\s*[\d,]+\s*[-–]\s*VND\s*[\d,]+', str(soup), re.I)
                if vnd_pattern:
                    specific_price = vnd_pattern.group(0)
                
                # Method 2: Find VND format in span.nowrap
                if not specific_price:
                    nowrap_spans = soup.select("span.nowrap")
                    for span in nowrap_spans:
                        text = span.get_text(strip=True)
                        if re.search(r'VND\s*[\d,]+', text, re.I):
                            specific_price = text
                            break
                
                # Method 3: Find by searching for "Price range per person" text
                if not specific_price:
                    price_range_text = soup.find(string=re.compile(r'Price range per person', re.I))
                    if price_range_text:
                        parent = price_range_text.parent
                        if parent:
                            container = parent.parent
                            if container:
                                vnd_match = re.search(r'VND\s*[\d,]+\s*[-–]\s*VND\s*[\d,]+', container.get_text(), re.I)
                                if vnd_match:
                                    specific_price = vnd_match.group(0)
                
                # Use VND price if found, otherwise check if JSON-LD has actual price (not just $)
                if specific_price:
                    price_range = specific_price
                elif price_range and re.search(r'\d', price_range):
                    # JSON-LD has numbers, keep it
                    pass
                else:
                    # JSON-LD only has $ symbols, set to None (will be filtered out later)
                    price_range = None

                # Fallback for rating
                if not average_rating:
                    rating_section = soup.select_one("span.card__rating-star")
                    if rating_section:
                        try:
                            average_rating = float(rating_section.get_text(strip=True))
                        except (ValueError, AttributeError):
                            pass

                # Fallback for rating count (votes)
                if not rating_count:
                    votes_section = soup.select_one("span.rating-stars__text") or soup.select_one("span.stars__text")
                    if votes_section:
                        try:
                            votes_text = votes_section.get_text(strip=True)
                            votes_match = re.search(r'(\d[\d,]*)', votes_text.replace(',', ''))
                            if votes_match:
                                rating_count = int(votes_match.group(1))
                        except (ValueError, AttributeError):
                            pass

                # RestaurantGuru uses scale 5, no normalization needed
                normalized_rating = average_rating
                review_count = rating_count or 0

                # Calculate quality score using rating (scale 5)
                # Formula: rating * log10(review_count + 1)
                quality_score = 0.0
                if normalized_rating and review_count:
                    try:
                        quality_score = float(normalized_rating) * math.log10(review_count + 1)
                    except (ValueError, TypeError):
                        pass

                # Determine if featured - must have both high rating AND many reviews
                # RestaurantGuru: rating >= 4.7 and reviews >= 100
                is_featured = (
                    normalized_rating is not None and 
                    normalized_rating >= FEATURED_MIN_RATING_RG and 
                    review_count >= FEATURED_MIN_REVIEWS_RG
                )

                # Update RAG context
                rag_parts = [rest.name]
                if address:
                    rag_parts.append(f"Address: {address}")
                if cuisine_type:
                    rag_parts.append(f"Cuisine: {cuisine_type}")
                if price_range:
                    rag_parts.append(f"Price: {price_range}")
                if opening_hours:
                    rag_parts.append(f"Hours: {opening_hours}")
                if average_rating:
                    rag_parts.append(f"Rating: {average_rating}/5")

                rag_context_text = ". ".join(rag_parts) + "."

                # === FILTER: Only keep high quality restaurants ===
                # RestaurantGuru rating must be >= 4.5 (scale 5) and review count >= 30
                if not average_rating or average_rating < MIN_RATING_RG:
                    print(f"[RESTAURANT_FAIL] {rest.name} (Reason: Rating {average_rating}/5 below standard {MIN_RATING_RG})")
                    rest.delete()
                    item.delete()
                    deleted_count += 1
                    continue
                
                if not review_count or review_count < MIN_REVIEW_COUNT:
                    print(f"[RESTAURANT_FAIL] {rest.name} (Reason: Review count {review_count} below standard {MIN_REVIEW_COUNT})")
                    rest.delete()
                    item.delete()
                    deleted_count += 1
                    continue

                # === FILTER: Only keep restaurants with complete information ===
                # Must have opening_hours and price_range information
                if not opening_hours:
                    print(f"[RESTAURANT_FAIL] {rest.name} (Reason: Missing opening hours information)")
                    rest.delete()
                    item.delete()
                    deleted_count += 1
                    continue
                
                if not price_range:
                    print(f"[RESTAURANT_FAIL] {rest.name} (Reason: Missing price range information)")
                    rest.delete()
                    item.delete()
                    deleted_count += 1
                    continue

                # Update restaurant with all extracted data
                if address:
                    rest.address = address
                if opening_hours:
                    rest.opening_hours = opening_hours
                if cuisine_type:
                    rest.cuisine_type = cuisine_type
                if price_range:
                    rest.price_range = price_range
                if normalized_rating:
                    rest.average_rating = normalized_rating
                if latitude:
                    rest.latitude = latitude
                if longitude:
                    rest.longitude = longitude
                rest.quality_score = quality_score
                rest.is_featured = is_featured
                rest.rag_context_text = rag_context_text
                rest.save()

                # Save to RestaurantSourceStats for tracking per-source data
                rg_source = item.source
                RestaurantSourceStats.objects.update_or_create(
                    restaurant=rest,
                    source=rg_source,
                    defaults={
                        "source_url": rest.detail_url,
                        "avg_rating": normalized_rating or 0,  # Store rating (scale 5)
                        "review_count": review_count or 0,
                    }
                )

                item.status = CrawledData.StatusChoices.PROCESSED
                item.save(update_fields=["status"])
                print(f"[RESTAURANT_SUCCESS] {rest.name} (Rating: {average_rating}/5, Reviews: {review_count})")
                updated_count += 1

        if updated_count:
            print(f"[OK] Updated {updated_count} valid RestaurantGuru restaurant details")
        if deleted_count:
            print(f"[DELETED] Removed {deleted_count} invalid or incomplete records")

        print("--- Hoàn tất process_detail_restaurantguru pipeline! ---")
