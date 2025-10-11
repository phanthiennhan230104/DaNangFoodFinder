import React from "react";
import "../../styles/Header.css";

export default function Header() {
  return (
    <header className="header">
        <nav className="nav">
            <div className="logo">🍜 DNFF</div>
            <ul className="nav-links">
                <li><a href="#home" data-scroll>Trang chủ</a></li>
                <li><a href="#about" data-scroll>Giới thiệu</a></li>
                <li><a href="#features" data-scroll>Tính năng</a></li>
                <li><a href="#why-choose" data-scroll>Tại sao chọn</a></li>
                <li><a href="#contact" data-scroll>Liên hệ</a></li>
                </ul>
            <div className="auth-buttons">
                <a href="/login" className="btn btn-secondary">Đăng nhập</a>
                <a href="/register" className="btn btn-primary">Đăng ký</a>
            </div>
        </nav>
    </header>
  );
}
