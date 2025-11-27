import re
import json
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import CrawledData, Restaurant

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

                price_min = data.get("PriceMin")
                price_max = data.get("PriceMax")
                cuisines = data.get("Cuisines", [])
                opening = data.get("OpeningTime", [])

                rest.price_range = (
                    f"{int(price_min):,} - {int(price_max):,} đ"
                    if price_min and price_max
                    else None
                )

                rest.opening_hours = None
                if opening:
                    try:
                        ot = opening[0]
                        rest.opening_hours = (
                            f"{ot['TimeOpen']['Hours']:02d}:{ot['TimeOpen']['Minutes']:02d} - "
                            f"{ot['TimeClose']['Hours']:02d}:{ot['TimeClose']['Minutes']:02d}"
                        )
                    except Exception:
                        rest.opening_hours = None

                rest.cuisine_type = None
                if cuisines:
                    c0 = cuisines[0]
                    rest.cuisine_type = (
                        c0.get("NameEn") or c0.get("Name") or "Other"
                    )

                if not (rest.price_range and rest.opening_hours and rest.cuisine_type):
                    rest.delete()
                    item.delete()
                    deleted_count += 1
                    continue

                rest.save()
                item.status = CrawledData.StatusChoices.PROCESSED
                item.save(update_fields=["status"])
                updated_count += 1

        if updated_count:
            print(f"[OK] Updated {updated_count} valid Foody restaurant details")
        if deleted_count:
            print(f"[DELETED] Removed {deleted_count} invalid or incomplete records")

        print("--- Hoàn tất process_detail pipeline! ---")
