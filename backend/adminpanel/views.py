import sys
import subprocess
from django.conf import settings
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from django.contrib.auth import get_user_model
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from api.models import CustomUser, Feedback, Profile, Role, CrawledSource, CrawledData
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
    if "restaurantguru.com" in url.lower():
        source = "RestaurantGuru"
    elif "foody.vn" in url.lower():
        source = "Foody"
    else:
        source = "CustomSource"

    def event_stream():
        yield f"--- Starting crawl_data with URL {url} ---\n"
        yield f"--- Detected source: {source} ---\n"
        for line in run_command(["crawl_data", url, "--source", source]):
            yield line

        yield f"--- Running process_data for {source} ---\n"
        for line in run_command(["process_data", "--source", source]):
            yield line

        yield f"--- Running crawl_detail for {source} (limit 20) ---\n"
        for line in run_command(["crawl_detail", "--limit", "20", "--source", source]):
            yield line

        # Use appropriate process_detail command based on source
        if source == "RestaurantGuru":
            yield "--- Running process_detail_restaurantguru ---\n"
            for line in run_command(["process_detail_restaurantguru"]):
                yield line
        else:
            yield "--- Running process_detail ---\n"
            for line in run_command(["process_detail"]):
                yield line

        yield "--- Running cleanup_restaurants ---\n"
        for line in run_command(["cleanup_restaurants"]):
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


@api_view(["GET"])
@permission_classes([AllowAny])
def crawl_progress(request):
    """
    Get crawl progress for Foody and RestaurantGuru
    Returns the latest page number crawled for each source
    """
    from django.db.models import Max
    import re
    
    progress_data = []
    
    # Get all crawled sources
    sources = CrawledSource.objects.all()
    
    for source in sources:
        # Get all URLs for this source
        urls = CrawledData.objects.filter(source=source).values_list('url', flat=True)
        
        if not urls:
            continue
            
        # Extract page numbers from URLs
        max_page = 0
        latest_url = ""
        listing_url = ""
        
        for url in urls:
            if 'foody.vn' in url.lower():
                match = re.search(r'[?&]page=(\d+)', url)
                if match:
                    page_num = int(match.group(1))
                    if page_num > max_page:
                        max_page = page_num
                        latest_url = url
            
            # For RestaurantGuru: Check for listing page pattern
            elif 'restaurantguru.com' in url.lower():
                if '/Da-Nang' in url:
                    page_match = re.search(r'/Da-Nang/(\d+)/?$', url)
                    if page_match:
                        page_num = int(page_match.group(1))
                    elif url.rstrip('/').endswith('/Da-Nang'):
                        page_num = 1
                    else:
                        continue
                    
                    if page_num > max_page:
                        max_page = page_num
                        latest_url = url
        
        # Add to progress data
        if max_page > 0:
            progress_data.append({
                'source': source.name,
                'max_page': max_page,
                'latest_url': latest_url if latest_url else 'N/A',
                'status': 'Active' if max_page > 0 else 'Not started'
            })
    
    return Response({
        'success': True,
        'data': progress_data,
        'timestamp': timezone.now()
    })
