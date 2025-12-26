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
  // Scroll to filter section
  const filterRef = useRef(null);

  const [restaurants, setRestaurants] = useState([]);

  //Get list of filters to show in dropdowns
  const [filtersData, setFiltersData] = useState({ 
    areas: [], //place mapping in backend
    cuisines_by_country: [], // cuisine country mapping in backend
    food_types: [] // food type mapping in backend
  });
  const [loading, setLoading] = useState(true);
  // Current filter values
  const [filters, setFilters] = useState({ 
    cuisine_country: "", 
    food_type: "", 
    address: "", 
    q: "" 
  });
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    pageSize: 8,
    hasNext: false,
    hasPrevious: false,
  });
  //gọi API lấy filter data
  useEffect(() => {
    api.get("filters/").then((res) => {
      setFiltersData(res.data || { 
        areas: [], 
        cuisines_by_country: [], 
        food_types: [] 
      });
    });
  }, []);
  //gọi API lấy danh sách nhà hàng
  const getRestaurants = useCallback((page = 1) => {
    setLoading(true);
    const params = new URLSearchParams();

    // Gửi cả 2 loại cuisine filter
    if (filters.cuisine_country) params.append("cuisine_type", filters.cuisine_country);
    if (filters.food_type) params.append("food_type", filters.food_type);
    if (filters.address) params.append("address", filters.address);
    if (filters.q.trim()) params.append("q", filters.q.trim());
    
    // Add pagination params
    params.append("page", page);
    params.append("page_size", pagination.pageSize);

    api
      .get(`restaurants/?${params.toString()}`)
      .then((res) => {
        const data = res.data;
        const list = Array.isArray(data) ? data : data?.results || [];
        setRestaurants(list);
        
        // Update pagination info
        if (data && !Array.isArray(data)) {
          setPagination(prev => ({
            ...prev,
            currentPage: data.current_page || page,
            totalPages: data.total_pages || 1,
            totalCount: data.count || list.length,
            hasNext: data.has_next || false,
            hasPrevious: data.has_previous || false,
          }));
        }
      })
      .finally(() => setLoading(false));
  }, [filters, pagination.pageSize]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    getRestaurants(1);
  }, [filters]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination(prev => ({ ...prev, currentPage: newPage }));
    getRestaurants(newPage);
    // Scroll to filter section for better UX
    filterRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSelectRestaurant = async (r) => {
    if (!r || !r.id) return;
    try {
      const res = await api.get(`restaurants/${r.id}/`);
      const full = res.data || r;
      setSelectedRestaurant(full);
    } catch (err) {
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
              cuisinesByCountry={filtersData.cuisines_by_country}
              foodTypes={filtersData.food_types}
            />
          </div>

          {loading ? (
            <LoadingIndicator />
          ) : (
            <>
              <RestaurantGrid
                title="Restaurant List"
                restaurants={restaurants}
                onSelectRestaurant={handleSelectRestaurant}
              />
              
              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="pagination-container">
                  <button
                    className="pagination-btn"
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevious}
                  >
                    ← Previous
                  </button>
                  
                  <div className="pagination-info">
                    {/* Page numbers */}
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                      .filter(pageNum => {
                        // Show first, last, and pages near current page
                        return (
                          pageNum === 1 ||
                          pageNum === pagination.totalPages ||
                          Math.abs(pageNum - pagination.currentPage) <= 2
                        );
                      })
                      .map((pageNum, index, arr) => (
                        <React.Fragment key={pageNum}>
                          {index > 0 && arr[index - 1] !== pageNum - 1 && (
                            <span className="pagination-ellipsis">...</span>
                          )}
                          <button
                            className={`pagination-page-btn ${
                              pageNum === pagination.currentPage ? "active" : ""
                            }`}
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </button>
                        </React.Fragment>
                      ))}
                  </div>
                  
                  <button
                    className="pagination-btn"
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNext}
                  >
                    Next →
                  </button>
                </div>
              )}
              
              {/* Summary info */}
              <div className="pagination-summary">
                Showing {restaurants.length} of {pagination.totalCount} restaurants
              </div>
            </>
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
