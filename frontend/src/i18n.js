import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  resources: {
    vn: {
      translation: {
        // Navbar
        area: "Khu vực",
        cuisine: "Loại món ăn",
        searchPlaceholder: "Tìm món ăn, nhà hàng...",
        search: "Tìm kiếm",
        login: "Đăng nhập",
        register: "Đăng ký",
        logout: "Đăng xuất",
        foodJourney: "Hành trình ẩm thực",

        // HomePage
        "homepage.restaurantList": "Danh sách nhà hàng",

        // HeroSection
        "hero.title": "Khám phá Ẩm thực Đà Nẵng",
        "hero.subtitle": "Tìm kiếm món ăn, nhà hàng yêu thích của bạn một cách thông minh.",
        "hero.searchPlaceholder": "Bạn muốn ăn gì hôm nay? (VD: bún chả cá gần cầu Rồng)",
        "hero.searchButton": "Tìm kiếm",

        // Error messages
        "error.getCuisines": "Lỗi khi lấy cuisines",
        "error.getRestaurants": "Lỗi khi lấy nhà hàng",

        // FilterSection
        "filter.area": "Khu vực:",
        "filter.allAreas": "-- Tất cả khu vực --",
        "filter.cuisine": "Loại ẩm thực:",
        "filter.allCuisines": "-- Tất cả ẩm thực --",
        "filter.map": "Xem bản đồ"
      },
    },
    en: {
      translation: {
        // Navbar
        area: "Area",
        cuisine: "Cuisine",
        searchPlaceholder: "Search dishes, restaurants...",
        search: "Search",
        login: "Login",
        register: "Register",
        logout: "LOGOUT",
        foodJourney: "Food Journey",

        // HomePage
        "homepage.restaurantList": "Restaurant List",

        // HeroSection
        "hero.title": "Discover Da Nang Cuisine",
        "hero.subtitle": "Find your favorite dishes and restaurants smartly.",
        "hero.searchPlaceholder": "What do you want to eat today? (e.g., fish noodle soup near Dragon Bridge)",
        "hero.searchButton": "Search",

        // Error messages
        "error.getCuisines": "Error fetching cuisines",
        "error.getRestaurants": "Error fetching restaurants",

        // FilterSection
        "filter.area": "Area:",
        "filter.allAreas": "-- All areas --",
        "filter.cuisine": "Cuisine:",
        "filter.allCuisines": "-- All cuisines --",
        "filter.map": "View map"
      },
    },
  },
  lng: "vn", 
  fallbackLng: "vn",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
