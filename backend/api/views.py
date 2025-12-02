

from typing import List
import json
import logging
import re
import requests
from datetime import timedelta

from django.db.models import Q
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings

from rest_framework import generics, status, permissions
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.views import TokenObtainPairView

from groq import Groq

from .models import Restaurant, FoodJourney, CustomUser, CrawledData, Profile,Feedback
from .models import Favorite
from .serializers import (
    UserSerializer,
    RestaurantSerializer,
    FoodJourneySerializer,
    RegisterSerializer,
    CustomTokenObtainPairSerializer,
    ProfileSerializer,
    FeedbackSerializer
    , FavoriteSerializer
)

from .services.journey_recommender import (
    Candidate,
    parse_price_range,
    infer_meal,
    score_candidate,
    pick_best_triplet,
)
from .services.geocode_service import geocode_address, normalize_danang_address
from .services.route_service import get_route
from .models import Profile
from .serializers import ProfileSerializer

User = get_user_model()
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_my_profile(request):
    """
    Trả về profile của user hiện tại.
    Nếu chưa có profile thì tự động tạo với giá trị mặc định,
    để frontend luôn nhận được dữ liệu (không trả 404).
    """
    profile, created = Profile.objects.get_or_create(
        user=request.user,
        defaults={
            "fullname": "",
            "dob": "2000-01-01",
            "gender": "",
        },
    )
    serializer = ProfileSerializer(profile)
    return Response(serializer.data, status=status.HTTP_200_OK)

        
        
class RestaurantListView(generics.ListAPIView):
    
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        address = self.request.query_params.get("address")
        cuisine = self.request.query_params.get("cuisine_type")
        
        if address:
            qs = qs.filter(address__icontains=f"Quận {address}")
        if cuisine:
            qs = qs.filter(cuisine_type=cuisine)

        limit_param = self.request.query_params.get("limit")
        page_param = self.request.query_params.get("page")
        page_size_param = self.request.query_params.get("page_size")

        # If page-based pagination params are present, return qs and let DRF pagination handle slicing
        if page_param or page_size_param:
            return qs

        # If limit explicitly requests all items
        if limit_param is None:
            # No limit provided and no pagination params -> return all records
            return qs

        if isinstance(limit_param, str) and limit_param.lower() in ("all", "none"):
            return qs

        try:
            limit = int(limit_param)
        except Exception:
            # Fallback to returning all
            return qs

        if limit <= 0:
            return qs

        return qs[:limit]


class RestaurantDetailView(generics.RetrieveAPIView):
    """Retrieve a single restaurant by PK (detail view).

    This endpoint complements the existing ListAPIView. It uses the same
    RestaurantSerializer and returns more detailed fields for UI popups.
    """
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantSerializer
    permission_classes = [AllowAny]


class FavoriteListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # list favorites for current user
        favs = Favorite.objects.filter(user=request.user).select_related('restaurant')
        serializer = FavoriteSerializer(favs, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request):
        # create favorite for current user (idempotent)
        restaurant_id = request.data.get('restaurant_id')
        if not restaurant_id:
            return Response({"detail": "Missing restaurant_id."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            restaurant = Restaurant.objects.get(pk=restaurant_id)
        except Restaurant.DoesNotExist:
            return Response({"detail": "Restaurant not found."}, status=status.HTTP_404_NOT_FOUND)

        fav, created = Favorite.objects.get_or_create(user=request.user, restaurant=restaurant)
        serializer = FavoriteSerializer(fav, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class FavoriteDestroyView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, restaurant_id):
        fav = Favorite.objects.filter(user=request.user, restaurant_id=restaurant_id).first()
        if not fav:
            return Response(status=status.HTTP_404_NOT_FOUND)
        fav.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)



class FeedbackCreateView(generics.CreateAPIView):
    queryset = Feedback.objects.all()
    serializer_class = FeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]  # Cho phép gửi cả khi chưa đăng nhập

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)



