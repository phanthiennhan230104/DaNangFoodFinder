from django.core.management.base import BaseCommand
from api.models import Restaurant
from api.services.geocode_service import geocode_address
import time

class Command(BaseCommand):
    help = "Geocode all restaurants that have no latitude/longitude"

    def handle(self, *args, **kwargs):
        items = Restaurant.objects.filter(latitude__isnull=True).order_by("id")
        total = items.count()

        if total == 0:
            self.stdout.write(self.style.SUCCESS("All restaurants already have coordinates."))
            return

        self.stdout.write(self.style.WARNING(f"Found {total} restaurants missing coordinates."))

        for r in items:
            self.stdout.write(f"Geocoding: {r.id} - {r.name}")

            result = geocode_address(r.address, r.name)

            if not result:
                self.stdout.write(self.style.ERROR(f"❌ Failed geocoding {r.address}"))
                continue

            r.latitude = result["lat"]
            r.longitude = result["lng"]
            r.save()

            self.stdout.write(self.style.SUCCESS(
                f"✓ Saved coordinates: ({r.latitude}, {r.longitude})"
            ))

            time.sleep(1)
