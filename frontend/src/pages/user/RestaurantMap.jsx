import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Circle,
    Polyline,
    useMap,
    useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import "../../styles/user/RestaurantMap.css";
import api from "../../api";

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
    const [mapBounds, setMapBounds] = useState(null);
    // Distance filter (km) for nearby restaurants slider (1..30 km)
    const [distanceKm, setDistanceKm] = useState(5);
    // Reference point mode: 'user' = use geolocation, 'map' = use current map center
    const [refPointMode, setRefPointMode] = useState("user");

    // Small helper to keep bounds in state so we can avoid rendering offscreen markers
    const MapBoundsUpdater = () => {
        useMapEvents({
            moveend: (e) => setMapBounds(e.target.getBounds()),
            zoomend: (e) => setMapBounds(e.target.getBounds()),
        });
        return null;
    };

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
            console.debug("Requesting restaurants from:", api.defaults.baseURL + "restaurants/map/");
            const resp = await api.get("restaurants/map/");
            const data = resp.data;

            const normalized = (data || []).map(normalizeRestaurant);

            // Log statistics about loaded restaurants
            const withCoords = normalized.filter(r => r.lat && r.lng);
            const withoutCoords = normalized.filter(r => !r.lat || !r.lng);
            console.log(`📊 Loaded ${normalized.length} restaurants`);
            console.log(`   ✓ With coordinates: ${withCoords.length} (shown on map immediately)`);
            console.log(`   ⚠ Without coordinates: ${withoutCoords.length} (will be auto-geocoded)`);

            setRestaurants(normalized);
            setFiltered(normalized);
        } catch (err) {
            console.error("fetchRestaurants error:", err);
            const msg = err?.response?.data?.detail || err.message || "Không thể tải danh sách nhà hàng.";
            setError(`Không thể tải danh sách nhà hàng. ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRestaurants();
    }, []);

    // Auto-geocode missing coordinates (run once after restaurants load)
    const geocodeRunRef = useRef(false);
    useEffect(() => {
        if (geocodeRunRef.current) return;
        if (!restaurants || restaurants.length === 0) return;

        const missing = restaurants.filter((r) => !r.latitude || !r.longitude);
        if (missing.length === 0) {
            console.log("✅ All restaurants have coordinates - no auto-geocoding needed");
            geocodeRunRef.current = true;
            return;
        }

        geocodeRunRef.current = true;
        console.log(`🔄 Starting auto-geocoding for ${missing.length} restaurants without coordinates...`);

        (async () => {
            // Geocode ALL missing restaurants, but with reasonable rate limiting
            // Nominatim allows ~1 request/second per IP, so process in groups of 3 with 1.5s delay
            const concurrency = 3;
            const delay = (ms) => new Promise((res) => setTimeout(res, ms));
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < missing.length; i += concurrency) {
                const batch = missing.slice(i, i + concurrency);
                const batchNum = Math.floor(i / concurrency) + 1;
                console.log(`   Batch ${batchNum}: Processing ${batch.length} restaurants...`);

                await Promise.all(
                    batch.map(async (r) => {
                        if (!r.address) return;
                        try {
                            const resp = await api.post("geocode/", {
                                restaurant_id: r.id,
                                name: r.name,
                                address: r.address
                            });
                            const data = resp.data;
                            if (data?.lat && data?.lng) {
                                setRestaurants((prev) =>
                                    prev.map((item) => (item.id === r.id ? { ...item, lat: data.lat, lng: data.lng, latitude: data.lat, longitude: data.lng } : item))
                                );
                                successCount++;
                                console.log(`   ✓ ${r.name}: (${data.lat.toFixed(4)}, ${data.lng.toFixed(4)})`);
                            } else {
                                failCount++;
                                console.warn(`   ✗ ${r.name}: No coordinates found`);
                            }
                        } catch (err) {
                            failCount++;
                            console.warn(`   ✗ ${r.name}: ${err?.response?.status || err.message}`);
                        }
                    })
                );

                // Wait between batches to respect API rate limits
                if (i + concurrency < missing.length) {
                    await delay(1500);
                }
            }
            console.log(`✅ Auto-geocoding complete: ${successCount}/${missing.length} success, ${failCount} failed`);
        })();
    }, [restaurants]);

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
            const resp = await api.get("restaurants/map/search/", { params: { q: search } });
            const data = resp.data;

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

    // Debounce search input: trigger search 350ms after user stops typing
    useEffect(() => {
        const handler = setTimeout(async () => {
            if (!search.trim()) {
                setFiltered(restaurants);
                setSelectedId(null);
                setRouteCoords([]);
                return;
            }

            setLoading(true);
            try {
                const resp = await api.get("restaurants/map/search/", { params: { q: search } });
                const data = resp.data;
                setFiltered(data.map(normalizeRestaurant));
            } catch {
                setError("Không thể tìm kiếm.");
            } finally {
                setLoading(false);
            }
        }, 350);

        return () => clearTimeout(handler);
    }, [search, restaurants]);

    // ===== Định vị nhà hàng =====
    const geocodeRestaurant = async (r) => {
        if (!r.address) return alert("Nhà hàng chưa có địa chỉ.");
        setLoading(true);

        try {
            const resp = await api.post("geocode/", {
                restaurant_id: r.id,
                name: r.name,
                address: r.address
            });
            const data = resp.data;

            if (!data.lat || !data.lng) {
                alert("❌ Không tìm thấy tọa độ nhà hàng.");
                return;
            }

            // Update both UI coords and underlying fields so reset/filters behave correctly
            const updated = restaurants.map((item) =>
                item.id === r.id ? { ...item, lat: data.lat, lng: data.lng, latitude: data.lat, longitude: data.lng } : item
            );
            setRestaurants(updated);
            setFiltered(updated);

            // Show success message
            if (data.saved) {
                alert(`✓ Định vị thành công!\n${data.saved_to_db}`);
            }

            // 🔥 Focus vào nhà hàng
            setMapFocus({ lat: data.lat, lng: data.lng, zoom: 16 });

        } catch (err) {
            console.error("Geocode error:", err);
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
            const resp = await api.post("route-osrm/", {
                start: userLocation,
                end: { lat: r.lat, lng: r.lng },
            });

            const data = resp.data;

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
        // Reset only the active route and recenter the map — do NOT clear coordinates or re-run geocoding
        setRouteCoords([]);
        setMapFocus({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng, zoom: 13 });
    };

    // ===== Focus vị trí người dùng =====
    const focusUserLocation = () => {
        if (!hasUserLocation) return alert("Không lấy được vị trí.");

        setMapFocus({ lat: userLocation.lat, lng: userLocation.lng, zoom: 15 });
    };

    // Compute list of restaurants matching the search + distance filter.
    const displayedRestaurants = useMemo(() => {
        // reference point for distance: select according to refPointMode
        let ref = DEFAULT_CENTER;
        if (refPointMode === "user" && hasUserLocation) {
            ref = userLocation;
        } else if (refPointMode === "map" && mapRef.current && typeof mapRef.current.getCenter === "function") {
            const c = mapRef.current.getCenter();
            ref = { lat: c.lat, lng: c.lng };
        } else if (hasUserLocation) {
            ref = userLocation;
        }

        return filtered.filter((r) => {
            if (!r.lat || !r.lng) return false; // we only show located restaurants in "nearby" mode

            if (!distanceKm) return true;

            try {
                const distStr = calcDistanceKm(ref.lat, ref.lng, r.lat, r.lng);
                if (distStr === null) return false;
                const dist = parseFloat(distStr);
                return dist <= Number(distanceKm);
            } catch {
                return true;
            }
        });
    }, [filtered, distanceKm, hasUserLocation, userLocation, refPointMode]);

    // Markers should be limited by map bounds as well for performance
    const restaurantsWithCoords = useMemo(() => {
        if (!displayedRestaurants) return [];

        return displayedRestaurants.filter((r) => {
            if (!r.lat || !r.lng) return false;
            if (!mapBounds) return true;
            try {
                return mapBounds.contains(L.latLng(r.lat, r.lng));
            } catch {
                return true;
            }
        });
    }, [displayedRestaurants, mapBounds]);

    // reference point for circle drawing (used in map overlay)
    const refPoint = (() => {
        if (refPointMode === "user" && hasUserLocation) return userLocation;
        if (refPointMode === "map" && mapRef.current && typeof mapRef.current.getCenter === "function") {
            const c = mapRef.current.getCenter();
            return { lat: c.lat, lng: c.lng };
        }
        return hasUserLocation ? userLocation : DEFAULT_CENTER;
    })();

    return (
        <div className="map-page">

            {/* SIDEBAR */}
            <div className="restaurants-sidebar">
                <div className="sidebar-header">
                    <div>
                        <h3>Explore restaurants</h3>
                        <p className="sidebar-subtitle">Da Nang • Food around you</p>
                    </div>

                    <button className="map-control-button" onClick={handleReset}>
                        🔄 Reset
                    </button>
                </div>

                {/* Distance slider (1..30 km) */}
                <div className="distance-slider">
                    <label>
                        Distance: <strong>{distanceKm} km</strong>
                    </label>
                    <input
                        type="range"
                        min={1}
                        max={30}
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(Number(e.target.value))}
                    />
                    <small>Show restaurants within radius {distanceKm} km</small>

                    <div className="ref-toggle">
                        <label>
                            <input
                                type="radio"
                                name="refPoint"
                                value="user"
                                checked={refPointMode === "user"}
                                onChange={() => setRefPointMode("user")}
                            />
                            &nbsp; My location
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="refPoint"
                                value="map"
                                checked={refPointMode === "map"}
                                onChange={() => setRefPointMode("map")}
                            />
                            &nbsp; Mapping Center
                        </label>
                    </div>
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
                {loading && <div className="loading-message">⏳ Processing...</div>}
                {error && <div className="error-message">{error}</div>}

                {/* Stats */}
                <div className="stats-panel">
                    <small>Total: <strong>{restaurants.length}</strong></small>
                    <small>Displayed: <strong>{displayedRestaurants.length}</strong></small>
                    <small>With coordinates: <strong>{restaurantsWithCoords.length}</strong></small>
                </div>

                {/* Danh sách */}
                <div className="restaurants-list">
                    {displayedRestaurants.map((r) => {
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
                                        loading="lazy"
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
                                                📍 Location
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
                    <div className="distance-legend" title="Vùng hiển thị theo khoảng cách">
                        <div className="swatch" />
                        <div style={{ fontSize: 12 }}>
                            {refPointMode === "user" ? "Ref: You" : "Ref: Center"} • {distanceKm} km
                        </div>
                    </div>
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
                    {/* keep map bounds updated (reduce offscreen markers) */}
                    <MapBoundsUpdater />

                    {/* ⭐ CONTROLLER CAMERA */}
                    <CameraControl focus={mapFocus} />

                    <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />

                    {/* Marker user */}
                    {hasUserLocation && (
                        <Marker position={userLocation} icon={userIcon}>
                            <Popup>You are here</Popup>
                        </Marker>
                    )}

                    {/* Distance circle overlay (reference point) */}
                    {refPoint && distanceKm && (
                        <Circle
                            center={[refPoint.lat, refPoint.lng]}
                            radius={Number(distanceKm) * 1000}
                            pathOptions={{ color: "#ff6b6b", weight: 2, fillColor: "#ff6b6b", fillOpacity: 0.08 }}
                        />
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
                                                🛣️ Distance to you{" "}
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