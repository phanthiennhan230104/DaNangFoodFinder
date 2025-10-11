from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager

# =================================================================================
# CUSTOM USER & ROLE
# =================================================================================

class Role(models.Model):
    role_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'Roles'

    def __str__(self):
        return self.name


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email must be set")
        email = self.normalize_email(email)
        role = extra_fields.get("role")
        if not role:
            role, _ = Role.objects.get_or_create(
                name="User", defaults={"description": "Normal user"}
            )
            extra_fields["role"] = role
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        role, _ = Role.objects.get_or_create(
            name="Admin", defaults={"description": "Superuser"}
        )
        extra_fields["role"] = role
        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractBaseUser, PermissionsMixin):
    user_id = models.AutoField(primary_key=True)
    email = models.EmailField(unique=True)
    created_date = models.DateTimeField(default=timezone.now)

    role = models.ForeignKey(Role, on_delete=models.CASCADE, null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    is_staff = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    objects = CustomUserManager()

    def __str__(self):
        return self.email

    class Meta:
        db_table = "Users"


class Profile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, primary_key=True, related_name='profile')
    fullname = models.CharField(max_length=255)
    dob = models.DateField()
    gender = models.CharField(max_length=10)
    phone = models.CharField(max_length=20, null=True, blank=True)
    address = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'Profiles'

    def __str__(self):
        return self.fullname


class Account(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    is_email_verified = models.BooleanField(default=False)

    def __str__(self):
        return self.user.email


# =================================================================================
# MODELS DỮ LIỆU THÔ TỪ CRAWLER
# =================================================================================

class CrawledSource(models.Model):
    name = models.CharField(max_length=255, unique=True, help_text="Tên của nguồn dữ liệu, ví dụ: Foody")
    base_url = models.URLField(max_length=255, blank=True, null=True, help_text="URL gốc của trang web")

    def __str__(self):
        return self.name


class CrawledData(models.Model):
    class StatusChoices(models.TextChoices):
        PENDING = 'Pending', 'Đang chờ xử lý'
        PROCESSED = 'Processed', 'Đã xử lý'
        ERROR = 'Error', 'Bị lỗi'

    source = models.ForeignKey(CrawledSource, on_delete=models.CASCADE, related_name='crawled_items')
    url = models.URLField(max_length=2048, help_text="URL cụ thể của trang được crawl")
    raw_html = models.TextField(blank=True, null=True, help_text="Nội dung HTML thô")
    status = models.CharField(max_length=20, choices=StatusChoices.choices, default=StatusChoices.PENDING)
    crawled_at = models.DateTimeField(auto_now_add=True)

    linked_restaurant = models.ForeignKey(
        'Restaurant', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='crawled_records'
    )

    def __str__(self):
        return f"Dữ liệu từ {self.source.name} - {self.status}"



# =================================================================================
# MODELS DỮ LIỆU SẠCH CHO ỨNG DỤNG VÀ RAG
# =================================================================================

class Restaurant(models.Model):
    name = models.CharField(max_length=255)
    address = models.TextField()
    opening_hours = models.CharField(max_length=500, blank=True, null=True)
    cuisine_type = models.CharField(max_length=100, blank=True, null=True)
    price_range = models.CharField(max_length=100, blank=True, null=True)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    rag_context_text = models.TextField(blank=True, null=True, help_text="Văn bản tổng hợp thông tin về nhà hàng để vector hóa.")
    vector_id = models.CharField(max_length=255, unique=True, null=True, blank=True, db_index=True)
    image = models.URLField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_updated_at = models.DateTimeField(auto_now=True)
    detail_url = models.URLField(max_length=2048, blank=True, null=True)

    def __str__(self):
        return self.name


class Feedback(models.Model):
    class FeedbackType(models.TextChoices):
        REPORT = "Report", "Report Issue / Error"
        SUGGESTION = "Suggestion", "Feature Suggestion"
        GENERAL = "General", "General Feedback"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="feedbacks"
    )
    feedback_type = models.CharField(
        max_length=50,
        choices=FeedbackType.choices,
        default=FeedbackType.GENERAL
    )
    subject = models.CharField(max_length=255, blank=True, null=True)
    message = models.TextField()
    contact_email = models.EmailField(blank=True, null=True)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "Feedbacks"
        ordering = ["-created_at"]

    def __str__(self):
        sender = self.user.email if self.user else "Anonymous"
        return f"[{self.feedback_type}] {sender} - {self.subject or 'No subject'}"



# =================================================================================
# MODELS CHO TÍNH NĂNG NGƯỜI DÙNG
# =================================================================================

class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='favorites')
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='favorited_by')
    date_saved = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'restaurant')

    def __str__(self):
        return f"{self.user.username} thích {self.restaurant.name}"


class SearchHistory(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='search_history')
    query_text = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"'{self.query_text}' bởi {self.user.username}"


class FoodJourney(models.Model): 
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="journeys") 
    date = models.DateField() 
    breakfast = models.ForeignKey(Restaurant, on_delete=models.SET_NULL, null=True, blank=True, related_name="breakfast_journeys") 
    lunch = models.ForeignKey(Restaurant, on_delete=models.SET_NULL, null=True, blank=True, related_name="lunch_journeys") 
    dinner = models.ForeignKey(Restaurant, on_delete=models.SET_NULL, null=True, blank=True, related_name="dinner_journeys") 
    created_at = models.DateTimeField(auto_now_add=True) 

    class Meta: 
        unique_together = ("user", "date") 
    
    def __str__(self): 
        return f"{self.user.username} - {self.date}"
