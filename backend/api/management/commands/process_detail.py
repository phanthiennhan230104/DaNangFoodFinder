import re, json
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from api.models import CrawledData

class Command(BaseCommand):
    help = "Parse Foody details (price, hours, cuisine) from initDataMain"

    def handle(self, *args, **options):
        items = CrawledData.objects.filter(status="Pending", linked_restaurant__isnull=False, source__name="Foody")

        for item in items:
            rest = item.linked_restaurant
            soup = BeautifulSoup(item.raw_html, "lxml")
            script = soup.find("script", text=re.compile("initDataMain"))
            if not script:
                rest.delete(); item.delete(); continue

            match = re.search(r"var initDataMain\s*=\s*({.*});", script.string, re.S)
            if not match:
                rest.delete(); item.delete(); continue

            try:
                data = json.loads(match.group(1))
            except Exception:
                rest.delete(); item.delete(); continue

            price_min, price_max = data.get("PriceMin"), data.get("PriceMax")
            cuisines = data.get("Cuisines", [])
            opening = data.get("OpeningTime", [])

            rest.price_range = f"{int(price_min):,} - {int(price_max):,} đ" if price_min and price_max else None
            if opening:
                ot = opening[0]
                rest.opening_hours = f"{ot['TimeOpen']['Hours']:02d}:{ot['TimeOpen']['Minutes']:02d} - {ot['TimeClose']['Hours']:02d}:{ot['TimeClose']['Minutes']:02d}"
            if cuisines:
                rest.cuisine_type = cuisines[0].get("NameEn") or cuisines[0].get("Name") or "Other"

            rest.save()
            item.status = "Processed"
            item.save()
            self.stdout.write(self.style.SUCCESS(f"[OK] Updated {rest.name}"))
