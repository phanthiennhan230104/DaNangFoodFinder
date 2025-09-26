import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import HeroSection from '../../components/sections/HeroSection';
import FilterSection from '../../components/sections/FilterSection';
import RestaurantGrid from '../../components/sections/RestaurantGrid';
import LoadingIndicator from '../../components/LoadingIndicator';
import '../../styles/HomePage.css';

function HomePage() {
  const { t } = useTranslation(); 
  const [restaurants, setRestaurants] = useState([]);
  const [filtersData, setFiltersData] = useState({ areas: [], cuisines: [] }); // 👈 chứa cả area + cuisine
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    cuisine_type: '',
    address: '',
  });

  // Lấy danh sách filters (areas + cuisines)
  useEffect(() => {
    api.get('filters/')
      .then(res => setFiltersData(res.data))
      .catch(err => console.error(t("error.getFilters"), err));
  }, [t]);

  // Hàm lấy danh sách nhà hàng (có filter)
  const getRestaurants = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.cuisine_type) {
      params.append('cuisine_type', filters.cuisine_type);
    }
    if (filters.address) {
      params.append('address', filters.address);
    }

    api.get(`restaurants/?${params.toString()}`)
      .then((res) => {
        if (Array.isArray(res.data)) {
          // Trường hợp backend không bật pagination
          setRestaurants(res.data);
        } else if (res.data && res.data.results) {
          // Trường hợp backend có pagination
          setRestaurants(res.data.results);
        } else {
          setRestaurants([]);
        }
      })
      .catch((err) => {
        console.error(t("error.getRestaurants"), err);
        setRestaurants([]);
      })
      .finally(() => setLoading(false));
  }, [filters, t]);

  // Gọi API mỗi khi filters thay đổi
  useEffect(() => {
    getRestaurants();
  }, [getRestaurants]);

  // Xử lý thay đổi filter
  const handleFilterChange = (filterName, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [filterName]: value,
    }));
  };

  // Xử lý search (sau này nối với RAG/Groq)
  const handleSearch = (query) => {
    console.log('Bắt đầu tìm kiếm RAG cho:', query);
  };

  return (
    <div className="homepage-container">
      <HeroSection onSearch={handleSearch} />
      
      <main className="main-content">
        <FilterSection 
          onFilterChange={handleFilterChange}
          filters={filters}                 // 👈 truyền toàn bộ object
          areas={filtersData.areas}         // 👈 truyền areas từ API
          cuisines={filtersData.cuisines}   // 👈 truyền cuisines từ API
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
