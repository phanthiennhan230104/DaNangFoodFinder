import api from "../api";

export async function fetchFavorites() {
  const res = await api.get("favorites/");
  return res.data; // array of favorite objects
}

export async function addFavorite(restaurantId) {
  const res = await api.post("favorites/", { restaurant_id: restaurantId });
  return res.data;
}

export async function deleteFavorite(restaurantId) {
  const res = await api.delete(`favorites/${restaurantId}/`);
  return res.status === 204;
}

export default { fetchFavorites, addFavorite, deleteFavorite };
