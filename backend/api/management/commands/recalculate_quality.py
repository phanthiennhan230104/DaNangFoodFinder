import math
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Avg, Sum
from api.models import Restaurant, RestaurantSourceStats

FEATURED_MIN_RATING = 4.0 
FEATURED_MIN_REVIEWS = 50 


class Command(BaseCommand):
    help = """
    Recalculate quality_score and is_featured for all restaurants.
    
    This command aggregates data from RestaurantSourceStats to compute:
    - average_rating: Weighted average of ratings from all sources (normalized to scale 5)
    - quality_score: rating * log10(total_reviews + 1)
    - is_featured: True if rating >= 4.0 AND total_reviews >= 50
    
    Run this after processing data from any source to ensure consistency.
    """

    def handle(self, *args, **options):
        restaurants = Restaurant.objects.all()
        
        if not restaurants.exists():
            print("No restaurants found.")
            return

        updated_count = 0
        featured_count = 0

        with transaction.atomic():
            for rest in restaurants:
                stats = RestaurantSourceStats.objects.filter(restaurant=rest)
                
                if not stats.exists():
                    if rest.is_featured:
                        rest.is_featured = False
                        rest.save(update_fields=["is_featured"])
                    continue

                total_reviews = 0
                weighted_rating_sum = 0.0
                
                for stat in stats:
                    if stat.avg_rating and stat.review_count:

                        weighted_rating_sum += float(stat.avg_rating) * stat.review_count
                        total_reviews += stat.review_count

                if total_reviews > 0 and weighted_rating_sum > 0:
                    average_rating = weighted_rating_sum / total_reviews
                else:
                    avg_result = stats.aggregate(avg=Avg("avg_rating"))
                    average_rating = float(avg_result["avg"]) if avg_result["avg"] else 0.0
                    total_reviews = stats.aggregate(total=Sum("review_count"))["total"] or 0

                quality_score = 0.0
                if average_rating > 0 and total_reviews > 0:
                    quality_score = average_rating * math.log10(total_reviews + 1)

                is_featured = (
                    average_rating >= FEATURED_MIN_RATING and 
                    total_reviews >= FEATURED_MIN_REVIEWS
                )

                rest.average_rating = round(average_rating, 2)
                rest.quality_score = round(quality_score, 2)
                rest.is_featured = is_featured
                rest.save(update_fields=["average_rating", "quality_score", "is_featured"])
                
                updated_count += 1
                if is_featured:
                    featured_count += 1

        print(f"[OK] Recalculated quality for {updated_count} restaurants")
        print(f"[FEATURED] {featured_count} restaurants marked as featured")
        print(f"    Criteria: rating >= {FEATURED_MIN_RATING}/5 AND reviews >= {FEATURED_MIN_REVIEWS}")
        print("--- Done recalculate_quality! ---")
