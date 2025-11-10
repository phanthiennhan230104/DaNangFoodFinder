from django.urls import path
from .views import (
    RestaurantListView, CuisineListView,
    JourneyRecommendationsView, FoodJourneyUpsertView,
    OverviewView, get_filters, translate_view, CalculateRouteView, get_my_profile, ProfileView
    ,chatbot_test, chatbot_search, chatbot_rag_sql, chatbot_ai_search

)
from rest_framework_simplejwt.views import TokenBlacklistView

urlpatterns = [
    path("logout/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("restaurants/", RestaurantListView.as_view(), name="restaurant-list"),
    path("cuisines/", CuisineListView.as_view(), name="cuisine-list"),
    path("filters/", get_filters, name="filters"),
    path("journey/restaurants/", JourneyRecommendationsView.as_view(), name="journey_recommendations"),
    path("journey/", FoodJourneyUpsertView.as_view(), name="journey_upsert"),
    path("overview",OverviewView.as_view(),name="overview"),
    path("translate/", translate_view, name="translate"),
    path("calculate_route/", CalculateRouteView.as_view(), name="calculate_route"),
    path("route/", CalculateRouteView.as_view(), name="route"),
    path("profile/", ProfileView.as_view(), name="user-profile"),
    path("profiles/me/", get_my_profile, name="profile_me"),
    path('chatbot/test/', chatbot_test, name='chatbot-test'),
    path('chatbot/search/', chatbot_search, name='chatbot-search'),
    path('chatbot/rag-sql/', chatbot_rag_sql, name='chatbot-rag-sql'),
    path('chatbot/rag-local/', chatbot_rag_sql, name='chatbot-rag-local'),
    path('chatbot/ai-search/', chatbot_ai_search, name='chatbot-ai-search'),
]

