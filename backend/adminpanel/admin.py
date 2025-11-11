from django.contrib import admin

from api.models import CustomUser, Profile, Role

admin.site.register(CustomUser)
admin.site.register(Profile)
admin.site.register(Role)

