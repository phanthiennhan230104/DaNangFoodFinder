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

  useEffect(() => {
    api
      .get("filters/")
      .then((res) => setFiltersData(res.data || { areas: [], cuisines: [] }))
      .catch((err) => console.error("Error fetching filter data:", err));
  }, []);

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

  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }));
  };

  return (
    <div className="homepage-container">
      <HeroSection
        onExplore={() => {
          if (filterRef.current) {
            filterRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }}
      />
      <main className="main-content">
        <div className="container">
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
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default HomePage;
