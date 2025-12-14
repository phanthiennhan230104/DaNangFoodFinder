import asyncio
import aiohttp
import ssl
from asgiref.sync import sync_to_async
from django.core.management.base import BaseCommand
from api.models import CrawledSource, CrawledData

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
}


async def fetch_html(session, url: str):
    try:
        async with session.get(url, headers=HEADERS, timeout=30, ssl=False) as resp:
            html = await resp.text()
            if not html or len(html) < 5000:
                return None
            return {"url": url, "html": html}
    except Exception as e:
        print(f"[Error aiohttp] {url}: {e}")
        return None


class Command(BaseCommand):
    help = "Crawl list page (Foody hoặc custom HTML) và lưu vào CrawledData"

    def add_arguments(self, parser):
        parser.add_argument("urls", nargs="+", help="List of URLs to crawl")
        parser.add_argument(
            "--source",
            type=str,
            default=None,
            help="Source name (auto-detect if omitted)",
        )

    def handle(self, *args, **options):
        asyncio.run(self._handle_async(options))

    async def _handle_async(self, options):
        urls = options["urls"]
        source_name = options.get("source")
        first_url = urls[0].lower()

        if not source_name:
            if "foody.vn" in first_url:
                source_name = "Foody"
            else:
                source_name = "CustomSource"
        else:
            source_name = source_name.strip()

        existing_sources = await sync_to_async(list)(CrawledSource.objects.all())
        matched = next(
            (s for s in existing_sources if s.name.lower() == source_name.lower()),
            None,
        )

        if matched:
            source = matched
        else:
            source = await sync_to_async(CrawledSource.objects.create)(
                name=source_name,
                base_url=urls[0],
            )

        results = []
        async with aiohttp.ClientSession() as session:
            tasks = [fetch_html(session, u) for u in urls]
            responses = await asyncio.gather(*tasks)
            results.extend([r for r in responses if r])

        existing_urls = await sync_to_async(set)(
            CrawledData.objects.filter(source=source).values_list("url", flat=True)
        )
        new_data = [r for r in results if r["url"] not in existing_urls]

        objs = [
            CrawledData(
                source=source,
                url=r["url"],
                raw_html=r["html"],
                status=CrawledData.StatusChoices.PENDING,
            )
            for r in new_data
            if r and r["html"]
        ]

        if objs:
            await sync_to_async(CrawledData.objects.bulk_create)(objs)

        skipped_dupes = len(results) - len(new_data)
        total_saved = len(objs)

        if total_saved:
            print(f"[OK] Crawled {total_saved} valid list pages from {source.name}")
        if skipped_dupes:
            print(f"[SKIPPED] {skipped_dupes} duplicate or invalid pages")

        print(f"--- Done crawl_data pipeline! ---")
