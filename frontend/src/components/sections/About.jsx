import React from "react";
import "../../styles/About.css";

export default function About() {
  return (
    <section id="about" className="about">
      <div className="container">
        <h2 className="section-title">Về DNFF</h2>
        <div className="about-content">
          <div className="about-text">
            <h3>🤖 Trí tuệ nhân tạo</h3>
            <p>
              DNFF sử dụng công nghệ AI tiên tiến để hiểu ngôn ngữ tự nhiên và
              đưa ra gợi ý cá nhân hóa dựa trên sở thích của bạn.
            </p>
            <p>
              Với khả năng học hỏi từ hành vi người dùng, hệ thống ngày càng hiểu rõ hơn về khẩu vị và nhu cầu của từng cá nhân.
            </p>
            <a href="#" className="btn btn-primary">Liên hệ ngay</a>
          </div>
          <div className="about-image">
            <h4>🎯 DNFF Team</h4>
            <p>Đội ngũ sinh viên Đại học Duy Tân cam kết mang đến trải nghiệm ẩm thực tốt nhất.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
