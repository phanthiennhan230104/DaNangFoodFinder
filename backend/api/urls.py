from django.urls import path
from .views import (
    RegisterView, RestaurantListView, CuisineListView,
    JourneyRestaurantListView, FoodJourneyListCreateView,
    CustomTokenObtainPairView, get_filters
)
from rest_framework_simplejwt.views import TokenRefreshView, TokenBlacklistView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("logout/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("restaurants/", RestaurantListView.as_view(), name="restaurant-list"),
    path("cuisines/", CuisineListView.as_view(), name="cuisine-list"),
    path("filters/", get_filters, name="filters"),   # 👈 thêm dòng này
    path("journey/restaurants/", JourneyRestaurantListView.as_view(), name="journey-restaurant-list"),
    path("journeys/", FoodJourneyListCreateView.as_view(), name="journey-list-create"),
]
