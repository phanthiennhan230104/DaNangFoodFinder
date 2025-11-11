
import { VI_UI_DICT } from "./vi_dictionary";

const BACKEND_TRANSLATE = "http://localhost:8000/api/translate/";

const memoryCache = new Map();

function lsGet(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function lsSet(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

function refineVietnamese(text) {
  if (!text) return text;

  const rules = [
    { from: /\b(Bữa sáng|Bữa trưa|Bữa tối)\s*(Gợi ý|Đề xuất)/gi, to: "Gợi ý $1" },
    { from: /\b(Gợi ý|Đề xuất)\s*(Bữa sáng|Bữa trưa|Bữa tối)/gi, to: "Gợi ý $2" },
    { from: /\b(Nhà hàng)\s*(Yêu thích|Ưa thích)/gi, to: "$2 $1" },
    { from: /\b(Khuyến nghị)\b/gi, to: "Gợi ý" },
    { from: /\b(Bản đồ)\s*(Mở|Đóng)/gi, to: "$2 $1" },
    { from: /\s{2,}/g, to: " " },
  ];

  let refined = text;
  for (const r of rules) refined = refined.replace(r.from, r.to);
  return refined.trim();
}

export async function translateText(text, from, to) {
  const trimmed = (text || "").trim();
  if (!trimmed || from === to) return text;

  if (from === "en" && to === "vi") {
    const fixed = VI_UI_DICT[trimmed];
    if (fixed) return fixed;
  }

  const cacheKey = `dnff_cache:${from}:${to}:${trimmed}`.slice(0, 1500);

  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey);
  const cached = lsGet(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(BACKEND_TRANSLATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed, from, to }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let result = data?.result || text;
    if (to === "vi") result = refineVietnamese(result);

    memoryCache.set(cacheKey, result);
    lsSet(cacheKey, result);
    return result;
  } catch (e) {
    console.error("Translate error:", e);
    return text;
  }
}
