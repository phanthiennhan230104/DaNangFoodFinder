import { useEffect } from "react";

export default function useSmoothScroll({ duration = 800, extraOffset = 20 } = {}) {
  useEffect(() => {
    const header = document.querySelector(".header");

    // tính offset động: chiều cao header + khoảng đệm
    const getOffset = () => (header?.getBoundingClientRect().height || 0) + extraOffset;

    const links = document.querySelectorAll('a[data-scroll]');

    const handleClick = (e) => {
      const href = e.currentTarget.getAttribute("href");
      if (!href) return;

      // 🔹 bỏ dấu '#' nếu có
      const id = href.startsWith("#") ? href.substring(1) : href;
      const target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();

      const startY = window.scrollY;
      const destY = target.getBoundingClientRect().top + window.scrollY - getOffset();
      const distance = destY - startY;
      const startT = performance.now();

      const easeInOutCubic = (t) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const step = (now) => {
        const p = Math.min((now - startT) / duration, 1);
        window.scrollTo(0, startY + distance * easeInOutCubic(p));
        if (p < 1) {
          requestAnimationFrame(step);
        } else {
          // cập nhật hash cuối URL
          history.replaceState(null, "", `#${id}`);
        }
      };

      requestAnimationFrame(step);
    };

    links.forEach((a) => a.addEventListener("click", handleClick));
    return () => links.forEach((a) => a.removeEventListener("click", handleClick));
  }, [duration, extraOffset]);
}