class FeedbackListAdminView(APIView):
    def get(self, request):
        is_resolved = request.query_params.get('is_resolved')
        if is_resolved == 'false':
            feedbacks = Feedback.objects.filter(is_resolved=False)
        elif is_resolved == 'true':
            feedbacks = Feedback.objects.filter(is_resolved=True)
        else:
            feedbacks = Feedback.objects.all()
        serializer = FeedbackSerializer(feedbacks, many=True)
        return Response(serializer.data)

@api_view(["GET"])
def get_filters(request):
    """
    Lấy danh sách khu vực (Quận) & loại ẩm thực (cuisine_type) duy nhất.
    """
    addresses = Restaurant.objects.values_list("address", flat=True).distinct()
    areas = set()

    for addr in addresses:
        if addr:
            match = re.search(r"Quận\s*([\w\sÀ-ỹ]+)", addr)
            if match:
                areas.add(match.group(1).strip())

    cuisines = Restaurant.objects.values_list("cuisine_type", flat=True).distinct()
    return Response({
        "areas": sorted(list(areas)),
        "cuisines": [c for c in cuisines if c],
    })


class CuisineListView(APIView):
    """Trả danh sách loại ẩm thực duy nhất."""
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        cuisines = Restaurant.objects.values_list("cuisine_type", flat=True).distinct()
        filtered = [c for c in cuisines if c]
        return Response(sorted(filtered))




class JourneyRecommendationsView(APIView):
    
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        strategy = request.GET.get("strategy", "simple")
        budget = int(request.GET.get("budget", 300000))
        preferences_raw = request.GET.get("preferences", "")
        preferences: List[str] = [
            p.strip() for p in preferences_raw.split(",") if p.strip()
        ]
        search = request.GET.get("search", "")

        # --- Lọc danh sách ---
        qs = Restaurant.objects.all()
        if preferences:
            qs = qs.filter(cuisine_type__in=preferences)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(address__icontains=search))

        # --- Tạo danh sách ứng viên ---
        candidates: List[Candidate] = []
        for r in qs:
            price_val = parse_price_range(r.price_range, default_price=0)
            meal = getattr(r, "meal_type", None) or infer_meal(
                price_val, 100000, 200000
            )
            candidates.append(
                Candidate(
                    id=r.id,
                    name=r.name,
                    cuisine_type=r.cuisine_type,
                    price_range=r.price_range,
                    rating=float(r.average_rating or 0.0),
                    meal_type=meal,
                    price=price_val,
                )
            )

        # --- Chiến lược AI ---
        if strategy == "ai":
            client = Groq(api_key=settings.GROQ_API_KEY)
            candidates_text = "\n".join(
                f"- id={c.id}, {c.name} ({c.cuisine_type}, {c.price} VND, rating {c.rating}, meal={c.meal_type})"
                for c in candidates
            )
            prompt = f"""
                User budget: {budget} VND
                Preferences: {", ".join(preferences) or "None"}
                Candidate restaurants:
                {candidates_text}

                Suggest exactly 3 restaurants (breakfast, lunch, dinner)
                Ensure total price <= budget.
                Return JSON only.
            """

            resp = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
            )
            content = resp.choices[0].message["content"]

            try:
                plan = json.loads(content)
            except Exception:
                plan = {"raw": content}

            return Response({
                "strategy": "ai",
                "budget": budget,
                "preferences": preferences,
                "best_plan": plan,
            })

        # --- Chiến lược simple ---
        top_k = int(request.GET.get("top_k", 6))
        breakfast_cut = int(request.GET.get("breakfast_cut", 100000))
        dinner_cut = int(request.GET.get("dinner_cut", 200000))
        over_allow_ratio = float(request.GET.get("over_allow_ratio", 0.1))

        # --- Chia ngân sách ---
        try:
            r1, r2, r3 = [float(x) for x in request.GET.get("split_ratio", "0.3,0.4,0.3").split(",")]
        except Exception:
            r1, r2, r3 = 0.3, 0.4, 0.3
        total_r = r1 + r2 + r3 or 1.0
        r1, r2, r3 = r1 / total_r, r2 / total_r, r3 / total_r
        meal_budget = {
            "breakfast": int(budget * r1),
            "lunch": int(budget * r2),
            "dinner": int(budget * r3),
        }

        # --- Trọng số ---
        try:
            w_cuisine, w_price, w_rating = [float(x) for x in request.GET.get("weights", "0.5,0.3,0.2").split(",")]
        except Exception:
            w_cuisine, w_price, w_rating = 0.5, 0.3, 0.2

        # --- Nhóm ứng viên ---
        grouped = {"breakfast": [], "lunch": [], "dinner": []}
        for c in candidates:
            if c.meal_type not in grouped:
                continue
            s = score_candidate(
                c,
                desired_cuisines=preferences,
                meal=c.meal_type,
                meal_budget=meal_budget[c.meal_type],
                w_cuisine=w_cuisine,
                w_price=w_price,
                w_rating=w_rating,
            )
            grouped[c.meal_type].append((c, s))

        for k in grouped.keys():
            grouped[k].sort(key=lambda x: x[1], reverse=True)
            grouped[k] = grouped[k][:top_k]

        b, l, d = pick_best_triplet(
            grouped, total_budget=budget, over_allow_ratio=over_allow_ratio
        )

        def serialize_candidate(c: Candidate | None):
            if not c:
                return None
            return {
                "id": c.id,
                "name": c.name,
                "cuisine_type": c.cuisine_type,
                "price_range": c.price_range,
                "price": c.price,
                "average_rating": c.rating,
                "meal_type": c.meal_type,
            }

        return Response({
            "strategy": "simple",
            "budget": budget,
            "meal_budget": meal_budget,
            "preferences": preferences,
            "best_plan": {
                "breakfast": serialize_candidate(b),
                "lunch": serialize_candidate(l),
                "dinner": serialize_candidate(d),
            },
            "top_candidates": {
                m: [serialize_candidate(c) for c, _ in grouped[m]]
                for m in grouped
            },
        })


