import asyncio
from playwright.async_api import async_playwright
from django.core.management.base import BaseCommand
from asgiref.sync import sync_to_async
from api.models import Restaurant, CrawledSource, CrawledData


async def fetch_detail(context, rest):
    try:
        page = await context.new_page()
        await page.goto(rest.detail_url, timeout=60000)
        await asyncio.sleep(4)
        html = await page.content()
        await page.close()
        return {"rest": rest, "html": html}
    except Exception as e:
        print(f"[Error] {rest.name}: {e}")
        return None


class Command(BaseCommand):

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=10)
        parser.add_argument("--source", type=str, default="Foody")

    def handle(self, *args, **options):
        asyncio.run(self._handle_async(options))

    async def _handle_async(self, options):
        limit = options["limit"]
        source_name = options["source"]

        source, _ = await sync_to_async(CrawledSource.objects.get_or_create)(
            name=source_name
        )

        restaurants = await sync_to_async(list)(
            Restaurant.objects.filter(
                detail_url__isnull=False,
                price_range__isnull=True
            )[:limit]
        )

        if not restaurants:
            print("⚠️ No restaurants found for crawling details.")
            return

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                locale="en-US"
            )

            tasks = [fetch_detail(context, r) for r in restaurants]
            results = await asyncio.gather(*tasks)
            await browser.close()

        valid_results = [r for r in results if r and r["html"]]
        if not valid_results:
            print("⚠️ No valid HTML results to save.")
            return

        saved_count = 0
        deleted_count = 0

        for item in valid_results:
            rest = item["rest"]
            html = (item["html"] or "").strip()

            if not html or "<html" not in html.lower() or "captcha-delivery.com" in html:
                await sync_to_async(rest.delete)()
                deleted_count += 1
                continue

            await sync_to_async(CrawledData.objects.filter(url=rest.detail_url).delete)()

            await sync_to_async(CrawledData.objects.create)(
                source=source,
                url=rest.detail_url,
                raw_html=html,
                linked_restaurant=rest,
                status="Pending",
            )

            saved_count += 1

        if saved_count:
            print(f"[OK] Crawled {saved_count} valid detail pages")
        if deleted_count:
            print(f"[DELETED] Removed {deleted_count} invalid or incomplete entries")

        print("--- ✅ Hoàn tất crawl_detail pipeline! ---")
