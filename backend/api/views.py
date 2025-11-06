"""
views.py — DNFF Backend (Refactored)
------------------------------------
Gồm các nhóm:
1️⃣ Authentication & User Profile
2️⃣ Restaurant APIs
3️⃣ Journey / Planner APIs
4️⃣ Utility APIs (Translation, Overview, Routing)
"""

from typing import List
import json
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

from .models import Restaurant, FoodJourney, CustomUser, CrawledData, Profile
from .serializers import (
    UserSerializer,
    RestaurantSerializer,
    FoodJourneySerializer,
    RegisterSerializer,
    CustomTokenObtainPairSerializer,
    ProfileSerializer,
)
from .services.journey_recommender import (
    Candidate,
    parse_price_range,
    infer_meal,
    score_candidate,
    pick_best_triplet,
)

User = get_user_model()


# ==============================================================
# 1️⃣ AUTHENTICATION & USER PROFILE
# ==============================================================

class RegisterView(generics.CreateAPIView):
    """Đăng ký người dùng mới."""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class CustomTokenObtainPairView(TokenObtainPairView):
    """Đăng nhập và lấy JWT token."""
    serializer_class = CustomTokenObtainPairSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_my_profile(request):
    """Lấy thông tin hồ sơ người dùng hiện tại."""
    try:
        profile = Profile.objects.get(user_id=request.user.user_id)
        serializer = ProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Profile.DoesNotExist:
        return Response(
            {"detail": "Profile not found"}, status=status.HTTP_404_NOT_FOUND
        )


# ==============================================================
# 2️⃣ RESTAURANT APIS
# ==============================================================

class RestaurantListView(generics.ListAPIView):
    """
    Danh sách nhà hàng (có lọc theo address & cuisine_type)
    Hỗ trợ query param:
      - address=Hải Châu
      - cuisine_type=Việt Nam
      - limit=8
    """
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        address = self.request.query_params.get("address")
        cuisine = self.request.query_params.get("cuisine_type")
        limit = int(self.request.query_params.get("limit", 8))

        if address:
            qs = qs.filter(address__icontains=f"Quận {address}")
        if cuisine:
            qs = qs.filter(cuisine_type=cuisine)

        return qs[:limit]


@api_view(["GET"])
def get_filters(request):
    """
    Lấy danh sách khu vực (Quận) & loại ẩm thực (cuisine_type) duy nhất.
    """
    addresses = Restaurant.objects.values_list("address", flat=True).distinct()
    areas = set()

    for addr in addresses:
        if addr:
            match = re.search(r"Quận\s*([\w\sÀ-ỹ]+)", addr)
            if match:
                areas.add(match.group(1).strip())

    cuisines = Restaurant.objects.values_list("cuisine_type", flat=True).distinct()
    return Response({
        "areas": sorted(list(areas)),
        "cuisines": [c for c in cuisines if c],
    })


class CuisineListView(APIView):
    """Trả danh sách loại ẩm thực duy nhất."""
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        cuisines = Restaurant.objects.values_list("cuisine_type", flat=True).distinct()
        filtered = [c for c in cuisines if c]
        return Response(sorted(filtered))


# ==============================================================
# 3️⃣ JOURNEY / FOOD PLANNER
# ==============================================================

class JourneyRecommendationsView(APIView):
    """
    Gợi ý hành trình ăn uống (simple hoặc AI).
    GET /api/journey/restaurants/
    Query params:
      - budget=300000
      - preferences=Ẩm thực
      - search=keyword
      - strategy=simple|ai
      - top_k, weights, split_ratio ...
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # --- Lấy tham số ---
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
            qs = qs.filter(cuisine_type__in=preferences)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(address__icontains=search))

        # --- Tạo danh sách ứng viên ---
        candidates: List[Candidate] = []
        for r in qs:
            price_val = parse_price_range(r.price_range, default_price=0)
            meal = getattr(r, "meal_type", None) or infer_meal(
                price_val, 100000, 200000
            )
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
            client = Groq(api_key=settings.GROQ_API_KEY)
            candidates_text = "\n".join(
                f"- id={c.id}, {c.name} ({c.cuisine_type}, {c.price} VND, rating {c.rating}, meal={c.meal_type})"
                for c in candidates
            )
            prompt = f"""
                User budget: {budget} VND
                Preferences: {", ".join(preferences) or "None"}
                Candidate restaurants:
                {candidates_text}

                Suggest exactly 3 restaurants (breakfast, lunch, dinner)
                Ensure total price <= budget.
                Return JSON only.
            """

            resp = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
            )
            content = resp.choices[0].message["content"]

            try:
                plan = json.loads(content)
            except Exception:
                plan = {"raw": content}

            return Response({
                "strategy": "ai",
                "budget": budget,
                "preferences": preferences,
                "best_plan": plan,
            })

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
    """Tạo hoặc cập nhật lịch trình ăn uống."""
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


# ==============================================================
# 4️⃣ UTILITY / ADMIN / TRANSLATION / ROUTING
# ==============================================================

class OverviewView(APIView):
    """Thống kê hệ thống (user, crawl data)."""
    permission_classes = [AllowAny]

    def get(self, request):
        users = list(CustomUser.objects.values(
            "last_login", "is_email_verified", "email", "created_date"
        ))
        crawled = CrawledData.objects.count()
        active = sum(1 for u in users if u.get("is_email_verified"))
        return Response({
            "total": len(users),
            "active": active,
            "crawled": crawled,
            "data": users,
        })


@api_view(["POST"])
@permission_classes([AllowAny])
def translate_view(request):
    """Dịch văn bản bằng Groq API."""
    text = request.data.get("text", "")
    source = request.data.get("from", "en")
    target = request.data.get("to", "vi")

    if not text.strip():
        return Response({"result": text})

    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system",
                 "content": f"Translate {source}→{target}, output only translation."},
                {"role": "user", "content": text},
            ],
            temperature=0.2,
        )
        translated = completion.choices[0].message.content.strip()
        return Response({"result": translated})
    except Exception as e:
        return Response({"result": text, "error": str(e)})


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
