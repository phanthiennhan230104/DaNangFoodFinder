import asyncio
import aiohttp
import ssl
import random
from asgiref.sync import sync_to_async
from django.core.management.base import BaseCommand
from api.models import CrawledSource, CrawledData

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
]
# Random User-Agent selection to Avoid Block
def get_random_user_agent():
    return random.choice(USER_AGENTS)

HEADERS = {
    "User-Agent": get_random_user_agent(),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

# aiohttp for static page (Foody)
async def fetch_html(session, url: str):
    """Simple aiohttp fetch for static pages (Foody)"""
    try:
        async with session.get(url, headers=HEADERS, timeout=30, ssl=False) as resp:
            html = await resp.text()
            if not html or len(html) < 5000:
                return None
            return {"url": url, "html": html}
    except Exception as e:
        print(f"[Error aiohttp] {url}: {e}")
        return None

#DrissionPage for JavaScript-rendered pages (anti-bot bypass) 1 url
def fetch_html_drission(url: str):
    """DrissionPage fetch for JavaScript-rendered pages - bypasses anti-bot effectively"""
    try:
        from DrissionPage import ChromiumPage
        import time
        
        print(f"[INFO] Using DrissionPage (anti-bot bypass)...")
 
        page = ChromiumPage()
        
        try:
            delay = random.uniform(1, 3) #random delay
            print(f"[INFO] Waiting {delay:.1f}s before request...")
            time.sleep(delay)
            
            page.get(url)
            time.sleep(2)

            page.scroll.to_bottom() #Scroll to bottom simulate user
            time.sleep(1)
            page.scroll.to_top() #Scroll to top simulate user
            time.sleep(0.5)
            
            html = page.html
            title = page.title

            #Check if blocked by bot detection
            if "Suspicious" in title or "captcha" in title.lower() or "blocked" in title.lower():
                print(f"[BLOCKED] {url} - Bot detected: {title}")
                return None
            
            #Check valid HTML DrissionPage
            if not html or len(html) < 10000:
                print(f"[Warning] Page too small: {url} ({len(html)} chars)")
                return None
                
            print(f"[OK] Fetched {len(html)} chars from {url}")
            return {"url": url, "html": html}
            
        finally:
            page.quit()
            
    except Exception as e:
        print(f"[Error DrissionPage] {url}: {e}")
        return None

#DrissionPage for JavaScript-rendered pages (anti-bot bypass) multiple URLs
def fetch_multiple_drission(urls: list):
    """Fetch multiple URLs using SINGLE browser session - better for avoiding detection"""
    from DrissionPage import ChromiumPage
    import time
    
    results = []
    print(f"[INFO] Using DrissionPage with single session for {len(urls)} URLs...")
    
    page = ChromiumPage()
    
    try:
        for i, url in enumerate(urls):
            if i > 0:
                delay = random.uniform(5, 10)
                print(f"[INFO] Waiting {delay:.1f}s between requests...")
                time.sleep(delay)
            
            print(f"[{i+1}/{len(urls)}] Loading: {url}")
            
            try:
                page.get(url)
                time.sleep(2)

                page.scroll.to_bottom()
                time.sleep(random.uniform(0.5, 1.5))
                page.scroll.to_top()
                time.sleep(0.5)
                
                html = page.html
                title = page.title
                
                if "Suspicious" in title or "captcha" in title.lower():
                    print(f"[BLOCKED] {url} - Bot detected!")
                    print("[INFO] Waiting 30s before retry...")
                    time.sleep(30)
                    page.get(url)
                    time.sleep(3)
                    html = page.html
                    title = page.title
                    
                    if "Suspicious" in title or "captcha" in title.lower():
                        print(f"[FAILED] Still blocked after retry")
                        continue
                
                if html and len(html) > 10000:
                    print(f"[OK] Fetched {len(html)} chars")
                    results.append({"url": url, "html": html})
                else:
                    print(f"[Warning] Page too small: {len(html)} chars")
                    
            except Exception as e:
                print(f"[Error] {url}: {e}")
                continue
                
    finally:
        page.quit()
        print(f"[INFO] Browser closed. Fetched {len(results)}/{len(urls)} pages")
    
    return results


async def fetch_html_playwright(url: str):
    """Fallback: Playwright fetch for JavaScript-rendered pages"""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, fetch_html_drission, url)


#Parse Arguments 
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

    #Auto detect source name (Foody / RestaurantGuru / CustomSource)
    async def _handle_async(self, options):
        urls = options["urls"]
        source_name = options.get("source")
        first_url = urls[0].lower()

        if not source_name:
            if "foody.vn" in first_url:
                source_name = "Foody"
            elif "restaurantguru.com" in first_url:
                source_name = "RestaurantGuru"
            else:
                source_name = "CustomSource"
        else:
            source_name = source_name.strip()

        #Check existing CrawledSource
        existing_sources = await sync_to_async(list)(CrawledSource.objects.all())
        matched = next(
            (s for s in existing_sources if s.name.lower() == source_name.lower()),
            None,
        )

        if matched:
            source = matched # Use existing source
        else:
            source = await sync_to_async(CrawledSource.objects.create)(
                name=source_name,
                base_url=urls[0], # Create new source
            )

        results = []
        #Fetch for restaurantguru with DrissionPage
        if source_name.lower() == "restaurantguru":
            print(f"[INFO] Using DrissionPage for RestaurantGuru (anti-bot bypass)")
            results = await sync_to_async(fetch_multiple_drission)(urls)
        else:
            async with aiohttp.ClientSession() as session:
                tasks = [fetch_html(session, u) for u in urls]
                responses = await asyncio.gather(*tasks)
                results.extend([r for r in responses if r])

        existing_urls = await sync_to_async(set)(
            CrawledData.objects.filter(source=source).values_list("url", flat=True)
        )
        new_data = [r for r in results if r["url"] not in existing_urls]
        # Save into CrawledData
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

        # Summary statistics to show in FE
        # Calculate statistics
        total_urls = len(urls)
        failed_fetch = total_urls - len(results) #URL failed to fetch
        skipped_dupes = len(results) - len(new_data) #URL existing in DB
        total_saved = len(objs) #URL saved to DB

        # Log results
        print(f"\n{'='*50}")
        print(f"[PIPELINE COMPLETED] Crawl Data - {source.name}")
        print(f"{'='*50}")
        
        if total_saved:
            print(f"✅ SUCCESS: Crawled {total_saved} new pages")
        
        if skipped_dupes:
            print(f"⏭️  SKIPPED: {skipped_dupes} pages already exist in database")
        
        if failed_fetch:
            print(f"❌ FAILED: {failed_fetch} pages could not be fetched")
            print(f"   Possible reasons:")
            print(f"   - Bot detection / CAPTCHA blocked")
            print(f"   - Network timeout or connection error")
            print(f"   - Invalid URL or page not found")
        
        if total_saved == 0 and failed_fetch == 0 and skipped_dupes > 0:
            print(f"\n📋 Note: All {skipped_dupes} URLs are duplicates. Try crawling new pages.")
        elif total_saved == 0 and failed_fetch > 0:
            print(f"\n⚠️  Warning: No data saved. Check if IP is blocked by {source.name}.")
            print(f"   Solutions: Change IP (use mobile hotspot) or wait 15-30 minutes.")
        
        print(f"{'='*50}\n")

        print(f"--- Done crawl_data pipeline! ---")
