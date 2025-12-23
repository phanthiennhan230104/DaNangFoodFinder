import re
import json
import math
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import CrawledData, Restaurant, RestaurantSourceStats, CrawledSource

# Day mapping for opening hours format (same as RestaurantGuru)
DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

# Constants for quality calculation
FEATURED_MIN_RATING = 4.0  # Minimum normalized rating (scale 5) to be featured
FEATURED_MIN_REVIEWS = 50  # Minimum review count to be featured

# === FILTER CRITERIA FOR HIGH QUALITY RESTAURANTS ===
# Foody uses scale 10, so 8.5/10 = 4.25/5
MIN_RATING_FOODY = 8.0  # Minimum rating on Foody (scale 10)
MIN_REVIEW_COUNT = 50   # Minimum review count to be saved

# === FEATURED CRITERIA (stricter) ===
# Foody: rating >= 8.5/10 and reviews >= 50
FEATURED_MIN_RATING_FOODY = 8.0  # Scale 10
FEATURED_MIN_REVIEWS_FOODY = 50

class Command(BaseCommand):
    help = "Parse Foody detail HTML từ CrawledData.linked_restaurant và update Restaurant"

    def handle(self, *args, **options):
        items = CrawledData.objects.filter(
            status=CrawledData.StatusChoices.PENDING,
            linked_restaurant__isnull=False,
            source__name="Foody",
        ).select_related("linked_restaurant")

        if not items.exists():
            print("No pending Foody detail data found.")
            return

        updated_count = 0
        deleted_count = 0

        with transaction.atomic():
            for item in items:
                rest: Restaurant = item.linked_restaurant

                if not rest or not (rest.name and rest.address and rest.detail_url):
                    if rest:
                        rest.delete()
                    item.delete()
                    deleted_count += 1
                    continue

                soup = BeautifulSoup(item.raw_html or "", "lxml")
                script = soup.find("script", text=re.compile("initDataMain"))
                if not script or not script.string:
                    rest.delete()
                    item.delete()
                    deleted_count += 1
                    continue

                match = re.search(
                    r"var initDataMain\s*=\s*({.*});", script.string, re.S
                )
                if not match:
                    rest.delete()
                    item.delete()
                    deleted_count += 1
                    continue

                try:
                    data = json.loads(match.group(1))
                except Exception:
                    rest.delete()
                    item.delete()
                    deleted_count += 1
                    continue

                # Extract price range - format: VND X - VND Y (same as RestaurantGuru)
                price_min = data.get("PriceMin")
                price_max = data.get("PriceMax")
                price_range = None
                if price_min and price_max:
                    price_range = f"VND {int(price_min):,} - VND {int(price_max):,}"

                # Extract opening hours - format: Mo HH:MM-HH:MM | Tu HH:MM-HH:MM | ... (same as RestaurantGuru)
                # Foody stores hours in TimeRanges (simpler) or OpeningTime (complex)
                opening_hours = None
                time_ranges = data.get("TimeRanges", [])
                opening_time = data.get("OpeningTime", [])
                
                # Method 1: Use TimeRanges if available (has StartTime24h/EndTime24h)
                if time_ranges:
                    try:
                        tr = time_ranges[0]
                        start = tr.get("StartTime24h", "").replace(" ", "")
                        end = tr.get("EndTime24h", "").replace(" ", "")
                        if start and end:
                            time_str = f"{start}-{end}"
                            # Apply same hours to all 7 days
                            opening_hours = " | ".join([f"{d} {time_str}" for d in DAY_NAMES])
                    except Exception:
                        pass
                
                # Method 2: Fallback to OpeningTime if TimeRanges not available
                if not opening_hours and opening_time:
                    try:
                        # Foody usually stores only 1 entry, apply to all days
                        ot = opening_time[0]
                        time_open = f"{ot['TimeOpen']['Hours']:02d}:{ot['TimeOpen']['Minutes']:02d}"
                        time_close = f"{ot['TimeClose']['Hours']:02d}:{ot['TimeClose']['Minutes']:02d}"
                        time_str = f"{time_open}-{time_close}"
                        # Apply same hours to all 7 days
                        opening_hours = " | ".join([f"{d} {time_str}" for d in DAY_NAMES])
                    except Exception:
                        opening_hours = None

                # Extract cuisine type
                cuisines = data.get("Cuisines", [])
                cuisine_type = None
                if cuisines:
                    # Get all cuisines, not just first one (same as RestaurantGuru)
                    cuisine_names = []
                    for c in cuisines:
                        name = c.get("NameEn") or c.get("Name")
                        if name:
                            cuisine_names.append(name)
                    cuisine_type = ", ".join(cuisine_names) if cuisine_names else None

                # Extract latitude/longitude from Foody data
                latitude = data.get("Latitude") or data.get("Lat")
                longitude = data.get("Longitude") or data.get("Lng") or data.get("Long")

                # Extract rating - Foody uses scale 10, need to normalize to scale 5
                raw_rating = data.get("AvgRating") or data.get("Rating")
                review_count = data.get("TotalReview") or data.get("ReviewCount") or 0
                
                # Normalize rating from scale 10 to scale 5
                normalized_rating = None
                if raw_rating:
                    try:
                        raw_rating = float(raw_rating)
                        # Foody rating is 0-10, convert to 0-5
                        normalized_rating = raw_rating / 2.0
                    except (ValueError, TypeError):
                        normalized_rating = None

                # Calculate quality score using normalized rating (scale 5)
                # Formula: normalized_rating * log10(review_count + 1)
                quality_score = 0.0
                if normalized_rating and review_count:
                    try:
                        quality_score = normalized_rating * math.log10(int(review_count) + 1)
                    except (ValueError, TypeError):
                        pass

                # Determine if featured - must have both high rating AND many reviews
                # Foody: use original scale 10 rating for comparison
                is_featured = (
                    raw_rating is not None and 
                    raw_rating >= FEATURED_MIN_RATING_FOODY and 
                    review_count >= FEATURED_MIN_REVIEWS_FOODY
                )

                # Validate required fields - check each one separately for detailed logging
                if not opening_hours:
                    print(f"[RESTAURANT_FAIL] {rest.name} (Reason: Missing opening hours information)")
                    rest.delete()
                    item.delete()
                    deleted_count += 1
                    continue
                
                if not cuisine_type:
                    print(f"[RESTAURANT_FAIL] {rest.name} (Reason: Missing cuisine type information)")
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

                # === FILTER: Only keep high quality restaurants ===
                # Foody rating must be >= 8.5 (scale 10) and review count >= 50
                if not raw_rating or raw_rating < MIN_RATING_FOODY:
                    print(f"[RESTAURANT_FAIL] {rest.name} (Reason: Rating {raw_rating}/10 below standard {MIN_RATING_FOODY})")
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

                # Update RAG context (same format as RestaurantGuru)
                rag_parts = [rest.name]
                if rest.address:
                    rag_parts.append(f"Address: {rest.address}")
                if cuisine_type:
                    rag_parts.append(f"Cuisine: {cuisine_type}")
                if price_range:
                    rag_parts.append(f"Price: {price_range}")
                if opening_hours:
                    rag_parts.append(f"Hours: {opening_hours}")
                if normalized_rating:
                    rag_parts.append(f"Rating: {normalized_rating:.1f}/5")
                rag_context_text = ". ".join(rag_parts) + "."

                # Update restaurant
                rest.price_range = price_range
                rest.opening_hours = opening_hours
                rest.cuisine_type = cuisine_type
                if latitude:
                    rest.latitude = float(latitude)
                if longitude:
                    rest.longitude = float(longitude)
                if normalized_rating:
                    rest.average_rating = float(normalized_rating)
                rest.quality_score = quality_score
                rest.is_featured = is_featured
                rest.rag_context_text = rag_context_text
                rest.save()

                # Save to RestaurantSourceStats for tracking per-source data
                foody_source = item.source
                RestaurantSourceStats.objects.update_or_create(
                    restaurant=rest,
                    source=foody_source,
                    defaults={
                        "source_url": rest.detail_url,
                        "avg_rating": normalized_rating or 0,  # Store normalized rating (scale 5)
                        "review_count": review_count or 0,
                    }
                )

                item.status = CrawledData.StatusChoices.PROCESSED
                item.save(update_fields=["status"])
                print(f"[RESTAURANT_SUCCESS] {rest.name} (Rating: {raw_rating}/10, Reviews: {review_count})")
                updated_count += 1

        if updated_count:
            print(f"[OK] Updated {updated_count} valid Foody restaurant details")
        if deleted_count:
            print(f"[DELETED] Removed {deleted_count} invalid or incomplete records")

        # Delete restaurants with missing critical information
        print("\n[CLEANUP] Checking for restaurants with missing critical information...")
        invalid_restaurants = Restaurant.objects.filter(
            Q(opening_hours__isnull=True) | Q(opening_hours="") |
            Q(cuisine_type__isnull=True) | Q(cuisine_type="") |
            Q(cuisine_type__icontains="Restaurant") |
            Q(cuisine_type__icontains="no information") |
            Q(price_range__isnull=True) | Q(price_range="")
        )
        
        cleanup_count = invalid_restaurants.count()
        if cleanup_count > 0:
            print(f"[CLEANUP] Found {cleanup_count} restaurants with missing info:")
            for rest in invalid_restaurants[:10]:  # Show first 10
                missing = []
                if not rest.opening_hours:
                    missing.append("opening_hours")
                if not rest.cuisine_type or "Restaurant" in rest.cuisine_type or "no information" in rest.cuisine_type.lower():
                    missing.append("cuisine_type")
                if not rest.price_range:
                    missing.append("price_range")
                print(f"  - {rest.name}: missing {', '.join(missing)}")
            
            invalid_restaurants.delete()
            print(f"[CLEANUP] Deleted {cleanup_count} incomplete restaurants")

        print("--- Hoàn tất process_detail pipeline! ---")
