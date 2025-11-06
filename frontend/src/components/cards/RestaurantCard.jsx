import '../../styles/user/HomePage.css';

function RestaurantCard({ restaurant }) {
  const imageUrl = restaurant.image;

  return (
    <div className="restaurant-card" translate="no" data-no-translate>
      <img src={imageUrl} alt={restaurant.name} className="card-image" />
      <div className="card-content">
        <h3 className="card-title" data-no-translate>{restaurant.name}</h3>
        <p className="card-address" data-no-translate>{restaurant.address}</p>
        <div className="card-footer" data-no-translate>
          <span className="card-rating">⭐ {restaurant.average_rating}</span>
          <span className="card-cuisine">{restaurant.cuisine_type}</span>
        </div>
      </div>
    </div>
  );
}

export default RestaurantCard;
