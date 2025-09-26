# backend/api/management/commands/process_restaurants.py
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from api.models import CrawledData, Restaurant

class Command(BaseCommand):
    help = "Xử lý dữ liệu HTML từ CrawledData (TripAdvisor) và lưu vào Restaurant"

    def handle(self, *args, **kwargs):
        pending_items = CrawledData.objects.filter(status='Pending')
        for item in pending_items:
            soup = BeautifulSoup(item.raw_html, "html.parser")
            restaurant_items = soup.find_all("div", class_="RfBGI")  # class khác nhau theo site

            count = 0
            for r in restaurant_items:
                name_el = r.find("a", class_="Lwqic")
                addr_el = r.find("span", class_="EATyf")

                if not name_el or not addr_el:
                    continue

                name = name_el.text.strip()
                address = addr_el.text.strip()

                Restaurant.objects.update_or_create(
                    name=name,
                    address=address,
                    defaults={
                        "cuisine_type": "Ẩm thực",
                        "average_rating": 4.0
                    }
                )
                count += 1

            item.status = "Processed"
            item.save()
            self.stdout.write(self.style.SUCCESS(f"Processed item {item.id}, added {count} restaurants"))
