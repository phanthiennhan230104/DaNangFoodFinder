import '../../styles/HomePage.css';

function RestaurantCard({ restaurant }) {
  // Giả sử restaurant.image là URL của ảnh
  const imageUrl = restaurant.image || 'https://via.placeholder.com/300x200?text=Food+Image';

  return (
    <div className="restaurant-card">
      <img src={imageUrl} alt={restaurant.name} className="card-image" />
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