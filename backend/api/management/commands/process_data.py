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
    "tripadvisor": {
        "container": "div.YHnoF",
        "name": "a.Lwqic.Cj.b",
        "address": "span.DsyBj.DxyfE",
        "rating": "svg[aria-label*='bubbles']",
        "image": "img",
        "detail_url": "a.Lwqic.Cj.b",
    },
}


def parse_one(item):
    key = item.source.name.lower()
    selectors = SELECTORS.get(key)
    if not selectors:
        return []

    soup = BeautifulSoup(item.raw_html, "lxml")
    restaurants = soup.select(selectors["container"])
    results = []

    for r in restaurants:
        name_el = r.select_one(selectors.get("name"))
        addr_el = r.select_one(selectors.get("address"))
        if not name_el or not addr_el:
            continue

        name = name_el.get_text(strip=True)
        address = addr_el.get_text(strip=True)
        if not name or not address:
            continue

        img_el = r.select_one(selectors.get("image"))
        image = img_el.get("src") if img_el and img_el.has_attr("src") else None

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

        if key == "foody" and href.startswith("/"):
            href = f"https://www.foody.vn{href}"
        elif key == "tripadvisor" and href.startswith("/"):
            href = f"https://www.tripadvisor.com{href}"

        if not (name and address and href):
            continue

        if Restaurant.objects.filter(Q(name=name, address=address) | Q(detail_url=href)).exists():
            continue

        results.append(
            Restaurant(
                name=name,
                address=address,
                image=image,
                average_rating=rating,
                detail_url=href,
                rag_context_text=f"{name}. Address: {address}.",
            )
        )

    item.status = "Processed"
    item.save()
    return results


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("--source", type=str, default=None, help="Filter source name")

    def handle(self, *args, **options):
        source_name = options.get("source")
        qs = CrawledData.objects.filter(status="Pending").select_related("source")
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
            self.style.SUCCESS(
                f"[OK] Saved {len(all_restaurants)} valid restaurants"
            )
        )
        if deleted_count:
            self.stdout.write(
                self.style.WARNING(
                    f"[DELETED] Removed {deleted_count} invalid or incomplete records"
                )
            )
        self.stdout.write(self.style.SUCCESS("--- ✅ Done process_data pipeline! ---"))
