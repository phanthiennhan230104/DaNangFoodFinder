import React from "react";
import "../../styles/Footer.css";

export default function Footer() {
  return (
    <footer className="footer" id="contact">
      <div className="container footer-content">
        <div className="footer-section">
          <h4>DNFF</h4>
          <p>Hệ thống tìm kiếm ẩm thực thông minh tại Đà Nẵng.</p>
        </div>
        <div className="footer-section">
          <h4>Liên kết</h4>
          <a href="#home">Trang Chủ</a>
          <a href="#about">Giới Thiệu</a>
          <a href="#features">Tính Năng</a>
          <a href="#why-choose">Tại sao chọn</a>
          <a href="#contact">Liên Hệ</a>
        </div>
        <div className="footer-section">
          <h4>Liên hệ</h4>
          <p>Email: phanthiennhan230104@gmail.com</p>
          <p>Điện thoại: 0944068045</p>
          <p>Địa chỉ: Đại học Duy Tân, Đà Nẵng</p>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2025 DNFF. Tất cả quyền được bảo lưu.</p>
      </div>
    </footer>
  );
}
