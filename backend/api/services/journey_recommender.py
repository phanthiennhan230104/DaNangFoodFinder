# services/journey_recommender.py
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
import math

@dataclass
class Candidate:
    id: int
    name: str
    cuisine_type: str | None
    price_range: str | None
    rating: float | None
    meal_type: str | None  # có thể None, sẽ suy ra sau
    price: int  # numeric (đồng)

def parse_price_range(price_range: str | None, default_price: int = 0) -> int:
    if not price_range:
        return default_price
    s = price_range.lower().replace(" ", "")
    # Hỗ trợ định dạng "50k-120k", "100000-200000", "~80k"
    s = s.replace("đ", "").replace("vnd", "")
    parts = s.split("-")
    nums = []
    for p in parts:
        p = p.replace("k", "000")
        # Lấy số
        digits = "".join([ch for ch in p if ch.isdigit()])
        if digits:
            nums.append(int(digits))
    if not nums:
        return default_price
    return sum(nums) // len(nums)

def infer_meal(price: int, cut_breakfast: int, cut_dinner: int) -> str:
    # Linh hoạt theo threshold truyền vào
    if price <= cut_breakfast:
        return "breakfast"
    if price >= cut_dinner:
        return "dinner"
    return "lunch"

def score_candidate(
    c: Candidate,
    desired_cuisines: List[str],
    meal: str,
    meal_budget: int,
    w_cuisine: float,
    w_price: float,
    w_rating: float,
) -> float:
    # cuisine score
    cuisine_ok = 1.0 if (c.cuisine_type and c.cuisine_type in desired_cuisines) else 0.0
    # price fit score (khoảng cách với meal_budget)
    if meal_budget <= 0:
        price_score = 0.0
    else:
        price_score = max(0.0, 1.0 - abs(c.price - meal_budget) / max(meal_budget, 1))
    # rating score (chuẩn hóa 0..1 từ thang 0..5)
    rating = c.rating or 0.0
    rating_score = max(0.0, min(1.0, rating / 5.0))

    return w_cuisine * cuisine_ok + w_price * price_score + w_rating * rating_score

def pick_best_triplet(
    groups: Dict[str, List[Tuple[Candidate, float]]],
    total_budget: int,
    over_allow_ratio: float,
) -> Tuple[Candidate | None, Candidate | None, Candidate | None]:
    """
    Chọn 1 ứng viên cho mỗi bữa sao cho tổng giá <= total_budget * (1 + over_allow_ratio)
    và tổng (score) là tối đa. Thử brute-force trên top-k mỗi nhóm (k nhỏ) để linh hoạt.
    """
    max_score, best = -1.0, (None, None, None)
    limit = total_budget * (1.0 + over_allow_ratio)
    breakfasts = groups.get("breakfast", [])
    lunches = groups.get("lunch", [])
    dinners = groups.get("dinner", [])

    for b, sb in breakfasts or [(None, 0.0)]:
        for l, sl in lunches or [(None, 0.0)]:
            for d, sd in dinners or [(None, 0.0)]:
                total_price = sum(x.price for x in [b, l, d] if x)
                total_score = sum([sb, sl, sd])
                if total_price <= limit and total_score > max_score:
                    max_score = total_score
                    best = (b, l, d)
    return best
