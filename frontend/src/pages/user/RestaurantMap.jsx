import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline,
    useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import "../../styles/user/RestaurantMap.css";

// ====== BOUNDS: Limit map within Da Nang city ======
// SW and NE corners (approx). Expanded by ~10km (~0.09° lat, ~0.094° lon) each direction
const DANANG_BOUNDS = L.latLngBounds([
    [15.62, 107.906], // southWest (expanded further vertically ~+10km)
    [16.53, 108.444], // northEast (expanded further vertically ~+10km)
]);

// Zoom limits to prevent seeing outside bounds when zoomed out
const MIN_ZOOM = 12;
const MAX_ZOOM = 18;

// ================== CAMERA CONTROL (fix zoom) ==================
const CameraControl = ({ focus }) => {
    const map = useMap();

    useEffect(() => {
        if (focus && map) {
            // Clamp focus into Da Nang bounds to avoid flying outside
            const sw = DANANG_BOUNDS.getSouthWest();
            const ne = DANANG_BOUNDS.getNorthEast();

            const lat = Math.max(sw.lat, Math.min(ne.lat, focus.lat));
            const lng = Math.max(sw.lng, Math.min(ne.lng, focus.lng));

            // Clamp zoom between MIN_ZOOM and MAX_ZOOM to avoid zooming out showing outside area
            const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, focus.zoom || 15));

            map.flyTo([lat, lng], targetZoom, {
                duration: 1.2,
            });
        }
    }, [focus, map]);

    return null;
};

// ================== CONFIG ==================
const DEFAULT_CENTER = { lat: 16.0678, lng: 108.2208 }; // Da Nang

// Fix default Leaflet icon when using a bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// User icon (blue)
const userIcon = new L.Icon({
    iconUrl:
        "https://cdn-icons-png.flaticon.com/512/684/684908.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
});

// ================== HELPER FUNCTIONS ==================
const normalizeRestaurant = (r) => {
    const lat = r.lat ?? r.latitude ?? null;
    const lng = r.lng ?? r.longitude ?? null;
    return { ...r, lat, lng };
};

const calcDistanceKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;

    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
};

const formatRating = (rating) => {
    if (!rating) return "N/A";
    const n = Number(rating);
    return isNaN(n) ? "N/A" : n.toFixed(1);
};

