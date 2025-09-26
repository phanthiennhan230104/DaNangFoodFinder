from rest_framework import serializers
from .models import Restaurant, Review, FoodJourney
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from rest_framework import exceptions

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "password"]
        extra_kwargs = {
            "password": {"write_only": True},
        }

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user
    
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["email", "password"]

    def create(self, validated_data):
        from .models import Role
        role, _ = Role.objects.get_or_create(
            name="User", defaults={"description": "Normal user"}
        )
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            role=role,
        )
        return user
    
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"

    def validate(self, attrs):
        credentials = {
            "email": attrs.get("email"),
            "password": attrs.get("password"),
        }

        if not credentials["email"] or not credentials["password"]:
            raise exceptions.AuthenticationFailed(_("Must include email and password."))

        user = authenticate(
            request=self.context.get("request"),
            email=credentials["email"],
            password=credentials["password"],
        )

        if not user:
            raise exceptions.AuthenticationFailed(_("Invalid credentials."))

        data = super().validate(attrs)
        data["email"] = user.email
        data["role"] = user.role.name if user.role else None
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["role"] = user.role.name if user.role else None
        return token

class RestaurantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restaurant
        fields = [
            "id", "name", "address", "cuisine_type",
            "price_range", "average_rating",
            "contact_info", "opening_hours",
            "image",
        ]

class ReviewSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.CharField(source="restaurant.name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "restaurant",
            "restaurant_name",
            "user",
            "user_email",
            "rating",
            "comment",
            "is_internal",
            "source_url",
            "review_date",
        ]

class FoodJourneySerializer(serializers.ModelSerializer):
    breakfast = RestaurantSerializer(read_only=True)
    lunch = RestaurantSerializer(read_only=True)
    dinner = RestaurantSerializer(read_only=True)

    class Meta:
        model = FoodJourney
        fields = ["id", "user", "date", "breakfast", "lunch", "dinner", "created_at"]
        read_only_fields = ["user", "created_at"]