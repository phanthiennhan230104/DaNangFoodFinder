

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

from .models import Restaurant, FoodJourney, CustomUser, CrawledData, Profile
from .serializers import (
    UserSerializer,
    RestaurantSerializer,
    FoodJourneySerializer,
    RegisterSerializer,
    CustomTokenObtainPairSerializer,
    ProfileSerializer,
)
from .services.journey_recommender import (
    Candidate,
    parse_price_range,
    infer_meal,
    score_candidate,
    pick_best_triplet,
)
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
    try:
        profile = Profile.objects.get(user_id=request.user.user_id)
        serializer = ProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Profile.DoesNotExist:
        return Response(
            {"detail": "Profile not found"}, status=status.HTTP_404_NOT_FOUND
        )
        
        
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
    """Tạo hoặc cập nhật lịch trình ăn uống."""
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
    """Dịch văn bản bằng Groq API."""
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
                {"role": "system",
                 "content": f"Translate {source}→{target}, output only translation."},
                {"role": "user", "content": text},
            ],
            temperature=0.2,
        )
        translated = completion.choices[0].message.content.strip()
        return Response({"result": translated})
    except Exception as e:
        return Response({"result": text, "error": str(e)})


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
        
        
        try:
            
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
        
      
        results = []
        for r in restaurants:
            try:
                
                restaurant_data = {
                    'type': 'restaurant',
                    'id': r.id if hasattr(r, 'id') else 0,
                    'name': str(r.name) if hasattr(r, 'name') and r.name else 'Không có tên',
                }
                
                
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
                
                
                price_display = 'Liên hệ'
                if hasattr(r, 'price_range') and r.price_range:
                    price_display = str(r.price_range)
                elif hasattr(r, 'price') and r.price:
                    price_display = str(r.price)
                restaurant_data['price_range'] = price_display
                
                
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
                
                
                desc = ''
                if hasattr(r, 'description') and r.description:
                    desc = str(r.description)
                elif hasattr(r, 'rag_context_text') and r.rag_context_text:
                    desc = str(r.rag_context_text)
                restaurant_data['description'] = desc
                
                
                image_url = None
                if hasattr(r, 'image_url') and r.image_url:
                    image_url = str(r.image_url)
                elif hasattr(r, 'image') and r.image:
                    try:
                        image_url = r.image.url
                    except Exception:
                        image_url = str(r.image) if r.image else None

                if image_url:
                    try:
                        if image_url.lower().startswith('http'):
                            restaurant_data['image'] = image_url
                        else:
                            restaurant_data['image'] = request.build_absolute_uri(image_url)
                    except Exception:
                        restaurant_data['image'] = image_url
                else:
                    restaurant_data['image'] = None
                
                results.append(restaurant_data)
                
            except Exception as item_error:
                logger.warning(f"⚠️ Error processing restaurant {r.id if hasattr(r, 'id') else '?'}: {str(item_error)}")
                continue
        
        logger.info(f"✅ Processed {len(results)} results successfully")
        
        
        results.sort(key=lambda x: x.get('rating', 0), reverse=True)
        
        
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
        
        
        if not hasattr(settings, 'GROQ_API_KEY') or not settings.GROQ_API_KEY:
            logger.warning("⚠️ GROQ_API_KEY not configured, falling back to simple search")
            return chatbot_search(request)
        
        
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
        
        
        results = []
        for r in restaurants:
            try:
        
                desc = ''
                if hasattr(r, 'description') and r.description:
                    desc = str(r.description)
                elif hasattr(r, 'rag_context_text') and r.rag_context_text:
                    desc = str(r.rag_context_text)

                
                image_url = None
                if hasattr(r, 'image_url') and r.image_url:
                    image_url = str(r.image_url)
                elif hasattr(r, 'image') and r.image:
                    try:
                        image_url = r.image.url
                    except Exception:
                        image_url = str(r.image) if r.image else None

                if image_url:
                    try:
                        if image_url.lower().startswith('http'):
                            final_image = image_url
                        else:
                            final_image = request.build_absolute_uri(image_url)
                    except Exception:
                        final_image = image_url
                else:
                    final_image = None

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
                    'image': final_image,
                })
            except Exception as e:
                logger.warning(f"Error processing: {e}")
                continue
        
        results.sort(key=lambda x: x['rating'], reverse=True)
        
        
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
        return chatbot_search(request)


