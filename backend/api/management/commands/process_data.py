import re
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from django.db import transaction
from concurrent.futures import ThreadPoolExecutor
from api.models import CrawledData, Restaurant
from django.db.models import Q

SELECTORS = {
    "foody": {
        "container": "div.row-item",
        "name": "h2 a",
        "address": "div.address span",
        "rating": "div.point",
        "image": "img",
        "detail_url": "h2 a",
    },
    "restaurantguru": {
        "container": "div.restaurant_row",
        "name": "h3.item__title",
        "address": "span.rest_address",
        "rating": "span.card__rating-star",
        "votes": "span.rating-stars__text",
        "image": "img.restaurant-img",
        "detail_url": "a.title_url",
        "cuisine": "span.rest-card__type",
        "price": "span.cost",
    },
}


def parse_one(item: CrawledData):
    key = item.source.name.lower()
    selectors = SELECTORS.get(key)
    if not selectors:
        item.status = CrawledData.StatusChoices.PROCESSED
        item.save(update_fields=["status"])
        return []

    soup = BeautifulSoup(item.raw_html or "", "lxml")
    restaurants = soup.select(selectors["container"])
    results = []

    for r in restaurants:
        name_el = r.select_one(selectors.get("name"))
        
        # For RestaurantGuru, address might not be in list page
        if key == "restaurantguru":
            if not name_el:
                continue
            name = name_el.get_text(strip=True)
            # Remove numbering like "1. " from name
            name = re.sub(r'^\d+\.\s*', '', name)
            address = "Da Nang, Vietnam"  # Default address, will be updated from detail page
        else:
            # For Foody and others, require address
            addr_el = r.select_one(selectors.get("address"))
            if not name_el or not addr_el:
                continue
            name = name_el.get_text(strip=True)
            address = addr_el.get_text(strip=True)
        
        if not name:
            continue

        img_el = r.select_one(selectors.get("image"))
        # For RestaurantGuru, try data-src first
        image = None
        if img_el:
            image = img_el.get("data-src") or img_el.get("src")

        rating = 0.0
        rating_el = r.select_one(selectors.get("rating"))
        if rating_el:
            try:
                rating = float(rating_el.get_text(strip=True).split()[0])
            except Exception:
                rating = 0.0

        href_el = r.select_one(selectors.get("detail_url"))
        href = href_el.get("href") if href_el and href_el.has_attr("href") else None
        if not href:
            continue

        # Handle relative URLs
        if key == "foody" and href.startswith("/"):
            href = f"https://www.foody.vn{href}"
        elif key == "restaurantguru" and href.startswith("/"):
            href = f"https://restaurantguru.com{href}"

        if not (name and href):
            continue

        # Skip if already exists
        if Restaurant.objects.filter(detail_url=href).exists():
            continue

        # Extract cuisine and price for RestaurantGuru
        cuisine = None
        price_range = None
        
        if key == "restaurantguru":
            cuisine_el = r.select_one(selectors.get("cuisine"))
            if cuisine_el:
                cuisine_text = cuisine_el.get_text(strip=True)
                # Extract first cuisine type
                cuisine = cuisine_text.split(',')[0].strip()
            
            price_el = r.select_one(selectors.get("price"))
            if price_el:
                price_range = price_el.get_text(strip=True)
                price_range = price_el.get_text(strip=True)

        results.append(
            Restaurant(
                name=name,
                address=address,
                image=image,
                average_rating=rating,
                detail_url=href,
                cuisine_type=cuisine,
                price_range=price_range,
                rag_context_text=f"{name}. Address: {address}.",
            )
        )

    item.status = CrawledData.StatusChoices.PROCESSED
    item.save(update_fields=["status"])
    return results


class Command(BaseCommand):
    help = "Parse CrawledData (list page) thành Restaurant (Foody)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--source", type=str, default=None, help="Filter by source name (optional)"
        )

    def handle(self, *args, **options):
        source_name = options.get("source")
        qs = CrawledData.objects.filter(
            status=CrawledData.StatusChoices.PENDING
        ).select_related("source")

        if source_name:
            qs = qs.filter(source__name__iexact=source_name)

        qs = qs[:300]

        all_restaurants = []
        with ThreadPoolExecutor(max_workers=8) as executor:
            for result in executor.map(parse_one, qs):
                all_restaurants.extend(result)

        with transaction.atomic():
            Restaurant.objects.bulk_create(all_restaurants, ignore_conflicts=True)

        invalid_qs = Restaurant.objects.filter(
            Q(name__isnull=True)
            | Q(name="")
            | Q(address__isnull=True)
            | Q(address="")
            | Q(detail_url__isnull=True)
            | Q(detail_url="")
        )
        deleted_count = invalid_qs.count()
        if deleted_count:
            invalid_qs.delete()

        self.stdout.write(
            self.style.SUCCESS(f"[OK] Saved {len(all_restaurants)} valid restaurants")
        )
        if deleted_count:
            self.stdout.write(
                self.style.WARNING(
                    f"[DELETED] Removed {deleted_count} invalid or incomplete records"
                )
            )
        self.stdout.write(self.style.SUCCESS("--- Done process_data pipeline! ---"))
