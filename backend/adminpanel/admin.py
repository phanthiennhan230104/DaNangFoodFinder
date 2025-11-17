from django.contrib import admin

from api.models import CustomUser, Profile, Role, Feedback

admin.site.register(CustomUser)
admin.site.register(Profile)
admin.site.register(Role)
admin.site.register(Feedback)
