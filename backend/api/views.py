

from typing import List
import json
import logging
import re
import requests
from datetime import timedelta

from django.db.models import Q
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings

from rest_framework import generics, status, permissions
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.views import TokenObtainPairView

from groq import Groq

from .models import Restaurant, FoodJourney, CustomUser, CrawledData, Profile,Feedback
from .models import Favorite
from .serializers import (
    UserSerializer,
    RestaurantSerializer,
    FoodJourneySerializer,
    RegisterSerializer,
    CustomTokenObtainPairSerializer,
    ProfileSerializer,
    FeedbackSerializer
    , FavoriteSerializer
)

from .services.journey_recommender import (
    Candidate,
    parse_price_range,
    infer_meal,
    score_candidate,
    pick_best_triplet,
)
from .services.geocode_service import geocode_address, normalize_danang_address
from .services.route_service import get_route
from .models import Profile
from .serializers import ProfileSerializer

User = get_user_model()
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_my_profile(request):
    """
    Trả về profile của user hiện tại.
    Nếu chưa có profile thì tự động tạo với giá trị mặc định,
    để frontend luôn nhận được dữ liệu (không trả 404).
    """
    profile, created = Profile.objects.get_or_create(
        user=request.user,
        defaults={
            "fullname": "",
            "dob": "2000-01-01",
            "gender": "",
        },
    )
    serializer = ProfileSerializer(profile)
    return Response(serializer.data, status=status.HTTP_200_OK)

        
        
class RestaurantListView(generics.ListAPIView):
    
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        area = self.request.query_params.get("address")  # Area/landmark filter
        cuisine = self.request.query_params.get("cuisine_type")  # Cuisine by country
        food_type = self.request.query_params.get("food_type")   # Food type
        
        # Filter by area - search using keywords from DANANG_AREAS
        if area:
            if area == "Other Areas":
                # Exclude all restaurants that match any known area
                exclude_q = Q()
                for area_name, keywords in DANANG_AREAS.items():
                    for keyword in keywords:
                        exclude_q |= Q(address__icontains=keyword)
                qs = qs.exclude(exclude_q)
            elif area in DANANG_AREAS:
                keywords = DANANG_AREAS[area]
                # Build Q objects to match any of the keywords
                q_objects = Q()
                for keyword in keywords:
                    q_objects |= Q(address__icontains=keyword)
                qs = qs.filter(q_objects)
        
        # Filter by cuisine_type (by country) - using icontains
        if cuisine:
            qs = qs.filter(cuisine_type__icontains=cuisine)
        
        # Filter by food_type - using icontains
        if food_type:
            qs = qs.filter(cuisine_type__icontains=food_type)

        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        # Lấy page và page_size từ query params
        page = request.query_params.get("page", 1)
        page_size = request.query_params.get("page_size", 8)
        
        try:
            page = int(page)
            page_size = int(page_size)
        except ValueError:
            page = 1
            page_size = 8
        
        # Tính toán offset
        total_count = queryset.count()
        total_pages = (total_count + page_size - 1) // page_size  # Ceiling division
        
        # Đảm bảo page không vượt quá giới hạn
        if page < 1:
            page = 1
        if page > total_pages and total_pages > 0:
            page = total_pages
        
        start = (page - 1) * page_size
        end = start + page_size
        
        # Slice queryset
        restaurants = queryset[start:end]
        
        serializer = self.get_serializer(restaurants, many=True)
        
        return Response({
            "results": serializer.data,
            "count": total_count,
            "total_pages": total_pages,
            "current_page": page,
            "page_size": page_size,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        })


class RestaurantDetailView(generics.RetrieveAPIView):
    """Retrieve a single restaurant by PK (detail view).

    This endpoint complements the existing ListAPIView. It uses the same
    RestaurantSerializer and returns more detailed fields for UI popups.
    """
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantSerializer
    permission_classes = [AllowAny]


class FavoriteListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # list favorites for current user
        favs = Favorite.objects.filter(user=request.user).select_related('restaurant')
        serializer = FavoriteSerializer(favs, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request):
        # create favorite for current user (idempotent)
        restaurant_id = request.data.get('restaurant_id')
        if not restaurant_id:
            return Response({"detail": "Missing restaurant_id."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            restaurant = Restaurant.objects.get(pk=restaurant_id)
        except Restaurant.DoesNotExist:
            return Response({"detail": "Restaurant not found."}, status=status.HTTP_404_NOT_FOUND)

        fav, created = Favorite.objects.get_or_create(user=request.user, restaurant=restaurant)
        serializer = FavoriteSerializer(fav, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class FavoriteDestroyView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, restaurant_id):
        fav = Favorite.objects.filter(user=request.user, restaurant_id=restaurant_id).first()
        if not fav:
            return Response(status=status.HTTP_404_NOT_FOUND)
        fav.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)



class FeedbackCreateView(generics.CreateAPIView):
    queryset = Feedback.objects.all()
    serializer_class = FeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]  # Cho phép gửi cả khi chưa đăng nhập

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)



class FeedbackListAdminView(APIView):
    def get(self, request):
        is_resolved = request.query_params.get('is_resolved')
        if is_resolved == 'false':
            feedbacks = Feedback.objects.filter(is_resolved=False)
        elif is_resolved == 'true':
            feedbacks = Feedback.objects.filter(is_resolved=True)
        else:
            feedbacks = Feedback.objects.all()
        serializer = FeedbackSerializer(feedbacks, many=True)
        return Response(serializer.data)

def remove_vietnamese_accents(text):
    """
    Convert Vietnamese text to non-accented English-friendly text.
    Example: "Lê Quang Đạo" -> "Le Quang Dao"
    Also normalizes to Title Case.
    """
    # Vietnamese character mapping
    vietnamese_map = {
        'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
        'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
        'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
        'đ': 'd',
        'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
        'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
        'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
        'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
        'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
        'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
        'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
        'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
        'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
        'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
        'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
        'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
        'Đ': 'D',
        'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
        'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
        'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
        'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
        'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
        'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
        'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
        'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
        'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y',
    }
    
    result = []
    for char in text:
        if char in vietnamese_map:
            result.append(vietnamese_map[char])
        else:
            result.append(char)
    
    # Convert to Title Case (capitalize first letter of each word)
    return ''.join(result).title()


# Define famous areas/landmarks in Da Nang with their associated keywords
DANANG_AREAS = {
    "My Khe Beach": [
        "Võ Nguyên Giáp", "võ nguyên giáp", "Vo Nguyen Giap",
        "Trường Sa", "Truong Sa", 
        "Phạm Văn Đồng", "Pham Van Dong",
        "Hồ Nghinh", "Ho Nghinh",
        "My Khe", "Mỹ Khê", "My Beach", "Ha My", "biển hà my"
    ],
    "An Thuong (Foreigner Street)": [
        "An Thượng", "An Thuong", "An Thu_ng"
    ],
    "Dragon Bridge Area": [
        "Bạch Đằng", "Bach Dang", "B_ch D_ng",
        "Trần Hưng Đạo", "Tran Hung Dao",
        "Chân Cầu", "Dragon"
    ],
    "Han River": [
        "Trần Phú", "Tran Phu",
        "Như Nguyệt", "Nhu Nguyet", 
        "Nguyễn Văn Linh", "Nguyen Van Linh"
    ],
    "Son Tra District": [
        "Sơn Trà", "Son Tra", "Son tra"
    ],
    "Hai Chau District": [
        "Hải Châu", "Hai Chau",
        "Lê Duẩn", "Le Duan",
        "Trưng Nữ Vương", "Trung Nu Vuong",
        "Đống Đa", "Dong Da",
        "Quang Trung",
        "Hoàng Diệu", "Hoang Dieu",
        "Phan Đăng Lưu", "Phan Dang Luu",
        "Nguyễn Tri Phương", "Nguyen Tri Phuong",
        "Lê Hồng Phong", "Le Hong Phong",
        "Trần Cao Vân", "Tran Cao Van",
        "Phan Châu Trinh", "Phan Chau Trinh",
        "Lý Tự Trọng", "Ly Tu Trong",
        "Ông Ích Khiêm", "Ong Ich Khiem",
        "Hùng Vương", "Hung Vuong"
    ],
    "Ngu Hanh Son District": [
        "Ngũ Hành Sơn", "Ngu Hanh Son",
        "Lê Văn Hiến", "Le Van Hien",
        "Non Nước", "Non Nuoc"
    ],
    "Thanh Khe District": [
        "Thanh Khê", "Thanh Khe",
        "Điện Biên Phủ", "Dien Bien Phu",
        "Hải Phòng", "Hai Phong"
    ],
    "Le Quang Dao Street": [
        "Lê Quang Đạo", "Le Quang Dao"
    ],
    "Nguyen Van Thoai Street": [
        "Nguyễn Văn Thoại", "Nguyen Van Thoai"
    ],
    "Chau Thi Vinh Te Street": [
        "Châu Thị Vĩnh Tế", "Chau Thi Vinh Te"
    ],
    "Tran Bach Dang Street": [
        "Trần Bạch Đằng", "Tran Bach Dang"
    ],
    "Dinh Nghe Street": [
        "Đình Nghệ", "Dinh Nghe", "D. Đình Nghệ"
    ],
}

# Food type normalization mapping - consolidate duplicate/similar food types
FOOD_TYPE_MAPPING = {
    # BBQ variations - normalize to BBQ
    "Barbecue": "BBQ",
    "barbecue": "BBQ",
    "Grill": "BBQ",
    
    # Vegan/Vegetarian - normalize to Vegetarian
    "Vegan": "Vegetarian",
    
    # Plural to singular
    "Soft foods": "Soft food",
    "Soups": "Soup",
}


@api_view(["GET"])
def get_filters(request):
    """
    Get unique list of areas (grouped by landmarks) and cuisine types.
    Areas are famous locations/landmarks in Da Nang.
    Split cuisines into 2 groups: by country/region and by food type.
    """
    # Check which areas have restaurants
    addresses = list(Restaurant.objects.values_list("address", flat=True))
    areas_with_count = []
    matched_addresses = set()  # Track addresses that matched an area
    
    for area_name, keywords in DANANG_AREAS.items():
        count = 0
        for idx, addr in enumerate(addresses):
            if addr:
                addr_lower = addr.lower()
                for keyword in keywords:
                    if keyword.lower() in addr_lower:
                        count += 1
                        matched_addresses.add(idx)
                        break
        if count > 0:
            areas_with_count.append((area_name, count))
    
    # Count "Other Areas" - restaurants that don't match any known area
    other_count = 0
    for idx, addr in enumerate(addresses):
        if idx not in matched_addresses:
            other_count += 1
    
    if other_count > 0:
        areas_with_count.append(("Other Areas", other_count))
    
    # Sort alphabetically, but keep "Other Areas" at the bottom
    areas_with_count.sort(key=lambda x: (x[0] == "Other Areas", x[0].lower()))
    popular_areas = [area for area, count in areas_with_count]
    
    # Define country/region based cuisines (ONLY actual countries/regions)
    country_cuisines = {
        # Asia
        "Vietnamese", "Japanese", "Korean", "Chinese", "Thai", "Indian",
        "Asian", "Taiwanese", "Taiwan", "Indonesian", "Malaysian", "Singaporean",
        "Filipino", "Cambodian", "Burmese", "Laotian", "Nepali", "Pakistani",
        "Sri Lankan", "Bangladeshi",
        # Europe
        "Italian", "French", "Spanish", "Greek", "British", "German",
        "Portuguese", "Dutch", "Belgian", "Swiss", "Austrian", "Polish",
        "Russian", "Ukrainian", "Hungarian", "Czech", "Swedish", "Norwegian",
        "Danish", "Finnish", "Irish", "Scottish", "European",
        # Mediterranean & Middle East
        "Mediterranean", "Turkish", "Lebanese", "Persian", "Israeli",
        "Moroccan", "Egyptian", "Middle Eastern", "Arabic", "Syrian",
        "Jordanian", "Iraqi", "Afghan",
        # Americas
        "American", "Mexican", "Brazilian", "Peruvian", "Argentine",
        "Colombian", "Cuban", "Puerto Rican", "Jamaican", "Caribbean",
        "Canadian", "Cajun", "Tex-Mex", "Latin American", "New American",
        # Africa & Oceania
        "African", "Ethiopian", "Nigerian", "South African",
        "Australian", "Hawaiian", "Polynesian",
        # Western is a region style
        "Western",
        # International/Multi-regional
        "International",
    }
    
    # Get all cuisine_type and split into individual types
    cuisines_raw = Restaurant.objects.values_list("cuisine_type", flat=True).distinct()
    
    by_country = set()  # Country/region based cuisines
    food_types = set()  # Food types (not country-based)
    
    for cuisine_str in cuisines_raw:
        if cuisine_str:
            # Split by comma and strip whitespace
            individual_cuisines = [c.strip() for c in cuisine_str.split(",")]
            for c in individual_cuisines:
                if c:
                    # Normalize the cuisine type using the mapping
                    normalized = FOOD_TYPE_MAPPING.get(c, c)
                    
                    # Check if it belongs to country cuisines
                    if normalized in country_cuisines:
                        by_country.add(normalized)
                    else:
                        food_types.add(normalized)
    
    return Response({
        "areas": popular_areas,  # Sorted by restaurant count
        "cuisines_by_country": sorted(list(by_country)),
        "food_types": sorted(list(food_types)),
    })


class CuisineListView(APIView):
    """Trả danh sách loại ẩm thực duy nhất."""
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        cuisines = Restaurant.objects.values_list("cuisine_type", flat=True).distinct()
        filtered = [c for c in cuisines if c]
        return Response(sorted(filtered))

class CuisineSearchView(APIView):
    """Tìm kiếm nhà hàng theo cuisine type."""
    permission_classes = [AllowAny]

    def get(self, request):
        q = request.GET.get("q", "").strip()
        if not q:
            return Response([])
        
        # Tìm nhà hàng có cuisine_type chứa từ khóa
        restaurants = Restaurant.objects.filter(
            cuisine_type__icontains=q
        )[:15]  # Limit 15 kết quả
        
        serializer = RestaurantSerializer(restaurants, many=True, context={"request": request})
        return Response(serializer.data)

