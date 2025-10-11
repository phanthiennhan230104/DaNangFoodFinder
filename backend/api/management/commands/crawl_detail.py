import asyncio
from playwright.async_api import async_playwright
from django.core.management.base import BaseCommand
from asgiref.sync import sync_to_async
from api.models import Restaurant, CrawledSource, CrawledData


async def fetch_detail(context, rest):
    try:
        page = await context.new_page()
        await page.goto(rest.detail_url, timeout=40000)
        await asyncio.sleep(4)
        html = await page.content()
        await page.close()
        return {"rest": rest, "html": html}
    except Exception as e:
        print(f"[Error] {rest.name}: {e}")
        return None


class Command(BaseCommand):
    help = "Async crawl restaurant detail pages fast with Playwright"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=10)
        parser.add_argument("--source", type=str, default="Foody")

    def handle(self, *args, **options):
        asyncio.run(self._handle_async(options))

    async def _handle_async(self, options):
        limit = options["limit"]
        source_name = options["source"]

        # ✅ ORM trong async → phải dùng sync_to_async
        source, _ = await sync_to_async(CrawledSource.objects.get_or_create)(
            name=source_name
        )

        restaurants = await sync_to_async(list)(
            Restaurant.objects.filter(
                detail_url__isnull=False, price_range__isnull=True
            )[:limit]
        )

        if not restaurants:
            print("No restaurants found for crawling details.")
            return

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context()
            tasks = [fetch_detail(context, r) for r in restaurants]
            results = await asyncio.gather(*tasks)
            await browser.close()

        valid_results = [r for r in results if r]
        if not valid_results:
            print("No valid results to save.")
            return

        objs = [
            CrawledData(
                source=source,
                url=item["rest"].detail_url,
                raw_html=item["html"],
                linked_restaurant=item["rest"],
                status="Pending",
            )
            for item in valid_results
        ]

        # ✅ ORM gọi trong async → phải bọc bằng sync_to_async
        await sync_to_async(CrawledData.objects.bulk_create)(objs)
        print(f"[OK] Crawled details for {len(objs)} restaurants")
