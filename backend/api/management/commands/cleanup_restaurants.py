
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import Restaurant, RestaurantSourceStats

MIN_RATING_FOODY = 8.5
MIN_RATING_FOODY_NORMALIZED = 4.25
MIN_RATING_RG = 4.5
MIN_REVIEW_COUNT = 30


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
        )
        parser.add_argument(
            '--source',
            type=str,
            choices=['foody', 'restaurantguru', 'all'],
            default='all',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        source_filter = options['source'].lower()

        print("=" * 60)
        print("🧹 CLEANUP RESTAURANTS - Remove restaurants that do not meet criteria")
        print("=" * 60)
        print(f"\n📋 Criteria:")
        print(f"   - Foody: Rating >= {MIN_RATING_FOODY}/10, Reviews >= {MIN_REVIEW_COUNT}")
        print(f"   - RestaurantGuru: Rating >= {MIN_RATING_RG}/5, Reviews >= {MIN_REVIEW_COUNT}")
        print(f"   - Required: Opening Hours + Price Range + Cuisine Type")
        print(f"   - Source filter: {source_filter}")
        print(f"   - Dry run: {dry_run}")
        print()

        to_delete = []
        kept = []

        restaurants = Restaurant.objects.all().prefetch_related('source_stats')

        for rest in restaurants:
            missing_info = []
            
            if not rest.opening_hours:
                missing_info.append("opening_hours")
            
            if not rest.price_range:
                missing_info.append("price_range")
            
            if not rest.cuisine_type or "Restaurant" in rest.cuisine_type or "no information" in (rest.cuisine_type or "").lower():
                missing_info.append(f"cuisine_type ({rest.cuisine_type})")

            if missing_info:
                to_delete.append((rest, f"Missing: {', '.join(missing_info)}", rest.average_rating or 0, 0))
                continue

            stats = rest.source_stats.all()
            
            if not stats.exists():
                if rest.average_rating and rest.average_rating >= MIN_RATING_RG:
                    kept.append((rest, "No stats but rating OK", rest.average_rating, 0))
                else:
                    to_delete.append((rest, "No source stats", rest.average_rating or 0, 0))
                continue

            is_qualified = False
            best_rating = 0
            best_reviews = 0
            source_name = ""

            for stat in stats:
                source_name = stat.source.name.lower() if stat.source else "unknown"
                rating = stat.avg_rating or 0
                reviews = stat.review_count or 0

                if rating > best_rating:
                    best_rating = rating
                    best_reviews = reviews

                if source_filter != 'all' and source_filter not in source_name:
                    continue

                if 'foody' in source_name:

                    original_rating = rating * 2
                    if original_rating >= MIN_RATING_FOODY and reviews >= MIN_REVIEW_COUNT:
                        is_qualified = True
                        break
                elif 'restaurantguru' in source_name:
                    if rating >= MIN_RATING_RG and reviews >= MIN_REVIEW_COUNT:
                        is_qualified = True
                        break

            if is_qualified:
                kept.append((rest, source_name, best_rating, best_reviews))
            else:
                to_delete.append((rest, source_name, best_rating, best_reviews))

        print(f"\n✅ Qualified restaurants: {len(kept)}")
        print("-" * 60)
        for rest, source, rating, reviews in kept[:10]:
            print(f"   ✅ {rest.name[:40]:<40} | {source:<15} | Rating: {rating:.1f} | Reviews: {reviews}")
        if len(kept) > 10:
            print(f"   ... and {len(kept) - 10} more restaurants")

        print(f"\n❌ Restaurants NOT qualified: {len(to_delete)}")
        print("-" * 60)
        for rest, source, rating, reviews in to_delete:
            print(f"   ❌ {rest.name[:40]:<40} | {source:<15} | Rating: {rating:.1f} | Reviews: {reviews}")

        if not dry_run and to_delete:
            print(f"\n🗑️  Deleting {len(to_delete)} restaurants...")
            with transaction.atomic():
                for rest, _, _, _ in to_delete:
                    RestaurantSourceStats.objects.filter(restaurant=rest).delete()
                    rest.delete()
            print(f"✅ Deleted {len(to_delete)} restaurants not meeting the criteria!")
        elif dry_run and to_delete:
            print(f"\n⚠️  DRY RUN - Not actually deleting. Run again without --dry-run to delete.")
        else:
            print(f"\n✨ No restaurants need to be deleted!")
        print("\n" + "=" * 60)
        print(f"📊 Summary: Kept {len(kept)}, Deleted {len(to_delete)}")
        print("=" * 60)
