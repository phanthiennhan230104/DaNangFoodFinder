import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Smooth scroll for anchor links (#id) with header offset.
 * Automatically adjusts for fixed header height.
 *
 * @param {Object} options
 * @param {number} options.duration - Animation duration (ms)
 * @param {number} options.extraOffset - Additional offset (px)
 */
export default function useSmoothScroll({ duration = 800, extraOffset = 20 } = {}) {
  const { pathname } = useLocation();

  useEffect(() => {
    const header = document.querySelector(".header");

    // Dynamic offset = header height + extra offset
    const getOffset = () => (header?.getBoundingClientRect().height || 0) + extraOffset;

    const links = document.querySelectorAll('a[data-scroll]');

    const handleClick = (e) => {
      const href = e.currentTarget.getAttribute("href");
      // Ignore external links or no href
      if (!href || !href.startsWith("#")) return;

      const id = href.substring(1);
      const target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();

      const startY = window.scrollY;
      const destY = target.getBoundingClientRect().top + window.scrollY - getOffset();
      const distance = destY - startY;
      const startT = performance.now();

      // Smooth easing function (easeInOutCubic)
      const easeInOutCubic = (t) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const step = (now) => {
        const p = Math.min((now - startT) / duration, 1);
        window.scrollTo(0, startY + distance * easeInOutCubic(p));
        if (p < 1) {
          requestAnimationFrame(step);
        } else {
          // Update hash in URL (no page jump)
          history.replaceState(null, "", `#${id}`);
        }
      };

      requestAnimationFrame(step);
    };

    links.forEach((a) => a.addEventListener("click", handleClick));

    // Cleanup listeners on unmount or route change
    return () => links.forEach((a) => a.removeEventListener("click", handleClick));
  }, [duration, extraOffset, pathname]);
}
