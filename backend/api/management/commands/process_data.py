from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from django.db import transaction
from concurrent.futures import ThreadPoolExecutor
from api.models import CrawledData, Restaurant

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
    "container": "div.YHnoF",  # mỗi card nhà hàng
    "name": "a.Lwqic.Cj.b",    # tên nhà hàng
    "address": "span.DsyBj.DxyfE",  # địa chỉ
    "rating": "svg[aria-label*='bubbles']",  # rating
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
        image = (r.select_one(selectors.get("image")) or {}).get("src")
        rating = 0.0

        rating_el = r.select_one(selectors.get("rating"))
        if rating_el:
            try:
                rating = float(rating_el.get_text(strip=True).split()[0])
            except Exception:
                rating = 0.0

        href = (r.select_one(selectors.get("detail_url")) or {}).get("href", "")
        if key == "foody" and href.startswith("/"):
            href = f"https://www.foody.vn{href}"
        elif key == "tripadvisor" and href.startswith("/"):
            href = f"https://www.tripadvisor.com{href}"

        results.append(Restaurant(
            name=name,
            address=address,
            image=image,
            average_rating=rating,
            detail_url=href,
            rag_context_text=f"{name}. Address: {address}."
        ))
    item.status = "Processed"
    item.save()
    return results

class Command(BaseCommand):
    help = "Fast parse list pages with ThreadPool + lxml + bulk_create"
    
    def add_arguments(self, parser):
        parser.add_argument("--source", type=str, default=None, help="Filter source name")
        
    def handle(self, *args, **options):
        qs = CrawledData.objects.filter(status="Pending").select_related("source")[:300]
        all_restaurants = []

        with ThreadPoolExecutor(max_workers=8) as executor:
            for result in executor.map(parse_one, qs):
                all_restaurants.extend(result)

        with transaction.atomic():
            Restaurant.objects.bulk_create(all_restaurants, ignore_conflicts=True)

        self.stdout.write(self.style.SUCCESS(f"[OK] Parsed {len(all_restaurants)} restaurants"))
