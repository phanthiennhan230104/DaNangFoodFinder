import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../../api";
import HeroSection from "../../components/sections/Homepage/HeroSection";
import FilterSection from "../../components/sections/Homepage/FilterSection";
import RestaurantGrid from "../../components/sections/Homepage/RestaurantGrid";
import LoadingIndicator from "../../components/LoadingIndicator";
import Footer from "../../components/layout/Footer";
import "../../styles/user/HomePage.css";

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function HomePage() {
  const filterRef = useRef(null);

  const [restaurants, setRestaurants] = useState([]);
  const [filtersData, setFiltersData] = useState({ areas: [], cuisines: [] });
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    cuisine_type: "",
    address: "",
    q: "",
  });

  const debouncedQ = useDebounce(filters.q, 450);

  /** 🔹 Lấy dữ liệu bộ lọc (cuisine, area) */
  useEffect(() => {
    let mounted = true;
    api
      .get("filters/")
      .then((res) => {
        if (!mounted) return;
        setFiltersData(res.data || { areas: [], cuisines: [] });
      })
      .catch((err) => {
        console.error("Error fetching filter data:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  /** 🔹 Lấy danh sách nhà hàng */
  const getRestaurants = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();

    if (filters.cuisine_type) params.append("cuisine_type", filters.cuisine_type);
    if (filters.address) params.append("address", filters.address);
    if (debouncedQ) params.append("q", debouncedQ);

    api
      .get(`restaurants/?${params.toString()}`)
      .then((res) => {
        const data = res.data;
        let list = [];

        if (Array.isArray(data)) list = data;
        else if (data?.results) list = data.results;
        else if (Array.isArray(data?.items)) list = data.items;
        else if (Array.isArray(data?.data)) list = data.data;

        setRestaurants(list.slice(0, 8));
      })
      .catch((err) => {
        console.error("Error fetching restaurants:", err);
        setRestaurants([]);
      })
      .finally(() => setLoading(false));
  }, [filters.cuisine_type, filters.address, debouncedQ]);

  useEffect(() => {
    getRestaurants();
  }, [getRestaurants]);

  /** 🔹 Thay đổi filter */
  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterName]: value,
    }));
  };

  /** 🔹 Tìm kiếm */
  const handleSearch = (query) => {
    setFilters((prev) => ({ ...prev, q: query || "" }));
  };

  /** 🔹 Xóa tìm kiếm */
  const handleClearSearch = () => {
    setFilters((prev) => ({ ...prev, q: "" }));
  };

  /** 🔹 Cuộn đến bộ lọc */
  const scrollToFilters = () => {
    if (filterRef.current) {
      filterRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="homepage-container">
      <HeroSection
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        onExplore={scrollToFilters}
      />


      <main className="main-content">
        <div ref={filterRef}>
          <FilterSection
            onFilterChange={handleFilterChange}
            filters={filters}
            areas={filtersData.areas || []}
            cuisines={filtersData.cuisines || []}
          />
        </div>

        {loading ? (
          <LoadingIndicator />
        ) : (
          <RestaurantGrid title="Restaurant List" restaurants={restaurants} />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default HomePage;
