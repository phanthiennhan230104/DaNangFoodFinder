"""
Command để xóa những nhà hàng không đạt yêu cầu rating và review count.

Tiêu chí:
- Foody: rating >= 8.5/10 (tức 4.25/5), review >= 30
- RestaurantGuru: rating >= 4.8/5, review >= 30
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import Restaurant, RestaurantSourceStats

# === FILTER CRITERIA ===
MIN_RATING_FOODY = 8.5      # Scale 10
MIN_RATING_FOODY_NORMALIZED = 4.25  # Scale 5 (8.5/2)
MIN_RATING_RG = 4.5         # Scale 5
MIN_REVIEW_COUNT = 30


class Command(BaseCommand):
    help = "Xóa những nhà hàng không đạt yêu cầu rating và review count"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Chỉ hiển thị danh sách nhà hàng sẽ bị xóa, không xóa thật',
        )
        parser.add_argument(
            '--source',
            type=str,
            choices=['foody', 'restaurantguru', 'all'],
            default='all',
            help='Nguồn dữ liệu cần kiểm tra (foody, restaurantguru, all)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        source_filter = options['source'].lower()

        print("=" * 60)
        print("🧹 CLEANUP RESTAURANTS - Xóa nhà hàng không đạt yêu cầu")
        print("=" * 60)
        print(f"\n📋 Tiêu chí:")
        print(f"   - Foody: Rating >= {MIN_RATING_FOODY}/10, Reviews >= {MIN_REVIEW_COUNT}")
        print(f"   - RestaurantGuru: Rating >= {MIN_RATING_RG}/5, Reviews >= {MIN_REVIEW_COUNT}")
        print(f"   - Required: Opening Hours + Price Range + Cuisine Type")
        print(f"   - Source filter: {source_filter}")
        print(f"   - Dry run: {dry_run}")
        print()

        to_delete = []
        kept = []

        # Lấy tất cả nhà hàng
        restaurants = Restaurant.objects.all().prefetch_related('source_stats')

        for rest in restaurants:
            # Kiểm tra thông tin cơ bản bắt buộc
            missing_info = []
            
            if not rest.opening_hours:
                missing_info.append("opening_hours")
            
            if not rest.price_range:
                missing_info.append("price_range")
            
            if not rest.cuisine_type or "Restaurant" in rest.cuisine_type or "no information" in (rest.cuisine_type or "").lower():
                missing_info.append(f"cuisine_type ({rest.cuisine_type})")
            
            # Nếu thiếu bất kỳ thông tin nào -> xóa luôn
            if missing_info:
                to_delete.append((rest, f"Missing: {', '.join(missing_info)}", rest.average_rating or 0, 0))
                continue

            # Lấy stats từ các nguồn
            stats = rest.source_stats.all()
            
            if not stats.exists():
                # Không có stats -> kiểm tra từ average_rating
                if rest.average_rating and rest.average_rating >= MIN_RATING_RG:
                    kept.append((rest, "No stats but rating OK", rest.average_rating, 0))
                else:
                    to_delete.append((rest, "Không có source stats", rest.average_rating or 0, 0))
                continue

            # Kiểm tra từng source
            is_qualified = False
            best_rating = 0
            best_reviews = 0
            source_name = ""

            for stat in stats:
                source_name = stat.source.name.lower() if stat.source else "unknown"
                rating = stat.avg_rating or 0
                reviews = stat.review_count or 0

                # Update best values
                if rating > best_rating:
                    best_rating = rating
                    best_reviews = reviews

                # Skip nếu không match source filter
                if source_filter != 'all' and source_filter not in source_name:
                    continue

                # Kiểm tra theo nguồn
                if 'foody' in source_name:
                    # Foody rating đã được normalize về scale 5 trong RestaurantSourceStats
                    # Nên cần convert ngược lại để so sánh với MIN_RATING_FOODY
                    original_rating = rating * 2  # Scale 5 -> Scale 10
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

        # Hiển thị kết quả
        print(f"\n✅ Nhà hàng ĐẠT yêu cầu: {len(kept)}")
        print("-" * 60)
        for rest, source, rating, reviews in kept[:10]:
            print(f"   ✅ {rest.name[:40]:<40} | {source:<15} | Rating: {rating:.1f} | Reviews: {reviews}")
        if len(kept) > 10:
            print(f"   ... và {len(kept) - 10} nhà hàng khác")

        print(f"\n❌ Nhà hàng KHÔNG đạt yêu cầu: {len(to_delete)}")
        print("-" * 60)
        for rest, source, rating, reviews in to_delete:
            print(f"   ❌ {rest.name[:40]:<40} | {source:<15} | Rating: {rating:.1f} | Reviews: {reviews}")

        # Xóa nếu không phải dry-run
        if not dry_run and to_delete:
            print(f"\n🗑️  Đang xóa {len(to_delete)} nhà hàng...")
            with transaction.atomic():
                for rest, _, _, _ in to_delete:
                    # Xóa RestaurantSourceStats liên quan
                    RestaurantSourceStats.objects.filter(restaurant=rest).delete()
                    # Xóa Restaurant
                    rest.delete()
            print(f"✅ Đã xóa {len(to_delete)} nhà hàng không đạt yêu cầu!")
        elif dry_run and to_delete:
            print(f"\n⚠️  DRY RUN - Không xóa thật. Chạy lại không có --dry-run để xóa.")
        else:
            print(f"\n✨ Không có nhà hàng nào cần xóa!")

        print("\n" + "=" * 60)
        print(f"📊 Tổng kết: Giữ {len(kept)}, Xóa {len(to_delete)}")
        print("=" * 60)
