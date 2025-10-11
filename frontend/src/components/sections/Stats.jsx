import React, { useEffect } from "react";
import "../../styles/Stats.css";

export default function Stats() {
  useEffect(() => {
    const stats = document.querySelectorAll(".stat-item h3");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = entry.target;
          const finalNumber = parseInt(target.dataset.value);
          let current = 0;
          const increment = finalNumber / 50;
          const timer = setInterval(() => {
            current += increment;
            if (current >= finalNumber) {
              clearInterval(timer);
              current = finalNumber;
            }
            target.textContent = Math.floor(current).toLocaleString();
          }, 40);
          observer.unobserve(target);
        }
      });
    });
    stats.forEach(stat => observer.observe(stat));
  }, []);

  return (
    <section className="stats">
      <div className="container stats-grid">
        <div className="stat-item"><h3 data-value="2000">0</h3><p>Nhà hàng</p></div>
        <div className="stat-item"><h3 data-value="50000">0</h3><p>Đánh giá</p></div>
        <div className="stat-item"><h3 data-value="5000">0</h3><p>Người dùng</p></div>
        <div className="stat-item"><h3 data-value="99">0</h3><p>Hài lòng</p></div>
      </div>
    </section>
  );
}