class JourneyRecommendationsView(APIView):
    
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        strategy = request.GET.get("strategy", "simple")
        budget = int(request.GET.get("budget", 300000))
        preferences_raw = request.GET.get("preferences", "")
        preferences: List[str] = [
            p.strip() for p in preferences_raw.split(",") if p.strip()
        ]
        search = request.GET.get("search", "")

        # --- Lọc danh sách ---
        qs = Restaurant.objects.all()
        if preferences:
            q_filter = Q()
            for pref in preferences:
                q_filter |= Q(cuisine_type__icontains=pref)
            qs = qs.filter(q_filter)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(address__icontains=search))

        # --- Tạo danh sách ứng viên ---
        candidates: List[Candidate] = []
        for r in qs:
            price_val = parse_price_range(r.price_range, default_price=0)
            meal = infer_meal(price_val, budget // 4, budget // 2, cuisine_type=r.cuisine_type, name=r.name)
            candidates.append(
                Candidate(
                    id=r.id,
                    name=r.name,
                    cuisine_type=r.cuisine_type,
                    price_range=r.price_range,
                    rating=float(r.average_rating or 0.0),
                    meal_type=meal,
                    price=price_val,
                )
            )

        # --- Chiến lược AI ---
        if strategy == "ai":
            # 1) Check API key
            api_key = getattr(settings, "GROQ_API_KEY", None)
            if not api_key:
                return Response(
                    {"detail": "GROQ_API_KEY is missing. Please set it in .env / settings."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # 2) Check candidates
            if not candidates:
                return Response({
                    "strategy": "ai",
                    "budget": budget,
                    "preferences": preferences,
                    "best_plan": None,
                    "error": "No candidates available after filtering (budget/preferences/search)."
                }, status=status.HTTP_200_OK)

            client = Groq(api_key=api_key)

            # Giới hạn số candidates để tránh prompt quá dài
            candidates_sorted = sorted(candidates, key=lambda x: x.rating, reverse=True)[:80]

            # Map nhanh id -> Candidate
            cand_map = {c.id: c for c in candidates_sorted}
            candidates_text = "\n".join(
                f"- id={c.id}, name={c.name}, cuisine={c.cuisine_type}, price={c.price}VND, rating={c.rating}"
                for c in candidates_sorted
            )
            prompt = f"""
                Bạn là AI gợi ý quán ăn ở Đà Nẵng.
                Chỉ trả về JSON THUẦN (không markdown, không giải thích).

                Ngân sách tổng: {budget} VND
                Sở thích ẩm thực: {", ".join(preferences) or "Không có"}

                Danh sách quán (chỉ chọn trong danh sách này):
                {candidates_text}

                Yêu cầu chọn đúng 3 quán:
                - breakfast: món nhẹ buổi sáng (cà phê, bánh, bún/phở nhẹ, ăn nhanh)
                - lunch: món ăn chính bữa trưa (cơm, mỳ/bún no, suất trưa, quán bình dân)
                - dinner: ưu tiên nhậu/ăn vặt buổi tối (hải sản, lẩu, nướng, bia, đồ nhắm, ăn vặt)
                - Tổng giá 3 quán <= {budget} VND

                Format JSON bắt buộc:
                {{
                "breakfast": {{"id": 1, "reason": "..."}},
                "lunch":     {{"id": 2, "reason": "..."}},
                "dinner":    {{"id": 3, "reason": "..."}}
                }}
                """.strip()

            resp = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=300,
            )
            
            content = (getattr(resp.choices[0].message, "content", "") or "").strip()

            # Parse JSON an toàn
            plan_raw = None

            try:
                plan_raw = json.loads(content)
            except Exception:
                # fallback: trích JSON object đầu tiên trong text
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try:
                        plan_raw = json.loads(m.group(0))
                    except Exception:
                        plan_raw = None

            if not isinstance(plan_raw, dict):
                return Response({
                    "strategy": "ai",
                    "budget": budget,
                    "preferences": preferences,
                    "best_plan": {"raw": content},
                    "error": "AI did not return valid JSON",
                }, status=status.HTTP_200_OK)

            def to_full(item):
                if not isinstance(item, dict) or "id" not in item:
                    return None
                cid = item.get("id")
                c = cand_map.get(cid)
                if not c:
                    return None
                return {
                    "id": c.id,
                    "name": c.name,
                    "cuisine_type": c.cuisine_type,
                    "price_range": c.price_range,
                    "price": c.price,
                    "average_rating": c.rating,
                    "meal_type": c.meal_type,
                    "reason": item.get("reason", ""),
                }

            return Response({
                "strategy": "ai",
                "budget": budget,
                "preferences": preferences,
                "best_plan": {
                    "breakfast": to_full(plan_raw.get("breakfast")),
                    "lunch": to_full(plan_raw.get("lunch")),
                    "dinner": to_full(plan_raw.get("dinner")),
                },
            }, status=status.HTTP_200_OK)
        # --- Chiến lược simple ---
        top_k = int(request.GET.get("top_k", 6))
        breakfast_cut = int(request.GET.get("breakfast_cut", 100000))
        dinner_cut = int(request.GET.get("dinner_cut", 200000))
        over_allow_ratio = float(request.GET.get("over_allow_ratio", 0.1))

        # --- Chia ngân sách ---
        try:
            r1, r2, r3 = [float(x) for x in request.GET.get("split_ratio", "0.3,0.4,0.3").split(",")]
        except Exception:
            r1, r2, r3 = 0.3, 0.4, 0.3
        total_r = r1 + r2 + r3 or 1.0
        r1, r2, r3 = r1 / total_r, r2 / total_r, r3 / total_r
        meal_budget = {
            "breakfast": int(budget * r1),
            "lunch": int(budget * r2),
            "dinner": int(budget * r3),
        }

        # --- Trọng số ---
        try:
            w_cuisine, w_price, w_rating = [float(x) for x in request.GET.get("weights", "0.5,0.3,0.2").split(",")]
        except Exception:
            w_cuisine, w_price, w_rating = 0.5, 0.3, 0.2

        # --- Nhóm ứng viên ---
        grouped = {"breakfast": [], "lunch": [], "dinner": []}
        for c in candidates:
            if c.meal_type not in grouped:
                continue
            s = score_candidate(
                c,
                desired_cuisines=preferences,
                meal=c.meal_type,
                meal_budget=meal_budget[c.meal_type],
                w_cuisine=w_cuisine,
                w_price=w_price,
                w_rating=w_rating,
            )
            grouped[c.meal_type].append((c, s))

        for k in grouped.keys():
            grouped[k].sort(key=lambda x: x[1], reverse=True)
            grouped[k] = grouped[k][:top_k]

        b, l, d = pick_best_triplet(
            grouped, total_budget=budget, over_allow_ratio=over_allow_ratio
        )

        def serialize_candidate(c: Candidate | None):
            if not c:
                return None
            return {
                "id": c.id,
                "name": c.name,
                "cuisine_type": c.cuisine_type,
                "price_range": c.price_range,
                "price": c.price,
                "average_rating": c.rating,
                "meal_type": c.meal_type,
            }

        return Response({
            "strategy": "simple",
            "budget": budget,
            "meal_budget": meal_budget,
            "preferences": preferences,
            "best_plan": {
                "breakfast": serialize_candidate(b),
                "lunch": serialize_candidate(l),
                "dinner": serialize_candidate(d),
            },
            "top_candidates": {
                m: [serialize_candidate(c) for c, _ in grouped[m]]
                for m in grouped
            },
        })


class FoodJourneyUpsertView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        date = request.GET.get("date")
        if not date:
            return Response({"detail": "Missing 'date'."}, status=400)
        obj = FoodJourney.objects.filter(user=request.user, date=date).first()
        if not obj:
            return Response(None, status=200)
        return Response(FoodJourneySerializer(obj).data)

    def post(self, request):
        date = request.data.get("date")
        if not date:
            return Response({"detail": "Missing 'date'."}, status=400)

        instance = FoodJourney.objects.filter(user=request.user, date=date).first()
        serializer = FoodJourneySerializer(
            instance or None, data=request.data, partial=bool(instance),
            context={"request": request},
        )

        if serializer.is_valid():
            obj = serializer.save()
            return Response(FoodJourneySerializer(obj).data, status=200 if instance else 201)
        return Response(serializer.errors, status=400)
    
class OverviewView(APIView):
    """Thống kê hệ thống (user, restaurant, feedback)."""
    permission_classes = [AllowAny]

    def get(self, request):
        users = list(CustomUser.objects.values(
            "last_login", "is_email_verified", "email", "created_date"
        ))
        # crawled = CrawledData.objects.count()

        restaurant = Restaurant.objects.count()

        feedback = Feedback.objects.count()

        # active = sum(1 for u in users if u.get("is_email_verified"))
        return Response({
            "total": len(users),
            "restaurant": restaurant,
            "feedback": feedback,
            "data": users,
        })


class CalculateRouteView(APIView):
    """Tính đường đi giữa hai tọa độ (OpenRouteService/OSRM)."""
    permission_classes = [AllowAny]

    def post(self, request):
        coordinates = request.data.get("coordinates")
        api_key = request.data.get("api_key", "")

        if not coordinates or len(coordinates) != 2:
            return Response({"error": "Invalid coordinates. Need 2 points."}, status=400)

        try:
            # --- OpenRouteService ---
            if api_key and api_key != 'eyJvcmciOiI1Yj...':
                ors_url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson'
                ors_response = requests.post(
                    ors_url,
                    json={"coordinates": coordinates},
                    headers={'Authorization': api_key, 'Content-Type': 'application/json'},
                    timeout=10
                )
                if ors_response.status_code == 200:
                    return Response(ors_response.json())

            # --- OSRM fallback ---
            osrm_url = (
                f"https://router.project-osrm.org/route/v1/driving/"
                f"{coordinates[0][0]},{coordinates[0][1]};"
                f"{coordinates[1][0]},{coordinates[1][1]}"
                "?overview=full&geometries=geojson"
            )
            res = requests.get(osrm_url, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data.get('routes'):
                    route = data['routes'][0]
                    return Response({
                        "type": "FeatureCollection",
                        "features": [{
                            "type": "Feature",
                            "geometry": route["geometry"],
                            "properties": {"summary": {"distance": route["distance"]}}
                        }]
                    })

            return Response({"error": "Unable to calculate route."}, status=500)

        except requests.RequestException as e:
            return Response({"error": f"Request failed: {e}"}, status=500)
        except Exception as e:
            return Response({"error": f"Unexpected error: {e}"}, status=500)

logger = logging.getLogger(__name__)


class ProfileView(generics.GenericAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        """Get or create profile for current user"""
        try:
            profile, created = Profile.objects.get_or_create(
                user=self.request.user,
                defaults={
                    'fullname': '',
                    'dob': '2000-01-01',
                    'gender': ''
                }
            )
            logger.info(f"Profile {'created' if created else 'retrieved'} for user {self.request.user.email}")
            return profile
        except Exception as e:
            logger.error(f"Error getting profile for user {self.request.user.email}: {str(e)}")
            raise
    
    def get(self, request):
        """Retrieve user profile"""
        try:
            logger.info(f"GET /profile/ - User: {request.user.email}")
            profile = self.get_object()
            serializer = self.get_serializer(profile)
            logger.info(f"Profile data: {serializer.data}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"GET /profile/ error: {str(e)}")
            return Response(
                {"detail": f"Error retrieving profile: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request):
        """Create or update user profile"""
        try:
            logger.info(f"POST /profile/ - User: {request.user.email}")
            logger.info(f"Request data: {request.data}")
            
            profile = self.get_object()
            serializer = self.get_serializer(profile, data=request.data, partial=True)
            
            if serializer.is_valid():
                serializer.save()
                logger.info(f"✅ Profile saved successfully for {request.user.email}")
                logger.info(f"Saved data: {serializer.data}")
                
                return Response({
                    "message": "Profile saved successfully",
                    "data": serializer.data
                }, status=status.HTTP_200_OK)
            else:
                logger.warning(f"❌ Validation errors: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"❌ POST /profile/ error: {str(e)}", exc_info=True)
            return Response(
                {"detail": f"Error saving profile: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
# ==============================================================
# 5️⃣ CHATBOT APIs - Safe Version
# Thay thế code chatbot cũ bằng version này
# ==============================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def chatbot_test(request):
    """Test endpoint"""
    return Response({
        'status': 'ok',
        'message': 'Chatbot API is working! ✅',
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def chatbot_search(request):
    """
    Search restaurants - Proxy to chatbot_rag_sql for unified logic.
    """
    return chatbot_rag_sql(request)


@api_view(['POST'])
@permission_classes([AllowAny])
def chatbot_ai_search(request):
    """
    AI Search - Proxy to chatbot_rag_sql for unified logic.
    """
    return chatbot_rag_sql(request)


def _parse_nl_query_with_ai(query: str) -> dict:
    """Use Groq AI to parse a natural language query into structured search filters.

    Returns a dict with keys: keywords(list[str]), cuisine(str|None), location(str|None), attributes(list[str])
    Falls back to simple keywords=[query] on error.
    """
    query = (query or "").strip()
    if not query:
        return {"keywords": [], "cuisine": None, "location": None, "attributes": []}

    try:
        client = Groq(api_key=getattr(settings, 'GROQ_API_KEY', None))
        prompt = f"""
Analyze the following user request and return a JSON object with these fields (ONLY JSON):
 - keywords: array of short keywords or phrases to search for (e.g. ["mì quảng", "lâu đời", "BBQ", "thịt nướng"]).
 - dish: specific dish name if present (e.g. "mì Quảng", "pizza", "BBQ", "thịt nướng") or null.
 - cuisine: the cuisine type if explicit. Use Vietnamese names: "Korean"→"Hàn Quốc", "Italian"→"Ý", "Japanese"→"Nhật Bản", "Chinese"→"Trung Quốc", "Vietnamese"→"Việt Nam", "Thai"→"Thái Lan". Return null if not present.
 - location: a place or district if present. IMPORTANT: Keep Vietnamese location names as-is even in English queries (e.g. "in the Hải Châu area"→"Hải Châu", "near Sơn Trà"→"Sơn Trà", "gần cầu Rồng"→"cầu Rồng"). Return null if not present.
 - attributes: array of attributes user wants (e.g. ["nổi tiếng", "gia truyền", "tươi sống"]) or empty array.
 - max_price: integer maximum price in VND if user specifies budget. Convert "500k"→500000, "200k"→200000. Return null if not present.
 - price_category: one of ["cheap","medium","expensive"] if user expresses relative price, else null.
 - min_rating: minimum desired rating (0-10) if present. If user asks for "ngon", "delicious", "best", "tốt", set this to 4.0 (on 5-scale).
 - group_size: integer if user mentions number of people or family/group needs, else null.
 - occasion: one of ["date","family","business","casual"] or null if implied (e.g., 'hẹn hò' -> "date").
 - sort_by: "quality" if user asks for "highest quality"/"chất lượng cao", "rating" if "best rated"/"đánh giá cao", "price_asc" if "cheapest"/"rẻ nhất", or null.
 - limit: integer number of results requested (e.g. "15 quán" -> 15, "top 3" -> 3). If not mentioned, return null.
 - intent: high-level intent such as "find_restaurant", "ask_suggestion", "ask_menu".

Request: "{query}"

Only output the JSON object, no extra commentary.
"""
        resp = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.0,
            max_tokens=350,
        )
        text = resp.choices[0].message.content.strip()
        try:
            parsed = json.loads(text)
            # Normalize keys and types
            return {
                "keywords": parsed.get("keywords") or [],
                "dish": parsed.get("dish") or None,
                "cuisine": parsed.get("cuisine") or None,
                "location": parsed.get("location") or None,
                "attributes": parsed.get("attributes") or [],
                "max_price": int(parsed.get("max_price")) if parsed.get("max_price") is not None else None,
                "price_category": parsed.get("price_category") or None,
                "min_rating": float(parsed.get("min_rating")) if parsed.get("min_rating") is not None else None,
                "group_size": int(parsed.get("group_size")) if parsed.get("group_size") is not None else None,
                "occasion": parsed.get("occasion") or None,
                "sort_by": parsed.get("sort_by") or None,
                "intent": parsed.get("intent") or None,
                "limit": int(parsed.get("limit")) if parsed.get("limit") is not None else None,
            }
        except Exception:
            logger.info("AI parse returned non-JSON or invalid fields, fallback to simple extraction")
            # Heuristic fallback: extract tokens and detect simple price words
            kws = [query]
            max_price = None
            price_cat = None
            m = re.search(r"(\d{1,3}(?:[.,]\d{3})?)\s*(k|K|vnđ|đ|d|VND)?", query)
            if m:
                num = m.group(1).replace('.', '').replace(',', '')
                try:
                    px = int(num) * (1000 if m.group(2) and m.group(2).lower() == 'k' else 1)
                    max_price = px
                except Exception:
                    max_price = None
            return {"keywords": kws, "dish": None, "cuisine": None, "location": None, "attributes": [], "max_price": max_price, "price_category": price_cat, "min_rating": None, "group_size": None, "occasion": None, "intent": None, "sort_by": None, "limit": None}
    except Exception as e:
        logger.exception("AI parsing failed: %s", e)
        return {"keywords": [query], "dish": None, "cuisine": None, "location": None, "attributes": [], "max_price": None, "price_category": None, "min_rating": None, "group_size": None, "occasion": None, "intent": None, "sort_by": None, "limit": None}


def _infer_district_from_street(location_str: str) -> str | None:
    """Infer Da Nang district from a street name.
    
    Returns district name (e.g. "Hải Châu", "Sơn Trà") or None.
    """
    if not location_str:
        return None
        
    low_loc = location_str.lower()
    
    # Street to District Mapping for Da Nang (Expanded)
    mapping = {
        'Hải Châu': [
            'bạch đằng', 'trần phú', 'lê lợi', 'hùng vương', 'phan châu trinh', 'hoàng diệu',
            'nguyễn văn linh', 'phan bội châu', 'chi lăng', 'triệu nữ vương', 'ông ích khiêm',
            'lê đình dương', 'nguyễn hoàng', 'như nguyệt', 'đống đa', 'quang trung', 'lê hồng phong',
            'hoàng văn thụ', 'thái phiên', 'yên bái', 'ngô gia tự', 'hải phòng', 'pastuer', 'nguyễn chí thanh'
        ],
        'Sơn Trà': [
            'ngô quyền', 'phạm văn đồng', 'võ nguyên giáp', 'hồ nghinh', 'trần hưng đạo',
            'ngô thế vinh', 'nguyễn phan vinh', 'yết kiêu', 'võ văn kiệt', 'vương thừa vũ',
            'nguyễn công trứ', 'đỗ anh hàn', 'lê hữu trác', 'nguyễn duy hiệu', 'trần hưng đạo'
        ],
        'Ngũ Hành Sơn': [
            'lê văn hiến', 'trường sa', 'hồ xuân hương', 'chương dương', 'minh mạng', 'nguyễn xiển',
            'châu thị vĩnh tế', 'phần hành', 'an thượng', 'ngô viết thụ', 'vỗ nguyên giáp'
        ],
        'Thanh Khê': [
            'điện biên phủ', 'nguyễn tất thành', 'lý thái tổ', 'hùng vương', 'hà huy tập', 'trần cao vân',
            'nguyễn tri phương', 'lê duẩn', 'nguyễn hữu thọ', 'thái thị bôi', 'kỳ đồng', 'vĩnh trung'
        ],
        'Liên Chiểu': [
            'tôn đức thắng', 'nguyễn lương bằng', 'âu cơ', 'lạc long quân', 'nguyễn sinh sắc',
            'kinh dương vương', 'ngô thì nhậm', 'đặng dung', 'nguyễn chánh'
        ],
        'Cẩm Lệ': [
            'cách mạng tháng tám', 'ông ích đường', 'văn tiến dũng', 'trần nam trung', 'nguyễn hữu thọ', 
            'tố hữu', 'lê đại hành', 'trường chinh', 'việt bắc', 'nguyễn nhàn'
        ],
        'Hòa Vang': [
            'quốc lộ 1a', 'quốc lộ 14b', 'trường sơn', 'âu cơ'
        ]
    }
    
    for district, streets in mapping.items():
        if any(street in low_loc for street in streets):
            return district
            
    return None


def _expand_cuisine_keywords(cuisine: str, keywords: list) -> list:
    """Expand cuisine type with language equivalents for better search coverage.
    
    For example: "Hàn Quốc" -> ["Hàn Quốc", "Korean", "Korea", "Hàn"]
    """
    if not cuisine:
        return keywords
    
    cuisine_lower = cuisine.lower()
    expanded = list(keywords) if keywords else []
    
    # Cuisine mapping: Vietnamese <-> English equivalents
    cuisine_map = {
        'hàn quốc': ['korean', 'korea', 'hàn'],
        'korean': ['hàn quốc', 'korea', 'hàn'],
        'ý': ['italian', 'italy', 'italia'],
        'italian': ['ý', 'italy'],
        'nhật bản': ['japanese', 'japan', 'nhật'],
        'japanese': ['nhật bản', 'japan', 'nhật'],
        'trung quốc': ['chinese', 'china', 'trung'],
        'chinese': ['trung quốc', 'china', 'trung'],
        'thái lan': ['thai', 'thailand', 'thái'],
        'thai': ['thái lan', 'thailand', 'thái'],
        'việt nam': ['vietnamese', 'vietnam', 'việt'],
        'việt nam': ['vietnamese', 'vietnam', 'việt'],
        'vietnamese': ['việt nam', 'vietnam', 'việt'],
        'chay': ['vegetarian', 'vegan', 'veggie'],
        'vegetarian': ['chay', 'vegan'],
        'vegan': ['chay', 'vegetarian'],
    }
    
    # Add the original cuisine
    if cuisine not in expanded:
        expanded.append(cuisine)
    
    # Add equivalents
    for key, equivalents in cuisine_map.items():
        if key in cuisine_lower:
            for equiv in equivalents:
                if equiv not in [k.lower() for k in expanded]:
                    expanded.append(equiv)
            break
    
    return expanded


def _detect_language(query: str) -> str:
    """Detect if query is in English or Vietnamese.
    
    Returns 'en' for English, 'vi' for Vietnamese.
    """
    query_lower = query.lower().strip()
    
    # English indicators
    english_keywords = [
        'hello', 'hi', 'hey', 'good', 'find', 'search', 'want', 'need',
        'restaurant', 'food', 'where', 'what', 'how', 'which', 'best',
        'cheap', 'expensive', 'near', 'pizza', 'seafood', 'bbq',
        'compare', 'vs', 'versus', 'better', 'price', 'rating',
        'spicy', 'light', 'heavy', 'dish', 'dishes', 'the', 'is', 'are',
        'can', 'you', 'please', 'show', 'me', 'any', 'some', 'hungry', 'tired'
    ]
    
    # Vietnamese indicators  
    vietnamese_keywords = [
        'xin chào', 'chào', 'tìm', 'muốn', 'cần', 'quán', 'món',
        'ăn', 'ngon', 'rẻ', 'đắt', 'gần', 'ở đâu', 'nào', 'tốt',
        'so sánh', 'hay', 'hơn', 'giá', 'đánh giá', 'phở', 'bún',
        'cay', 'nhẹ', 'nặng', 'đói', 'có', 'không', 'gì', 'thế nào',
        'mở cửa', 'lúc', 'mấy', 'giờ', 'địa chỉ', 'số điện thoại'
    ]
    
    # Count matches
    en_count = sum(1 for kw in english_keywords if kw in query_lower)
    vi_count = sum(1 for kw in vietnamese_keywords if kw in query_lower)
    
    # Check for Vietnamese diacritics
    vietnamese_chars = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ'
    has_vietnamese_chars = any(c in query_lower for c in vietnamese_chars)
    
    # Decision logic
    # If we have clear Vietnamese indicators (chars or keywords), prioritize Vietnamese
    # especially for queries containing mixed English brand names
    if has_vietnamese_chars and vi_count > 0:
        return 'vi'
    if vi_count > en_count:
        return 'vi'
    if en_count >= 2 and en_count > vi_count:
        return 'en'
    if en_count > 0:
        return 'en'
    if has_vietnamese_chars:
        return 'vi'
    return 'vi'


def _get_localized_message(key: str, lang: str, **kwargs) -> str:
    """Get localized message template."""
    messages = {
        'greeting_vi': 'Xin chào! Tôi có thể giúp bạn tìm món ăn và quán ăn.',
        'greeting_en': 'Hello! I can help you find food and restaurants.',
        
        'no_results_vi': 'Không tìm thấy kết quả cho "{query}". Bạn thử tìm kiếm khác nhé!',
        'no_results_en': 'No results found for "{query}". Please try a different search!',
        
        'found_results_vi': 'Tìm thấy {count} quán phù hợp với "{query}"!',
        'found_results_en': 'Found {count} restaurants matching "{query}"!',
        
        'clarify_vi': 'Bạn nói rõ hơn giúp mình được không? Ví dụ: "Tôi muốn ăn pizza ở Sơn Trà"',
        'clarify_en': 'Could you be more specific? For example: "I want pizza in Son Tra"',
        
        'vague_query_vi': 'Bạn đang đói nhỉ 😊 Để mình gợi ý:\n🍕 Pizza - Nhanh, ngon\n🍜 Phở/Bún - Nhẹ bụng\n🦞 Hải sản - Tươi ngon\n🥩 BBQ - Thịnh soạn\n\nBạn thích món nào? Hoặc có mức giá cụ thể không?',
        'vague_query_en': 'You\'re hungry! 😊 Let me suggest:\n🍕 Pizza - Quick & tasty\n🍜 Pho/Noodles - Light\n🦞 Seafood - Fresh\n🥩 BBQ - Hearty\n\nWhat would you like? Any budget in mind?',
    }
    
    template_key = f'{key}_{lang}'
    template = messages.get(template_key, messages.get(f'{key}_vi', ''))
    return template.format(**kwargs) if kwargs else template


def _detect_query_type(query: str, lang: str) -> dict:
    """Detect what type of query this is.
    
    Returns dict with type: 'spiciness', 'digestibility', 'restaurant_info', 'comparison', 'search', 'chit_chat'
    """
    low_q = query.lower()
    
    # 1. Chit-chat / Conversational keywords (Check this early if very short or specific keywords)
    chitchat_keywords_vi = ['chào', 'hello', 'hi', 'bạn là ai', 'tên gì', 'khỏe không', 'buồn', 'vui', 'chán', 'mệt', 'tâm sự', 'người yêu', 'thất tình', 'cô đơn', 'giúp tôi', 'ơi', 'à', 'ừ', 'vâng', 'cảm ơn', 'thanks']
    chitchat_keywords_en = ['who are you', 'how are you', 'whats up', 'sad', 'happy', 'bored', 'tired', 'help me', 'thanks', 'thank you']
    
    food_words = ['ăn', 'uống', 'quán', 'nhà hàng', 'món', 'đói', 'thèm', 'cửa hàng', 'hiệu', 'tiệm']
    if any(kw in low_q for kw in (chitchat_keywords_vi + chitchat_keywords_en)):
        # If no food keywords or very short, it's likely chit-chat
        if not any(fw in low_q for fw in food_words) or len(low_q.split()) < 3:
            return {'type': 'chit_chat'}

    # 2. Restaurant info keywords
    info_keywords_vi = ['mở cửa', 'đóng cửa', 'số điện thoại', 'địa chỉ', 'ở đâu', 'giờ nào', 'giờ mở', 'lúc mấy giờ', 'giờ làm việc', 'sđt', 'liên lạc']
    info_keywords_en = ['open', 'close', 'phone', 'address', 'where', 'what time', 'hours', 'when', 'contact', 'location', 'working hours']
    
    if any(kw in low_q for kw in (info_keywords_vi + info_keywords_en)):
        logger.info(f"Detected info query: '{query}'")
        return {'type': 'restaurant_info'}

    # 3. Spiciness keywords
    spicy_keywords_vi = ['cay', 'không cay', 'ít cay', 'cay nhất', 'cay vừa']
    spicy_keywords_en = ['spicy', 'not spicy', 'mild', 'spiciest', 'hot']
    
    # Extra check for 'hot' to avoid confusion with high temperature
    if 'hot' in low_q:
        spicy_context = ['pepper', 'sauce', 'chili', 'spicy', 'food', 'dish']
        if not any(ctx in low_q for ctx in spicy_context):
            # If 'hot' is used without food/spice context, maybe it's not spiciness search
            pass

    if any(kw in low_q for kw in (spicy_keywords_vi + spicy_keywords_en)):
        return {'type': 'spiciness'}
    
    # 4. Digestibility keywords
    digest_keywords_vi = ['nhẹ bụng', 'nặng bụng', 'dễ tiêu', 'khó tiêu', 'ít béo', 'nhẹ', 'nặng']
    digest_keywords_en = ['light', 'heavy', 'easy to digest', 'digest', 'healthy']
    
    if any(kw in low_q for kw in (digest_keywords_vi + digest_keywords_en)):
        return {'type': 'digestibility'}
    
    # 5. Comparison
    if ' vs ' in low_q or ' hay ' in low_q or 'so sánh' in low_q or 'compare' in low_q:
        return {'type': 'comparison'}
    
    # Default to search
    return {'type': 'search'}


def _analyze_dish_characteristics(dishes: list, characteristic: str, lang: str) -> str:
    """Use AI to analyze dish characteristics (spiciness, digestibility).
    
    Args:
        dishes: List of dish/restaurant names
        characteristic: 'spicy' or 'heaviness'
        lang: 'vi' or 'en'
    
    Returns:
        AI-generated analysis with emojis and recommendations
    """
    if not hasattr(settings, 'GROQ_API_KEY') or not settings.GROQ_API_KEY:
        if lang == 'en':
            return "AI analysis feature is not available."
        return "Tính năng phân tích AI chưa khả dụng."
    
    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        
        if characteristic == 'spicy':
            if lang == 'en':
                prompt = f'''Analyze spiciness levels of these Vietnamese dishes: {", ".join(dishes[:10])}

Classify each as:
🌶️🌶️🌶️ Very spicy
🌶️🌶️ Medium spicy  
🌶️ Mildly spicy
✅ Not spicy

Be brief, friendly, and recommend 2-3 non-spicy options if asked.'''
            else:
                prompt = f'''Phân tích độ cay của các món: {", ".join(dishes[:10])}

Phân loại:
🌶️🌶️🌶️ Rất cay
🌶️🌶️ Cay vừa
🌶️ Hơi cay
✅ Không cay

Ngắn gọn, thân thiện, gợi ý 2-3 món không cay nếu được hỏi.'''
        
        else:  # heaviness/digestibility
            if lang == 'en':
                prompt = f'''Analyze digestibility of these dishes: {", ".join(dishes[:10])}

Classify as:
🪶 Light (easy to digest): soups, steamed, salads
⚖️ Medium: rice, stir-fry, noodles
🍖 Heavy (hard to digest): BBQ, fried, hot pot

Be brief and recommend 2-3 light options.'''
            else:
                prompt = f'''Phân tích độ tiêu hóa của các món: {", ".join(dishes[:10])}

Phân loại:
🪶 Nhẹ (dễ tiêu): súp, món hấp, salad
⚖️ Trung bình: cơm, xào, mì
🍖 Nặng (khó tiêu): BBQ, chiên, lẩu

Ngắn gọn, gợi ý 2-3 món nhẹ.'''
        
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=300
        )
        
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Error in dish characteristics analysis: {e}")
        if lang == 'en':
            return "Sorry, I couldn't analyze the dishes at the moment."
        return "Xin lỗi, tôi không thể phân tích các món ăn lúc này."


def _handle_comparison(query: str, lang: str) -> dict:
    """Handle restaurant comparison queries.
    
    Extracts two restaurant names and compares them.
    """
    import re
    
    # Extract restaurant names from comparison query
    # Patterns: "A vs B", "A hay B", "A và B ... ngon hơn/tốt hơn"
    restaurants_names = []
    
    if lang == 'vi':
        # Vietnamese patterns - more flexible
        patterns = [
            r'(.+?)\s+(?:vs|hay|và)\s+(.+?)\s*,?\s*(?:quán nào|nào|cái nào|món nào)',
            r'(.+?)\s+(?:vs|hay|và)\s+(.+?)\s*,?\s*(?:ngon hơn|tốt hơn|rẻ hơn|tốt|ngon)',
            r'so sánh\s+(.+?)\s+(?:vs|hay|và)\s+(.+?)(?:\s|,|$)',
            r'(.+?)\s+(?:vs|hay|và)\s+(.+?)(?:\s*,|\s*\?|$)',  # Fallback: just "A vs/hay/và B"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                restaurants_names = [match.group(1).strip(), match.group(2).strip()]
                logger.info(f"Vietnamese pattern matched: {pattern}")
                break
    else:
        # English patterns - more flexible
        patterns = [
            r'(.+?)\s+vs\s+(.+?)\s*,?\s*(?:which|what|better)',
            r'(.+?)\s+or\s+(.+?)\s*,?\s*(?:which|what|better)',
            r'compare\s+(.+?)\s+(?:vs|and|or|with)\s+(.+?)(?:\s|,|$)',
            r'(.+?)\s+vs\s+(.+?)(?:\s*,|\s*\?|$)',  # Fallback: just "A vs B"
            r'(.+?)\s+or\s+(.+?)(?:\s*,|\s*\?|$)',  # Fallback: just "A or B"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                restaurants_names = [match.group(1).strip(), match.group(2).strip()]
                logger.info(f"English pattern matched: {pattern}")
                break
    
    # Clean up extracted names - remove trailing punctuation
    if restaurants_names:
        restaurants_names = [re.sub(r'[,\.\?!]+$', '', name).strip() for name in restaurants_names]
    
    logger.info(f"Comparison query - Extracted names: {restaurants_names}")

    
    if len(restaurants_names) != 2:
        if lang == 'en':
            return {
                'answer': "I couldn't identify two restaurants to compare. Please use format: 'Restaurant A vs Restaurant B'",
                'results': []
            }
        else:
            return {
                'answer': "Tôi không thể xác định được 2 quán để so sánh. Vui lòng dùng format: 'Quán A vs Quán B' hoặc 'Quán A hay Quán B'",
                'results': []
            }
    
    # Search for both restaurants
    results = []
    for name in restaurants_names:
        logger.info(f"Searching for restaurant: '{name}'")
        
        # Try exact match first
        r = Restaurant.objects.filter(name__iexact=name).first()
        
        if not r:
            # Try partial match
            r = Restaurant.objects.filter(name__icontains=name).first()
            if r:
                logger.info(f"  Found by partial match: {r.name}")
        
        if not r:
            # Strip common words and try again
            # Remove: Restaurant, Nhà Hàng, Quán, Vegetarian, Chay, Shop, Snack
            clean_name = name
            for word in ['Restaurant', 'Nhà Hàng', 'Quán', 'Vegetarian', 'Chay', 'Shop', 'Snack', 'Bar', 'Café']:
                clean_name = clean_name.replace(word, '').strip()
            
            # Remove extra spaces
            clean_name = ' '.join(clean_name.split())
            
            if clean_name and clean_name != name:
                logger.info(f"  Trying cleaned name: '{clean_name}'")
                r = Restaurant.objects.filter(name__icontains=clean_name).first()
                if r:
                    logger.info(f"  Found by cleaned name: {r.name}")
        
        if not r and len(name.split()) > 2:
            # Try first few words
            partial = ' '.join(name.split()[:3])
            r = Restaurant.objects.filter(name__icontains=partial).first()
            if r:
                logger.info(f"  Found by first words '{partial}': {r.name}")
        
        if not r and len(name.split()) >= 2:
            # Try first 2 words
            partial = ' '.join(name.split()[:2])
            r = Restaurant.objects.filter(name__icontains=partial).first()
            if r:
                logger.info(f"  Found by first 2 words '{partial}': {r.name}")
        
        if r:
            results.append({
                'id': r.id,
                'name': r.name,
                'cuisine_type': r.cuisine_type or '',
                'rating': float(r.average_rating) if r.average_rating else 0,
                'address': r.address,
                'price_range': r.price_range or '',
                'phone': '',
                'image': r.image or '',
                'opening_hours': r.opening_hours or ''
            })
            logger.info(f"✓ Found restaurant: {r.name} ({r.cuisine_type})")
        else:
            logger.warning(f"✗ Could not find restaurant: '{name}'")


    
    if len(results) < 2:
        if lang == 'en':
            found_names = [r['name'] for r in results]
            return {
                'answer': f"I could only find: {', '.join(found_names)}. Please check the restaurant names.",
                'results': results
            }
        else:
            found_names = [r['name'] for r in results]
            return {
                'answer': f"Tôi chỉ tìm thấy: {', '.join(found_names)}. Vui lòng kiểm tra lại tên quán.",
                'results': results
            }
    
    # Check if both restaurants have similar cuisine types
    cuisine1 = results[0].get('cuisine_type', '').lower()
    cuisine2 = results[1].get('cuisine_type', '').lower()
    
    logger.info(f"Comparing cuisines: '{cuisine1}' vs '{cuisine2}'")
    
    # Define cuisine categories for comparison - restaurants must be in same category
    cuisine_categories = {
        'vietnamese': ['vietnam', 'vietnamese', 'việt nam', 'central', 'hanoi', 'hà nội'],
        'chinese': ['chinese', 'trung quốc', 'china', 'hongkong', 'taiwan'],
        'japanese': ['japanese', 'nhật bản', 'japan', 'nhật'],
        'korean': ['korean', 'hàn quốc', 'korea', 'hàn'],
        'thai': ['thai', 'thái lan', 'thailand'],
        'western': ['italian', 'ý', 'american', 'mỹ', 'french', 'pháp'],
        'mexican': ['mexican', 'mexico'],
        'vegetarian': ['vegetarian', 'chay', 'vegan'],
        'snack': ['snack', 'ăn vặt'],
        'pizza': ['pizza'],
        'burger': ['burger'],
        'hotpot': ['hotpot', 'lẩu'],
    }
    
    # Get cuisine category for each restaurant
    def get_cuisine_category(cuisine):
        cuisine_lower = cuisine.lower()
        for category, keywords in cuisine_categories.items():
            if any(kw in cuisine_lower for kw in keywords):
                return category
        return 'other'
    
    cat1 = get_cuisine_category(cuisine1)
    cat2 = get_cuisine_category(cuisine2)
    
    logger.info(f"Categories: '{cat1}' vs '{cat2}'")
    
    # Decline comparison if cuisines are in different categories
    # Allow comparison only if: same category OR both are 'other' (unknown)
    if cat1 != cat2:
        if lang == 'en':
            return {
                'answer': f"I'm sorry, but I can't meaningfully compare {results[0]['name']} ({results[0]['cuisine_type']}) and {results[1]['name']} ({results[1]['cuisine_type']}) as they serve very different types of food. Would you like me to suggest similar restaurants to compare instead?",
                'results': results
            }
        else:
            return {
                'answer': f"Xin lỗi, tôi không thể so sánh {results[0]['name']} ({results[0]['cuisine_type']}) và {results[1]['name']} ({results[1]['cuisine_type']}) vì họ phục vụ các loại món ăn rất khác nhau. Bạn có muốn tôi gợi ý các quán tương tự để so sánh không?",
                'results': results
            }
    
    logger.info(f"Cuisines are compatible, proceeding with comparison")
    
    # Generate AI comparison
    if not hasattr(settings, 'GROQ_API_KEY') or not settings.GROQ_API_KEY:
        # Fallback without AI
        if lang == 'en':
            answer = f"**Comparison: {results[0]['name']} vs {results[1]['name']}**\n\n"
            answer += f"**{results[0]['name']}**\n"
            answer += f"⭐ Rating: {results[0]['rating']}/10\n"
            answer += f"💰 Price: {results[0]['price_range']}\n\n"
            answer += f"**{results[1]['name']}**\n"
            answer += f"⭐ Rating: {results[1]['rating']}/10\n"
            answer += f"💰 Price: {results[1]['price_range']}\n"
        else:
            answer = f"**So sánh: {results[0]['name']} vs {results[1]['name']}**\n\n"
            answer += f"**{results[0]['name']}**\n"
            answer += f"⭐ Đánh giá: {results[0]['rating']}/10\n"
            answer += f"💰 Giá: {results[0]['price_range']}\n\n"
            answer += f"**{results[1]['name']}**\n"
            answer += f"⭐ Đánh giá: {results[1]['rating']}/10\n"
            answer += f"💰 Giá: {results[1]['price_range']}\n"
    else:
        # Use AI for detailed comparison
        try:
            client = Groq(api_key=settings.GROQ_API_KEY)
            
            if lang == 'en':
                prompt = f"""Compare these two restaurants and recommend which is better:

**{results[0]['name']}**
- Cuisine: {results[0]['cuisine_type']}
- Rating: {results[0]['rating']}/10
- Price: {results[0]['price_range']}
- Address: {results[0]['address']}

**{results[1]['name']}**
- Cuisine: {results[1]['cuisine_type']}
- Rating: {results[1]['rating']}/10
- Price: {results[1]['price_range']}
- Address: {results[1]['address']}

Provide a brief, friendly comparison focusing on:
1. Which has better rating
2. Which offers better value
3. Your recommendation

Be concise and decisive."""
            else:
                prompt = f"""So sánh 2 quán ăn này và gợi ý quán nào tốt hơn:

**{results[0]['name']}**
- Loại: {results[0]['cuisine_type']}
- Đánh giá: {results[0]['rating']}/10
- Giá: {results[0]['price_range']}
- Địa chỉ: {results[0]['address']}

**{results[1]['name']}**
- Loại: {results[1]['cuisine_type']}
- Đánh giá: {results[1]['rating']}/10
- Giá: {results[1]['price_range']}
- Địa chỉ: {results[1]['address']}

Đưa ra so sánh ngắn gọn, thân thiện về:
1. Quán nào rating cao hơn
2. Quán nào giá trị hơn
3. Gợi ý của bạn

Ngắn gọn và quyết đoán."""
            
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=400
            )
            
            answer = response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"AI comparison error: {e}")
            # Fallback to simple comparison
            if lang == 'en':
                answer = f"Comparing {results[0]['name']} (⭐{results[0]['rating']}) vs {results[1]['name']} (⭐{results[1]['rating']})"
            else:
                answer = f"So sánh {results[0]['name']} (⭐{results[0]['rating']}) vs {results[1]['name']} (⭐{results[1]['rating']})"
    
    return {
        'answer': answer,
        'results': results
    }


def _format_opening_hours(hours_str: str, lang: str = 'vi') -> str:
    """Shorten redundant opening hours (e.g., 'Mo-Su 09:00-21:00')."""
    if not hours_str:
        return 'Not available' if lang == 'en' else 'Chưa có thông tin'
    
    parts = [p.strip() for p in hours_str.split('|') if p.strip()]
    if len(parts) < 2:
        return hours_str
        
    times = []
    for p in parts:
        match = re.search(r'^[A-Za-z]{2,3}\s+(.*)$', p)
        if match:
            times.append(match.group(1).strip())
        else:
            times.append(p)
            
    if len(set(times)) == 1 and len(times) >= 6:
        label = "Daily" if lang == 'en' else "Hàng ngày"
        return f"{label} {times[0]}"
    
    return hours_str


def _get_restaurant_info(query: str, lang: str) -> dict:
    """Extract restaurant name and return specific information."""
    import re
    
    # Remove question words to isolate restaurant name
    clean_query = query
    
    if lang == 'vi':
        # Pattern 1: "tên quán + question" (e.g., "Snow Pizza mở cửa lúc mấy giờ")
        patterns = [
            r'(.*?)\s+(mở cửa|đóng cửa|giờ mở|lúc mấy giờ)',
            r'(.*?)\s+(số điện thoại|phone)',
            r'(.*?)\s+(địa chỉ|ở đâu)',
        ]
        for pattern in patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                clean_query = match.group(1).strip()
                break
    else:
        # For English, handle both patterns:
        # Pattern 1: "what time does Snow Pizza open?" - extract between "does" and verb
        # Pattern 2: "Snow Pizza hours" - extract before keyword
        
        # Try pattern: "what time/when does RESTAURANT_NAME open/close"
        match = re.search(r'(?:what time|when)\s+(?:does|is)\s+(.*?)\s+(?:open|close|have)', query, re.IGNORECASE)
        if match:
            clean_query = match.group(1).strip()
        else:
            # Try pattern: "RESTAURANT_NAME + keyword"
            patterns = [
                r'(.*?)\s+(?:open|close|hours|what time|when)',
                r'(.*?)\s+(?:phone|number)',
                r'(.*?)\s+(?:address|where|location)',
            ]
            for pattern in patterns:
                match = re.search(pattern, query, re.IGNORECASE)
                if match:
                    clean_query = match.group(1).strip()
                    break
    
    # Clean up common question words that might remain
    clean_query = re.sub(r'^(what|when|where|how|does|is|the)\s+', '', clean_query, flags=re.IGNORECASE)
    
    logger.info(f"Extracted restaurant name: '{clean_query}' from query: '{query}'")
    
    # Search for restaurant - try exact match first, then partial
    restaurants = Restaurant.objects.filter(name__iexact=clean_query)
    
    if not restaurants.exists():
        # Try partial match
        restaurants = Restaurant.objects.filter(name__icontains=clean_query)
    
    if not restaurants.exists():
        # Try matching with first few words
        words = clean_query.split()
        if len(words) > 2:
            # Try first 3 words
            partial_name = ' '.join(words[:3])
            restaurants = Restaurant.objects.filter(name__icontains=partial_name)
        elif len(words) >= 1:
            # Try first word
            restaurants = Restaurant.objects.filter(name__icontains=words[0])
    
    # If still no results, try removing common prefixes like "quán", "nhà hàng"
    if not restaurants.exists():
        simpler_query = re.sub(r'^(quán|nhà hàng|hiệu)\s+', '', clean_query, flags=re.IGNORECASE)
        if simpler_query != clean_query:
            restaurants = Restaurant.objects.filter(name__icontains=simpler_query)
    
    # Limit to 1 for specific info queries to avoid confusion
    restaurants = restaurants[:1]
    
    if not restaurants:
        if lang == 'en':
            return {'answer': f"Sorry, I couldn't find information about '{clean_query}'.", 'results': []}
        else:
            return {'answer': f"Xin lỗi, tôi không tìm thấy thông tin về '{clean_query}'.", 'results': []}
    
    r = restaurants[0]
    logger.info(f"Found restaurant: {r.name}")
    
    formatted_hours = _format_opening_hours(r.opening_hours, lang)
    
    # Build detailed response
    if lang == 'en':
        answer = f"{r.name}\n\n"
        is_hour_q = any(kw in query.lower() for kw in ['open', 'hour', 'when', 'time'])
        is_phone_q = 'phone' in query.lower()
        is_addr_q = any(kw in query.lower() for kw in ['address', 'where'])
        
        if is_hour_q:
            answer += f"⏰ Hours: {formatted_hours}\n"
        if is_phone_q:
            answer += f"📞 Phone: {r.phone_number or 'Not available'}\n"
        if is_addr_q:
            answer += f"📍 Address: {r.address}\n"
        
        # If no specific info requested, show all
        if not (is_hour_q or is_phone_q or is_addr_q):
            answer += f"⏰ Hours: {formatted_hours}\n"
            answer += f"📞 Phone: {r.phone_number or 'Not available'}\n"
            answer += f"📍 Address: {r.address}\n"
            answer += f"💰 Price: {r.price_range}\n"
            answer += f"⭐ Rating: {r.average_rating}/10"
    else:
        answer = f"{r.name}\n\n"
        is_hour_q = any(kw in query.lower() for kw in ['mở cửa', 'giờ', 'lúc mấy'])
        is_phone_q = any(kw in query.lower() for kw in ['điện thoại', 'phone'])
        is_addr_q = any(kw in query.lower() for kw in ['địa chỉ', 'ở đâu'])

        if is_hour_q:
            answer += f"⏰ Giờ mở cửa: {formatted_hours}\n"
        if is_phone_q:
            answer += f"📞 Số điện thoại: {r.phone_number or 'Chưa có thông tin'}\n"
        if is_addr_q:
            answer += f"📍 Địa chỉ: {r.address}\n"
        
        # If no specific info requested, show all
        if not (is_hour_q or is_phone_q or is_addr_q):
            answer += f"⏰ Giờ mở cửa: {formatted_hours}\n"
            answer += f"📞 Số điện thoại: {r.phone_number or 'Chưa có thông tin'}\n"
            answer += f"📍 Địa chỉ: {r.address}\n"
            answer += f"💰 Giá: {r.price_range}\n"
            answer += f"⭐ Đánh giá: {r.average_rating}/10"
    
    # Serialize restaurant data
    result_data = {
        'id': r.id,
        'name': r.name,
        'cuisine_type': r.cuisine_type or '',
        'address': r.address,
        'price_range': r.price_range or '',
        'rating': float(r.average_rating) if r.average_rating else 0,
        'phone': '',
        'image': r.image or '',
        'opening_hours': r.opening_hours or ''
    }
    
    return {
        'answer': answer,
        'results': [result_data]
    }


def _filter_relevant_results(results: list, keywords: list, max_price: int = None) -> list:
    """
    Filter search results to keep only restaurants that match the keywords and price.
    
    For example, if user searches for 'hải sản', remove Pizza, BBQ, etc.
    If user specifies max_price, remove restaurants exceeding that price.
    """
    if not results:
        return results
    
    filtered = []
    
    for restaurant in results:
        name = restaurant.get('name', '').lower()
        cuisine = restaurant.get('cuisine_type', '').lower()
        price_range = restaurant.get('price_range', '')
        
        # Check keyword relevance
        is_relevant = True
        if keywords:
            keywords_lower = [kw.lower() for kw in keywords]
            is_relevant = False
            for keyword in keywords_lower:
                if keyword in name or keyword in cuisine:
                    is_relevant = True
                    break
        
        if not is_relevant:
            continue
        
        # Check price if specified
        if max_price:
            import re
            # Extract max price from range (e.g., "50,000 - 200,000 đ")
            price_nums = re.findall(r'(\d+(?:,\d+)*)', price_range)
            if price_nums:
                # Get the highest price in the range
                restaurant_max_price = int(price_nums[-1].replace(',', ''))
                if restaurant_max_price > max_price:
                    logger.info(f"Filtered out {name}: price {restaurant_max_price} > {max_price}")
                    continue
        
        filtered.append(restaurant)
    
    # If filtering removed everything, return original results
    # (better to show something than nothing)
    if not filtered:
        logger.warning(f"Filtering removed all results for keywords: {keywords}")
        return results
    
    logger.info(f"Filtered {len(results)} results down to {len(filtered)} relevant ones")
    return filtered


def _structured_search(keywords: list, location: str | None, attributes: list, top_k: int = 10, max_price: int | None = None, min_rating: float | None = None, price_category: str | None = None, group_size: int | None = None, occasion: str | None = None, dish: str | None = None, sort_by: str | None = None):
    """Perform a DB search using structured filters. Returns list of result dicts.

    This builds safe LIKE clauses from keywords and attributes, applies location filter,
    and returns rows ordered by average_rating desc and match count.
    """
    # Use Django DB through DjangoEngine wrapper from vendor if available
    try:
        from .rag_sql_vendor.db.django_engine import DjangoEngine
        db = DjangoEngine()
    except Exception:
        # fallback to raw django connection

        class _RawDB:
            def execute_query(self, q, limit=500):
                from django.db import connection
                with connection.cursor() as cursor:
                    cursor.execute(q)
                    cols = [c[0] for c in cursor.description] if cursor.description else []
                    rows = cursor.fetchall()
                    out = []
                    for r in rows:
                        out.append({cols[i]: r[i] for i in range(len(cols))})
                    return out

        db = _RawDB()

    # Build token clauses
    import re

    toks = []
    strict_dish = False
    if dish and dish.strip():
        d = dish.strip()
        toks.append(d)
        strict_dish = True
    else:
        for kw in keywords or []:
            if not kw:
                continue

            toks.append(kw.strip())
            for t in re.findall(r"[\wÀ-ỹ]+", kw, flags=re.UNICODE):
                if len(t) > 1:
                    toks.append(t)

    toks = list(dict.fromkeys([t.lower() for t in toks]))

    # Allow search with location only - don't require keywords
    if not toks and not attributes and not location and not max_price and not min_rating:
        return []

    where_clauses = []
    # If strict dish requested, require dish presence in name or rag_context_text
    if strict_dish:
        d_esc = toks[0].lower().replace("'", "''")
        try:
            cuisine_sql = f"SELECT * FROM restaurants WHERE LOWER(cuisine_type) LIKE '%{d_esc}%' LIMIT {max(50, top_k*5)}"
            cuisine_rows = db.execute_query(cuisine_sql)
            if cuisine_rows:
                # Process and return these rows directly
                processed = []
                def match_count_c(r):
                    s = " ".join([str(r.get(k, "")) for k in ("name", "cuisine_type", "address", "rag_context_text")]).lower()
                    cnt = 0
                    for t in toks:
                        if t in s:
                            cnt += 1
                    return cnt

                for r in cuisine_rows:
                    processed.append({
                        "name": r.get("name") or '',
                        "average_rating": float(r.get("average_rating") or 0) if r.get("average_rating") is not None else None,
                        "rating": float(r.get("average_rating") or 0) if r.get("average_rating") is not None else None,
                        "address": r.get("address") or '',
                        "price_range": r.get("price_range") or '',
                        "phone": r.get("phone_number") or '',
                        "image": r.get("image") or '',
                        "imageUrl": r.get("image") or '',
                        "rate": float(r.get("average_rating") or 0) if r.get("average_rating") is not None else None,
                        "quality_score": float(r.get("quality_score") or 0) if r.get("quality_score") is not None else None,
                        "is_featured": bool(r.get("is_featured")) if r.get("is_featured") is not None else False,
                        "_match_count": match_count_c(r),
                    })
                processed.sort(key=lambda x: (x.get("_match_count", 0), x.get("average_rating") or 0), reverse=True)
                for it in processed:
                    it.pop("_match_count", None)
                return processed[:top_k]
        except Exception:
            logger.info("Cuisine-type based search failed or returned no rows; falling back to name/rag text match")
        
        # Also try simpler version for cuisine (e.g. "món chay" -> "chay")
        d_simple = d_esc.replace("món ", "").replace("thực đơn ", "").strip()
        dish_clause = f"(LOWER(name) LIKE '%{d_esc}%' OR LOWER(rag_context_text) LIKE '%{d_esc}%' OR LOWER(cuisine_type) LIKE '%{d_simple}%')"
        # We'll require the dish clause; other keywords (if any) are optional
        where_clauses_required = [dish_clause]
        optional_clauses = []
        for t in toks[1:]:
            esc = t.replace("'", "''")
            optional_clauses.append(f"(LOWER(name) LIKE '%{esc}%' OR LOWER(rag_context_text) LIKE '%{esc}%' OR LOWER(cuisine_type) LIKE '%{esc}%' OR LOWER(address) LIKE '%{esc}%')")
        for attr in attributes or []:
            a = attr.strip()
            if not a:
                continue
            esc = a.replace("'", "''")
            optional_clauses.append(f"(LOWER(rag_context_text) LIKE '%{esc}%' OR LOWER(name) LIKE '%{esc}%')")
    else:
        for t in toks:
            esc = t.replace("'", "''")
            clause = f"(LOWER(name) LIKE '%{esc}%' OR LOWER(rag_context_text) LIKE '%{esc}%' OR LOWER(cuisine_type) LIKE '%{esc}%' OR LOWER(address) LIKE '%{esc}%')"
            where_clauses.append(clause)
        # attributes as additional tokens
        for attr in attributes or []:
            a = attr.strip()
            if not a:
                continue
            esc = a.replace("'", "''")
            where_clauses.append(f"(LOWER(rag_context_text) LIKE '%{esc}%' OR LOWER(name) LIKE '%{esc}%')")

    # build final where_sql depending on strict dish
    if strict_dish:
        optional_sql = " OR ".join(optional_clauses) if optional_clauses else "1=1"
        where_sql = f"({' AND '.join(where_clauses_required)})"
        if optional_clauses:
            where_sql = f"({where_sql}) AND ({optional_sql})"
    else:
        where_sql = " OR ".join(where_clauses) if where_clauses else "1=1"

    # Apply location filter
    if location:
        # Split by comma to handle inferred district or detailed addresses
        # e.g. "Văn Tiến Dũng, Cẩm Lệ" -> ["Văn Tiến Dũng", "Cẩm Lệ"]
        loc_parts = [p.strip().replace("'", "''") for p in location.split(',') if p.strip()]
        
        if loc_parts:
            loc_clauses = [f"LOWER(address) LIKE '%{p.lower()}%'" for p in loc_parts]
            location_where = " AND ".join(loc_clauses)
            
            if where_sql == "1=1":
                where_sql = location_where
            else:
                where_sql = f"({where_sql}) AND ({location_where})"

  
    extras = []
    if min_rating is not None:
        try:
            mr = float(min_rating)
            extras.append(f"COALESCE(average_rating,0) >= {mr}")
        except Exception:
            pass
    if max_price is not None:
        try:
            # MySQL uses CONCAT for string concatenation, or we can use f-strings for the SQL
            # Better: use formatted string for price range matching
            extras.append(f"(price_range IS NULL OR price_range LIKE '%{max_price}%')")
        except Exception:
            pass

    if extras:
        where_sql = f"({where_sql}) AND (" + " AND ".join(extras) + ")"

    final_sql = f"SELECT * FROM restaurants WHERE {where_sql} LIMIT {max(50, top_k*5)}"
    logger.info("Structured search SQL: %s", final_sql)

    rows = db.execute_query(final_sql)
    def match_count(row):
        s = " ".join([str(row.get(k, "")) for k in ("name", "cuisine_type", "address", "rag_context_text")]).lower()
        cnt = 0
        for t in toks:
            if t in s:
                cnt += 1
        return cnt

    processed = []
    for r in rows:
        processed.append({
            "id": r.get("id") or 0,
            "name": r.get("name") or '',
            "cuisine_type": r.get("cuisine_type") or '',
            "average_rating": float(r.get("average_rating") or 0) if r.get("average_rating") is not None else None,
            "rating": float(r.get("average_rating") or 0) if r.get("average_rating") is not None else None,
            "address": r.get("address") or '',
            "price_range": r.get("price_range") or '',
            "phone": r.get("phone_number") or '',
            # DEBUG
            "image": (lambda x: (logger.info(f"DB Row Image: {x}") or x) if x else '')(r.get("image")) or '',
            "quality_score": float(r.get("quality_score") or 0) if r.get("quality_score") is not None else None,
            "is_featured": bool(r.get("is_featured")) if r.get("is_featured") is not None else False,
            "_match_count": match_count(r),
        })


    # Sort results
    if sort_by == 'quality':
        # Sort by quality_score desc, then match_count
        processed.sort(key=lambda x: (x.get("quality_score") or 0, x.get("_match_count", 0)), reverse=True)
    elif sort_by == 'rating':
        processed.sort(key=lambda x: (x.get("average_rating") or 0, x.get("_match_count", 0)), reverse=True)
    elif sort_by == 'price_asc':
         # heuristic sort for price ignored for now, or just leave default
         pass
    else:
        # Default sort: match_count then rating
        processed.sort(key=lambda x: (x.get("_match_count", 0), x.get("average_rating") or 0), reverse=True)

    for it in processed:
        it.pop("_match_count", None)
        # Add frontend friendly aliases
        it['imageUrl'] = it.get('image')
        it['rate'] = it.get('rating')

    return processed[:top_k]


def _human_like_reply(query: str, lang: str = 'vi', parsed: dict | None = None, results: list | None = None) -> str:
    """Generate a human-like conversational reply in Vietnamese or English for casual queries.

    - If Groq is configured, call it to generate a short friendly reply (1-3 sentences) and one clarifying question.
    - Otherwise return a simple canned reply asking a clarifying question.
    """
    parsed = parsed or {}
    try:
        if hasattr(settings, 'GROQ_API_KEY') and settings.GROQ_API_KEY:
            client = Groq(api_key=settings.GROQ_API_KEY)
            
            # Language-specific system prompts
            if lang == 'en':
                system_prompt = (
                    "You are a friendly restaurant assistant chatting in English. "
                    "Respond naturally like a real person: brief, warm, and always ask 1 clarifying question if needed."
                )
            else:
                system_prompt = (
                    "Bạn là một trợ lý trò chuyện thân thiện bằng tiếng Việt. "
                    "Trả lời như một người thật: ngắn gọn, ấm áp, và luôn hỏi 1 câu để làm rõ nếu cần."
                )
            
            # Include a short context of parsed fields if available
            context_lines = []
            if parsed:
                for k in ('dish','cuisine','location','max_price','price_category','min_rating','intent'):
                    v = parsed.get(k)
                    if v:
                        context_lines.append(f"{k}: {v}")

            if lang == 'en':
                user_prompt = f"User: \"{query}\"\nContext:\n" + "\n".join(context_lines) + "\n\nRespond friendly and naturally, 1-3 sentences, and ask 1 clarifying question if needed."
            else:
                user_prompt = f"Người dùng: \"{query}\"\nContext:\n" + "\n".join(context_lines) + "\n\nHãy trả lời thân thiện, tự nhiên, 1-3 câu, và hỏi 1 câu để làm rõ yêu cầu nếu cần."

            completion = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.8,
                max_tokens=120,
            )
            reply = completion.choices[0].message.content.strip()
            return reply
    except Exception:
        logger.info("Groq conversational reply failed, using canned fallback")

    # Simple canned fallback replies (human-like)
    low = query.strip().lower()
    
    if lang == 'en':
        if any(w in low for w in ("hungry", "starving", "eat", "food")):
            return "You're hungry! 😊 What kind of food do you like — Italian, Vietnamese, or maybe something near you? I can suggest some great places!"
        return "Could you tell me more? For example: 'I want pizza in Son Tra' or 'Any good seafood restaurants?'"
    else:
        if any(w in low for w in ("đói", "tôi đói", "đói quá", "mệt", "ăn")):
            return "Bạn đang đói nhỉ 😊 Bạn muốn ăn gì — món Việt, món Tây hay muốn gần chỗ bạn đang ở? Mình gợi ý vài món nếu bạn cần."
        return "Bạn nói rõ hơn giúp mình được không? Ví dụ: 'Tôi muốn ăn mì Quảng ở Sơn Trà' hoặc 'Có quán pizza ngon không?'."


@api_view(['POST'])
@permission_classes([AllowAny])
def chatbot_rag_sql(request):
    """Proxy to external RAG-SQL service (/question-answering).

    Request JSON: { "query": "..." }
    Response: { 'answer': str, 'results': [], 'source': 'rag-sql', 'raw': <raw rag response> }

    If RAG-SQL fails, fallback to AI search or regular search.
    """
    try:
        query = request.data.get('query', '').strip()
        
        # Detect language from query
        lang = _detect_language(query)
        logger.info(f"Detected language: {lang} for query: {query}")
        
        if not query:
            return Response({'answer': _get_localized_message('clarify', lang), 'results': [], 'lang': lang})

        # Detect query type for special handling (Chit-chat, info, comparison, etc.)
        query_type_info = _detect_query_type(query, lang)
        logger.info(f"Query type detected: {query_type_info['type']}")

        # Handle trivial greetings briefly if not in chit_chat mode
        if query_type_info['type'] != 'chit_chat':
            greeting_keywords_en = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings']
            greeting_keywords_vi = ['xin chào', 'chào', 'chào bạn', 'hi', 'hello']
            low_q = query.lower().strip()
            
            # Match only very short greeting-only queries
            if any(kw == low_q for kw in (greeting_keywords_en if lang == 'en' else greeting_keywords_vi)):
                return Response({
                    'answer': _get_localized_message('greeting', lang),
                    'results': [],
                    'source': 'greeting',
                    'query': query,
                    'lang': lang
                })

        rag_url = getattr(settings, 'RAG_SQL_URL', 'http://localhost:8001/question-answering')

        # Handle comparison queries FIRST (highest priority)
        if query_type_info['type'] == 'comparison':
            try:
                comparison_result = _handle_comparison(query, lang)
                return Response({
                    **comparison_result,
                    'source': 'comparison',
                    'query': query,
                    'lang': lang
                })
            except Exception as e:
                logger.error(f"Comparison error: {e}", exc_info=True)

        # Handle spiciness queries - SEARCH for spicy/non-spicy foods instead of analyzing
        if query_type_info['type'] == 'spiciness':
            try:
                # Detect if user wants spicy or non-spicy food
                low_q = query.lower()
                wants_non_spicy = any(kw in low_q for kw in ['không cay', 'not spicy', 'ít cay', 'mild', 'nhẹ'])
                wants_spicy = any(kw in low_q for kw in ['cay', 'spicy', 'cay nhất', 'hot'])
                
                # Define search keywords based on what user wants
                if wants_non_spicy:
                    # Non-spicy food keywords
                    search_keywords = ['pizza', 'pasta', 'salad', 'phở', 'bún', 'cháo', 'chay', 'soup', 'burger', 'sandwich']
                    if lang == 'en':
                        friendly_msg = "Here are some mild and non-spicy options:"
                    else:
                        friendly_msg = "Dưới đây là các món không cay, nhẹ nhàng:"
                else:
                    # Spicy food keywords
                    search_keywords = ['cay', 'spicy', 'ớt', 'sả ớt', 'thai', 'thái', 'tứ xuyên', 'sichuan', 'kim chi']
                    if lang == 'en':
                        friendly_msg = "Here are some spicy options:"
                    else:
                        friendly_msg = "Dưới đây là các món cay:"
                
                logger.info(f"Spiciness search with keywords: {search_keywords}")
                
                # Search for matching restaurants
                results = _structured_search(
                    keywords=search_keywords,
                    location=None,
                    attributes=[],
                    top_k=10
                )
                
                if results:
                    return Response({
                        'answer': friendly_msg,
                        'results': results,
                        'source': 'spiciness-search',
                        'query': query,
                        'lang': lang
                    })
                else:
                    if lang == 'en':
                        return Response({
                            'answer': 'I couldn\'t find specific spicy/non-spicy dishes. Try asking about specific cuisines!',
                            'results': [],
                            'source': 'spiciness-search',
                            'lang': lang
                        })
                    else:
                        return Response({
                            'answer': 'Tôi không tìm thấy món phù hợp. Thử hỏi về loại món ăn cụ thể nhé!',
                            'results': [],
                            'source': 'spiciness-search',
                            'lang': lang
                        })
            except Exception as e:
                logger.error(f"Spiciness search error: {e}", exc_info=True)

                if lang == 'en':
                    return Response({
                        'answer': 'Sorry, there was an error analyzing dishes. Please try again.',
                        'results': [],
                        'source': 'spiciness-analysis-error',
                        'lang': lang
                    })
                else:
                    return Response({
                        'answer': 'Xin lỗi, có lỗi khi phân tích món ăn. Vui lòng thử lại.',
                        'results': [],
                        'source': 'spiciness-analysis-error',
                        'lang': lang
                    })

        # Handle chit-chat / conversational queries
        if query_type_info['type'] == 'chit_chat':
            try:
                persona_prompt = f"""
You are a friendly, sympathetic, and helpful local food expert in Da Nang. 
The user is sharing something personal or just chatting with you ("tâm sự").
Respond warmly in {('Vietnamese' if lang == 'vi' else 'English')}. 
Be a good listener, show empathy, and if appropriate, subtly suggest that a good meal (like a local specialty in Da Nang) might help or be a great way to celebrate.
Keep it concise and natural, like a friend talking.

User says: "{query}"

Response:"""
                client = Groq(api_key=getattr(settings, 'GROQ_API_KEY', None))
                resp = client.chat.completions.create(
                    messages=[{"role": "user", "content": persona_prompt}],
                    model="llama-3.1-8b-instant",
                    temperature=0.7,
                    max_tokens=200,
                )
                answer = resp.choices[0].message.content.strip()
                return Response({
                    'answer': answer,
                    'results': [],
                    'source': 'chit-chat',
                    'query': query,
                    'lang': lang
                })
            except Exception as e:
                logger.error(f"Chit-chat AI response failed: {e}")
                fallback_msg = "Tôi luôn ở đây để lắng nghe và giúp bạn tìm những món ăn ngon nhất Đà Nẵng. Bạn cứ chia sẻ nhé!" if lang == 'vi' else "I'm always here to listen and help you find the best food in Da Nang. Feel free to share!"
                return Response({
                    'answer': fallback_msg,
                    'results': [],
                    'source': 'chit-chat-fallback',
                    'query': query,
                    'lang': lang
                })


        # Handle digestibility queries - SEARCH for light/heavy foods instead of analyzing
        if query_type_info['type'] == 'digestibility':
            try:
                # Detect if user wants light or heavy food
                low_q = query.lower()
                wants_light = any(kw in low_q for kw in ['nhẹ', 'light', 'dễ tiêu', 'healthy', 'ít béo'])
                wants_heavy = any(kw in low_q for kw in ['nặng', 'heavy', 'thịnh soạn', 'no'])
                
                # Define search keywords based on what user wants
                if wants_light:
                    # Light food keywords
                    search_keywords = ['salad', 'gỏi', 'chè', 'phở', 'bún', 'cháo', 'soup', 'chay', 'rau']
                    if lang == 'en':
                        friendly_msg = "Here are some light and easy-to-digest options:"
                    else:
                        friendly_msg = "Dưới đây là các món nhẹ bụng, dễ tiêu hóa:"
                else:
                    # Heavy food keywords
                    search_keywords = ['bbq', 'nướng', 'pizza', 'burger', 'chiên', 'rán', 'lẩu', 'buffet']
                    if lang == 'en':
                        friendly_msg = "Here are some hearty and filling options:"
                    else:
                        friendly_msg = "Dưới đây là các món no bụng, thịnh soạn:"
                
                logger.info(f"Digestibility search with keywords: {search_keywords}")
                
                # Search for matching restaurants
                results = _structured_search(
                    keywords=search_keywords,
                    location=None,
                    attributes=[],
                    top_k=10
                )
                
                if results:
                    return Response({
                        'answer': friendly_msg,
                        'results': results,
                        'source': 'digestibility-search',
                        'query': query,
                        'lang': lang
                    })
                else:
                    if lang == 'en':
                        return Response({
                            'answer': 'I couldn\'t find specific light/heavy dishes. Try asking about specific cuisines!',
                            'results': [],
                            'source': 'digestibility-search',
                            'lang': lang
                        })
                    else:
                        return Response({
                            'answer': 'Tôi không tìm thấy món phù hợp. Thử hỏi về loại món ăn cụ thể nhé!',
                            'results': [],
                            'source': 'digestibility-search',
                            'lang': lang
                        })
            except Exception as e:
                logger.error(f"Digestibility search error: {e}")

        # Handle specific restaurant info queries
        if query_type_info['type'] == 'restaurant_info':
            try:
                info = _get_restaurant_info(query, lang)
                return Response({
                    **info,
                    'source': 'restaurant-info',
                    'query': query,
                    'lang': lang
                })
            except Exception as e:
                logger.error(f"Restaurant info error: {e}")

        # First: try structured AI parsing + focused DB search (preferred)
        try:
            parsed = _parse_nl_query_with_ai(query)
            logger.info(f"🔍 AI Parsed query '{query}': cuisine={parsed.get('cuisine')}, keywords={parsed.get('keywords')}, max_price={parsed.get('max_price')}, limit={parsed.get('limit')}")
            # Detect vague conversational queries (e.g., 'Tôi đói' or 'I'm hungry') and ask clarifying question first
            vague_tokens_vi = ["đói", "ăn gì", "ngon", "tôi đói", "đói quá"]
            vague_tokens_en = ["hungry", "starving", "what to eat", "food"]
            vague_tokens = vague_tokens_vi + vague_tokens_en
            has_hungry_word = any(t in low_q for t in vague_tokens)
            has_structured_fields = any(
                parsed.get(k) for k in ("dish", "cuisine", "location", "max_price", "attributes", "price_category")
            )
            if not has_structured_fields and has_hungry_word:
                reply = _human_like_reply(query, lang=lang, parsed=parsed, results=None)
                return Response({
                    'answer': reply,
                    'results': [],
                    'source': 'clarify',
                    'query': query,
                    'lang': lang
                })

            top_k = getattr(settings, 'RAG_TOP_K', 10)
            
            # Expand cuisine type with language equivalents
            cuisine = parsed.get('cuisine')
            keywords = parsed.get('keywords') or [query]
            location_parsed = parsed.get('location')
            
            logger.info(f"🔍 Parsed - cuisine: {cuisine}, keywords: {keywords}, location: {location_parsed}")
            
            # Save original expanded cuisine keywords for filtering later
            cuisine_keywords_for_filter = []

            # Clean up location string if present
            if location_parsed:
                # Remove common Vietnamese prefixes in locations to improve matching
                # e.g. "đường Văn Tiến Dũng" -> "Văn Tiến Dũng"
                location_cleaned = re.sub(r'^(đường|phố|quận|huyện|phường|xã|tp|thành phố|st|street|district)\s+', '', location_parsed, flags=re.IGNORECASE)
                location_parsed = location_cleaned
                logger.info(f"Cleaned location: '{location_parsed}'")
                
                # Try to infer district if only street provided
                inferred_district = _infer_district_from_street(location_parsed)
                if inferred_district:
                    logger.info(f"Inferred district '{inferred_district}' from street '{location_parsed}'")
                    # If the location itself doesn't contain the district name, 
                    # use it to STRENGTHEN the location search rather than just a generic keyword
                    if inferred_district.lower() not in location_parsed.lower():
                        # Append to location string for better SQL LIKE matching
                        location_parsed = f"{location_parsed}, {inferred_district}"
                        logger.info(f"Updated location with district: '{location_parsed}'")

            # Handle vague location "trung tâm"
            if location_parsed and 'trung tâm' in location_parsed.lower():
                # If specific district not found, assume city center (Hai Chau, Thanh Khe)
                # We append these to keywords so they are searched in address
                keywords.extend(['hải châu', 'thanh khê'])
                logger.info("Mapped location 'trung tâm' to districts: hải châu, thanh khê")

            # If cuisine is detected, expand keywords with language equivalents
            if cuisine:
                logger.info(f"Before expansion - cuisine: '{cuisine}', keywords: {keywords}")
                keywords = _expand_cuisine_keywords(cuisine, keywords)
                logger.info(f"After expansion - keywords: {keywords}")
                
                # Filter out generic words that don't help narrow the search
                # We split joined words to check if they are generic (e.g. "quán ăn" -> ["quán", "ăn"])
                generic_words = ['restaurant', 'restaurants', 'place', 'places', 'food', 'quán', 'nhà hàng', 'chỗ', 'ăn', 'uống', 'món', 'tiệm', 'hiệu']
                cleaned_keywords = []
                for kw in keywords:
                    kw_low = kw.lower()
                    # Check if the whole phrase is generic
                    if kw_low in generic_words:
                        continue
                    # Check if splitting it makes it generic
                    parts = kw_low.split()
                    if all(p in generic_words for p in parts):
                        continue
                    cleaned_keywords.append(kw)
                keywords = cleaned_keywords
                logger.info(f"After filtering generic words - keywords: {keywords}")
                
                # Save these for filtering later (before abstract expansion changes them)
                cuisine_keywords_for_filter = [kw.lower() for kw in keywords]
            else:
                logger.info(f"No cuisine detected, keywords: {keywords}")
                # Still filter generic words even without cuisine
                generic_words = ['restaurant', 'restaurants', 'place', 'places', 'food', 'quán', 'nhà hàng', 'chỗ', 'ăn', 'uống', 'món', 'tiệm', 'hiệu']
                original_keywords = keywords[:]
                cleaned_keywords = []
                for kw in keywords:
                    kw_low = kw.lower()
                    if kw_low in generic_words:
                        continue
                    parts = kw_low.split()
                    if all(p in generic_words for p in parts):
                        continue
                    cleaned_keywords.append(kw)
                keywords = cleaned_keywords
                if len(keywords) != len(original_keywords):
                    logger.info(f"Filtered generic words: {original_keywords} → {keywords}")

            
            # Expand abstract keywords to concrete dishes
            expanded_keywords = []
            
            for kw in keywords:
                kw_lower = kw.lower()
                # Map "món nóng" / "hot food" / "something hot" to hotpot and hot dishes
                if any(word in kw_lower for word in ['nóng', 'ấm', 'hot']):
                    # Check if it's specifically about hot food (not spicy hot)
                    if 'spicy' not in kw_lower and 'cay' not in kw_lower:
                        expanded_keywords.extend(['lẩu', 'hotpot', 'soup', 'phở'])
                        logger.info(f"Expanded '{kw}' to hot dishes: lẩu, hotpot, soup, phở")
                        continue
                # Map "uống lạnh" / "cold drink" to café and beer
                elif ('uống' in kw_lower or 'drink' in kw_lower) and ('lạnh' in kw_lower or 'mát' in kw_lower or 'cold' in kw_lower):
                    expanded_keywords.extend(['café', 'coffee', 'bia', 'bar'])
                    logger.info(f"Expanded '{kw}' to cold drinks: café, coffee, bia, bar")
                # Map "món lạnh" / "cold food" to specific cold dishes  
                elif 'lạnh' in kw_lower or 'mát' in kw_lower or 'cold' in kw_lower:
                    expanded_keywords.extend(['gỏi', 'salad', 'chè', 'kem'])
                    logger.info(f"Expanded '{kw}' to cold dishes: gỏi, salad, chè, kem")
                else:
                    expanded_keywords.append(kw)
            
            # Use expanded keywords for search
            search_keywords = expanded_keywords if expanded_keywords else keywords
            
            # Determine top_k dynamically
            req_limit = parsed.get('limit')
            if req_limit and isinstance(req_limit, int) and req_limit > 0:
                top_k = req_limit
                logger.info(f"User requested specific limit: {top_k}")
            elif parsed.get('sort_by') in ['quality', 'rating'] and top_k > 5:
                # Default limit for quality/rating is 5 unless overridden by user
                top_k = 5
            else:
                # For general searches (like "restaurants in Hai Chau"), prefer more results
                if top_k < 15 and not req_limit:
                    top_k = 15
            
            structured_results = _structured_search(
                keywords=search_keywords,
                location=parsed.get('location'),
                attributes=parsed.get('attributes') or [],
                top_k=top_k,
                max_price=parsed.get('max_price'),
                min_rating=parsed.get('min_rating'),
                price_category=parsed.get('price_category'),
                group_size=parsed.get('group_size'),
                occasion=parsed.get('occasion'),
                dish=parsed.get('dish'),
                sort_by=parsed.get('sort_by'),
            )
            
            # Filter results to keep only relevant ones
            if structured_results:
                keywords_for_filter = parsed.get('keywords') or [query]
                max_price = parsed.get('max_price')
                
                # If cuisine is detected, apply strict cuisine-based filtering
                if cuisine and cuisine_keywords_for_filter:
                    logger.info(f"Applying strict cuisine filtering with keywords: {cuisine_keywords_for_filter}")
                    cuisine_filtered = []
                    
                    for rest in structured_results:
                        rest_name = rest.get('name', '').lower()
                        rest_cuisine = rest.get('cuisine_type', '').lower()
                        
                        # Check if restaurant matches any cuisine keyword
                        matches = any(kw in rest_name or kw in rest_cuisine for kw in cuisine_keywords_for_filter)
                        
                        if matches:
                            cuisine_filtered.append(rest)
                            logger.info(f"  ✓ Kept: {rest.get('name')} ({rest.get('cuisine_type')})")
                        else:
                            logger.info(f"  ✗ Removed: {rest.get('name')} ({rest.get('cuisine_type')})")
                    
                    if cuisine_filtered:
                        structured_results = cuisine_filtered
                        logger.info(f"After cuisine filtering: {len(structured_results)} restaurants")
                    else:
                        logger.warning("Cuisine filtering removed all results, keeping original")
                
                # Apply regular keyword and price filtering
                structured_results = _filter_relevant_results(structured_results, keywords_for_filter, max_price)

            if structured_results:
                # Build friendly answer
                # Try to generate a human-like conversational reply using Groq
                try:
                    if hasattr(settings, 'GROQ_API_KEY') and settings.GROQ_API_KEY:
                        client = Groq(api_key=settings.GROQ_API_KEY)
                        # Normalize image URLs in structured_results when possible
                        for _r in structured_results:
                            img = _r.get('image') or _r.get('image_url')
                            if img:
                                try:
                                    if not img.lower().startswith('http'):
                                        _r['image'] = request.build_absolute_uri(img)
                                    else:
                                        _r['image'] = img
                                except Exception:
                                    _r['image'] = img
                            
                            # Sync alias
                            _r['imageUrl'] = _r.get('image')

                        # Prepare a short summary of top results for the LLM
                        top_lines = []
                        for r in structured_results[:5]:
                            name = r.get('name') or ''
                            cuisine = r.get('cuisine_type') or ''
                            rating = r.get('average_rating') or ''
                            addr = r.get('address') or ''
                            top_lines.append(f"{name} — {cuisine} — {rating}⭐ — {addr}")

                        # Language-specific system prompts
                        if lang == 'en':
                            system_prompt = (
                                "You are a friendly restaurant recommendation assistant chatting in English. "
                                "When you have a list of restaurants, provide 2–3 standout suggestions and ask a follow-up question if needed. "
                                "Be brief and natural like a local friend."
                            )
                            user_prompt = (
                                f"User asked: \"{query}\"\n\n"
                                f"Search results (top {min(len(structured_results),5)}):\n" + "\n".join(top_lines) +
                                "\n\nRespond friendly and briefly (2-3 sentences). Ask 1 follow-up question if helpful."
                            )
                        else:
                            system_prompt = (
                                "Bạn là trợ lý gợi ý quán ăn thân thiện, trả lời ngắn gọn, tự nhiên như người bản xứ "
                                "(tiếng Việt). Khi có danh sách quán, đưa ra 2–3 gợi ý nổi bật và một câu hỏi kế tiếp nếu cần. "
                            )
                            user_prompt = (
                                f"Người dùng hỏi: \"{query}\"\n\n"
                                f"Danh sách kết quả (top {min(len(structured_results),5)}):\n" + "\n".join(top_lines) +
                                "\n\nHãy trả lời thân thiện, ngắn gọn (2-3 câu). Nếu cần, hỏi 1 câu để làm rõ yêu cầu tiếp theo."
                            )

                        completion = client.chat.completions.create(
                            model="llama-3.1-8b-instant",
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt},
                            ],
                            temperature=0.7,
                            max_tokens=200,
                        )
                        reply = completion.choices[0].message.content.strip()
                    else:
                        raise RuntimeError("GROQ_API_KEY not configured")
                except Exception:
                    # Fallback to plain summary if LLM is not available
                    summary_lines = []
                    for r in structured_results[:3]:
                        name = r.get('name') or ''
                        cuisine = r.get('cuisine_type') or ''
                        price = r.get('price_range') or ''
                        summary_lines.append(f"- {name}: {cuisine} {price}".strip())
                    reply = f"🔎 Tìm thấy {len(structured_results)} quán phù hợp với '{query}'.\n\nTop:\n" + "\n".join(summary_lines)

                return Response({
                    'answer': reply,
                    'results': structured_results,
                    'source': 'structured-ai',
                    'query': query,
                })
            else:
                # If user explicitly requested a specific dish, do NOT fall back to looser searches;
                # instead inform the user that no restaurants serving that dish were found.
                if parsed.get('dish'):
                    dish_txt = parsed.get('dish')
                    loc_txt = parsed.get('location') or ''
                    if 'chỉ' in query or 'only' in query.lower() or 'exactly' in query.lower():
                        answer = f"😔 Không tìm thấy quán phục vụ '{dish_txt}' {('ở ' + loc_txt) if loc_txt else ''}. Bạn thử miêu tả khác hoặc bỏ bớt tiêu chí để tìm được nhiều quán hơn nhé!".strip()
                    else:
                        # If 'chỉ' wasn't used, allow fallback instead of returning hard failure
                        logger.info(f"No specific matches for dish '{dish_txt}', but 'chỉ' wasn't used. Falling back...")
                        # We'll just fall through to RAG/local instead of returning here
                        pass
                    if 'answer' in locals():
                        return Response({
                            'answer': answer,
                            'results': [],
                            'source': 'structured-ai-failed',
                            'query': query,
                        })

                logger.info("Structured AI search returned no results, falling back to RAG/local")
        except Exception as e_struct:
            logger.exception("Structured search error: %s", e_struct)

        # If the RAG-SQL service is available via HTTP use it; otherwise try local integration
        try:
            resp = requests.post(rag_url, json={'question': query}, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                answer = data.get('answer') or data.get('message') or ''
                return Response({
                    'answer': answer,
                    'results': data.get('results', []),
                    'source': 'rag-sql-remote',
                    'raw': data,
                    'query': query,
                })
            else:
                logger.info(f"RAG-SQL remote returned status {resp.status_code}, falling back to local")
        except Exception as e_remote:
            logger.info(f"RAG-SQL remote unreachable: {e_remote}, trying local integration")

        # Try local import/integration: call MonolithAgent directly
        try:
            from .rag_sql_local import get_monolith_predictor
            predictor = get_monolith_predictor()
            results = predictor(query, lang=lang)
            # Build a friendly answer summary
            if results and isinstance(results, list):
                # Normalize image URLs in predictor results when possible
                for rr in results:
                    img = rr.get('image') or rr.get('image_url') or rr.get('imageUrl')
                    if img:
                        try:
                            if not img.lower().startswith('http'):
                                rr['image'] = request.build_absolute_uri(img)
                            else:
                                rr['image'] = img
                        except Exception:
                            rr['image'] = img

                if len(results) == 0:
                    answer = f"😔 Không tìm thấy kết quả cho '{query}'." if lang == 'vi' else f"😔 No results found for '{query}'."
                else:
                    top3 = results[:3]
                    summary_lines = []
                    for r in top3:
                        name = r.get('name') or r.get('restaurant_name') or ''
                        cuisine = r.get('cuisine_type', '')
                        price = r.get('price_range', '')
                        summary_lines.append(f"- {name}: {cuisine} {price}".strip())
                    answer = f"🔍 Tìm thấy {len(results)} quán.\n\nTop:\n" + "\n".join(summary_lines) if lang == 'vi' else f"🔍 Found {len(results)} restaurants.\n\nTop:\n" + "\n".join(summary_lines)
            else:
                answer = str(results)

            return Response({
                'answer': answer,
                'results': results,
                'source': 'rag-sql-local',
                'query': query,
            })
        except Exception as e_local:
            logger.exception("Local RAG-SQL integration failed: %s", e_local)
            # Check if we already have some results to show or if this is a total failure
            return Response({
                'answer': '😔 Có vẻ hiện tại hệ thống đang gặp chút trục trặc khi tìm kiếm. Bạn hãy thử lại với từ khóa đơn giản như tên món ăn hoặc tên quán nhé!',
                'results': [],
                'source': 'error-fallback',
                'query': query,
            })

    except Exception as e:
        import traceback as _tb
        tb = _tb.format_exc()
        logger.error(f"chatbot_rag_sql error: {e}\n{tb}", exc_info=True)
        return Response({
            'answer': '⚠️ Có lỗi khi gọi RAG-SQL. Vui lòng thử lại sau.',
            'results': [],
            'error': str(e),
            'traceback': tb,
        }, status=500)

class FeedbackCreateView(generics.CreateAPIView):
    queryset = Feedback.objects.all()
    serializer_class = FeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]  # Cho ph├⌐p gß╗¡i cß║ú khi ch╞░a ─æ─âng nhß║¡p

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)




class FavoriteListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # list favorites for current user
        favs = Favorite.objects.filter(user=request.user).select_related('restaurant')
        serializer = FavoriteSerializer(favs, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request):
        # create favorite for current user (idempotent)
        restaurant_id = request.data.get('restaurant_id')
        if not restaurant_id:
            return Response({"detail": "Missing restaurant_id."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            restaurant = Restaurant.objects.get(pk=restaurant_id)
        except Restaurant.DoesNotExist:
            return Response({"detail": "Restaurant not found."}, status=status.HTTP_404_NOT_FOUND)

        fav, created = Favorite.objects.get_or_create(user=request.user, restaurant=restaurant)
        serializer = FavoriteSerializer(fav, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)



class RestaurantMapListView(APIView):
    """
    GET /api/restaurants/map/
    Return all restaurants for the map
    """
    permission_classes = [AllowAny]

    def get(self, request):
        # Use the RestaurantSerializer so the frontend receives image and average_rating
        qs = Restaurant.objects.all()
        serializer = RestaurantSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)



class RestaurantMapSearchView(APIView):
    """
    GET /api/restaurants/map/search/?q=...
    Search by name and address
    """
    permission_classes = [AllowAny]

    def get(self, request):
        q = request.GET.get("q", "")
        items = Restaurant.objects.filter(
            Q(name__icontains=q) | Q(address__icontains=q)
        )
        return Response(RestaurantSerializer(items, many=True).data)



class GeocodeRestaurantView(APIView):
    """
    POST /api/geocode/
    Body:
    {
        "name": "...",
        "address": "..."
    }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        name = request.data.get("name", "")
        address = request.data.get("address", "")
        restaurant_id = request.data.get("restaurant_id")
        restaurant_obj = None
        if restaurant_id:
            try:
                restaurant_obj = Restaurant.objects.get(id=restaurant_id)
            except Restaurant.DoesNotExist:
                restaurant_obj = None

        if not address:
            return Response({
                "lat": None,
                "lng": None,
                "confidence": 0,
                "_debug": {"normalized": ""}
            })

        # pass restaurant_obj so geocode_address can persist lat/lng when available
        result = geocode_address(address, name, save_instance=restaurant_obj)

        if not result:
            return Response({
                "lat": None,
                "lng": None,
                "confidence": 0,
                "_debug": {"normalized": normalize_danang_address(address)}
            })

        resp = dict(result)
        resp["_debug"] = {"normalized": normalize_danang_address(address)}
        return Response(resp)
    

class GeocodeAllRestaurantsView(APIView):
    """
    POST /api/geocode/all/
    Tß╗▒ ─æß╗Öng geocode to├án bß╗Ö nh├á h├áng ch╞░a c├│ latitude & longitude.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        restaurants = Restaurant.objects.all()

        updated = 0
        failed = []

        for r in restaurants:
            result = geocode_address(r.address, r.name)

            if result:
                r.latitude = result["lat"]
                r.longitude = result["lng"]
                r.save()
                updated += 1
            else:
                failed.append({"id": r.id, "name": r.name})

        return Response({
            "total": restaurants.count(),
            "updated": updated,
            "failed": failed,
        })




class OSRMRouteView(APIView):
    """
    POST /api/route-osrm/
    Body:
    {
        "start": { "lat": .., "lng": .. },
        "end":   { "lat": .., "lng": .. }
    }

    Tr??? v???:
      { "coords": [ [lat,lng], ... ] }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        start = request.data.get("start")
        end = request.data.get("end")

        if not start or not end:
            return Response({"error": "Missing start or end"}, status=400)

        try:
            coords = get_route(start, end)
            return Response({"coords": coords})
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class RestaurantDetailView(generics.RetrieveAPIView):
    """Retrieve a single restaurant by PK (detail view).

    This endpoint complements the existing ListAPIView. It uses the same
    RestaurantSerializer and returns more detailed fields for UI popups.
    """
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantSerializer
    permission_classes = [AllowAny]



class FeedbackListAdminView(APIView):
    def get(self, request):
        is_resolved = request.query_params.get('is_resolved')
        if is_resolved == 'false':
            feedbacks = Feedback.objects.filter(is_resolved=False)
        elif is_resolved == 'true':
            feedbacks = Feedback.objects.filter(is_resolved=True)
        else:
            feedbacks = Feedback.objects.all()
        serializer = FeedbackSerializer(feedbacks, many=True)
        return Response(serializer.data)

def remove_vietnamese_accents(text):
    """
    Convert Vietnamese text to non-accented English-friendly text.
    Example: "L?? Quang ?????o" -> "Le Quang Dao"
    Also normalizes to Title Case.
    """
    # Vietnamese character mapping
    vietnamese_map = {
        '??': 'a', '??': 'a', '???': 'a', '??': 'a', '???': 'a',
        '??': 'a', '???': 'a', '???': 'a', '???': 'a', '???': 'a', '???': 'a',
        '??': 'a', '???': 'a', '???': 'a', '???': 'a', '???': 'a', '???': 'a',
        '??': 'd',
        '??': 'e', '??': 'e', '???': 'e', '???': 'e', '???': 'e',
        '??': 'e', '???': 'e', '???': 'e', '???': 'e', '???': 'e', '???': 'e',
        '??': 'i', '??': 'i', '???': 'i', '??': 'i', '???': 'i',
        '??': 'o', '??': 'o', '???': 'o', '??': 'o', '???': 'o',
        '??': 'o', '???': 'o', '???': 'o', '???': 'o', '???': 'o', '???': 'o',
        '??': 'o', '???': 'o', '???': 'o', '???': 'o', '???': 'o', '???': 'o',
        '??': 'u', '??': 'u', '???': 'u', '??': 'u', '???': 'u',
        '??': 'u', '???': 'u', '???': 'u', '???': 'u', '???': 'u', '???': 'u',
        '???': 'y', '??': 'y', '???': 'y', '???': 'y', '???': 'y',
        '??': 'A', '??': 'A', '???': 'A', '??': 'A', '???': 'A',
        '??': 'A', '???': 'A', '???': 'A', '???': 'A', '???': 'A', '???': 'A',
        '??': 'A', '???': 'A', '???': 'A', '???': 'A', '???': 'A', '???': 'A',
        '??': 'D',
        '??': 'E', '??': 'E', '???': 'E', '???': 'E', '???': 'E',
        '??': 'E', '???': 'E', '???': 'E', '???': 'E', '???': 'E', '???': 'E',
        '??': 'I', '??': 'I', '???': 'I', '??': 'I', '???': 'I',
        '??': 'O', '??': 'O', '???': 'O', '??': 'O', '???': 'O',
        '??': 'O', '???': 'O', '???': 'O', '???': 'O', '???': 'O', '???': 'O',
        '??': 'O', '???': 'O', '???': 'O', '???': 'O', '???': 'O', '???': 'O',
        '??': 'U', '??': 'U', '???': 'U', '??': 'U', '???': 'U',
        '??': 'U', '???': 'U', '???': 'U', '???': 'U', '???': 'U', '???': 'U',
        '???': 'Y', '??': 'Y', '???': 'Y', '???': 'Y', '???': 'Y',
    }
    
    result = []
    for char in text:
        if char in vietnamese_map:
            result.append(vietnamese_map[char])
        else:
            result.append(char)
    
    # Convert to Title Case (capitalize first letter of each word)
    return ''.join(result).title()

class FavoriteDestroyView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, restaurant_id):
        fav = Favorite.objects.filter(user=request.user, restaurant_id=restaurant_id).first()
        if not fav:
            return Response(status=status.HTTP_404_NOT_FOUND)
        fav.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# ==============================================================
# RESTAURANT MAP API (TỪ FILE CŨ – GIỮ NGUYÊN CHỨC NĂNG)
# ==============================================================

from .services.geocode_service import geocode_address, normalize_danang_address
from .services.route_service import get_route
from django.db.models import Q


class RestaurantMapListView(APIView):
    """
    GET /api/restaurants/map/
    Return all restaurants for the map
    """
    permission_classes = [AllowAny]

    def get(self, request):
        # Use the RestaurantSerializer so the frontend receives image and average_rating
        qs = Restaurant.objects.all()
        serializer = RestaurantSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)


class RestaurantMapSearchView(APIView):
    """
    GET /api/restaurants/map/search/?q=...
    Search by name and address
    """
    permission_classes = [AllowAny]

    def get(self, request):
        q = request.GET.get("q", "")
        items = Restaurant.objects.filter(
            Q(name__icontains=q) | Q(address__icontains=q)
        )
        return Response(RestaurantSerializer(items, many=True).data)


class GeocodeRestaurantView(APIView):
    """
    POST /api/geocode/
    Body:
    {
        "name": "...",
        "address": "..."
    }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        name = request.data.get("name", "")
        address = request.data.get("address", "")
        restaurant_id = request.data.get("restaurant_id")
        restaurant_obj = None
        if restaurant_id:
            try:
                restaurant_obj = Restaurant.objects.get(id=restaurant_id)
            except Restaurant.DoesNotExist:
                restaurant_obj = None

        if not address:
            return Response({
                "lat": None,
                "lng": None,
                "confidence": 0,
                "_debug": {"normalized": ""}
            })

        # pass restaurant_obj so geocode_address can persist lat/lng when available
        result = geocode_address(address, name, save_instance=restaurant_obj)

        if not result:
            return Response({
                "lat": None,
                "lng": None,
                "confidence": 0,
                "_debug": {"normalized": normalize_danang_address(address)}
            })

        resp = dict(result)
        resp["_debug"] = {"normalized": normalize_danang_address(address)}
        return Response(resp)
    
class GeocodeAllRestaurantsView(APIView):
    """
    POST /api/geocode/all/
    Tự động geocode toàn bộ nhà hàng chưa có latitude & longitude.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        restaurants = Restaurant.objects.all()

        updated = 0
        failed = []

        for r in restaurants:
            result = geocode_address(r.address, r.name)

            if result:
                r.latitude = result["lat"]
                r.longitude = result["lng"]
                r.save()
                updated += 1
            else:
                failed.append({"id": r.id, "name": r.name})

        return Response({
            "total": restaurants.count(),
            "updated": updated,
            "failed": failed,
        })


class OSRMRouteView(APIView):
    """
    POST /api/route-osrm/
    Body:
    {
        "start": { "lat": .., "lng": .. },
        "end":   { "lat": .., "lng": .. }
    }

    Trả về:
      { "coords": [ [lat,lng], ... ] }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        start = request.data.get("start")
        end = request.data.get("end")

        if not start or not end:
            return Response({"error": "Missing start or end"}, status=400)

        try:
            coords = get_route(start, end)
            return Response({"coords": coords})
        except Exception as e:
            return Response({"error": str(e)}, status=500)