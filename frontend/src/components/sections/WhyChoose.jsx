import React from "react";
import "../../styles/WhyChoose.css";

export default function WhyChoose() {
  const benefits = [
    { icon: "⚡", title: "Nhanh chóng", desc: "Phản hồi dưới 3 giây." },
    { icon: "🎯", title: "Chính xác", desc: "Dữ liệu chuẩn hóa và cập nhật thường xuyên." },
    { icon: "🧠", title: "Thông minh", desc: "AI học hỏi và cải thiện liên tục." },
    { icon: "📱", title: "Hỗ trợ 24/7", desc: "Luôn sẵn sàng hỗ trợ mọi lúc." },
  ];

  return (
    <section id="why-choose" className="why-choose">
      <div className="container">
        <h2 className="section-title">Tại sao chọn DNFF?</h2>
        <div className="benefits-grid">
          {benefits.map((b, i) => (
            <div key={i} className="benefit-item">
              <div className="benefit-icon">{b.icon}</div>
              <h5>{b.title}</h5>
              <p>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
