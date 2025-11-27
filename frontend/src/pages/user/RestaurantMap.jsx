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

// ====== BOUNDS: Giới hạn map trong thành phố Đà Nẵng ======
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
const DEFAULT_CENTER = { lat: 16.0678, lng: 108.2208 }; // Đà Nẵng

// Fix icon mặc định của Leaflet khi dùng bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Icon user riêng màu xanh
const userIcon = new L.Icon({
    iconUrl:
        "https://cdn-icons-png.flaticon.com/512/684/684908.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
});

// ================== HÀM TIỆN ÍCH ==================
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
    if (!rating) return "Chưa có";
    const n = Number(rating);
    return isNaN(n) ? "Chưa có" : n.toFixed(1);
};

// ================== COMPONENT CHÍNH ==================
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

    // ===== Lấy vị trí người dùng =====
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

    // ===== Lấy danh sách nhà hàng =====
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
            setError("Không thể tải danh sách nhà hàng.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRestaurants();
    }, []);

    // ===== Tìm kiếm =====
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
            setError("Không thể tìm kiếm.");
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

    // ===== Định vị nhà hàng =====
    const geocodeRestaurant = async (r) => {
        if (!r.address) return alert("Nhà hàng chưa có địa chỉ.");
        setLoading(true);

        try {
            const res = await fetch("/api/geocode/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: r.name, address: r.address }),
            });

            const data = await res.json();

            if (!data.lat || !data.lng) {
                alert("❌ Không tìm thấy tọa độ nhà hàng.");
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
            setError("Không thể định vị nhà hàng.");
        } finally {
            setLoading(false);
        }
    };

    // ===== Tuyến đường =====
    const getRoute = async (r) => {
        if (!r.lat || !r.lng) return alert("Cần định vị trước!");

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
            setError("Không thể tính tuyến đường.");
        } finally {
            setLoading(false);
        }
    };

    // ===== Reset =====
    const handleReset = () => {
        setSearch("");
        setSelectedId(null);
        setRouteCoords([]);

        // XÓA toàn bộ lat/lng (reset định vị)
        const reset = restaurants.map((r) => ({ ...r, lat: null, lng: null }));
        setRestaurants(reset);
        setFiltered(reset);

        // 🔥 Zoom về trung tâm ĐN
        setMapFocus({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng, zoom: 13 });
    };

    // ===== Focus vị trí người dùng =====
    const focusUserLocation = () => {
        if (!hasUserLocation) return alert("Không lấy được vị trí.");

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
                        <h3>Khám phá nhà hàng</h3>
                        <p className="sidebar-subtitle">Đà Nẵng • Ẩm thực quanh bạn</p>
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
                            placeholder="Tìm theo tên, địa chỉ, món ăn..."
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
                {loading && <div className="loading-message">⏳ Đang xử lý...</div>}
                {error && <div className="error-message">{error}</div>}

                {/* Stats */}
                <div className="stats-panel">
                    <small>Tổng: <strong>{restaurants.length}</strong></small>
                    <small>Hiển thị: <strong>{filtered.length}</strong></small>
                    <small>Có tọa độ: <strong>{restaurantsWithCoords.length}</strong></small>
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
                                            <span className="distance-chip">📍 Đã định vị</span>
                                        ) : (
                                            <span className="distance-chip warn">⚠ Chưa định vị</span>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="card-actions">
                                        {!r.lat ? (
                                            <button
                                                className="geocode-single-button"
                                                onClick={() => geocodeRestaurant(r)}
                                            >
                                                📍 Định vị
                                            </button>
                                        ) : (
                                            <button
                                                className="select-restaurant-button"
                                                onClick={() => getRoute(r)}
                                            >
                                                ➤ Chỉ đường
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
                        👤 Vị trí của tôi
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
                            <Popup>Bạn đang ở đây</Popup>
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
                                                🛣️ Cách bạn{" "}
                                                <strong>{distance} km</strong>
                                            </p>
                                        )}

                                        <div className="popup-actions">
                                            <button
                                                className="direction-button primary"
                                                onClick={() => getRoute(r)}
                                            >
                                                ➤ Chỉ đường
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