import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/contexts/AuthContext";
import { motion } from "framer-motion";
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

  // ----------- PARSE OPENING HOURS (TODAY + FULL) ----------
  const parseOpeningHoursFull = () => {
    if (!restaurant.opening_hours) return { today: null, full: null };

    // Normalize separators and split into day entries
    const raw = restaurant.opening_hours.replace(/\s*\|\s*/g, " | ");
    const entries = raw.split("|").map((s) => s.trim()).filter(Boolean);

    // Attempt to find today's entry
    const dayMap = {
      0: ["Su", "Sun", "Sunday"],
      1: ["Mo", "Mon", "Monday"],
      2: ["Tu", "Tue", "Tuesday"],
      3: ["We", "Wed", "Wednesday"],
      4: ["Th", "Thu", "Thursday"],
      5: ["Fr", "Fri", "Friday"],
      6: ["Sa", "Sat", "Saturday"],
    };

    const todayIndex = new Date().getDay();
    const todayKeys = dayMap[todayIndex];

    let todayEntry = null;

    for (const entry of entries) {
      const prefix = entry.split(" ")[0];
      // match short or long day names
      if (todayKeys.some((k) => prefix.toLowerCase().startsWith(k.toLowerCase()))) {
        todayEntry = entry;
        break;
      }
    }

    // If not found, try to match a time-range anywhere (fall back)
    if (!todayEntry && entries.length > 0) {
      const timeMatch = entries[0].match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (timeMatch) todayEntry = entries[0];
    }

    return { today: todayEntry, full: entries.join(" | ") };
  };

  const { today: todayHours, full: fullHours } = parseOpeningHoursFull();

  // Parse full hours into {day, time} pairs for aligned rows
  const parseFullHoursEntries = (full) => {
    if (!full) return [];
    const entries = full.split("|").map(s => s.trim()).filter(Boolean);

    return entries.map((entry) => {
      // try to split at first time-like token (starts with digit)
      const m = entry.match(/^([^-\d:]+?)\s*(.*)$/);
      if (m) {
        const maybeDay = m[1].trim();
        const rest = m[2].trim();
        // If rest starts with time digits, treat as time; otherwise split by the first whitespace
        if (/^\d/.test(rest)) {
          return { day: maybeDay || "", time: rest };
        }
      }

      // fallback: try to split by first space
      const parts = entry.split(/\s+(.+)/);
      if (parts.length === 3) {
        return { day: parts[0].trim(), time: parts[1].trim() };
      }

      return { day: entry, time: "" };
    });
  };

  // ----------- GET OPEN / CLOSED STATUS FOR TODAY ----------
  const getOpenStatusToday = () => {
    if (!todayHours) return null;

    const m = todayHours.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!m) return null;

    const [_, openT, closeT] = m;
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();

    const [oH, oM] = openT.split(":").map(Number);
    const [cH, cM] = closeT.split(":").map(Number);

    const openMinutes = oH * 60 + oM;
    const closeMinutes = cH * 60 + cM;

    // If close <= open we assume it crosses midnight
    if (closeMinutes <= openMinutes) {
      return current >= openMinutes || current < closeMinutes ? "open" : "closed";
    }

    return current >= openMinutes && current < closeMinutes ? "open" : "closed";
  };

  const openStatus = getOpenStatusToday();

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
                  ⭐ {restaurant.average_rating ? `${Number(restaurant.average_rating).toFixed(2)}/5` : "—"}
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

              {/* INFO SECTION */}
              <div className="popup-info-modern">
                <div className="info-row">
                  <strong>💵 Price:</strong>
                  <span>{restaurant.price_range || "Not available"}</span>
                </div>

                <div className="info-row">
                  <strong>🍽 Cuisine:</strong>
                  <span>{restaurant.cuisine_type || restaurant.tags?.join(", ") || "—"}</span>
                </div>

                <div className="info-row">
                  <strong>⏰ Today:</strong>
                  <span>{todayHours || "No information"}</span>
                </div>

                <div className="info-row full-span">
                  <strong>⏳ Full hours:</strong>
                  <div className="full-hours-columns">
                    {(() => {
                      const items = parseFullHoursEntries(fullHours);
                      if (!items || items.length === 0) return <div className="fh-empty">—</div>;

                      // Convert to objects with raw string and original day for grouping
                      const list = items.map(i => ({ raw: `${i.day} ${i.time}`.trim(), day: (i.day || '').trim() }));

                      const normalize = (d) => (d || '').toLowerCase();

                      // helper to detect group: 1 => Mon-Thu, 2 => Fri-Sun
                      const groupOf = (day) => {
                        const d = normalize(day);
                        if (!d) return 1;
                        if (/^mo|^mon|^monday/.test(d)) return 1;
                        if (/^tu|^tue|^tuesday/.test(d)) return 1;
                        if (/^we|^wed|^wednesday/.test(d)) return 1;
                        if (/^th|^thu|^thursday/.test(d)) return 1;
                        if (/^fr|^fri|^friday/.test(d)) return 2;
                        if (/^sa|^sat|^saturday/.test(d)) return 2;
                        if (/^su|^sun|^sunday/.test(d)) return 2;
                        if (/thu\s*2|th[uứ]\s*2|t2/i.test(day)) return 1;
                        if (/thu\s*3|th[uứ]\s*3|t3/i.test(day)) return 1;
                        if (/thu\s*4|th[uứ]\s*4|t4/i.test(day)) return 1;
                        if (/thu\s*5|th[uứ]\s*5|t5/i.test(day)) return 1;
                        if (/thu\s*6|th[uứ]\s*6|t6/i.test(day)) return 2;
                        if (/thu\s*7|th[uứ]\s*7|t7/i.test(day)) return 2;
                        if (/chu?n\s*nhat|cn/i.test(day)) return 2;
                        if (/[-–—]/.test(day)) {
                          if (/(mo|mon|monday|tu|tue|tuesday|we|wed|wednesday|th|thu|thursday)/i.test(day)) return 1;
                          if (/(fr|fri|friday|sa|sat|saturday|su|sun|sunday|thu\s*6|thu\s*7|ch[uủ]n)/i.test(day)) return 2;
                        }
                        return 1;
                      };

                      const col1 = [];
                      const col2 = [];

                      list.forEach(it => {
                        const g = groupOf(it.day);
                        if (g === 1) col1.push(it.raw);
                        else col2.push(it.raw);
                      });

                      // If one column is empty, balance by splitting the other column
                      if (col1.length === 0 && col2.length > 1) {
                        const half = Math.ceil(col2.length / 2);
                        col1.push(...col2.splice(0, half));
                      } else if (col2.length === 0 && col1.length > 1) {
                        const half = Math.ceil(col1.length / 2);
                        col2.push(...col1.splice(half));
                      }

                      return (
                        <>
                          <div className="fh-col">
                            {col1.map((s, idx) => (
                              <div className="fh-item" key={`c1-${idx}`}>{s}</div>
                            ))}
                          </div>
                          <div className="fh-col">
                            {col2.map((s, idx) => (
                              <div className="fh-item" key={`c2-${idx}`}>{s}</div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="info-row full-span">
                  <strong>📍 Status:</strong>
                  <span
                    className={`status-badge ${
                      openStatus === "open" ? "status-open" : "status-closed"
                    }`}
                  >
                    {openStatus === "open" ? "🟢 Open" : openStatus === "closed" ? "🔴 Closed" : "—"}
                  </span>
                </div>




              </div>

              {/* BUTTONS */}
              <div className="popup-actions-modern">
                {(restaurant.latitude || restaurant.lat) && (restaurant.longitude || restaurant.lng) && (
                  <button
                    className="btn-modern primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      const name = restaurant.name || "";
                      const lat = restaurant.lat ?? restaurant.latitude;
                      const lng = restaurant.lng ?? restaurant.longitude;
                      // Navigate to /nearby and pass the restaurant name + destination coords so map can expand distance and focus
                      navigate(`/nearby?query=${encodeURIComponent(name)}&destLat=${encodeURIComponent(lat)}&destLng=${encodeURIComponent(lng)}`);
                    }}
                  >
                    ➤ Directions
                  </button>
                )}

                <button className="btn-modern secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
