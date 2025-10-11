from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
import random, uuid

from .serializers import (
    RegisterSerializer,
    MyTokenObtainPairSerializer,
    ResetPasswordSerializer,
)
from .models import OTP, ResetToken

User = get_user_model()


# REGISTER
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        user = serializer.save()
        otp = str(random.randint(100000, 999999))
        OTP.objects.create(email=user.email, otp_code=otp)

        send_mail("Xác thực tài khoản", f"Mã OTP của bạn là: {otp}", None, [user.email])
        return user

    def create(self, request, *args, **kwargs):
        super().create(request, *args, **kwargs)
        return Response({"message": "User registered. OTP sent to email."}, status=201)


# VERIFY OTP
class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")

        if not email or not otp:
            return Response({"error": "Missing email or OTP"}, status=400)

        try:
            otp_obj = OTP.objects.filter(email=email, otp_code=otp, is_used=False).latest("created_at")
        except OTP.DoesNotExist:
            return Response({"error": "OTP không hợp lệ"}, status=400)

        if otp_obj.is_expired():
            return Response({"error": "OTP đã hết hạn"}, status=400)

        try:
            user = User.objects.get(email=email)
            user.is_active = True
            user.is_email_verified = True 
            user.save()

            otp_obj.is_used = True
            otp_obj.save()

            return Response({"message": "OTP verified. Account activated."})
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)


# LOGIN
class MyTokenObtainPairView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = MyTokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


# GET CURRENT USER INFO
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


# FORGOT PASSWORD
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email is required"}, status=400)

        try:
            User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        otp = str(random.randint(100000, 999999))
        OTP.objects.create(email=email, otp_code=otp)

        send_mail("Đặt lại mật khẩu", f"Mã OTP của bạn là: {otp}", None, [email])
        return Response({"message": "OTP sent to email."}, status=200)


# VERIFY RESET OTP
class VerifyResetOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")

        if not email or not otp:
            return Response({"error": "Email and OTP are required"}, status=400)

        try:
            otp_obj = OTP.objects.filter(email=email, otp_code=otp, is_used=False).latest("created_at")
        except OTP.DoesNotExist:
            return Response({"error": "OTP không hợp lệ"}, status=400)

        if otp_obj.is_expired():
            return Response({"error": "OTP đã hết hạn"}, status=400)

        otp_obj.is_used = True
        otp_obj.save()

        token = str(uuid.uuid4())
        ResetToken.objects.create(email=email, token=token)

        return Response({"message": "OTP verified", "reset_token": token}, status=200)


# RESET PASSWORD
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reset_token = request.data.get("reset_token")
        
        if not reset_token:
            return Response({"error": "reset_token is required"}, status=400)

        try:
            reset_obj = ResetToken.objects.get(token=reset_token)
        except ResetToken.DoesNotExist:
            return Response({"error": "Invalid reset token"}, status=400)

        if reset_obj.is_expired():
            return Response({"error": "Reset token expired"}, status=400)

        password1 = serializer.validated_data.get("password1")
        email = reset_obj.email

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        user.set_password(password1)
        user.is_active = True
        user.save()

        reset_obj.delete()

        return Response({"message": "Password reset successful"}, status=200)