from django.contrib import admin
from django.urls import path, include
from api.views import CalculateRouteView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path("api/admin/", include("adminpanel.urls")),
    path("api/auth/", include("authentication.urls")),
    path('route/', CalculateRouteView.as_view(), name="route"),
]
