import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/contexts/AuthContext";
import useFavorites from "../hooks/useFavorites";
import { AnimatePresence } from "framer-motion";
import "../styles/user/RestaurantDetailPopup.css";

export default function RestaurantDetailPopup({ restaurant, onClose }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { favoritesQuery, addFavorite, removeFavorite } = useFavorites();

  if (!restaurant) return null;

  const isFavorited = Boolean(
    isAuthenticated &&
      (favoritesQuery.data || []).some(
        (f) => f.restaurant?.id === restaurant.id
      )
  );

  const toggleFavorite = async (e) => {
    e.stopPropagation();
    if (!isAuthenticated) return navigate("/login");

    try {
      if (isFavorited) await removeFavorite(restaurant.id);
      else await addFavorite(restaurant.id);
    } catch (err) {
      console.error(err);
    }
  };

  // ----------- PARSE OPENING HOURS ----------
  const parseOpeningHours = () => {
    if (!restaurant.opening_hours) return { open: null, close: null };
    const parts = restaurant.opening_hours.split("-");
    if (parts.length !== 2) return { open: null, close: null };

    return {
      open: parts[0].trim(),
      close: parts[1].trim(),
    };
  };

  const { open, close } = parseOpeningHours();

  // ----------- GET OPEN / CLOSED STATUS ----------
  const getOpenStatus = () => {
    if (!open || !close) return null;

    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();

    const [oH, oM] = open.split(":").map(Number);
    const [cH, cM] = close.split(":").map(Number);

    const openMinutes = oH * 60 + oM;
    const closeMinutes = cH * 60 + cM;

    return current >= openMinutes && current < closeMinutes
      ? "open"
      : "closed";
  };

  const openStatus = getOpenStatus();

  return (
    <AnimatePresence>
      <motion.div
        className="popup-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="popup-container-modern"
          initial={{ scale: 0.85, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 40 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button className="popup-close-btn-modern" onClick={onClose}>
            ✕
          </button>

          <div className="popup-grid-modern">
            {/* LEFT IMAGE */}
            <div className="popup-left">
              {restaurant.image ? (
                <img
                  src={restaurant.image}
                  alt={restaurant.name}
                  className="popup-image-modern"
                />
              ) : (
                <div className="popup-image placeholder">
                  <div className="placeholder-inner">
                    {restaurant.name?.slice(0, 1)}
                  </div>
                </div>
              )}

              {/* Rating left */}
              <div className="popup-badge-left">
                <div className="rating-modern">
                  ⭐ {restaurant.average_rating ?? "—"}
                </div>
              </div>

              {/* Heart right */}
              <div className="popup-badge-right">
                <button
                  className={`card-heart ${isFavorited ? "on" : ""}`}
                  onClick={toggleFavorite}
                >
                  {isFavorited ? "❤" : "♡"}
                </button>
              </div>
            </div>

            {/* RIGHT CONTENT */}
            <div className="popup-right">
              <h2 className="popup-title-modern">{restaurant.name}</h2>

              <div className="popup-address-modern">
                {restaurant.cuisine_type} • {restaurant.address}
              </div>

              {restaurant.description && (
                <p className="popup-description-modern">
                  {restaurant.description}
                </p>
              )}

              {/* INFO SECTION */}
              <div className="popup-info-modern">
                <div className="info-row">
                  <strong>💵 Giá:</strong>
                  <span>{restaurant.price_range || "Không có"}</span>
                </div>

                <div className="info-row">
                  <strong>🏷 Tags:</strong>
                  <span>
                    {restaurant.tags?.join(", ") ||
                      restaurant.cuisine_type ||
                      "—"}
                  </span>
                </div>

                <div className="info-row">
                  <strong>⏰ Giờ mở cửa:</strong>
                  <span>
                    {open && close ? `${open} - ${close}` : "Không có thông tin"}
                  </span>
                </div>

                <div className="info-row">
                  <strong>📍 Trạng thái:</strong>
                  <span
                    className={`status-badge ${
                      openStatus === "open"
                        ? "status-open"
                        : "status-closed"
                    }`}
                  >
                    {openStatus === "open"
                      ? "🟢 Đang mở cửa"
                      : "🔴 Đã đóng cửa"}
                  </span>
                </div>
              </div>

              {/* BUTTONS */}
              <div className="popup-actions-modern">
                {restaurant.lat && restaurant.lng && (
                  <a
                    className="btn-modern primary"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat},${restaurant.lng}`}
                  >
                    ➤ Chỉ đường
                  </a>
                )}

                <button className="btn-modern secondary" onClick={onClose}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
