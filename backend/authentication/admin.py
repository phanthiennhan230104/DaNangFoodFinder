from django.contrib import admin
from .models import OTP


@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):
    list_display = ("email", "otp_code", "created_at", "is_used")
    list_filter = ("is_used", "created_at")
    search_fields = ("email", "otp_code")
    ordering = ("-created_at",)