class FoodJourneyUpsertView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        date = request.GET.get("date")
        if not date:
            return Response({"detail": "Missing 'date'."}, status=400)
        obj = FoodJourney.objects.filter(user=request.user, date=date).first()
        if not obj:
            return Response(None, status=200)
        return Response(FoodJourneySerializer(obj).data)

    def post(self, request):
        date = request.data.get("date")
        if not date:
            return Response({"detail": "Missing 'date'."}, status=400)

        instance = FoodJourney.objects.filter(user=request.user, date=date).first()
        serializer = FoodJourneySerializer(
            instance or None, data=request.data, partial=bool(instance),
            context={"request": request},
        )

        if serializer.is_valid():
            obj = serializer.save()
            return Response(FoodJourneySerializer(obj).data, status=200 if instance else 201)
        return Response(serializer.errors, status=400)
    
class OverviewView(APIView):
    """Thống kê hệ thống (user, crawl data)."""
    permission_classes = [AllowAny]

    def get(self, request):
        users = list(CustomUser.objects.values(
            "last_login", "is_email_verified", "email", "created_date"
        ))
        crawled = CrawledData.objects.count()
        active = sum(1 for u in users if u.get("is_email_verified"))
        return Response({
            "total": len(users),
            "active": active,
            "crawled": crawled,
            "data": users,
        })


@api_view(["POST"])
@permission_classes([AllowAny])
def translate_view(request):
    """Dịch văn bản bằng Groq API với hậu xử lý tiếng Việt tự nhiên."""
    text = request.data.get("text", "")
    source = request.data.get("from", "en")
    target = request.data.get("to", "vi")

    if not text.strip():
        return Response({"result": text})

    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional translator for a web application about food discovery in Da Nang. "
                        "Translate from English to Vietnamese using natural, modern language suited for a travel/food website. "
                        "Avoid literal or technical terms like 'nghiệp vụ' or 'vận hành'. "
                        "Use phrases familiar to Vietnamese users, e.g., 'khám phá ẩm thực', 'gợi ý món ăn', 'trải nghiệm ẩm thực'. "
                        "Output translation only, no explanation."
                    ),
                },
                {"role": "user", "content": text},
            ],
            temperature=0.2,
        )

        translated = completion.choices[0].message.content.strip()
        refined = refine_vietnamese(translated)
        return Response({"result": refined})

    except Exception as e:
        return Response({"result": text, "error": str(e)})


