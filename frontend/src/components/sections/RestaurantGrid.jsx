
import RestaurantCard from '../cards/RestaurantCard';
import '../../styles/user/HomePage.css';

function RestaurantGrid({ title, restaurants }) {
  return (
    <section className="restaurant-grid-section">
      <h2>{title}</h2>
      <div className="restaurants-grid">
        {restaurants.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} />
        ))}
      </div>
    </section>
  );
}

export default RestaurantGrid;