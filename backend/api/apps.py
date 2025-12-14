from django.apps import AppConfig
from django.db.models.signals import post_migrate


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        """
        Hàm này chạy khi Django load app.
        - Kích hoạt signals (geocode)
        - Khởi tạo các role mặc định sau khi migrate
        """
        # Import signals để Django register receiver
        import api.signals  # 🔥 Quan trọng: bật auto-geocode

        # Import Role model để tạo default roles
        from .models import Role
        from django.db import connection

        def create_default_roles(sender, **kwargs):
            """
            Tự động tạo role mặc định sau mỗi lần migrate.
            """
            roles = [
                {"role_id": 1, "name": "Admin", "description": "Superuser"},
                {"role_id": 2, "name": "User", "description": "Normal user"},
            ]

            for r in roles:
                Role.objects.get_or_create(
                    role_id=r["role_id"],
                    defaults={
                        "name": r["name"],
                        "description": r["description"],
                    },
                )

            print("✅ Default roles ensured.")

        # Kết nối signal post_migrate
        post_migrate.connect(create_default_roles, sender=self)
