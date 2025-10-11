from django.contrib import admin

from api.models import CustomUser, Profile, Role, Account

admin.site.register(CustomUser)
admin.site.register(Profile)
admin.site.register(Role)
admin.site.register(Account)
