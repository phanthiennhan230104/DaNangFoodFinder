// frontend/src/api.js
import axios from "axios";
import { ACCESS_TOKEN } from "./constants";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
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

export default api;