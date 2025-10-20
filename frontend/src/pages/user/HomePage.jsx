// frontend/src/pages/HomePage/HomePage.jsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../../api";
import HeroSection from "../../components/sections/Homepage/HeroSection";
import FilterSection from "../../components/sections/Homepage/FilterSection";
import RestaurantGrid from "../../components/sections/Homepage/RestaurantGrid";
import QuickActions from "../../components/sections/Homepage/QuickActions";
import LoadingIndicator from "../../components/LoadingIndicator";
import "../../styles/user/HomePage.css";

// Hook: Debounce input value
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

  const [coords, setCoords] = useState(null);
  const debouncedQ = useDebounce(filters.q, 450);

  // Fetch available filters (areas, cuisines)
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

  // Get current location (coords)
  useEffect(() => {
    if (!navigator.geolocation) return;
    let mounted = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mounted) return;
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        console.warn("Geolocation error or denied:", err);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 5000 }
    );
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch restaurant list
  const getRestaurants = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();

    if (filters.cuisine_type) params.append("cuisine_type", filters.cuisine_type);
    if (filters.address) params.append("address", filters.address);
    if (debouncedQ) params.append("q", debouncedQ);

    if (coords && coords.lat != null && coords.lon != null) {
      params.append("lat", coords.lat);
      params.append("lon", coords.lon);
    }

    api
      .get(`restaurants/?${params.toString()}`)
      .then((res) => {
        const data = res.data;
        if (Array.isArray(data)) {
          setRestaurants(data);
        } else if (data && data.results) {
          setRestaurants(data.results);
        } else if (Array.isArray(data?.items)) {
          setRestaurants(data.items);
        } else if (Array.isArray(data?.data)) {
          setRestaurants(data.data);
        } else {
          setRestaurants([]);
        }
      })
      .catch((err) => {
        console.error("Error fetching restaurants:", err);
        setRestaurants([]);
      })
      .finally(() => setLoading(false));
  }, [filters.cuisine_type, filters.address, debouncedQ, coords]);

  useEffect(() => {
    getRestaurants();
  }, [getRestaurants]);

  // Handle filter & search actions
  const handleFilterChange = (filterName, value) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [filterName]: value,
    }));
  };

  const handleSearch = (query) => {
    setFilters((prev) => ({ ...prev, q: query || "" }));
  };

  const handleClearSearch = () => {
    setFilters((prev) => ({ ...prev, q: "" }));
  };

  const scrollToFilters = () => {
    if (filterRef.current) {
      filterRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="homepage-container">
      <HeroSection onSearch={handleSearch} onClearSearch={handleClearSearch} />

      <main className="main-content">
        <QuickActions coords={coords} onScrollToFilters={scrollToFilters} />

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
    </div>
  );
}

export default HomePage;
