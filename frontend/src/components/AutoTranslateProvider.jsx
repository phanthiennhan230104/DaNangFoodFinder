import React, { useEffect, useMemo, useRef, useState } from "react";
import { translateText } from "../utils/translator";

// 🌐 Ngôn ngữ gốc của UI
const BASE_LANG = "en";
const SUPPORTED = ["en", "vi"];

function detectBrowserLang() {
  const cand = (navigator.language || "en").slice(0, 2).toLowerCase();
  return SUPPORTED.includes(cand) ? cand : BASE_LANG;
}

function collectTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest("[data-no-translate]"))
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  let current;
  while ((current = walker.nextNode())) nodes.push(current);
  return nodes;
}

export default function AutoTranslateProvider({ children }) {
  const containerRef = useRef(null);
  const [lang, setLang] = useState(
    localStorage.getItem("lang") || detectBrowserLang()
  );
  const [loading, setLoading] = useState(false);
  const originalMap = useRef(new WeakMap());
  const observerRef = useRef(null);
  const translatingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  // ==== DỊCH TOÀN BỘ ====
  async function translateContainer() {
    const container = containerRef.current;
    if (!container) return;

    const from = BASE_LANG;
    const to = lang;
    if (from === to) {
      const nodes = collectTextNodes(container);
      nodes.forEach((n) => {
        const orig = originalMap.current.get(n);
        if (orig != null) n.nodeValue = orig;
      });
      return;
    }

    const nodes = collectTextNodes(container);
    if (!nodes.length) return;

    // Lưu text gốc
    nodes.forEach((node) => {
      if (!originalMap.current.has(node)) {
        originalMap.current.set(node, node.nodeValue);
      }
    });

    if (observerRef.current) observerRef.current.disconnect();
    translatingRef.current = true;
    setLoading(true);

    // 🌙 Thêm delay nhẹ (1 giây) cho mượt
    await new Promise((r) => setTimeout(r, 1000));

    const batchSize = 10;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      const joined = batch.map((n) => originalMap.current.get(n)).join(" ||| ");

      try {
        const translatedBatch = await translateText(joined, from, to);
        const parts = translatedBatch.split("|||");
        batch.forEach((node, idx) => {
          const t = (parts[idx] || "").trim();
          if (t) node.nodeValue = t;
        });
      } catch (e) {
        console.error("Batch translation error:", e);
      }
    }

    translatingRef.current = false;
    setLoading(false);

    // Bật lại observer sau khi dịch xong
    const mo = observerRef.current;
    if (mo && container) {
      mo.observe(container, { childList: true, subtree: true, characterData: true });
    }

    // ✨ Thêm hiệu ứng mượt
    container.classList.add("fade-in");
    setTimeout(() => container.classList.remove("fade-in"), 800);
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mo = new MutationObserver(() => {
      if (!translatingRef.current) {
        clearTimeout(mo.timer);
        mo.timer = setTimeout(() => translateContainer(), 800);
      }
    });
    observerRef.current = mo;

    mo.observe(container, { childList: true, subtree: true, characterData: true });
    translateContainer();

    return () => mo.disconnect();
  }, [lang]);

  const Switcher = useMemo(
    () => (
      <div
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: "8px 10px",
          boxShadow: "0 6px 16px rgba(0,0,0,.12)",
          zIndex: 9999,
        }}
      >
        <button
          onClick={() => {
            const newLang = lang === "en" ? "vi" : "en";
            setLang(newLang);
            console.log("🌐 Switched to:", newLang);
          }}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {lang === "en" ? "🇻🇳 VI" : "🇬🇧 EN"}
        </button>
      </div>
    ),
    [lang]
  );

  return (
    <>
      {Switcher}

      {/* 🌙 Overlay khi đang dịch */}
      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255,255,255,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
            color: "#333",
            zIndex: 9998,
            backdropFilter: "blur(2px)",
            transition: "opacity 0.5s ease",
          }}
        >
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          transition: "opacity 0.6s ease",
        }}
      >
        {children}
      </div>
    </>
  );
}
