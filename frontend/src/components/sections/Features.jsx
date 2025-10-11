import React from "react";
import "../../styles/Features.css";

export default function Features() {
  const features = [
    { icon: "🔍", title: "Tìm kiếm thông minh", desc: "Tìm kiếm món ăn bằng từ khóa hoặc câu hỏi tự nhiên, kèm bộ lọc thông minh." },
    { icon: "🎯", title: "Gợi ý cá nhân hóa", desc: "AI đề xuất món ăn và nhà hàng phù hợp dựa trên lịch sử, vị trí và sở thích." },
    { icon: "🗺️", title: "Lập lịch ăn uống", desc: "Tạo kế hoạch ăn uống theo timeline phù hợp với ngân sách và khẩu vị." },
    { icon: "💖", title: "Yêu thích & Lịch sử", desc: "Lưu nhà hàng yêu thích, xem lại lịch sử tìm kiếm và đánh giá." },
    { icon: "🌐", title: "Tích hợp Google Maps", desc: "Hiển thị bản đồ, tính khoảng cách và chỉ đường tối ưu." },
    { icon: "🛡️", title: "Bảo mật & Quản lý", desc: "Phân quyền rõ ràng và bảo mật thông tin người dùng." }
  ];

  return (
    <section id="features" className="features">
      <div className="container">
        <h2 className="features-title">Tính năng nổi bật</h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
