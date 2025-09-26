# backend/api/management/commands/scrape_raw_data.py
from django.core.management.base import BaseCommand
from api.models import CrawledSource, CrawledData
import requests

class Command(BaseCommand):
    help = "Cào dữ liệu từ TripAdvisor Đà Nẵng và lưu vào CrawledData"

    def handle(self, *args, **kwargs):
        source, _ = CrawledSource.objects.get_or_create(
            name="TripAdvisor", 
            base_url="https://www.tripadvisor.com/Restaurants-g298085-Da_Nang.html"
        )
        url = source.base_url
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0",
            "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://www.google.com/"
        }

        try:
            page = requests.get(url, headers=headers, timeout=20)
            page.raise_for_status()
            html = page.text

            CrawledData.objects.create(
                source=source,
                url=url,
                raw_html=html,
                status='Pending'
            )
            self.stdout.write(self.style.SUCCESS("Đã cào và lưu HTML từ TripAdvisor thành công!"))
        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.ERROR(f"Lỗi khi tải trang: {e}"))
