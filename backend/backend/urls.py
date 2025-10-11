from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path("api/admin/", include("adminpanel.urls")),
    path("api/auth/", include("authentication.urls")),
]