def _parse_nl_query_with_ai(query: str) -> dict:
    """Use Groq AI to parse a natural language query into structured search filters.

    Returns a dict with keys: keywords(list[str]), cuisine(str|None), location(str|None), attributes(list[str])
    Falls back to simple keywords=[query] on error.
    """
    query = (query or "").strip()
    if not query:
        return {"keywords": [], "cuisine": None, "location": None, "attributes": []}

    try:
        client = Groq(api_key=getattr(settings, 'GROQ_API_KEY', None))
        prompt = f"""
Analyze the following user request and return a JSON object with these fields (ONLY JSON):
 - keywords: array of short keywords or phrases to search for (e.g. ["mì quảng", "lâu đời"]).
 - dish: specific dish name if present (e.g. "mì Quảng", "pizza") or null.
 - cuisine: the cuisine type if explicit (e.g. "Ý", "Việt Nam") or null.
 - location: a place or district if present (e.g. "Sơn Trà", "gần cầu Rồng") or null.
 - attributes: array of attributes user wants (e.g. ["nổi tiếng", "gia truyền", "tươi sống"]) or empty array.
 - max_price: integer maximum price in VND if user specifies budget (e.g. 50000) or null.
 - price_category: one of ["cheap","medium","expensive"] if user expresses relative price, else null.
 - min_rating: minimum desired rating (0-10) if present, else null.
 - group_size: integer if user mentions number of people or family/group needs, else null.
 - occasion: one of ["date","family","business","casual"] or null if implied (e.g., 'hẹn hò' -> "date").
 - intent: high-level intent such as "find_restaurant", "ask_suggestion", "ask_menu".

Request: "{query}"

Only output the JSON object, no extra commentary.
"""
        resp = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.0,
            max_tokens=350,
        )
        text = resp.choices[0].message.content.strip()
        try:
            parsed = json.loads(text)
            # Normalize keys and types
            return {
                "keywords": parsed.get("keywords") or [],
                "dish": parsed.get("dish") or None,
                "cuisine": parsed.get("cuisine") or None,
                "location": parsed.get("location") or None,
                "attributes": parsed.get("attributes") or [],
                "max_price": int(parsed.get("max_price")) if parsed.get("max_price") is not None else None,
                "price_category": parsed.get("price_category") or None,
                "min_rating": float(parsed.get("min_rating")) if parsed.get("min_rating") is not None else None,
                "group_size": int(parsed.get("group_size")) if parsed.get("group_size") is not None else None,
                "occasion": parsed.get("occasion") or None,
                "intent": parsed.get("intent") or None,
            }
        except Exception:
            logger.info("AI parse returned non-JSON or invalid fields, fallback to simple extraction")
            # Heuristic fallback: extract tokens and detect simple price words
            kws = [query]
            max_price = None
            price_cat = None
            m = re.search(r"(\d{1,3}(?:[.,]\d{3})?)\s*(k|K|vnđ|đ|d|VND)?", query)
            if m:
                num = m.group(1).replace('.', '').replace(',', '')
                try:
                    px = int(num) * (1000 if m.group(2) and m.group(2).lower() == 'k' else 1)
                    max_price = px
                except Exception:
                    max_price = None
            return {"keywords": kws, "dish": None, "cuisine": None, "location": None, "attributes": [], "max_price": max_price, "price_category": price_cat, "min_rating": None, "group_size": None, "occasion": None, "intent": None}
    except Exception as e:
        logger.exception("AI parsing failed: %s", e)
        return {"keywords": [query], "dish": None, "cuisine": None, "location": None, "attributes": [], "max_price": None, "price_category": None, "min_rating": None, "group_size": None, "occasion": None, "intent": None}


