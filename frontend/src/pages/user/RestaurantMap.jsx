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
import { useLocation } from "react-router-dom";

// ====== BOUNDS: Giới hạn map trong thành phố Đà Nẵng ======
// SW and NE corners (approx). Expanded by ~10km (~0.09° lat, ~0.094° lon) each direction
const DANANG_BOUNDS = L.latLngBounds([
    [15.62, 107.906],
    [16.53, 108.444],
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
    if (!rating) return "No rating";
    const n = Number(rating);
    return isNaN(n) ? "No rating" : n.toFixed(1);
};

const formatDistanceLabel = (d) => {
    if (d == null) return "0";
    const n = Number(d);
    return Number.isInteger(n) ? `${n}` : n.toFixed(1);
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
            const msg = err?.response?.data?.detail || err.message || "Unable to load restaurants.";
            setError(`Unable to load restaurants. ${msg}`);
        } finally {
            setLoading(false);
        }
    }; 

    useEffect(() => {
        fetchRestaurants();
    }, []);

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
                setError("Unable to search.");
            } finally {
                setLoading(false);
            }
        }, 350);

        return () => clearTimeout(handler);
    }, [search, restaurants]);

    // ===== Support linking from popup / external: if URL contains ?query=NAME, perform search and focus the map on the first/best match =====
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const q = params.get("query")?.trim();
        if (!q) return;

        (async () => {
            setLoading(true);
            setError("");
            try {
                const resp = await api.get("restaurants/map/search/", { params: { q } });
                const data = (resp.data || []).map(normalizeRestaurant);
                setFiltered(data);
                setSearch(q);

                // Prefer an item whose name includes the query (case-insensitive), otherwise take first result
                const low = q.toLowerCase();
                const matched = data.find(r => (r.name || "").toLowerCase().includes(low)) || data[0];

                if (matched) {
                    if (matched.lat && matched.lng) {
                        setMapFocus({ lat: matched.lat, lng: matched.lng, zoom: 16 });
                        setSelectedId(matched.id);
                    } else {
                        // try to geocode and then focus
                        await geocodeRestaurant(matched);
                        setSelectedId(matched.id);
                    }
                }
            } catch (err) {
                console.error("Query redirect error:", err);
                setError("Unable to perform query from link.");
            } finally {
                setLoading(false);
            }
        })();
    }, [location.search]);

    // ===== Định vị nhà hàng =====
    const geocodeRestaurant = async (r) => {
        if (!r.address) return alert("Restaurant has no address.");
        setLoading(true);

        try {
            const resp = await api.post("geocode/", {
                restaurant_id: r.id,
                name: r.name,
                address: r.address
            });
            const data = resp.data;

            if (!data.lat || !data.lng) {
                alert("❌ Could not find restaurant coordinates.");
                return;
            }
            const updated = restaurants.map((item) =>
                item.id === r.id ? { ...item, lat: data.lat, lng: data.lng, latitude: data.lat, longitude: data.lng } : item
            );
            setRestaurants(updated);
            setFiltered(updated);

            if (data.saved) {
                alert(`✓ Located successfully!\n${data.saved_to_db}`);
            }

            setMapFocus({ lat: data.lat, lng: data.lng, zoom: 16 });

        } catch (err) {
            console.error("Geocode error:", err);
            setError("Unable to locate restaurant.");
        } finally {
            setLoading(false);
        }
    }; 

    // ===== Tuyến đường =====
    const getRoute = async (r) => {
        if (!r.lat || !r.lng) return alert("Please locate the restaurant first!");

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
            setError("Unable to calculate route.");
        } finally {
            setLoading(false);
        }
    };

    
    // ===== Reset =====
    const handleReset = () => {

        setRouteCoords([]);
        setMapFocus({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng, zoom: 13 });
    };


    // ===== Focus vị trí người dùng =====
    const focusUserLocation = () => {
        if (!hasUserLocation) return alert("Unable to get location.");

        setMapFocus({ lat: userLocation.lat, lng: userLocation.lng, zoom: 15 });
    }; 


    const displayedRestaurants = useMemo(() => {

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
            if (!r.lat || !r.lng) return false;

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
                        <h3>Discover restaurants</h3>
                        <p className="sidebar-subtitle">Da Nang • Food near you</p>
                    </div>

                    <button className="map-control-button" onClick={handleReset}>
                        🔄 Reset
                    </button>
                </div>

                {/* Distance slider (1..30 km) */}
                <div className="distance-slider">
                    <label>
                        Distance: <strong>{formatDistanceLabel(distanceKm)} km</strong>
                    </label>
                    <input
                        type="range"
                        min={1}
                        max={30}
                        step={0.1}
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(Number(e.target.value))}
                    />
                    <small>Showing restaurants within {formatDistanceLabel(distanceKm)} km</small>

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
                            &nbsp; Map center
                        </label>
                    </div>
                </div>

                {/* Search */}
                <div className="search-container">
                    <div className="search-input-group">
                        <input
                            className="search-input"
                            placeholder="Search by name, address, cuisine..."
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
                    <small>Shown: <strong>{displayedRestaurants.length}</strong></small>
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
                                            "https://source.unsplash.com/random/400x300/?vietnam,food"
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
                    <div className="distance-legend" title="Area shown by distance">
                        <div className="swatch" />
                        <div style={{ fontSize: 12 }}>
                            {refPointMode === "user" ? "Ref: You" : "Ref: Map center"} • {formatDistanceLabel(distanceKm)} km
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
                                        <div className="popup-header">
                                            <img
                                                className="popup-image"
                                                src={
                                                    r.image ||
                                                    "https://source.unsplash.com/random/400x300/?vietnam,food"
                                                }
                                                alt={r.name}
                                                loading="lazy"
                                            />
                                            <div className="popup-title">
                                                <h3>{r.name}</h3>
                                                <div className="popup-rating">⭐ {formatRating(r.average_rating)}</div>
                                            </div>
                                        </div>

                                        <p className="popup-address">📍 {r.address}</p>

                                        {distance && (
                                            <p>
                                                🛣️ {distance} km from you
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