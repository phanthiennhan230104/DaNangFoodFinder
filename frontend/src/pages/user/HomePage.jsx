import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../../api";
import HeroSection from "../../components/sections/Homepage/HeroSection";
import FilterSection from "../../components/sections/Homepage/FilterSection";
import RestaurantGrid from "../../components/sections/Homepage/RestaurantGrid";
import RestaurantDetailPopup from "../../components/RestaurantDetailPopup";
import LoadingIndicator from "../../components/LoadingIndicator";
import Footer from "../../components/layout/Footer";
import "../../styles/user/HomePage.css";

function HomePage() {
  const filterRef = useRef(null);
  const [restaurants, setRestaurants] = useState([]);
  const [filtersData, setFiltersData] = useState({ areas: [], cuisines: [] });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ cuisine_type: "", address: "", q: "" });
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  useEffect(() => {
    api.get("filters/").then((res) => {
      setFiltersData(res.data || { areas: [], cuisines: [] });
    });
  }, []);

  const getRestaurants = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();

    if (filters.cuisine_type) params.append("cuisine_type", filters.cuisine_type);
    if (filters.address) params.append("address", filters.address);
    if (filters.q.trim()) params.append("q", filters.q.trim());

    api
      .get(`restaurants/?${params.toString()}`)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setRestaurants(list.slice(0, 8));
      })
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    getRestaurants();
  }, [getRestaurants]);

  const handleSelectRestaurant = async (r) => {
    if (!r || !r.id) return;
    try {
      // api base is already set to '/api/', so don't prefix another 'api/' here
      const res = await api.get(`restaurants/${r.id}/`);
      const full = res.data || r;
      setSelectedRestaurant(full);
    } catch (err) {
      // fallback to using passed-in object + helpful console message for debugging
      console.warn(`Failed to fetch full restaurant details for id=${r.id}`, err?.response?.status, err?.message);
      setSelectedRestaurant(r);
    }
  };
  return (
    <div className="homepage-container">
      <HeroSection onExplore={() => filterRef.current?.scrollIntoView({ behavior: "smooth" })} />

      <main className="main-content">
        <div className="container">
          <div ref={filterRef}>
            <FilterSection
              onFilterChange={(name, value) =>
                setFilters((prev) => ({ ...prev, [name]: value }))
              }
              filters={filters}
              areas={filtersData.areas}
              cuisines={filtersData.cuisines}
            />
          </div>

          {loading ? (
            <LoadingIndicator />
          ) : (
            <RestaurantGrid
              title="Restaurant List"
              restaurants={restaurants}
              onSelectRestaurant={handleSelectRestaurant}
            />
          )}
        </div>
      </main>

      <Footer />

      {/* Popup restaurant */}
      <RestaurantDetailPopup
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
      />
    </div>
  );
}

export default HomePage;
