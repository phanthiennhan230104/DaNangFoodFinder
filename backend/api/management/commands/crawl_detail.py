import asyncio
import random
import time
from django.core.management.base import BaseCommand
from asgiref.sync import sync_to_async
from api.models import Restaurant, CrawledSource, CrawledData

# Function to fetch detail pages using DrissionPage
def fetch_details_drission(restaurants: list, source_name: str):
    """
    Fetch multiple detail pages using DrissionPage with SINGLE browser session.
    Much better at bypassing anti-bot detection.
    """
    from DrissionPage import ChromiumPage
    
    results = []
    print(f"[INFO] Using DrissionPage to crawl {len(restaurants)} detail pages...")
    
    page = ChromiumPage() #Single browser session
    
    try:
        for i, rest in enumerate(restaurants):
            if i > 0:
                delay = random.uniform(3, 6) # Random delay between requests
                print(f"[INFO] Waiting {delay:.1f}s between requests...")
                time.sleep(delay)
            
            print(f"[{i+1}/{len(restaurants)}] Crawling: {rest.name[:50]}...")
            
            try:
                page.get(rest.detail_url)
                time.sleep(2)
 
                page.scroll.to_bottom()
                time.sleep(1)
                page.scroll.to_top()
                time.sleep(0.5)
                
                html = page.html
                title = page.title

                if "Suspicious" in title or "captcha" in title.lower():
                    print(f"[BLOCKED] {rest.name} - Waiting 20s and retrying...")
                    time.sleep(20)
                    page.get(rest.detail_url)
                    time.sleep(3)
                    html = page.html
                    title = page.title
                    
                    if "Suspicious" in title or "captcha" in title.lower():
                        print(f"[FAILED] Still blocked after retry")
                        continue

                #Check valid HTML DrissionPage
                if html and len(html) > 5000 and "<html" in html.lower():
                    print(f"[OK] Fetched {len(html)} chars")
                    results.append({"rest": rest, "html": html})
                else:
                    print(f"[Warning] Invalid HTML for {rest.name}")
                    
            except Exception as e:
                print(f"[Error] {rest.name}: {e}")
                continue
                
    finally:
        page.quit()
        print(f"[INFO] Browser closed. Fetched {len(results)}/{len(restaurants)} pages")
    
    return results


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

        #Tìm nhà hàng thiếu thông tin
        if source_name.lower() == "foody":
            restaurants = await sync_to_async(list)(
                Restaurant.objects.filter(
                    detail_url__icontains="foody.vn",
                    price_range__isnull=True, ## Missing price_range
                )[:limit]
            )
        
        elif source_name.lower() == "restaurantguru":
            restaurants = await sync_to_async(list)(
                Restaurant.objects.filter(
                    detail_url__icontains="restaurantguru.com",
                    opening_hours__isnull=True, ## Missing opening_hours
                )[:limit]
            )
        else:
            print(f"Unsupported source: {source_name}")
            return

        if not restaurants:
            print(f"No restaurants found for crawling {source_name} details.")
            return

        #Call function to fetch details
        if source_name.lower() == "restaurantguru":
            loop = asyncio.get_event_loop()
            valid_results = await loop.run_in_executor(
                None, fetch_details_drission, restaurants, source_name
            )
        else:
            from playwright.async_api import async_playwright
            #Fetch detail pages with Playwright
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
            
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True) #Headless Chronium
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    locale="en-US",
                    ignore_https_errors=True,
                )

                tasks = [fetch_detail(context, r) for r in restaurants]
                results = await asyncio.gather(*tasks)
                await browser.close()
            
            valid_results = [r for r in results if r and r.get("html")]

        if not valid_results:
            print("No valid HTML results to save.")
            return

        saved_count = 0
        deleted_count = 0

        for item in valid_results:
            rest = item["rest"]
            html = (item["html"] or "").strip()

            if (
                not html
                or "<html" not in html.lower()
                or "captcha-delivery.com" in html
            ):
                await sync_to_async(rest.delete)()
                deleted_count += 1
                continue

            #Check delete existing CrawledData
            await sync_to_async(CrawledData.objects.filter(url=rest.detail_url).delete)()
            #Create new CrawledData
            await sync_to_async(CrawledData.objects.create)(
                source=source,
                url=rest.detail_url,
                raw_html=html,
                linked_restaurant=rest,
                status=CrawledData.StatusChoices.PENDING,
            )

            saved_count += 1

        if saved_count:
            print(f"[OK] Crawled {saved_count} valid {source_name} detail pages")
        if deleted_count:
            print(f"[DELETED] Removed {deleted_count} invalid or incomplete entries")

        print("--- Done crawl_detail pipeline! ---")
