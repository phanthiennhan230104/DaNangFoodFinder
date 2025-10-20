const BACKEND_TRANSLATE = "http://localhost:8000/api/translate/";

const memoryCache = new Map();

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export async function translateText(text, from, to) {
  const trimmed = (text || "").trim();
  if (!trimmed || from === to) return text;

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
    const data = await res.json();
    const result = data?.result || text;

    memoryCache.set(cacheKey, result);
    lsSet(cacheKey, result);
    return result;
  } catch (e) {
    console.error("Translate error:", e);
    return text;
  }
}