def refine_vietnamese(text: str) -> str:
    """Làm mềm và chuẩn ngữ pháp tiếng Việt."""
    replacements = [
        (r"\b(Bữa sáng|Bữa trưa|Bữa tối)\s*(Gợi ý|Đề xuất)", "Gợi ý \\1"),
        (r"\b(Gợi ý|Đề xuất)\s*(Bữa sáng|Bữa trưa|Bữa tối)", "Gợi ý \\2"),
        (r"\b(Nhà hàng)\s*(Yêu thích|Ưa thích)", "\\2 \\1"),
        (r"\b(Bản đồ)\s*(Mở|Đóng)", "\\2 \\1"),
        (r"\b(Khuyến nghị)\b", "Gợi ý"),
        (r"\s{2,}", " "),
    ]
    for pattern, repl in replacements:
        text = re.sub(pattern, repl, text, flags=re.IGNORECASE)
    return text.strip()


class CalculateRouteView(APIView):
    """Tính đường đi giữa hai tọa độ (OpenRouteService/OSRM)."""
    permission_classes = [AllowAny]

    def post(self, request):
        coordinates = request.data.get("coordinates")
        api_key = request.data.get("api_key", "")

        if not coordinates or len(coordinates) != 2:
            return Response({"error": "Invalid coordinates. Need 2 points."}, status=400)

        try:
            # --- OpenRouteService ---
            if api_key and api_key != 'eyJvcmciOiI1Yj...':
                ors_url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson'
                ors_response = requests.post(
                    ors_url,
                    json={"coordinates": coordinates},
                    headers={'Authorization': api_key, 'Content-Type': 'application/json'},
                    timeout=10
                )
                if ors_response.status_code == 200:
                    return Response(ors_response.json())

            # --- OSRM fallback ---
            osrm_url = (
                f"https://router.project-osrm.org/route/v1/driving/"
                f"{coordinates[0][0]},{coordinates[0][1]};"
                f"{coordinates[1][0]},{coordinates[1][1]}"
                "?overview=full&geometries=geojson"
            )
            res = requests.get(osrm_url, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data.get('routes'):
                    route = data['routes'][0]
                    return Response({
                        "type": "FeatureCollection",
                        "features": [{
                            "type": "Feature",
                            "geometry": route["geometry"],
                            "properties": {"summary": {"distance": route["distance"]}}
                        }]
                    })

            return Response({"error": "Unable to calculate route."}, status=500)

        except requests.RequestException as e:
            return Response({"error": f"Request failed: {e}"}, status=500)
        except Exception as e:
            return Response({"error": f"Unexpected error: {e}"}, status=500)

logger = logging.getLogger(__name__)


class ProfileView(generics.GenericAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        """Get or create profile for current user"""
        try:
            profile, created = Profile.objects.get_or_create(
                user=self.request.user,
                defaults={
                    'fullname': '',
                    'dob': '2000-01-01',
                    'gender': ''
                }
            )
            logger.info(f"Profile {'created' if created else 'retrieved'} for user {self.request.user.email}")
            return profile
        except Exception as e:
            logger.error(f"Error getting profile for user {self.request.user.email}: {str(e)}")
            raise
    
    def get(self, request):
        """Retrieve user profile"""
        try:
            logger.info(f"GET /profile/ - User: {request.user.email}")
            profile = self.get_object()
            serializer = self.get_serializer(profile)
            logger.info(f"Profile data: {serializer.data}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"GET /profile/ error: {str(e)}")
            return Response(
                {"detail": f"Error retrieving profile: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request):
        """Create or update user profile"""
        try:
            logger.info(f"POST /profile/ - User: {request.user.email}")
            logger.info(f"Request data: {request.data}")
            
            profile = self.get_object()
            serializer = self.get_serializer(profile, data=request.data, partial=True)
            
            if serializer.is_valid():
                serializer.save()
                logger.info(f"✅ Profile saved successfully for {request.user.email}")
                logger.info(f"Saved data: {serializer.data}")
                
                return Response({
                    "message": "Profile saved successfully",
                    "data": serializer.data
                }, status=status.HTTP_200_OK)
            else:
                logger.warning(f"❌ Validation errors: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"❌ POST /profile/ error: {str(e)}", exc_info=True)
            return Response(
                {"detail": f"Error saving profile: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
# ==============================================================
# 5️⃣ CHATBOT APIs - Safe Version
# Thay thế code chatbot cũ bằng version này
# ==============================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def chatbot_test(request):
    """Test endpoint"""
    return Response({
        'status': 'ok',
        'message': 'Chatbot API is working! ✅',
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def chatbot_search(request):
    """
    Tìm kiếm quán ăn - Safe version với error handling tốt
    """
    try:
        query = request.data.get('query', '').strip()
        
        logger.info(f"🔍 Chatbot search: '{query}'")
        
        if not query:
            return Response({
                'answer': 'Vui lòng cho tôi biết bạn muốn tìm món ăn hoặc quán ăn nào? 🍴',
                'results': [],
                'total': 0
            })
        
        # Tìm kiếm trong database - Safe version
        try:
            # Note: `description` is not a field on Restaurant (removed/renamed),
            # so avoid querying it directly. Keep other safe filters.
            # Also search the `rag_context_text` field which contains
            # aggregated textual info (used for RAG/vectorization).
            restaurants = Restaurant.objects.filter(
                Q(name__icontains=query) |
                Q(cuisine_type__icontains=query) |
                Q(address__icontains=query) |
                Q(rag_context_text__icontains=query)
            )[:10]
            
            logger.info(f"📊 Query returned {restaurants.count()} restaurants")
            
        except Exception as db_error:
            logger.error(f"❌ Database query error: {str(db_error)}")
            return Response({
                'answer': '⚠️ Lỗi truy vấn database. Vui lòng thử lại.',
                'results': [],
                'error': str(db_error)
            }, status=500)
        
        # Xử lý kết quả - Kiểm tra từng field cẩn thận
        results = []
        for r in restaurants:
            try:
                # Lấy thông tin cơ bản - an toàn
                restaurant_data = {
                    'type': 'restaurant',
                    'id': r.id if hasattr(r, 'id') else 0,
                    'name': str(r.name) if hasattr(r, 'name') and r.name else 'Không có tên',
                }
                
                # Lấy các field tùy chọn - kiểm tra từng cái
                if hasattr(r, 'cuisine_type'):
                    restaurant_data['cuisine_type'] = str(r.cuisine_type) if r.cuisine_type else 'Không rõ'
                else:
                    restaurant_data['cuisine_type'] = 'Không rõ'
                
                if hasattr(r, 'address'):
                    restaurant_data['address'] = str(r.address) if r.address else ''
                else:
                    restaurant_data['address'] = ''
                
                if hasattr(r, 'phone_number'):
                    restaurant_data['phone'] = str(r.phone_number) if r.phone_number else ''
                else:
                    restaurant_data['phone'] = ''
                
                # Price range - nhiều tên field khác nhau
                price_display = 'Liên hệ'
                if hasattr(r, 'price_range') and r.price_range:
                    price_display = str(r.price_range)
                elif hasattr(r, 'price') and r.price:
                    price_display = str(r.price)
                restaurant_data['price_range'] = price_display
                
                # Rating - có thể có nhiều tên field
                rating = 0.0
                if hasattr(r, 'average_rating') and r.average_rating:
                    try:
                        rating = float(r.average_rating)
                    except (ValueError, TypeError):
                        rating = 0.0
                elif hasattr(r, 'rating') and r.rating:
                    try:
                        rating = float(r.rating)
                    except (ValueError, TypeError):
                        rating = 0.0
                restaurant_data['rating'] = rating
                
                # Description: prefer explicit `description` if present,
                # otherwise use `rag_context_text` which holds aggregated text.
                desc = ''
                if hasattr(r, 'description') and r.description:
                    desc = str(r.description)
                elif hasattr(r, 'rag_context_text') and r.rag_context_text:
                    desc = str(r.rag_context_text)
                restaurant_data['description'] = desc
                
                # Image - kiểm tra nhiều field
                image_url = None
                if hasattr(r, 'image_url') and r.image_url:
                    image_url = str(r.image_url)
                elif hasattr(r, 'image') and r.image:
                    try:
                        image_url = r.image.url
                    except:
                        image_url = None
                restaurant_data['image'] = image_url
                
                results.append(restaurant_data)
                
            except Exception as item_error:
                logger.warning(f"⚠️ Error processing restaurant {r.id if hasattr(r, 'id') else '?'}: {str(item_error)}")
                continue
        
        logger.info(f"✅ Processed {len(results)} results successfully")
        
        # Sắp xếp theo rating
        results.sort(key=lambda x: x.get('rating', 0), reverse=True)
        
        # Tạo câu trả lời
        if results:
            answer = f"🔍 Tìm thấy {len(results)} quán ăn phù hợp với '{query}'!"
            
            if len(results) >= 3:
                top3 = results[:3]
                answer += "\n\n🌟 Top 3 gợi ý:\n"
                for i, r in enumerate(top3, 1):
                    rating_str = f"{r['rating']:.1f}⭐" if r['rating'] > 0 else "Chưa có đánh giá"
                    answer += f"{i}. {r['name']} - {r['cuisine_type']} ({rating_str})\n"
        else:
            answer = (
                f"😔 Không tìm thấy kết quả cho '{query}'.\n\n"
                "💡 Gợi ý tìm kiếm:\n"
                "• Tên món: phở, bún bò, bánh xèo\n"
                "• Loại ẩm thực: Việt Nam, Hàn Quốc\n"
                "• Khu vực: Hải Châu, Sơn Trà"
            )
        
        return Response({
            'answer': answer,
            'results': results,
            'query': query,
            'total': len(results)
        })
        
    except Exception as e:
        logger.error(f"❌ Chatbot error: {str(e)}", exc_info=True)
        import traceback
        traceback.print_exc()
        
        return Response({
            'answer': '⚠️ Có lỗi xảy ra trên server. Vui lòng thử lại sau.',
            'results': [],
            'error': str(e),
            'error_type': type(e).__name__
        }, status=500)


@api_view(['POST'])
@permission_classes([AllowAny])
def chatbot_ai_search(request):
    """AI Search - với fallback về search thường nếu lỗi"""
    try:
        query = request.data.get('query', '').strip()
        
        if not query:
            return Response({
                'answer': 'Vui lòng cho tôi biết bạn muốn tìm gì? 🍴',
                'results': []
            })
        
        # Kiểm tra GROQ_API_KEY có tồn tại không
        if not hasattr(settings, 'GROQ_API_KEY') or not settings.GROQ_API_KEY:
            logger.warning("⚠️ GROQ_API_KEY not configured, falling back to simple search")
            return chatbot_search(request)
        
        # Sử dụng Groq AI
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        
        prompt = f"""
Phân tích câu hỏi và trả về JSON:
Câu hỏi: "{query}"

Format:
{{
    "keywords": ["từ khóa"],
    "cuisine": "loại ẩm thực hoặc null",
    "location": "địa điểm hoặc null"
}}

Chỉ JSON, không giải thích.
"""
        
        ai_response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.2,
            max_tokens=200
        )
        
        try:
            extracted = json.loads(ai_response.choices[0].message.content.strip())
        except:
            extracted = {"keywords": [query]}
        
        logger.info(f"🤖 AI extracted: {extracted}")
        
        # Tìm kiếm với thông tin AI
        qs = Restaurant.objects.all()
        
        keywords = extracted.get('keywords', [query])
        if keywords:
            q_filter = Q()
            for kw in keywords:
                q_filter |= (
                    Q(name__icontains=kw) | 
                    Q(cuisine_type__icontains=kw) |
                    Q(rag_context_text__icontains=kw)
                )
            qs = qs.filter(q_filter)
        
        if extracted.get('cuisine'):
            qs = qs.filter(cuisine_type__icontains=extracted['cuisine'])
        
        if extracted.get('location'):
            qs = qs.filter(address__icontains=extracted['location'])
        
        restaurants = qs[:10]
        
        # Xử lý kết quả giống như chatbot_search
        results = []
        for r in restaurants:
            try:
                # Prefer rag_context_text as description when available
                desc = ''
                if hasattr(r, 'description') and r.description:
                    desc = str(r.description)
                elif hasattr(r, 'rag_context_text') and r.rag_context_text:
                    desc = str(r.rag_context_text)

                results.append({
                    'type': 'restaurant',
                    'id': r.id,
                    'name': str(r.name) if r.name else 'Không có tên',
                    'cuisine_type': str(r.cuisine_type) if hasattr(r, 'cuisine_type') and r.cuisine_type else 'Không rõ',
                    'address': str(r.address) if hasattr(r, 'address') and r.address else '',
                    'phone': str(r.phone_number) if hasattr(r, 'phone_number') and r.phone_number else '',
                    'price_range': str(r.price_range) if hasattr(r, 'price_range') and r.price_range else 'Liên hệ',
                    'rating': float(getattr(r, 'average_rating', 0) or getattr(r, 'rating', 0) or 0),
                    'description': desc,
                })
            except Exception as e:
                logger.warning(f"Error processing: {e}")
                continue
        
        results.sort(key=lambda x: x['rating'], reverse=True)
        
        # Tạo câu trả lời bằng AI
        if results:
            summary = "\n".join([
                f"- {r['name']}: {r['cuisine_type']}, {r['price_range']}"
                for r in results[:3]
            ])
            
            answer_prompt = f"""
Người dùng hỏi: "{query}"
Tìm thấy {len(results)} quán:
{summary}

Trả lời ngắn (2-3 câu), thân thiện bằng tiếng Việt.
"""
            
            answer_response = client.chat.completions.create(
                messages=[{"role": "user", "content": answer_prompt}],
                model="llama-3.1-8b-instant",
                temperature=0.7,
                max_tokens=200
            )
            
            answer = answer_response.choices[0].message.content.strip()
        else:
            answer = f"😔 Không tìm thấy kết quả cho '{query}'. Bạn thử tìm kiếm khác nhé!"
        
        return Response({
            'answer': answer,
            'results': results,
            'query': query,
            'total': len(results),
            'ai_mode': True
        })
        
    except Exception as e:
        logger.error(f"AI Error: {e}", exc_info=True)
        # Fallback về search thường
        return chatbot_search(request)


@api_view(['POST'])
@permission_classes([AllowAny])
def chatbot_rag_sql(request):
    """Proxy to external RAG-SQL service (/question-answering).

    Request JSON: { "query": "..." }
    Response: { 'answer': str, 'results': [], 'source': 'rag-sql', 'raw': <raw rag response> }

    If RAG-SQL fails, fallback to AI search or regular search.
    """
    try:
        query = request.data.get('query', '').strip()
        if not query:
            return Response({'answer': 'Vui lòng cho tôi biết bạn muốn tìm gì? 🍴', 'results': []})

        rag_url = getattr(settings, 'RAG_SQL_URL', 'http://localhost:8001/question-answering')

        # If the RAG-SQL service is available via HTTP use it; otherwise try local integration
        try:
            resp = requests.post(rag_url, json={'question': query}, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                answer = data.get('answer') or data.get('message') or ''
                return Response({
                    'answer': answer,
                    'results': data.get('results', []),
                    'source': 'rag-sql-remote',
                    'raw': data,
                    'query': query,
                })
            else:
                logger.info(f"RAG-SQL remote returned status {resp.status_code}, falling back to local")
        except Exception as e_remote:
            logger.info(f"RAG-SQL remote unreachable: {e_remote}, trying local integration")

        # Try local import/integration: call MonolithAgent directly
        try:
            from .rag_sql_local import get_monolith_predictor
            predictor = get_monolith_predictor()
            results = predictor(query)
            # Build a friendly answer summary
            if results and isinstance(results, list):
                if len(results) == 0:
                    answer = f"😔 Không tìm thấy kết quả cho '{query}'."
                else:
                    top3 = results[:3]
                    summary_lines = []
                    for r in top3:
                        name = r.get('name') or r.get('restaurant_name') or ''
                        cuisine = r.get('cuisine_type', '')
                        price = r.get('price_range', '')
                        summary_lines.append(f"- {name}: {cuisine} {price}".strip())
                    answer = f"🔍 Tìm thấy {len(results)} quán.\n\nTop:\n" + "\n".join(summary_lines)
            else:
                answer = str(results)

            return Response({
                'answer': answer,
                'results': results,
                'source': 'rag-sql-local',
                'query': query,
            })
        except Exception as e_local:
            logger.exception("Local RAG-SQL integration failed: %s", e_local)
            # fallback to AI/DB search
            try:
                return chatbot_ai_search(request)
            except Exception:
                return chatbot_search(request)

    except Exception as e:
        import traceback as _tb
        tb = _tb.format_exc()
        logger.error(f"chatbot_rag_sql error: {e}\n{tb}", exc_info=True)
        return Response({
            'answer': '⚠️ Có lỗi khi gọi RAG-SQL. Vui lòng thử lại sau.',
            'results': [],
            'error': str(e),
            'traceback': tb,
        }, status=500)
# ==============================================================
# RESTAURANT MAP API (TỪ FILE CŨ – GIỮ NGUYÊN CHỨC NĂNG)
# ==============================================================

from .services.geocode_service import geocode_address, normalize_danang_address
from .services.route_service import get_route
from django.db.models import Q


class RestaurantMapListView(APIView):
    """
    GET /api/restaurants/map/
    Trả toàn bộ nhà hàng cho bản đồ
    """
    permission_classes = [AllowAny]

    def get(self, request):
        restaurants = Restaurant.objects.all()
        return Response(RestaurantSerializer(restaurants, many=True).data)


class RestaurantMapSearchView(APIView):
    """
    GET /api/restaurants/map/search/?q=...
    Tìm kiếm theo tên + địa chỉ
    """
    permission_classes = [AllowAny]

    def get(self, request):
        q = request.GET.get("q", "")
        items = Restaurant.objects.filter(
            Q(name__icontains=q) | Q(address__icontains=q)
        )
        return Response(RestaurantSerializer(items, many=True).data)


class GeocodeRestaurantView(APIView):
    """
    POST /api/geocode/
    Body:
    {
        "name": "...",
        "address": "..."
    }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        name = request.data.get("name", "")
        address = request.data.get("address", "")

        if not address:
            return Response({
                "lat": None,
                "lng": None,
                "confidence": 0,
                "_debug": {"normalized": ""}
            })

        result = geocode_address(address, name)

        if not result:
            return Response({
                "lat": None,
                "lng": None,
                "confidence": 0,
                "_debug": {"normalized": normalize_danang_address(address)}
            })

        resp = dict(result)
        resp["_debug"] = {"normalized": normalize_danang_address(address)}
        return Response(resp)


class OSRMRouteView(APIView):
    """
    POST /api/route-osrm/
    Body:
    {
        "start": { "lat": .., "lng": .. },
        "end":   { "lat": .., "lng": .. }
    }

    Trả về:
      { "coords": [ [lat,lng], ... ] }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        start = request.data.get("start")
        end = request.data.get("end")

        if not start or not end:
            return Response({"error": "Missing start or end"}, status=400)

        try:
            coords = get_route(start, end)
            return Response({"coords": coords})
        except Exception as e:
            return Response({"error": str(e)}, status=500)