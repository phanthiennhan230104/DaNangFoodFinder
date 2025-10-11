// frontend/src/pages/HomePage/HomePage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import HeroSection from '../../components/sections/HeroSection';
import FilterSection from '../../components/sections/FilterSection';
import RestaurantGrid from '../../components/sections/RestaurantGrid';
import LoadingIndicator from '../../components/LoadingIndicator';
import '../../styles/HomePage.css';

/**
 * Simple debounce hook
 */
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function HomePage() {
  const { t } = useTranslation();

  const [restaurants, setRestaurants] = useState([]);
  const [filtersData, setFiltersData] = useState({ areas: [], cuisines: [] }); // chứa cả area + cuisine
  const [loading, setLoading] = useState(true);

  // filters hiện tại: cuisine_type, address, q (tìm kiếm)
  const [filters, setFilters] = useState({
    cuisine_type: '',
    address: '',
    q: '',
  });

  // Tọa độ người dùng (nếu cho phép)
  const [coords, setCoords] = useState(null);

  // Debounced query để tránh spam API khi user gõ nhanh / voice có nhiều cập nhật
  const debouncedQ = useDebounce(filters.q, 450);

  // Lấy danh sách filters (areas + cuisines) 1 lần
  useEffect(() => {
    let mounted = true;
    api.get('filters/')
      .then(res => {
        if (!mounted) return;
        setFiltersData(res.data || { areas: [], cuisines: [] });
      })
      .catch(err => {
        console.error(t("error.getFilters"), err);
      });
    return () => { mounted = false; };
  }, [t]);

  // Lấy tọa độ người dùng 1 lần (không bắt buộc)
  useEffect(() => {
    if (!navigator.geolocation) return;
    let mounted = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mounted) return;
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        // user denied or other error -> không làm gì, vẫn hoạt động bằng DB/HERE fallback
        console.warn("Geolocation error or denied:", err);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 5000 }
    );
    return () => { mounted = false; };
  }, []);

  // Hàm lấy danh sách nhà hàng (có filter + q + coords)
  const getRestaurants = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();

    // filters cơ bản
    if (filters.cuisine_type) params.append('cuisine_type', filters.cuisine_type);
    if (filters.address) params.append('address', filters.address);

    // query tìm kiếm (tên/loại...)
    if (debouncedQ) params.append('q', debouncedQ);

    // gửi tọa độ nếu có (backend có thể dùng để ưu tiên gần user)
    if (coords && coords.lat != null && coords.lon != null) {
      params.append('lat', coords.lat);
      params.append('lon', coords.lon);
    }

    // tùy chỉnh page/per_page nếu cần (mặc định backend xử lý)
    // params.append('page', 1);
    // params.append('per_page', 50);

    api.get(`restaurants/?${params.toString()}`)
      .then((res) => {
        const data = res.data;
        if (Array.isArray(data)) {
          // backend trả mảng trực tiếp
          setRestaurants(data);
        } else if (data && data.results) {
          // backend trả object có results (pagination)
          setRestaurants(data.results);
        } else {
          // fallback: nếu backend trả object nhưng không đúng structure
          // thử dùng data.items hoặc data.data nếu bạn từng dùng
          if (Array.isArray(data?.items)) setRestaurants(data.items);
          else if (Array.isArray(data?.data)) setRestaurants(data.data);
          else setRestaurants([]);
        }
      })
      .catch((err) => {
        console.error(t("error.getRestaurants"), err);
        setRestaurants([]);
      })
      .finally(() => setLoading(false));
  }, [filters.cuisine_type, filters.address, debouncedQ, coords, t]);

  // Gọi API mỗi khi debounce query hoặc filters cơ bản / coords thay đổi
  useEffect(() => {
    getRestaurants();
  }, [getRestaurants]);

  // Xử lý thay đổi filter từ FilterSection
  const handleFilterChange = (filterName, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [filterName]: value,
    }));
  };

  // Xử lý search (được gọi từ HeroSection - input + voice)
  // Khi set filters.q, effect debounced sẽ trigger getRestaurants
  const handleSearch = (query) => {
    setFilters(prev => ({ ...prev, q: query || '' }));
  };

  const handleClearSearch = () => {
    setFilters(prev => ({ ...prev, q: '' }));
  };

  return (
    <div className="homepage-container">
      <HeroSection onSearch={handleSearch} onClearSearch={handleClearSearch} />

      <main className="main-content">
        <FilterSection
          onFilterChange={handleFilterChange}
          filters={filters}
          areas={filtersData.areas || []}
          cuisines={filtersData.cuisines || []}
        />

        {loading ? (
          <LoadingIndicator />
        ) : (
          <RestaurantGrid
            title={t("homepage.restaurantList")}
            restaurants={restaurants}
          />
        )}
      </main>
    </div>
  );
}

export default HomePage;
