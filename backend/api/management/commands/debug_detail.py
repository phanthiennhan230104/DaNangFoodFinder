from django.core.management.base import BaseCommand
from api.models import CrawledData


class Command(BaseCommand):
    help = "Export raw HTML of CrawledData (detail page) to foody_detail_debug.html"

    def add_arguments(self, parser):
        parser.add_argument("--source", type=str, default="Foody", help="Tên source (mặc định: Foody)")
        parser.add_argument("--id", type=int, help="ID cụ thể của CrawledData")

    def handle(self, *args, **options):
        source = options["source"]
        obj_id = options.get("id")

        if obj_id:
            item = CrawledData.objects.filter(source__name=source, id=obj_id).first()
        else:
            item = CrawledData.objects.filter(source__name=source).last()

        if not item:
            self.stdout.write(self.style.ERROR(f"Không tìm thấy dữ liệu cho source={source}, id={obj_id}"))
            return

        filename = f"{source.lower()}_detail_debug.html"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(item.raw_html)

        self.stdout.write(self.style.SUCCESS(f"Đã export raw_html ra file: {filename}"))
