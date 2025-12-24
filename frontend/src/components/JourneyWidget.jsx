import React, { useState, useEffect } from "react";
import { FaRoute, FaTimes, FaUtensils, FaMapMarkerAlt, FaStar, FaCalendarAlt, FaClock, FaTrash, FaFlag } from "react-icons/fa";
import { useLocation } from "react-router-dom";
import api from "../api";
import "../styles/user/JourneyWidget.css";

const JourneyWidget = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [journeys, setJourneys] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // Journey to confirm delete
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: string }

  // Chỉ hiển thị widget khi ở trang /journey
  const isJourneyPage = location.pathname === "/journey";

  useEffect(() => {
    if (isOpen && isJourneyPage) {
      fetchJourneys();
    }
  }, [isOpen, isJourneyPage]);

  const fetchJourneys = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("journey/");
      setJourneys(response.data || []);
    } catch (error) {
      console.error("Error fetching journeys:", error);
      setJourneys([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Không render nếu không ở trang journey
  if (!isJourneyPage) return null;

  // Kiểm tra xem journey có phải là quá khứ không
  const isPastJourney = (dateString) => {
    const journeyDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    journeyDate.setHours(0, 0, 0, 0);
    return journeyDate < today;
  };

  // Hiển thị notification tạm thời
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Xóa journey
  const handleDeleteClick = (journeyId, e) => {
    e.stopPropagation();
    setConfirmDelete(journeyId);
  };

  const confirmDeleteJourney = async () => {
    if (!confirmDelete) return;

    setDeletingId(confirmDelete);
    try {
      await api.delete(`journey/?id=${confirmDelete}`);
      setJourneys(journeys.filter(j => j.id !== confirmDelete));
      if (selectedJourney?.id === confirmDelete) {
        setSelectedJourney(null);
      }
      showNotification('success', 'Journey deleted successfully!');
    } catch (error) {
      console.error("Error deleting journey:", error);
      showNotification('error', 'Failed to delete journey. Please try again.');
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const cancelDelete = () => {
    setConfirmDelete(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const MealCard = ({ meal, mealType, mealLabel }) => {
    if (!meal) {
      return (
        <div className="journey-meal-card empty">
          <div className="meal-icon">
            <FaUtensils />
          </div>
          <div className="meal-info">
            <span className="meal-type">{mealLabel}</span>
            <span className="meal-empty">Not selected</span>
          </div>
        </div>
      );
    }

    return (
      <div className="journey-meal-card">
        <div className="meal-icon">
          <FaUtensils />
        </div>
        <div className="meal-info">
          <span className="meal-type">{mealLabel}</span>
          <h4 className="meal-name">{meal.name}</h4>
          {meal.cuisine_type && (
            <span className="meal-cuisine">{meal.cuisine_type}</span>
          )}
          <div className="meal-details">
            {meal.average_rating && (
              <span className="meal-rating">
                <FaStar /> {Number(meal.average_rating).toFixed(1)}
              </span>
            )}
            {meal.price_range && (
              <span className="meal-price">{meal.price_range}</span>
            )}
          </div>
          {meal.address && (
            <p className="meal-address">
              <FaMapMarkerAlt /> {meal.address}
            </p>
          )}
        </div>
      </div>
    );
  };

  const JourneyDetail = ({ journey, onBack }) => {
    const isPast = isPastJourney(journey.date);
    
    return (
      <div className="journey-detail">
        <div className="journey-detail-header">
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
          <div className="journey-detail-title">
            <h3>
              <FaCalendarAlt /> {formatDate(journey.date)}
            </h3>
            {isPast && (
              <span className="past-flag" title="Past journey">
                <FaFlag /> Past
              </span>
            )}
          </div>
          <button 
            className="delete-btn-detail" 
            onClick={(e) => handleDeleteClick(journey.id, e)}
            disabled={deletingId === journey.id}
            title="Delete journey"
          >
            <FaTrash /> {deletingId === journey.id ? "Deleting..." : "Delete"}
          </button>
        </div>
        <div className="journey-meals">
          <MealCard meal={journey.breakfast} mealType="breakfast" mealLabel="🌅 Breakfast" />
          <MealCard meal={journey.lunch} mealType="lunch" mealLabel="☀️ Lunch" />
          <MealCard meal={journey.dinner} mealType="dinner" mealLabel="🌙 Dinner" />
        </div>
      </div>
    );
  };

  const JourneyList = () => (
    <div className="journey-list">
      {journeys.length === 0 ? (
        <div className="journey-empty">
          <FaRoute size={48} />
          <p>You don't have any journeys yet!</p>
          <span>Create a new food journey</span>
        </div>
      ) : (
        journeys.map((journey) => {
          const isPast = isPastJourney(journey.date);
          return (
            <div
              key={journey.id}
              className={`journey-item ${isPast ? 'past' : ''}`}
              onClick={() => setSelectedJourney(journey)}
            >
              {isPast && (
                <div className="past-badge" title="Past journey">
                  <FaFlag />
                </div>
              )}
              <div className="journey-item-header">
                <FaCalendarAlt />
                <span className="journey-date">{formatDate(journey.date)}</span>
              </div>
              <div className="journey-item-meals">
                <div className="mini-meal">
                  <span className="mini-meal-label">Breakfast:</span>
                  <span className="mini-meal-name">
                    {journey.breakfast?.name || "Not selected"}
                  </span>
                </div>
                <div className="mini-meal">
                  <span className="mini-meal-label">Lunch:</span>
                  <span className="mini-meal-name">
                    {journey.lunch?.name || "Not selected"}
                  </span>
                </div>
                <div className="mini-meal">
                  <span className="mini-meal-label">Dinner:</span>
                  <span className="mini-meal-name">
                    {journey.dinner?.name || "Not selected"}
                  </span>
                </div>
              </div>
              <div className="journey-item-footer">
                <div className="footer-left">
                  <FaClock />
                  <span>
                    Created: {new Date(journey.created_at).toLocaleDateString("en-US")}
                  </span>
                </div>
                <button
                  className="delete-btn"
                  onClick={(e) => handleDeleteClick(journey.id, e)}
                  disabled={deletingId === journey.id}
                  title="Delete journey"
                >
                  {deletingId === journey.id ? "..." : <FaTrash />}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="journey-widget-container">
      {isOpen && (
        <div className="journey-widget-popup">
          <div className="journey-widget-header">
            <div className="journey-header-title">
              <FaRoute size={18} />
              <span>My Journeys</span>
            </div>
            <FaTimes
              onClick={() => {
                setIsOpen(false);
                setSelectedJourney(null);
              }}
              className="journey-close-btn"
              title="Close"
            />
          </div>

          <div className="journey-widget-content">
            {isLoading ? (
              <div className="journey-loading">
                <div className="loading-spinner"></div>
                <span>Loading journeys...</span>
              </div>
            ) : selectedJourney ? (
              <JourneyDetail
                journey={selectedJourney}
                onBack={() => setSelectedJourney(null)}
              />
            ) : (
              <JourneyList />
            )}
          </div>

          <div className="journey-widget-footer">
            <button className="refresh-btn" onClick={fetchJourneys} disabled={isLoading}>
              🔄 Refresh
            </button>
          </div>

          {/* Notification */}
          {notification && (
            <div className={`journey-notification ${notification.type}`}>
              {notification.type === 'success' ? '✓' : '✕'} {notification.message}
            </div>
          )}

          {/* Confirm Delete Modal */}
          {confirmDelete && (
            <div className="journey-confirm-overlay">
              <div className="journey-confirm-modal">
                <div className="confirm-icon">
                  <FaTrash />
                </div>
                <h4>Delete Journey?</h4>
                <p>Are you sure you want to delete this journey? This action cannot be undone.</p>
                <div className="confirm-buttons">
                  <button className="confirm-cancel" onClick={cancelDelete}>
                    Cancel
                  </button>
                  <button 
                    className="confirm-delete" 
                    onClick={confirmDeleteJourney}
                    disabled={deletingId === confirmDelete}
                  >
                    {deletingId === confirmDelete ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isOpen && (
        <button
          className="journey-widget-bubble"
          onClick={() => setIsOpen(true)}
          title="View my journeys"
        >
          <FaRoute size={28} />
        </button>
      )}
    </div>
  );
};

export default JourneyWidget;
