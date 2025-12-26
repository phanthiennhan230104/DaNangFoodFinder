from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
import random, uuid, time
import requests
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import ValidationError

from .serializers import (
    RegisterSerializer,
    MyTokenObtainPairSerializer,
    ResetPasswordSerializer,
)

User = get_user_model()


# ====================== OTP / TOKEN HANDLING ======================
def generate_otp():
    return str(random.randint(100000, 999999))

def save_otp(email, otp, timeout=300):  # 5 minutes
    cache.set(f"otp_{email}", {"otp": otp, "created_at": time.time()}, timeout)

def verify_otp(email, otp):
    data = cache.get(f"otp_{email}")
    if not data:
        return False, "OTP does not exist or has expired."
    if data["otp"] != otp:
        return False, "Invalid OTP."
    return True, None

def save_reset_token(email, token, timeout=900):  # 15 minutes
    cache.set(f"reset_{email}", token, timeout)

def verify_reset_token(email, token):
    stored_token = cache.get(f"reset_{email}")
    if not stored_token:
        return False, "Reset token does not exist or has expired."
    if stored_token != token:
        return False, "Invalid reset token."
    return True, None


# ====================== REGISTER ======================
# views.py
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        email = serializer.validated_data["email"]

        # ✅ XÓA OTP CŨ (CỰC KỲ QUAN TRỌNG)
        cache.delete(f"otp_{email}")

        user = serializer.save()

        otp = generate_otp()
        save_otp(email, otp)

        send_mail(
            "Account Verification",
            f"Your OTP code is: {otp}",
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False
        )


    def create(self, request, *args, **kwargs):
        super().create(request, *args, **kwargs)
        return Response(
            {"message": "OTP sent to email. Please verify your account."},
            status=status.HTTP_201_CREATED
        )


# ====================== VERIFY OTP ======================
class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")

        if not email or not otp:
            return Response({"error": "Email and OTP are required."}, status=400)

        # Verify OTP
        ok, msg = verify_otp(email, otp)
        if not ok:
            return Response({"error": msg}, status=400)

        # Lấy registration data từ cache
        reg_data = cache.get(f"reg_{email}")
        if not reg_data:
            return Response({
                "error": "Registration data expired. Please register again."
            }, status=400)

        # Kiểm tra xem user đã tồn tại chưa
        if User.objects.filter(email=email).exists():
            # Nếu đã tồn tại, chỉ activate
            user = User.objects.get(email=email)
            if user.is_active:
                return Response({"error": "Account already verified"}, status=400)
            user.is_active = True
            user.is_email_verified = True
            user.save()
        else:
            # TẠO USER MỚI - chỉ khi OTP đúng
            from api.models import Role
            role, _ = Role.objects.get_or_create(
                name="User", defaults={"description": "Normal user"}
            )
            user = User.objects.create_user(
                email=reg_data["email"],
                password=reg_data["password"],
                role=role
            )
            user.is_active = True
            user.is_email_verified = True
            user.save()
            print(f"✅ User created successfully: {email}")

        # Xóa cache
        cache.delete(f"otp_{email}")
        cache.delete(f"reg_{email}")
        
        return Response({"message": "OTP verified. Account activated successfully."}, status=200)



# ====================== LOGIN ======================
class MyTokenObtainPairView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = MyTokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


# ====================== GET CURRENT USER ======================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    user = request.user
    return Response({
        'user_id': user.user_id,
        'email': user.email,
        'role_id': user.role.role_id if user.role else None,
        'role_name': user.role.name if user.role else None,
        'is_active': user.is_active
    })


# ====================== FORGOT PASSWORD ======================
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email is required."}, status=400)

        try:
            User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=404)

        otp = generate_otp()
        save_otp(email, otp)
        send_mail(
            "Password Reset",
            f"Your OTP code is: {otp}",
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False
        )

        return Response({"message": "OTP sent to email."}, status=200)


# ====================== VERIFY RESET OTP ======================
class VerifyResetOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")

        if not email or not otp:
            return Response({"error": "Email and OTP are required."}, status=400)

        ok, msg = verify_otp(email, otp)
        if not ok:
            return Response({"error": msg}, status=400)

        cache.delete(f"otp_{email}")
        reset_token = str(uuid.uuid4())
        save_reset_token(email, reset_token)

        return Response({"message": "OTP verified successfully.", "reset_token": reset_token}, status=200)


# ====================== RESET PASSWORD ======================
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reset_token = request.data.get("reset_token")
        email = request.data.get("email")
        if not reset_token or not email:
            return Response({"error": "Email and reset_token are required."}, status=400)

        ok, msg = verify_reset_token(email, reset_token)
        if not ok:
            return Response({"error": msg}, status=400)

        password1 = serializer.validated_data.get("password1")
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=404)

        user.set_password(password1)
        user.is_active = True
        user.save()

        cache.delete(f"reset_{email}")

        return Response({"message": "Password reset successfully."}, status=200)


class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        id_token = request.data.get("id_token")
        if not id_token:
            return Response({"detail": "Missing id_token"}, status=400)

        try:
            # Gửi token lên Google để verify
            r = requests.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
                timeout=5,
            )
        except Exception as e:
            print("Error calling Google tokeninfo:", e)
            return Response({"detail": "Error verifying token with Google"}, status=400)

        if r.status_code != 200:
            print("Google tokeninfo status != 200:", r.status_code, r.text)
            return Response({"detail": "Invalid Google token"}, status=400)

        data = r.json()
        aud = data.get("aud")
        email = data.get("email")
        email_verified = str(data.get("email_verified", "")).lower() in ["true", "1"]

        # Debug log
        print("Google token data:", data)
        print("settings.GOOGLE_CLIENT_ID:", settings.GOOGLE_CLIENT_ID)

        # Kiểm tra client_id
        if aud != settings.GOOGLE_CLIENT_ID:
            print("AUD mismatch:", aud, "!=", settings.GOOGLE_CLIENT_ID)
            return Response({"detail": "Invalid client_id"}, status=400)

        if not email or not email_verified:
            return Response({"detail": "Email not verified by Google"}, status=400)

        # Tìm hoặc tạo user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            user = User.objects.create_user(
                email=email,
                password=None,  
            )
            user.is_active = True
            user.is_email_verified = True
            user.save()
            
            user.last_login = timezone.now()
            user.save(update_fields=["last_login"])


        # Tạo JWT token
        refresh = RefreshToken.for_user(user)
        access = refresh.access_token

        return Response(
            {
                "refresh": str(refresh),
                "access": str(access),
                "email": user.email,
                "user_id": getattr(user, "user_id", None),
            },
            status=200,
        )
