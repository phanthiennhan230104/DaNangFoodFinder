from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import Restaurant, FoodJourney
from .serializers import UserSerializer, RestaurantSerializer, FoodJourneySerializer, RegisterSerializer, CustomTokenObtainPairSerializer
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view
from django.db import models  # dùng cho Q object

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
    """
    Lấy danh sách nhà hàng, hỗ trợ lọc theo các trường.
    Ví dụ: /api/restaurants/?cuisine_type=Bún&price_range=100k-200k.
    """
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantSerializer
    permission_classes = [AllowAny]

    filter_backends = [DjangoFilterBackend]
    filterset_fields = [
        'cuisine_type',
        'price_range',
        'address',
    ]


@api_view(["GET"])
def get_filters(request):
    """
    API để lấy danh sách khu vực (address) và loại ẩm thực (cuisine_type) duy nhất.
    """
    areas = Restaurant.objects.values_list("address", flat=True).distinct()
    cuisines = Restaurant.objects.values_list("cuisine_type", flat=True).distinct()
    return Response({
        "areas": [a for a in areas if a],
        "cuisines": [c for c in cuisines if c]
    })


class CuisineListView(APIView):
    """API để lấy danh sách các loại ẩm thực duy nhất."""
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        cuisines = Restaurant.objects.values_list('cuisine_type', flat=True).distinct()
        filtered_cuisines = [c for c in cuisines if c]
        return Response(sorted(filtered_cuisines))

class JourneyRestaurantListView(APIView):
    """
    API cho Food Journey Planner.
    Cho phép lọc theo budget (trong price_range), preferences (cuisine_type), search (tên hoặc địa chỉ).
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        budget = request.query_params.get("budget")
        preferences = request.query_params.get("preferences")
        search = request.query_params.get("search")

        queryset = Restaurant.objects.all()

        if budget:
            queryset = queryset.filter(price_range__icontains=str(budget))

        if preferences:
            prefs = [p.strip() for p in preferences.split(",") if p.strip()]
            queryset = queryset.filter(cuisine_type__in=prefs)

        if search:
            queryset = queryset.filter(
                models.Q(name__icontains=search) |
                models.Q(address__icontains=search)
            )

        serializer = RestaurantSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class FoodJourneyListCreateView(generics.ListCreateAPIView):
    serializer_class = FoodJourneySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FoodJourney.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
