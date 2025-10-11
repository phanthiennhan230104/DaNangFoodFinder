from typing import List
import json

from django.db.models import Q
from django.contrib.auth import get_user_model

from rest_framework import generics, status, permissions
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view

from rest_framework_simplejwt.views import TokenObtainPairView
from django_filters.rest_framework import DjangoFilterBackend

from groq import Groq
from django.conf import settings
import re

from .models import Restaurant, FoodJourney
from .serializers import (
    UserSerializer,
    RestaurantSerializer,
    FoodJourneySerializer,
    RegisterSerializer,
    CustomTokenObtainPairSerializer,
)
from .services.journey_recommender import (
    Candidate,
    parse_price_range,
    infer_meal,
    score_candidate,
    pick_best_triplet,
)

User = get_user_model()


# -----------------------------
# AUTH
# -----------------------------
class RegisterView(generics.CreateAPIView):
    """API cho Đăng ký user mới."""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


# -----------------------------
# RESTAURANTS
# -----------------------------
class RestaurantListView(generics.ListAPIView):
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        address_param = self.request.query_params.get("address")
        cuisine_param = self.request.query_params.get("cuisine_type")

        if address_param:
            qs = qs.filter(address__icontains=f"Quận {address_param}")
        if cuisine_param:
            qs = qs.filter(cuisine_type=cuisine_param)

        return qs


@api_view(["GET"])
def get_filters(request):
    """
    API để lấy danh sách khu vực (theo Quận) và loại ẩm thực (cuisine_type) duy nhất.
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
    """API để lấy danh sách các loại ẩm thực duy nhất."""
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        cuisines = Restaurant.objects.values_list("cuisine_type", flat=True).distinct()
        filtered_cuisines = [c for c in cuisines if c]
        return Response(sorted(filtered_cuisines))


# -----------------------------
# FOOD JOURNEY
# -----------------------------
class JourneyRecommendationsView(APIView):
    """
    GET /api/journey/restaurants/
    Query params:
      - budget=300000
      - preferences=Ẩm thực
      - search=keyword
      - top_k=6
      - breakfast_cut=100000
      - dinner_cut=200000
      - over_allow_ratio=0.1
      - split_ratio=0.3,0.4,0.3
      - weights=0.5,0.3,0.2
      - strategy=simple | ai
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        strategy = request.GET.get("strategy", "simple")
        budget = int(request.GET.get("budget", 300000))
        preferences_raw = request.GET.get("preferences", "")
        preferences: List[str] = [
            p.strip() for p in preferences_raw.split(",") if p.strip()
        ]
        search = request.GET.get("search", "")

        # Query restaurants
        qs = Restaurant.objects.all()
        if preferences:
            qs = qs.filter(cuisine_type__in=preferences)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(address__icontains=search))

        # Build candidates
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

        # -------- AI strategy --------
        if strategy == "ai":
            client = Groq(api_key=settings.GROQ_API_KEY)

            candidates_text = "\n".join(
                f"- id={c.id}, {c.name} ({c.cuisine_type}, {c.price} VND, rating {c.rating}, meal={c.meal_type})"
                for c in candidates
            )
            prompt = f"""
User budget: {budget} VND
Preferences: {", ".join(preferences) if preferences else "None"}
Candidate restaurants:
{candidates_text}

Please suggest exactly 3 restaurants: breakfast, lunch, dinner.
Make sure total price <= budget.
Return JSON only, like:
{{
  "breakfast": {{"id": <id>, "name": "<name>"}},
  "lunch": {{"id": <id>, "name": "<name>"}},
  "dinner": {{"id": <id>, "name": "<name>"}}
}}
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

            return Response(
                {
                    "strategy": "ai",
                    "budget": budget,
                    "preferences": preferences,
                    "best_plan": plan,
                },
                status=200,
            )

        # -------- Simple strategy --------
        top_k = int(request.GET.get("top_k", 6))
        breakfast_cut = int(request.GET.get("breakfast_cut", 100000))
        dinner_cut = int(request.GET.get("dinner_cut", 200000))
        over_allow_ratio = float(request.GET.get("over_allow_ratio", 0.1))

        split_ratio_raw = request.GET.get("split_ratio", "0.3,0.4,0.3")
        try:
            r1, r2, r3 = [float(x) for x in split_ratio_raw.split(",")]
        except Exception:
            r1, r2, r3 = 0.3, 0.4, 0.3
        total_r = (r1 + r2 + r3) or 1.0
        r1, r2, r3 = r1 / total_r, r2 / total_r, r3 / total_r
        meal_budget = {
            "breakfast": int(budget * r1),
            "lunch": int(budget * r2),
            "dinner": int(budget * r3),
        }

        weights_raw = request.GET.get("weights", "0.5,0.3,0.2")
        try:
            w_cuisine, w_price, w_rating = [float(x) for x in weights_raw.split(",")]
        except Exception:
            w_cuisine, w_price, w_rating = 0.5, 0.3, 0.2

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

        response = {
            "strategy": "simple",
            "budget": budget,
            "meal_budget": meal_budget,
            "preferences": preferences,
            "top_candidates": {
                "breakfast": [
                    serialize_candidate(c) for c, _ in grouped.get("breakfast", [])
                ],
                "lunch": [serialize_candidate(c) for c, _ in grouped.get("lunch", [])],
                "dinner": [
                    serialize_candidate(c) for c, _ in grouped.get("dinner", [])
                ],
            },
            "best_plan": {
                "breakfast": serialize_candidate(b),
                "lunch": serialize_candidate(l),
                "dinner": serialize_candidate(d),
            },
        }
        return Response(response, status=status.HTTP_200_OK)


class FoodJourneyUpsertView(APIView):
    """
    POST /api/journey/
      body: { "date": "YYYY-MM-DD", "breakfast_id":?, "lunch_id":?, "dinner_id":? }
    GET /api/journey/?date=YYYY-MM-DD
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        date = request.GET.get("date")
        if not date:
            return Response({"detail": "Missing 'date'."}, status=400)
        obj = FoodJourney.objects.filter(user=request.user, date=date).first()
        if not obj:
            return Response(None, status=200)
        return Response(FoodJourneySerializer(obj).data, status=200)

    def post(self, request):
        date = request.data.get("date")
        if not date:
            return Response({"detail": "Missing 'date'."}, status=400)

        instance = FoodJourney.objects.filter(user=request.user, date=date).first()
        if instance:
            serializer = FoodJourneySerializer(
                instance,
                data=request.data,
                partial=True,
                context={"request": request},
            )
        else:
            serializer = FoodJourneySerializer(
                data=request.data, context={"request": request}
            )

        if serializer.is_valid():
            obj = serializer.save()
            return Response(
                FoodJourneySerializer(obj).data, status=200 if instance else 201
            )
        return Response(serializer.errors, status=400)
