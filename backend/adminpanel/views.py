import sys
import subprocess
from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response

from django.contrib.auth import get_user_model
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from api.models import CustomUser, Feedback, Profile, Role
from .serializers import (
    CustomUserSerializer,
    FeedbackSerializer,
    FeedbackUpdateSerializer,
    ProfileSerializer,
    RoleSerializer,
    AccountSerializer,
)
from rest_framework.views import APIView
from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

PYTHON_EXEC = sys.executable


def run_command(args):
    from django.conf import settings
    base_dir = settings.BASE_DIR  

    process = subprocess.Popen(
        [PYTHON_EXEC, "manage.py"] + args,
        cwd=str(base_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    for line in iter(process.stdout.readline, ""):
        yield line
    process.stdout.close()
    process.wait()


@api_view(["POST"])
def crawl_pipeline(request):
    url = request.data.get("url")
    if not url:
        return Response({"error": "Missing URL"}, status=400)

    # ✅ Auto-detect source domain
    if "tripadvisor.com" in url.lower():
        source = "TripAdvisor"
    elif "foody.vn" in url.lower():
        source = "Foody"
    else:
        source = "CustomSource"

    def event_stream():
        yield f"--- Starting crawl_data with URL {url} ---\n"
        for line in run_command(["crawl_data", url, "--source", source]):
            yield line

        yield "--- Running process_data ---\n"
        for line in run_command(["process_data", "--source", source]):
            yield line

        yield "--- Running crawl_detail (limit 12) ---\n"
        for line in run_command(["crawl_detail", "--limit", "12"]):
            yield line

        yield "--- Running process_detail ---\n"
        for line in run_command(["process_detail"]):
            yield line

        yield "--- ✅ Pipeline completed! ---\n"

    return StreamingHttpResponse(event_stream(), content_type="text/plain")


# ==========================
# ADMIN FUNCTIONS
# ==========================

class RoleListView(generics.ListAPIView):
    """
    Get the list of all roles.
    Admin only.
    """
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAdminUser]


class RoleCreateView(generics.CreateAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAdminUser]


class RoleDetailView(generics.RetrieveAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAdminUser]


class RoleUpdateView(generics.UpdateAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAdminUser]


class RoleDeleteView(generics.DestroyAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAdminUser]


class UserListView(generics.ListAPIView):
    """
    List all users.
    Admin only.
    """
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["email", "role__name"]


class UserCreateView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [IsAdminUser]


class UserDetailView(generics.RetrieveAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return CustomUser.objects.all()
        return CustomUser.objects.filter(pk=user.pk)


class UserUpdateView(generics.UpdateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return CustomUser.objects.all()
        return CustomUser.objects.filter(pk=user.pk)


class UserDeleteView(generics.DestroyAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [IsAdminUser]


class ProfileListView(generics.ListAPIView):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["fullname", "gender"]


class ProfileCreateView(generics.CreateAPIView):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAdminUser]


class ProfileDetailView(generics.RetrieveAPIView):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAdminUser]


class ProfileUpdateView(generics.UpdateAPIView):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAdminUser]


class ProfileDeleteView(generics.DestroyAPIView):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAdminUser]


class AccountListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = AccountSerializer


class AccountDetailView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = AccountSerializer


class AccountUpdateView(generics.UpdateAPIView):
    queryset = User.objects.all()
    serializer_class = AccountSerializer


class AccountDeleteView(generics.DestroyAPIView):
    queryset = User.objects.all()
    serializer_class = AccountSerializer


class AccountCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = AccountSerializer


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(request, username=username, password=password)
        if user is not None:
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "user": {
                        "email": user.email,
                        "is_staff": user.is_staff,
                        "is_superuser": user.is_superuser,
                    },
                },
                status=status.HTTP_200_OK,
            )
        return Response(
            {"detail": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED,
        )


class FeedbackUpdateAPIView(generics.UpdateAPIView):
    queryset = Feedback.objects.all()
    serializer_class = FeedbackUpdateSerializer