def _structured_search(keywords: list, location: str | None, attributes: list, top_k: int = 10, max_price: int | None = None, min_rating: float | None = None, price_category: str | None = None, group_size: int | None = None, occasion: str | None = None, dish: str | None = None):
    """Perform a DB search using structured filters. Returns list of result dicts.

    This builds safe LIKE clauses from keywords and attributes, applies location filter,
    and returns rows ordered by average_rating desc and match count.
    """
    # Use Django DB through DjangoEngine wrapper from vendor if available
    try:
        from .rag_sql_vendor.db.django_engine import DjangoEngine
        db = DjangoEngine()
    except Exception:
        # fallback to raw django connection
        from django.db import connection

        class _RawDB:
            def execute_query(self, q, limit=500):
                with connection.cursor() as cursor:
                    cursor.execute(q)
                    cols = [c[0] for c in cursor.description] if cursor.description else []
                    rows = cursor.fetchall()
                    out = []
                    for r in rows:
                        out.append({cols[i]: r[i] for i in range(len(cols))})
                    return out

        db = _RawDB()

    # Build token clauses
    import re

    toks = []
    strict_dish = False
    if dish and dish.strip():
        d = dish.strip()
        toks.append(d)
        strict_dish = True
    else:
        for kw in keywords or []:
            if not kw:
                continue

            toks.append(kw.strip())
            for t in re.findall(r"[\wÀ-ỹ]+", kw, flags=re.UNICODE):
                if len(t) > 1:
                    toks.append(t)

    toks = list(dict.fromkeys([t.lower() for t in toks]))

    if not toks and not attributes and not location and not max_price and not min_rating:
        return []

    where_clauses = []
    # If strict dish requested, require dish presence in name or rag_context_text
    if strict_dish:
        d_esc = toks[0].lower().replace("'", "''")
        try:
            cuisine_sql = f"SELECT * FROM api_restaurant WHERE LOWER(cuisine_type) LIKE '%{d_esc}%' LIMIT {max(50, top_k*5)}"
            cuisine_rows = db.execute_query(cuisine_sql)
            if cuisine_rows:
                # Process and return these rows directly
                processed = []
                def match_count_c(r):
                    s = " ".join([str(r.get(k, "")) for k in ("name", "cuisine_type", "address", "rag_context_text")]).lower()
                    cnt = 0
                    for t in toks:
                        if t in s:
                            cnt += 1
                    return cnt

                for r in cuisine_rows:
                    processed.append({
                        "name": r.get("name") or '',
                        "average_rating": float(r.get("average_rating") or 0) if r.get("average_rating") is not None else None,
                        "address": r.get("address") or '',
                        "price_range": r.get("price_range") or '',
                        "_match_count": match_count_c(r),
                    })
                processed.sort(key=lambda x: (x.get("_match_count", 0), x.get("average_rating") or 0), reverse=True)
                for it in processed:
                    it.pop("_match_count", None)
                return processed[:top_k]
        except Exception:
            logger.info("Cuisine-type based search failed or returned no rows; falling back to name/rag text match")
        dish_clause = f"(LOWER(name) LIKE '%{d_esc}%' OR LOWER(rag_context_text) LIKE '%{d_esc}%')"
        # We'll require the dish clause; other keywords (if any) are optional
        where_clauses_required = [dish_clause]
        optional_clauses = []
        for t in toks[1:]:
            esc = t.replace("'", "''")
            optional_clauses.append(f"(LOWER(name) LIKE '%{esc}%' OR LOWER(rag_context_text) LIKE '%{esc}%' OR LOWER(cuisine_type) LIKE '%{esc}%' OR LOWER(address) LIKE '%{esc}%')")
        for attr in attributes or []:
            a = attr.strip()
            if not a:
                continue
            esc = a.replace("'", "''")
            optional_clauses.append(f"(LOWER(rag_context_text) LIKE '%{esc}%' OR LOWER(name) LIKE '%{esc}%')")
    else:
        for t in toks:
            esc = t.replace("'", "''")
            clause = f"(LOWER(name) LIKE '%{esc}%' OR LOWER(rag_context_text) LIKE '%{esc}%' OR LOWER(cuisine_type) LIKE '%{esc}%' OR LOWER(address) LIKE '%{esc}%')"
            where_clauses.append(clause)
        # attributes as additional tokens
        for attr in attributes or []:
            a = attr.strip()
            if not a:
                continue
            esc = a.replace("'", "''")
            where_clauses.append(f"(LOWER(rag_context_text) LIKE '%{esc}%' OR LOWER(name) LIKE '%{esc}%')")

    # build final where_sql depending on strict dish
    if strict_dish:
        optional_sql = " OR ".join(optional_clauses) if optional_clauses else "1=1"
        where_sql = f"({' AND '.join(where_clauses_required)})"
        if optional_clauses:
            where_sql = f"({where_sql}) AND ({optional_sql})"
    else:
        where_sql = " OR ".join(where_clauses) if where_clauses else "1=1"

    if location:
        loc = location.replace("'", "''")
        where_sql = f"({where_sql}) AND LOWER(address) LIKE '%{loc.lower()}%'"

  
    extras = []
    if min_rating is not None:
        try:
            mr = float(min_rating)
            extras.append(f"COALESCE(average_rating,0) >= {mr}")
        except Exception:
            pass
    if max_price is not None:
        try:
            # add a loose condition: find restaurants whose lower bound <= max_price
            extras.append(f"(price_range IS NULL OR price_range LIKE '%' || '{max_price}' || '%')")
        except Exception:
            pass

    if extras:
        where_sql = f"({where_sql}) AND (" + " AND ".join(extras) + ")"

    final_sql = f"SELECT * FROM api_restaurant WHERE {where_sql} LIMIT {max(50, top_k*5)}"
    logger.info("Structured search SQL: %s", final_sql)

    rows = db.execute_query(final_sql)
    def match_count(row):
        s = " ".join([str(row.get(k, "")) for k in ("name", "cuisine_type", "address", "rag_context_text")]).lower()
        cnt = 0
        for t in toks:
            if t in s:
                cnt += 1
        return cnt

    processed = []
    for r in rows:
        processed.append({
            "name": r.get("name") or '',
            "average_rating": float(r.get("average_rating") or 0) if r.get("average_rating") is not None else None,
            "address": r.get("address") or '',
            "price_range": r.get("price_range") or '',
            "_match_count": match_count(r),
        })

    processed.sort(key=lambda x: (x.get("_match_count", 0), x.get("average_rating") or 0), reverse=True)
    for it in processed:
        it.pop("_match_count", None)

    return processed[:top_k]


