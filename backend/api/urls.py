from django.urls import path
from rest_framework_simplejwt.views import TokenBlacklistView

from .views import (
    # Auth
    RegisterView,
    CustomTokenObtainPairView,

    # Restaurants & Cuisines
    RestaurantListView,
    CuisineListView,
    RestaurantMapListView,
    RestaurantMapSearchView,

    # Journeys
    JourneyRecommendationsView,
    FoodJourneyUpsertView,

    # Overview & Filters & Translate
    OverviewView,
    get_filters,
    translate_view,

    # Routes
    CalculateRouteView,
    OSRMRouteView,
    GeocodeRestaurantView,

    # Profile
    get_my_profile,
    ProfileView,

    # Chatbot
    chatbot_test,
    chatbot_search,
    chatbot_rag_sql,
    chatbot_ai_search,

    # Feedback
    FeedbackCreateView,
    FeedbackListAdminView,
)

urlpatterns = [
    # ---------------------- AUTH ----------------------
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("logout/", TokenBlacklistView.as_view(), name="token_blacklist"),

    # ---------------------- RESTAURANTS ----------------------
    path("restaurants/", RestaurantListView.as_view(), name="restaurant-list"),
    path("cuisines/", CuisineListView.as_view(), name="cuisine-list"),
    path("filters/", get_filters, name="filters"),

    # Restaurant Map APIs
    path("restaurants/map/", RestaurantMapListView.as_view(), name="restaurant_map_list"),
    path("restaurants/map/search/", RestaurantMapSearchView.as_view(), name="restaurant_map_search"),
    path("geocode/", GeocodeRestaurantView.as_view(), name="geocode_restaurant"),

    # ---------------------- JOURNEYS ----------------------
    path("journey/restaurants/", JourneyRecommendationsView.as_view(), name="journey_recommendations"),
    path("journey/", FoodJourneyUpsertView.as_view(), name="journey_upsert"),

    # ---------------------- OVERVIEW + TRANSLATE ----------------------
    path("overview/", OverviewView.as_view(), name="overview"),
    path("translate/", translate_view, name="translate"),

    # ---------------------- ROUTES ----------------------
    path("calculate_route/", CalculateRouteView.as_view(), name="calculate_route"),
    path("route-osrm/", OSRMRouteView.as_view(), name="route_osrm"),

    # ---------------------- PROFILE ----------------------
    path("profile/", ProfileView.as_view(), name="user-profile"),
    path("profiles/me/", get_my_profile, name="profile_me"),

    # ---------------------- CHATBOT ----------------------
    path("chatbot/test/", chatbot_test, name="chatbot-test"),
    path("chatbot/search/", chatbot_search, name="chatbot-search"),
    path("chatbot/rag-sql/", chatbot_rag_sql, name="chatbot-rag-sql"),
    path("chatbot/rag-local/", chatbot_rag_sql, name="chatbot-rag-local"),
    path("chatbot/ai-search/", chatbot_ai_search, name="chatbot-ai-search"),

    # ---------------------- FEEDBACK ----------------------
    path("feedback/", FeedbackCreateView.as_view(), name="feedback-create"),
    path("feedback-list/", FeedbackListAdminView.as_view(), name="feedback-list"),
]
