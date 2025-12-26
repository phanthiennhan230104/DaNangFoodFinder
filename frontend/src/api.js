// frontend/src/api.js
import axios from "axios";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "./constants";

const api = axios.create({
  baseURL: "http://localhost:8000/api/",
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor cho response: xử lý khi Access Token hết hạn (401)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Nếu server trả về 401 (Unauthorized) và chưa thử refresh lần nào
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Đánh dấu đã thử refresh để tránh lặp vô tận

      const refreshToken = localStorage.getItem(REFRESH_TOKEN);

      if (refreshToken) {
        try {
          // Gọi API refresh token
          const res = await axios.post("http://localhost:8000/api/auth/token/refresh/", {
            refresh: refreshToken,
          });

          if (res.status === 200) {
            const newAccessToken = res.data.access;
            localStorage.setItem(ACCESS_TOKEN, newAccessToken);

            // Cập nhật header cho request ban đầu và gửi lại
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error("Refresh token failed:", refreshError);
          // Nếu refresh cũng lỗi (hết hạn nốt), bắt đăng nhập lại
          localStorage.clear();
          window.location.replace("/login");
          return Promise.reject(refreshError);
        }
      } else {
        // Không có refresh token, bắt đăng nhập lại
        localStorage.clear();
        window.location.replace("/login");
      }
    }

    return Promise.reject(error);
  }
);

export const fetchJourneyRecommendations = async (params) => {
  const res = await api.get("/journey/restaurants/", { params });
  return res.data;
};

// lưu hành trình
export const saveJourney = async (token, journeyData) => {
  const res = await api.post("/journey/", journeyData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// lấy hành trình theo ngày
export const getJourneyByDate = async (token, date) => {
  const res = await api.get(`/journey/?date=${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};
// Lưu/update thông tin người dùng
export const saveUserProfile = async (profileData) => {
  try {
    const res = await api.put("/profile/", profileData);
    return res.data;
  } catch (error) {
    console.error("API error:", error.response?.data || error.message);
    throw error;
  }
};


export default api;