def _human_like_reply(query: str, parsed: dict | None = None, results: list | None = None) -> str:
    """Generate a human-like conversational reply in Vietnamese for casual queries.

    - If Groq is configured, call it to generate a short friendly reply (1-3 sentences) and one clarifying question.
    - Otherwise return a simple canned reply asking a clarifying question.
    """
    parsed = parsed or {}
    try:
        if hasattr(settings, 'GROQ_API_KEY') and settings.GROQ_API_KEY:
            client = Groq(api_key=settings.GROQ_API_KEY)
            system_prompt = (
                "Bạn là một trợ lý trò chuyện thân thiện bằng tiếng Việt. Trả lời như một người thật: ngắn gọn, ấm áp, và luôn hỏi 1 câu để làm rõ nếu cần."
            )
            # Include a short context of parsed fields if available
            context_lines = []
            if parsed:
                for k in ('dish','cuisine','location','max_price','price_category','min_rating','intent'):
                    v = parsed.get(k)
                    if v:
                        context_lines.append(f"{k}: {v}")

            user_prompt = f"Người dùng: \"{query}\"\nContext:\n" + "\n".join(context_lines) + "\n\nHãy trả lời thân thiện, tự nhiên, 1-3 câu, và hỏi 1 câu để làm rõ yêu cầu nếu cần."

            completion = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.8,
                max_tokens=120,
            )
            reply = completion.choices[0].message.content.strip()
            return reply
    except Exception:
        logger.info("Groq conversational reply failed, using canned fallback")

    # Simple canned fallback replies (human-like)
    low = query.strip().lower()
    if any(w in low for w in ("đói", "tôi đói", "đói quá", "mệt", "ăn")):
        return "Bạn đang đói nhỉ 😊 Bạn muốn ăn gì — món Việt, món Tây hay muốn gần chỗ bạn đang ở? Mình gợi ý vài món nếu bạn cần."
    return "Bạn nói rõ hơn giúp mình được không? Ví dụ: 'Tôi muốn ăn mì Quảng ở Sơn Trà' hoặc 'Có quán pizza ngon không?'."


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

        # First: try structured AI parsing + focused DB search (preferred)
        try:
            parsed = _parse_nl_query_with_ai(query)
            # Detect vague conversational queries (e.g., 'Tôi đói') and ask clarifying question first
            low_q = (query or "").lower()
            vague_tokens = ["đói", "ăn gì", "ngon", "hungry", "tôi đói", "đói quá"]
            has_hungry_word = any(t in low_q for t in vague_tokens)
            has_structured_fields = any(
                parsed.get(k) for k in ("dish", "cuisine", "location", "max_price", "attributes", "price_category")
            )
            if not has_structured_fields and has_hungry_word:
                reply = _human_like_reply(query, parsed=parsed, results=None)
                return Response({
                    'answer': reply,
                    'results': [],
                    'source': 'clarify',
                    'query': query,
                })

            top_k = getattr(settings, 'RAG_TOP_K', 10)
            structured_results = _structured_search(
                keywords=parsed.get('keywords') or [query],
                location=parsed.get('location'),
                attributes=parsed.get('attributes') or [],
                top_k=top_k,
                max_price=parsed.get('max_price'),
                min_rating=parsed.get('min_rating'),
                price_category=parsed.get('price_category'),
                group_size=parsed.get('group_size'),
                occasion=parsed.get('occasion'),
                dish=parsed.get('dish'),
            )

            if structured_results:
                # Build friendly answer
                # Try to generate a human-like conversational reply using Groq
                try:
                    if hasattr(settings, 'GROQ_API_KEY') and settings.GROQ_API_KEY:
                        client = Groq(api_key=settings.GROQ_API_KEY)
                        # Normalize image URLs in structured_results when possible
                        for _r in structured_results:
                            img = _r.get('image') or _r.get('image_url')
                            if img:
                                try:
                                    if not img.lower().startswith('http'):
                                        _r['image'] = request.build_absolute_uri(img)
                                    else:
                                        _r['image'] = img
                                except Exception:
                                    _r['image'] = img

                        # Prepare a short summary of top results for the LLM
                        top_lines = []
                        for r in structured_results[:5]:
                            name = r.get('name') or ''
                            cuisine = r.get('cuisine_type') or ''
                            rating = r.get('average_rating') or ''
                            addr = r.get('address') or ''
                            top_lines.append(f"{name} — {cuisine} — {rating}⭐ — {addr}")

                        system_prompt = (
                            "Bạn là trợ lý gợi ý quán ăn thân thiện, trả lời ngắn gọn, tự nhiên như người bản xứ "
                            "(tiếng Việt). Khi có danh sách quán, đưa ra 2–3 gợi ý nổi bật và một câu hỏi kế tiếp nếu cần. "
                        )

                        user_prompt = (
                            f"Người dùng hỏi: \"{query}\"\n\n"
                            f"Danh sách kết quả (top {min(len(structured_results),5)}):\n" + "\n".join(top_lines) +
                            "\n\nHãy trả lời thân thiện, ngắn gọn (2-3 câu). Nếu cần, hỏi 1 câu để làm rõ yêu cầu tiếp theo."
                        )

                        completion = client.chat.completions.create(
                            model="llama-3.1-8b-instant",
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt},
                            ],
                            temperature=0.7,
                            max_tokens=200,
                        )
                        reply = completion.choices[0].message.content.strip()
                    else:
                        raise RuntimeError("GROQ_API_KEY not configured")
                except Exception:
                    # Fallback to plain summary if LLM is not available
                    summary_lines = []
                    for r in structured_results[:3]:
                        name = r.get('name') or ''
                        cuisine = r.get('cuisine_type') or ''
                        price = r.get('price_range') or ''
                        summary_lines.append(f"- {name}: {cuisine} {price}".strip())
                    reply = f"🔎 Tìm thấy {len(structured_results)} quán phù hợp với '{query}'.\n\nTop:\n" + "\n".join(summary_lines)

                return Response({
                    'answer': reply,
                    'results': structured_results,
                    'source': 'structured-ai',
                    'query': query,
                })
            else:
                # If user explicitly requested a specific dish, do NOT fall back to looser searches;
                # instead inform the user that no restaurants serving that dish were found.
                if parsed.get('dish'):
                    dish_txt = parsed.get('dish')
                    loc_txt = parsed.get('location') or ''
                    answer = f"😔 Không tìm thấy quán phục vụ '{dish_txt}' {('ở ' + loc_txt) if loc_txt else ''}. Bạn thử miêu tả khác hoặc bỏ từ 'chỉ' để mở rộng tìm kiếm.".strip()
                    return Response({
                        'answer': answer,
                        'results': [],
                        'source': 'structured-ai',
                        'query': query,
                    })

                logger.info("Structured AI search returned no results, falling back to RAG/local")
        except Exception as e_struct:
            logger.exception("Structured search error: %s", e_struct)

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
                # Normalize image URLs in predictor results when possible
                for rr in results:
                    img = rr.get('image') or rr.get('image_url') or rr.get('imageUrl')
                    if img:
                        try:
                            if not img.lower().startswith('http'):
                                rr['image'] = request.build_absolute_uri(img)
                            else:
                                rr['image'] = img
                        except Exception:
                            rr['image'] = img

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