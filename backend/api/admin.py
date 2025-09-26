# backend/api/admin.py
from django.contrib import admin
from .models import Restaurant, CrawledData, CrawledSource

# Đăng ký các model để chúng xuất hiện trên trang admin
admin.site.register(Restaurant)
admin.site.register(CrawledData)
admin.site.register(CrawledSource)