// ================== MAIN COMPONENT ==================
const RestaurantMap = () => {
    const [restaurants, setRestaurants] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [userLocation, setUserLocation] = useState(DEFAULT_CENTER);
    const [hasUserLocation, setHasUserLocation] = useState(false);
    const [loading, setLoading] = useState(false);
    const [routeCoords, setRouteCoords] = useState([]);
    const [error, setError] = useState("");
    const [mapFocus, setMapFocus] = useState(null);  // ⭐ For camera flyTo

    const mapRef = useRef(null);

    // ===== Get user location =====
    useEffect(() => {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                };
                setUserLocation(loc);
                setHasUserLocation(true);
            },
            () => setHasUserLocation(false)
        );
    }, []);

    // ===== Fetch restaurants =====
    const fetchRestaurants = async () => {
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/restaurants/map/");
            const data = await res.json();

            const normalized = (data || []).map(normalizeRestaurant);
            setRestaurants(normalized);
            setFiltered(normalized);
        } catch {
            setError("Unable to load restaurant list.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRestaurants();
    }, []);

    // ===== Search =====
    const handleSearch = async () => {
        if (!search.trim()) {
            setFiltered(restaurants);
            setSelectedId(null);
            setRouteCoords([]);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(
                `/api/restaurants/map/search/?q=${encodeURIComponent(search)}`
            );
            const data = await res.json();

            setFiltered(data.map(normalizeRestaurant));
        } catch {
            setError("Unable to search.");
        } finally {
            setLoading(false);
        }
    };

    const clearSearch = () => {
        setSearch("");
        setFiltered(restaurants);
        setSelectedId(null);
        setRouteCoords([]);
        setError("");
    };

    // ===== Geocode restaurant =====
    const geocodeRestaurant = async (r) => {
        if (!r.address) return alert("Restaurant has no address.");
        setLoading(true);

        try {
            const res = await fetch("/api/geocode/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: r.name, address: r.address }),
            });

            const data = await res.json();

            if (!data.lat || !data.lng) {
                alert("❌ Unable to find restaurant coordinates.");
                return;
            }

            // Update
            const updated = restaurants.map((item) =>
                item.id === r.id ? { ...item, lat: data.lat, lng: data.lng } : item
            );
            setRestaurants(updated);
            setFiltered(updated);

            // 🔥 Focus vào nhà hàng
            setMapFocus({ lat: data.lat, lng: data.lng, zoom: 16 });

        } catch {
            setError("Unable to locate the restaurant.");
        } finally {
            setLoading(false);
        }
    };

    // ===== Route =====
    const getRoute = async (r) => {
        if (!r.lat || !r.lng) return alert("Please locate the restaurant first!");

        setLoading(true);

        try {
            const res = await fetch("/api/route-osrm/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    start: userLocation,
                    end: { lat: r.lat, lng: r.lng },
                }),
            });

            const data = await res.json();

            setRouteCoords(data.coords || []);
            setSelectedId(r.id);

            if (data.coords?.length)
                setMapFocus(null);

        } catch {
            setError("Unable to calculate the route.");
        } finally {
            setLoading(false);
        }
    };

    // ===== Reset =====
    const handleReset = () => {
        setSearch("");
        setSelectedId(null);
        setRouteCoords([]);

        // CLEAR all lat/lng (reset location)
        const reset = restaurants.map((r) => ({ ...r, lat: null, lng: null }));
        setRestaurants(reset);
        setFiltered(reset);

        // 🔥 Zoom back to Da Nang center
        setMapFocus({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng, zoom: 13 });
    };

    // ===== Focus vị trí người dùng =====
    const focusUserLocation = () => {
        if (!hasUserLocation) return alert("Unable to get location.");

        setMapFocus({ lat: userLocation.lat, lng: userLocation.lng, zoom: 15 });
    };

    const restaurantsWithCoords = useMemo(
        () => filtered.filter((r) => r.lat && r.lng),
        [filtered]
    );

    return (
        <div className="map-page">

            {/* SIDEBAR */}
            <div className="restaurants-sidebar">
                <div className="sidebar-header">
                    <div>
                        <h3>Discover Restaurants</h3>
                        <p className="sidebar-subtitle">Da Nang • Cuisine near you</p>
                    </div>

                    <button className="map-control-button" onClick={handleReset}>
                        🔄 Reset
                    </button>
                </div>

                {/* Search */}
                <div className="search-container">
                    <div className="search-input-group">
                            <input
                            className="search-input"
                            placeholder="Search by name, address, dish..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        />

                        {search && (
                            <button className="clear-search-button" onClick={clearSearch}>
                                ✕
                            </button>
                        )}

                        <button className="search-button" onClick={handleSearch}>
                            🔍
                        </button>
                    </div>
                </div>

                {/* Loading & Error */}
                {loading && <div className="loading-message">⏳ Loading...</div>}
                {error && <div className="error-message">{error}</div>}

                {/* Stats */}
                <div className="stats-panel">
                    <small>Total: <strong>{restaurants.length}</strong></small>
                    <small>Shown: <strong>{filtered.length}</strong></small>
                    <small>With coordinates: <strong>{restaurantsWithCoords.length}</strong></small>
                </div>

                {/* Danh sách */}
                <div className="restaurants-list">
                    {filtered.map((r) => {
                        const distance =
                            hasUserLocation && r.lat && r.lng
                                ? calcDistanceKm(
                                    userLocation.lat,
                                    userLocation.lng,
                                    r.lat,
                                    r.lng
                                )
                                : null;

                        return (
                            <div
                                key={r.id}
                                className={
                                    "restaurant-card" +
                                    (selectedId === r.id ? " selected" : "")
                                }
                            >
                                {/* Ảnh */}
                                <div className="restaurant-thumb">
                                    <img
                                        src={
                                            r.image ||
                                            "https://source.unsplash.com/random/300x200/?vietnam,food"
                                        }
                                        alt={r.name}
                                    />
                                </div>

                                {/* Info */}
                                <div className="restaurant-info">
                                    <h4 className="restaurant-name">{r.name}</h4>
                                    <p className="restaurant-address">{r.address}</p>

                                    <div className="restaurant-meta">
                                        <span className="meta-tag">🍽 {r.cuisine_type}</span>
                                        <span className="meta-rating">⭐ {formatRating(r.average_rating)}</span>
                                    </div>

                                    {/* Khoảng cách */}
                                    <div className="distance-row">
                                        {distance ? (
                                            <span className="distance-chip">🛣️ {distance} km</span>
                                        ) : r.lat ? (
                                            <span className="distance-chip">📍 Located</span>
                                        ) : (
                                            <span className="distance-chip warn">⚠ Not located</span>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="card-actions">
                                        {!r.lat ? (
                                            <button
                                                className="geocode-single-button"
                                                onClick={() => geocodeRestaurant(r)}
                                            >
                                                📍 Locate
                                            </button>
                                        ) : (
                                            <button
                                                className="select-restaurant-button"
                                                onClick={() => getRoute(r)}
                                            >
                                                ➤ Directions
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* MAP */}
            <div className="map-container">
                {/* Nút điều khiển ở trên map */}
                    <div className="map-controls">
                    <button className="map-control-button" onClick={focusUserLocation}>
                        👤 My location
                    </button>
                </div>

                <MapContainer
                    center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
                    zoom={13}
                    scrollWheelZoom
                    className="leaflet-map"
                    // Giới hạn di chuyển trong Da Nang
                    maxBounds={DANANG_BOUNDS}
                    maxBoundsViscosity={1.0}
                    minZoom={MIN_ZOOM}
                    maxZoom={MAX_ZOOM}
                    whenCreated={(map) => {
                        mapRef.current = map;
                        try {
                            map.setMaxBounds(DANANG_BOUNDS);
                        } catch {
                            // ignore
                        }
                    }}
                >
                    {/* ⭐ CONTROLLER CAMERA */}
                    <CameraControl focus={mapFocus} />

                    <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />

                    {/* Marker user */}
                    {hasUserLocation && (
                        <Marker position={userLocation} icon={userIcon}>
                            <Popup>You are here</Popup>
                        </Marker>
                    )}

                    {/* Marker nhà hàng */}
                    {restaurantsWithCoords.map((r) => {
                        const distance =
                            hasUserLocation
                                ? calcDistanceKm(
                                    userLocation.lat,
                                    userLocation.lng,
                                    r.lat,
                                    r.lng
                                )
                                : null;

                        return (
                            <Marker key={r.id} position={[r.lat, r.lng]}>
                                <Popup>
                                    <div className="restaurant-popup">
                                        <h3>{r.name}</h3>
                                        <p>📍 {r.address}</p>

                                        {distance && (
                                            <p>
                                                🛣️ Distance from you {" "}
                                                <strong>{distance} km</strong>
                                            </p>
                                        )}

                                        <div className="popup-actions">
                                            <button
                                                className="direction-button primary"
                                                onClick={() => getRoute(r)}
                                            >
                                                ➤ Directions
                                                </button>

                                            <a
                                                className="direction-button secondary"
                                                href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
                                                target="_blank"
                                            >
                                                🗺 Google Maps
                                            </a>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}

                    {/* Route */}
                    {routeCoords.length > 0 && (
                        <Polyline
                            positions={routeCoords}
                            pathOptions={{ color: "red", weight: 4 }}
                        />
                    )}
                </MapContainer>
            </div>
        </div>
    );
};

export default RestaurantMap;