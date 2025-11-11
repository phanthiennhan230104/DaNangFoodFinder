import React, { useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
import { translateText } from "../utils/translator";

const BASE_LANG = "en";
const SUPPORTED = ["en", "vi"];
// 🔹 Tạo Context để Header có thể lấy ngôn ngữ & hàm đổi ngôn ngữ
export const LangContext = createContext({
  lang: "en",
  setLang: () => {},
});

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

export function LanguageSwitcher() {
  const { lang, setLang } = useContext(LangContext);
  return (
    <button
      role="switch-lang"
      onClick={() => setLang(lang === "en" ? "vi" : "en")}
      style={{
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontWeight: 600,
        marginLeft: "10px",
        fontSize: "0.95rem",
      }}
    >
      {lang === "en" ? "🇻🇳 VI" : "🇬🇧 EN"}
    </button>
  );
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

    nodes.forEach((node) => {
      if (!originalMap.current.has(node)) {
        originalMap.current.set(node, node.nodeValue);
      }
    });

    if (observerRef.current) observerRef.current.disconnect();
    translatingRef.current = true;
    setLoading(true);

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

    const mo = observerRef.current;
    if (mo && container) {
      mo.observe(container, { childList: true, subtree: true, characterData: true });
    }

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

  return (
    <LangContext.Provider value={{ lang, setLang }}>
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
          Translating...
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
    </LangContext.Provider>
  );
}
