import '../../styles/user/HomePage.css';
import { useAuth } from '../contexts/AuthContext';
import useFavorites from '../../hooks/useFavorites';

function RestaurantCard({ restaurant, onSelect }) {
  const imageUrl = restaurant.image;
  const { isAuthenticated } = useAuth();
  const { favoritesQuery, addFavorite, removeFavorite } = useFavorites();

  const isFavorited = Boolean((favoritesQuery.data || []).some((f) => f.restaurant?.id === restaurant.id));

  const toggleFav = async (e) => {
    e.stopPropagation();
    if (!isAuthenticated) return window.location.href = '/login';
    try {
      if (isFavorited) await removeFavorite(restaurant.id);
      else await addFavorite(restaurant.id);
    } catch (err) { console.error(err); }
  };

    return (
    <div
      className="restaurant-card"
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect && onSelect(restaurant)}
      onKeyDown={(e) => {
        if (!onSelect) return;
        if (e.key === 'Enter' || e.key === ' ') onSelect(restaurant);
      }}
    >
      <img
        src={imageUrl}
        alt={restaurant.name}
        className="card-image"
        onClick={() => onSelect && onSelect(restaurant)}
        style={{ cursor: onSelect ? 'pointer' : 'default' }}
      />
      {/* small heart button */}
      <button className={`card-heart ${isFavorited ? 'on' : ''}`} onClick={toggleFav} title={isFavorited ? 'Unfavorite' : 'Favorite'}>
        {isFavorited ? '❤' : '♡'}
      </button>

      {/* whole card is clickable now; removed info-button */}
      <div className="card-content">
        <h3 className="card-title">{restaurant.name}</h3>
        <p className="card-address">{restaurant.address}</p>
        <div className="card-footer">
          <span className="card-rating">⭐ {restaurant.average_rating}</span>
          <span className="card-cuisine">{restaurant.cuisine_type}</span>
        </div>
      </div>
    </div>
  );
}

export default RestaurantCard;
