from django.apps import AppConfig
from django.db.models.signals import post_migrate


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
    def ready(self):
        from .models import Role
        from django.db import connection

        def create_default_roles(sender, **kwargs):
            roles = [
                {"role_id": 1, "name": "Admin", "description": "Superuser"},
                {"role_id": 2, "name": "User", "description": "Normal user"},
            ]
            for r in roles:
                Role.objects.get_or_create(  role_id=r["role_id"],
                    defaults={"name": r["name"], "description": r["description"]},)
                # Role.objects.get_or_create(name="Admin", defaults={"description": "Superuser"})
                # Role.objects.update_or_create(
                #     role_id=r["role_id"],
                #     defaults={"name": r["name"], "description": r["description"]},
                # )

        post_migrate.connect(create_default_roles, sender=self)
