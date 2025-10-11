import asyncio
import aiohttp
from asgiref.sync import sync_to_async
from django.core.management.base import BaseCommand
from api.models import CrawledSource, CrawledData
from playwright.async_api import async_playwright

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
}


# ========== Hàm crawl bằng aiohttp (Foody, v.v.) ==========
async def fetch_html(session, url):
    try:
        async with session.get(url, headers=HEADERS, timeout=30) as resp:
            html = await resp.text()
            return {"url": url, "html": html}
    except Exception as e:
        print(f"[Error aiohttp] {url}: {e}")
        return None


# ========== Hàm crawl bằng Playwright (TripAdvisor) ==========
async def fetch_with_playwright(url):
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,  # bật trình duyệt thật (có GUI)
                args=["--disable-blink-features=AutomationControlled"]
            )
            context = await browser.new_context(
                user_agent=HEADERS["User-Agent"],
                viewport={"width": 1280, "height": 800},
                locale="en-US",
            )
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=90000)
            await page.mouse.move(100, 100)
            await asyncio.sleep(5)
            html = await page.content()
            await browser.close()
            return {"url": url, "html": html}
    except Exception as e:
        print(f"[Error Playwright] {url}: {e}")
        return None



class Command(BaseCommand):
    help = "Crawl list pages (auto detect Foody or TripAdvisor) and save to CrawledData"

    def add_arguments(self, parser):
        parser.add_argument("urls", nargs="+", help="List of URLs to crawl")
        parser.add_argument("--source", type=str, default=None, help="Source name (auto-detect if omitted)")

    def handle(self, *args, **options):
        asyncio.run(self._handle_async(options))

    async def _handle_async(self, options):
        urls = options["urls"]
        source_name = options.get("source")
        first_url = urls[0].lower()

        # ✅ Auto detect nếu chưa truyền --source
        if not source_name:
            if "tripadvisor.com" in first_url:
                source_name = "TripAdvisor"
            elif "foody.vn" in first_url:
                source_name = "Foody"
            else:
                source_name = "CustomSource"
        else:
            # Normalize tên (chữ hoa chữ thường)
            if source_name.lower() == "tripadvisor":
                source_name = "TripAdvisor"
            elif source_name.lower() == "foody":
                source_name = "Foody"

        # ✅ Đảm bảo tạo đúng CrawledSource (không lẫn Foody)
        existing_sources = await sync_to_async(list)(CrawledSource.objects.all())
        matched = next((s for s in existing_sources if s.name.lower() == source_name.lower()), None)

        if matched:
            source = matched
        else:
            source = await sync_to_async(CrawledSource.objects.create)(
                name=source_name,
                base_url=urls[0],
            )

        results = []

        # ✅ Nếu là TripAdvisor → dùng Playwright render JS
        if "tripadvisor.com" in first_url:
            for u in urls:
                print(f"[TripAdvisor] Crawling with Playwright: {u}")
                data = await fetch_with_playwright(u)
                if data:
                    results.append(data)
        else:
            # ✅ Foody hoặc site HTML tĩnh → dùng aiohttp song song
            async with aiohttp.ClientSession() as session:
                tasks = [fetch_html(session, u) for u in urls]
                responses = await asyncio.gather(*tasks)
                results.extend([r for r in responses if r])

        # ✅ Lưu vào DB
        objs = [
            CrawledData(source=source, url=r["url"], raw_html=r["html"], status="Pending")
            for r in results if r
        ]

        if objs:
            await sync_to_async(CrawledData.objects.bulk_create)(objs)

        print(f"[OK] Crawled {len(objs)} list pages from {source.name}")
