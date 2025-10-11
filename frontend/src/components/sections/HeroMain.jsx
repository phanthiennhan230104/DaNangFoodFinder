import React from "react";
import "../../styles/Hero.css";

export default function HeroMain() {
  return (
    <section id="home" className="hero">
      <div className="hero-content">
        <h1>Khám phá ẩm thực Đà Nẵng với AI</h1>
        <p>
          Hệ thống tìm kiếm món ăn thông minh giúp bạn khám phá những món ăn địa
          phương tuyệt vời với gợi ý cá nhân hóa và tìm kiếm bằng ngôn ngữ tự nhiên.
        </p>
        <div className="hero-buttons">
          <a href="#" className="btn btn-primary">Bắt đầu khám phá</a>
          <a href="#features" className="btn btn-secondary">Tìm hiểu thêm</a>
        </div>
      </div>
    </section>
  );
}
