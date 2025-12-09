import React, { useEffect, useState } from "react";
import api from "../../api";
import useFavorites from "../../hooks/useFavorites";
import RestaurantGrid from "../../components/sections/Homepage/RestaurantGrid";
import RestaurantDetailPopup from "../../components/RestaurantDetailPopup";
import LoadingIndicator from "../../components/LoadingIndicator";
import "../../styles/user/HomePage.css";

export default function Favorites() {
  const { favoritesQuery } = useFavorites();

  const favoritesData = (favoritesQuery.data || []).map((f) => f.restaurant).filter(Boolean);
  const loading = favoritesQuery.isLoading;
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  useEffect(() => {
    // favoritesQuery handles fetching automatically via react-query
  }, [favoritesQuery]);

  const handleSelectRestaurant = async (r) => {
    if (!r || !r.id) return;
    try {
      const res = await api.get(`restaurants/${r.id}/`);
      setSelectedRestaurant(res.data || r);
    } catch (err) {
      console.warn(`Failed to fetch full restaurant details for id=${r.id}`, err?.response?.status, err?.message);
      setSelectedRestaurant(r);
    }
  };

  return (
    <div className="container">
      <h1 style={{ marginTop: 14, marginBottom: 12 }}>Your Favorites</h1>
      {loading ? (
        <LoadingIndicator />
      ) : (
        <section className="favorites-grid">
          <RestaurantGrid
            title="Your favorite restaurants"
            restaurants={favoritesData}
            onSelectRestaurant={handleSelectRestaurant}
          />
        </section>
      )}

      <RestaurantDetailPopup
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
      />
    </div>
  );
}
