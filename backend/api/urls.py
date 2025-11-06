from django.urls import path
from .views import (
    RestaurantListView,
    CuisineListView,
    JourneyRecommendationsView,
    FoodJourneyUpsertView,
    OverviewView,
    ProfileView,
    get_filters,
    translate_view,
    CalculateRouteView
)
from rest_framework_simplejwt.views import TokenBlacklistView

urlpatterns = [
    path("logout/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("restaurants/", RestaurantListView.as_view(), name="restaurant-list"),
    path("cuisines/", CuisineListView.as_view(), name="cuisine-list"),
    path("filters/", get_filters, name="filters"),
    path("journey/restaurants/", JourneyRecommendationsView.as_view(), name="journey_recommendations"),
    path("journey/", FoodJourneyUpsertView.as_view(), name="journey_upsert"),
    path("overview/", OverviewView.as_view(), name="overview"),
    path("translate/", translate_view, name="translate"),
    path("calculate_route/", CalculateRouteView.as_view(), name="calculate_route"),
    path("route/", CalculateRouteView.as_view(), name="route"),
    path("profile/", ProfileView.as_view(), name="user-profile"),
]
