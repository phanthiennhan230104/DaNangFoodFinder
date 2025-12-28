import email
from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from datetime import timedelta


User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["email", "password"]

    def validate_email(self, email):
        email = email.strip().lower()

        # ✅ CHỈ CHO GMAIL
        if not email.endswith("@gmail.com"):
            raise serializers.ValidationError("Only gmail.com is allowed")

        # ❌ CHẶN DOMAIN SAI
        invalid_domains = [
            "@gmai.com", "@gmial.com", "@gnail.com",
            "@gmail.con", "@gmail.co"
        ]
        for d in invalid_domains:
            if email.endswith(d):
                raise serializers.ValidationError(
                    "Invalid email domain. Did you mean gmail.com?"
                )

        if User.objects.filter(email=email, is_active=True).exists():
            raise serializers.ValidationError("Email already exists")
        return email

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"]
        )
        user.is_active = False
        user.is_email_verified = False
        user.save()
        return user

class MyTokenObtainPairSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({"detail": "Incorrect email or password"})
        
        if not user.check_password(password):
            raise serializers.ValidationError({"detail": "Incorrect email or password"})
        
        if not user.is_active:
            raise serializers.ValidationError({"detail": "The account has not been verified with OTP"})
        
        # Tạo token - SỬA ĐỂ TRÁNH LỖI
        refresh = RefreshToken()
        refresh['user_id'] = user.user_id  # ✅ Dùng user_id
        refresh['email'] = user.email
        refresh.set_exp(lifetime=timedelta(days=1))
        
        # Tạo access token từ refresh
        access = refresh.access_token
        access['user_id'] = user.user_id
        access['email'] = user.email
        access.set_exp(lifetime=timedelta(days=1)) 
        user.last_login = timezone.now()
        
        user.save()
        
        return {
            'refresh': str(refresh),
            'access': str(access),
            'email': user.email,
            'user_id': user.user_id
        }

class ResetPasswordSerializer(serializers.Serializer):
    password1 = serializers.CharField(write_only=True, required=True)
    password2 = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        if attrs.get("password1") != attrs.get("password2"):
            raise serializers.ValidationError({"password": "Passwords do not match"})
        return attrs