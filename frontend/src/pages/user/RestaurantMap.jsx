import React, { useState, useEffect, useMemo } from 'react';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline,
    useMap,
    useMapEvent,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Star, User, Utensils, RefreshCw, Search, Maximize, Minimize } from 'lucide-react';
import '../../styles/user/RestaurantMap.css';

/** Sửa icon mặc định của Leaflet khi dùng Vite */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ✅ Tập trung vào Đà Nẵng
const DEFAULT_CENTER = { lat: 16.0544, lng: 108.2022 };
const DA_NANG_BOUNDS = {
    north: 16.2000,
    south: 15.9000,
    east: 108.3500,
    west: 107.9000
};

/* ================= CẢI THIỆN: Geocoding chính xác ================= */

// ✅ Hàm chuẩn hóa địa chỉ Đà Nẵng
const normalizeDaNangAddress = (address) => {
    if (!address || typeof address !== 'string') return '';

    let normalized = address.trim();

    // Chuẩn hóa viết hoa/viết thường
    normalized = normalized.toLowerCase();

    // Chuẩn hóa các từ viết tắt phổ biến ở Đà Nẵng
    const replacements = {
        'đn': 'đà nẵng',
        'dn': 'đà nẵng',
        'q.': 'quận',
        'h.': 'huyện',
        'p.': 'phường',
        'tp.': 'thành phố',
        'tp': 'thành phố',
        'kv': 'khu vực',
        'khu ': 'khu ',
        'đ ': 'đường ',
        'ng ': 'ngõ ',
        'hg ': 'hẻm ',
    };

    // Apply replacements carefully so we don't collapse punctuation or neighboring words
    Object.keys(replacements).forEach(key => {
        const regex = new RegExp(`(^|\\s|,|\\.|-)${key}(?=\\s|,|\\.|-|$)`, 'gi');
        normalized = normalized.replace(regex, (m, p1) => `${p1}${replacements[key]}`);
    });

    // Normalize commas/spaces and collapse multiple spaces
    normalized = normalized.replace(/\s*,\s*/g, ', ').replace(/\s{2,}/g, ' ');

    // Fix common missing-space issues like 'giáphường' or 'phườngquận' introduced by bad input
    normalized = normalized.replace(/(phường|phuong)(?=[a-z])/g, '$1 ');
    normalized = normalized.replace(/(quận|quan)(?=[a-z])/g, '$1 ');

    // Đảm bảo có "Đà Nẵng" trong địa chỉ
    if (!normalized.includes('đà nẵng') && !normalized.includes('da nang')) {
        normalized += ', đà nẵng';
    }

    // Thêm "Vietnam" nếu chưa có
    if (!normalized.includes('việt nam') && !normalized.includes('vietnam')) {
        normalized += ', vietnam';
    }

    return normalized;
};

// ✅ Hàm trích xuất thông tin địa chỉ chi tiết
const extractAddressComponents = (address) => {
    const components = {
        street: '',
        ward: '',
        district: '',
        city: 'Đà Nẵng',
        country: 'Vietnam'
    };

    const lowerAddr = address.toLowerCase();

    // Các quận/huyện Đà Nẵng
    const districts = [
        'hải châu', 'thanh khê', 'sơn trà', 'ngũ hành sơn',
        'liên chiểu', 'cẩm lệ', 'hòa vang', 'hoàng sa', 'trường sa'
    ];

    // Tìm quận/huyện
    districts.forEach(district => {
        if (lowerAddr.includes(district)) {
            components.district = district;
        }
    });

    // Trích xuất số nhà và tên đường (đơn giản)
    const streetMatch = lowerAddr.match(/(\d+\s+)?([^,]+)(?=,)/);
    if (streetMatch) {
        components.street = streetMatch[0].trim();
    }

    return components;
};

// ✅ Hàm geocoding cải tiến với nhiều fallback
const geocodeAddress = async (address, restaurantName = '') => {
    try {
        const normalizedAddress = normalizeDaNangAddress(address);
        console.log(`🗺️ Đang định vị: "${address}" -> "${normalizedAddress}"`);

        // Strategy 1: Nominatim với query được tối ưu
        const nominatimQuery = encodeURIComponent(normalizedAddress);
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${nominatimQuery}&limit=5&countrycodes=vn&accept-language=vi`;

        let response = await fetch(nominatimUrl);

        if (!response.ok) {
            throw new Error(`Nominatim error: ${response.status}`);
        }

        let data = await response.json();

        // Lọc kết quả tốt nhất
        let bestResult = null;
        let highestScore = 0;

        if (data && data.length > 0) {
            data.forEach(result => {
                const score = calculateGeocodingConfidence(address, restaurantName, result);

                if (score > highestScore) {
                    highestScore = score;
                    bestResult = result;
                }
            });
        }

        // If initial results aren't confident, try a simplified retry using street + district
        if ((!bestResult || highestScore < 4) && address) {
            try {
                const comp = extractAddressComponents(address);
                const parts = [];
                if (comp.street) parts.push(comp.street);
                if (comp.district) parts.push(comp.district);
                parts.push('Đà Nẵng');
                parts.push('Vietnam');

                const simpleQuery = parts.filter(Boolean).join(', ');
                if (simpleQuery.trim()) {
                    console.log(`🔁 Thử truy vấn rút gọn: "${simpleQuery}"`);
                    const sUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simpleQuery)}&limit=3&countrycodes=vn&accept-language=vi`;
                    const sResp = await fetch(sUrl);
                    if (sResp.ok) {
                        const sData = await sResp.json();
                        if (sData && sData.length > 0) {
                            sData.forEach(result => {
                                const score = calculateGeocodingConfidence(address, restaurantName, result);
                                if (score > highestScore) {
                                    highestScore = score;
                                    bestResult = result;
                                }
                            });
                        }
                    }
                }
            } catch (err) {
                console.warn('Fallback simplified geocoding failed:', err);
            }
        }

        if (bestResult) {
            const lat = parseFloat(bestResult.lat);
            const lng = parseFloat(bestResult.lon || bestResult.lng);

            console.log(`✅ Định vị thành công: ${address} -> (${lat}, ${lng}) - Điểm tin cậy: ${highestScore}/10`);

            return {
                lat: lat,
                lng: lng,
                display_name: bestResult.display_name || bestResult.formatted_address,
                confidence: highestScore,
                geocoder: bestResult.geocoder || 'nominatim',
                address_components: extractAddressComponents(address)
            };
        }

        console.log(`❌ Không thể định vị: ${address}`);
        return null;

    } catch (error) {
        console.error('❌ Lỗi geocoding:', error);
        return null;
    }
};

// ✅ Tính điểm tin cậy cải tiến
const calculateGeocodingConfidence = (originalAddress, restaurantName, geocodedResult) => {
    const originalLower = originalAddress.toLowerCase();
    const geocodedLower = (geocodedResult.display_name || geocodedResult.formatted_address || '').toLowerCase();
    const geocodedType = geocodedResult.type || geocodedResult.types?.[0] || '';

    let score = 0;

    // ✅ Quan trọng: Kiểm tra thành phố Đà Nẵng
    const daNangKeywords = ['đà nẵng', 'da nang', 'thanh pho da nang'];
    const hasDaNang = daNangKeywords.some(keyword => geocodedLower.includes(keyword));
    if (hasDaNang) score += 3;

    // ✅ Quan trọng: Kiểm tra loại địa điểm
    const preferredTypes = ['restaurant', 'cafe', 'food', 'eating', 'amenity'];
    const isPreferredType = preferredTypes.some(type =>
        geocodedType.includes(type) || geocodedLower.includes(type)
    );
    if (isPreferredType) score += 2;

    // ✅ Kiểm tra quận/huyện Đà Nẵng
    const districts = ['hải châu', 'thanh khê', 'sơn trà', 'ngũ hành sơn', 'liên chiểu', 'cẩm lệ'];
    districts.forEach(district => {
        if (geocodedLower.includes(district)) score += 2;
        if (originalLower.includes(district)) score += 1;
    });

    // ✅ Kiểm tra số nhà
    const numberMatch = originalLower.match(/\d+/);
    if (numberMatch && geocodedLower.includes(numberMatch[0])) {
        score += 2;
    }

    // ✅ Kiểm tra tên đường
    const streetKeywords = ['đường', 'street', 'avenue', 'road'];
    streetKeywords.forEach(keyword => {
        if (originalLower.includes(keyword) && geocodedLower.includes(keyword)) {
            score += 1;
        }
    });

    // ✅ Kiểm tra tên nhà hàng trong kết quả
    if (restaurantName) {
        const nameWords = restaurantName.toLowerCase().split(' ').filter(word => word.length > 2);
        nameWords.forEach(word => {
            if (geocodedLower.includes(word)) score += 1;
        });
    }

    // ✅ Kiểm tra xem có trong bounds Đà Nẵng không
    const lat = parseFloat(geocodedResult.lat);
    const lng = parseFloat(geocodedResult.lon || geocodedResult.lng);
    if (isInDaNang(lat, lng)) {
        score += 2;
    } else {
        score -= 3; // Trừ điểm nếu ngoài Đà Nẵng
    }

    // ✅ Đảm bảo điểm không âm
    return Math.max(0, Math.min(10, score));
};

/* ================= CÁC HÀM TIỆN ÍCH ================= */

const toNumber = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
        const s = v.trim().replace(',', '.');
        const n = Number(s);
        return Number.isFinite(n) ? n : NaN;
    }
    return NaN;
};

// Helper to read a cookie (used for CSRF token)
const getCookie = (name) => {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return match ? match.pop() : '';
};

const isValidLatLng = (pt) =>
    pt &&
    Number.isFinite(pt.lat) &&
    Number.isFinite(pt.lng) &&
    pt.lat >= -90 &&
    pt.lat <= 90 &&
    pt.lng >= -180 &&
    pt.lng <= 180;

const isInDaNang = (lat, lng) => {
    return lat >= DA_NANG_BOUNDS.south &&
        lat <= DA_NANG_BOUNDS.north &&
        lng >= DA_NANG_BOUNDS.west &&
        lng <= DA_NANG_BOUNDS.east;
};

/* =============== MAP COMPONENTS =============== */

function FlyTo({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        if (center && isValidLatLng(center)) {
            map.flyTo(center, zoom, { duration: 0.6 });
        }
    }, [center, zoom, map]);
    return null;
}

function ZoomListener({ onZoom }) {
    useMapEvent('zoomend', (e) => onZoom(e.target.getZoom()));
    return null;
}

function FitBoundsOnRoute({ coords }) {
    const map = useMap();
    useEffect(() => {
        if (coords && coords.length > 1) {
            const valid = coords.filter(
                ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)
            );
            if (valid.length > 1) {
                map.fitBounds(L.latLngBounds(valid), { padding: [24, 24] });
            }
        }
    }, [coords, map]);
    return null;
}

function haversineKm(a, b) {
    if (!isValidLatLng(a) || !isValidLatLng(b)) return NaN;

    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const la1 = (a.lat * Math.PI) / 180;
    const la2 = (b.lat * Math.PI) / 180;
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

/* =============== COMPONENT CHÍNH =============== */

const RestaurantMap = () => {
    const [showMap, setShowMap] = useState(false);
    const [userLocation, setUserLocation] = useState(DEFAULT_CENTER);
    const [restaurants, setRestaurants] = useState([]);
    const [filteredRestaurants, setFilteredRestaurants] = useState([]);
    const [mapZoom, setMapZoom] = useState(13);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // ORS routing state
    const [routeCoords, setRouteCoords] = useState([]);
    const [routeDistanceKm, setRouteDistanceKm] = useState(null);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [routeError, setRouteError] = useState(null);

    // State cho chức năng tìm kiếm
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState(null);

    // State cho fullscreen mode
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Hàm toggle fullscreen
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            }).catch(err => {
                console.error('Error attempting to exit fullscreen:', err);
            });
        }
    };

    // Lắng nghe sự kiện fullscreen change
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // ✅ Hàm định vị lại một nhà hàng cụ thể với retry logic
    const geocodeSingleRestaurant = async (restaurantId, maxRetries = 2) => {
        const restaurant = restaurants.find(r => r.id === restaurantId);
        if (!restaurant) return false;

        console.log(`📍 Đang định vị lại: ${restaurant.name}`);

        // Mark in progress
        setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, geocoding_in_progress: true } : r));

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            console.log(`🔍 Định vị thử lần ${attempt + 1} cho: ${restaurant.name}`);
            const geocoded = await geocodeAddress(restaurant.address, restaurant.name);

            if (geocoded) {
                const updatedRestaurant = {
                    ...restaurant,
                    lat: geocoded.lat,
                    lng: geocoded.lng,
                    geocoded: true,
                    geocoding_in_progress: false,
                    geocoded_address: geocoded.display_name,
                    geocoding_confidence: geocoded.confidence,
                    geocoder_used: geocoded.geocoder,
                    in_da_nang: isInDaNang(geocoded.lat, geocoded.lng),
                    needs_geocoding: false,
                    address_components: geocoded.address_components,
                    show_distance: true
                };

                setRestaurants(prev => prev.map(r => r.id === restaurantId ? updatedRestaurant : r));
                setFilteredRestaurants(prev => prev.map(r => r.id === restaurantId ? updatedRestaurant : r));

                console.log(`✅ Đã định vị lại: ${restaurant.name} - Độ tin cậy: ${geocoded.confidence}/10`);
                return true;
            }

            if (attempt < maxRetries) {
                // small delay before retry
                await new Promise(res => setTimeout(res, 1000));
                continue;
            }

            // final failure: mark failed and clear in_progress
            const failedRestaurant = {
                ...restaurant,
                geocoding_in_progress: false,
                geocoding_failed: true,
                geocoding_retries: maxRetries + 1
            };

            setRestaurants(prev => prev.map(r => r.id === restaurantId ? failedRestaurant : r));
            setFilteredRestaurants(prev => prev.map(r => r.id === restaurantId ? failedRestaurant : r));

            console.log(`❌ Không thể định vị lại sau ${maxRetries + 1} lần thử: ${restaurant.name}`);
            return false;
        }
    };

    // ✅ CẢI THIỆN: Fetch restaurants với xử lý tọa độ ưu tiên
    const fetchRestaurants = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('🔄 Đang tải dữ liệu nhà hàng Đà Nẵng từ Python API...');

            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

            const endpoints = [
                `${apiUrl}/api/restaurants/`,
                `${apiUrl}/api/restaurants`,
                `${apiUrl}/restaurants/`,
                `${apiUrl}/restaurants`,
            ];

            let data = null;
            let successfulEndpoint = '';

            for (const endpoint of endpoints) {
                try {
                    console.log(`📡 Đang thử endpoint: ${endpoint}`);
                    const response = await fetch(endpoint);

                    if (response.ok) {
                        data = await response.json();
                        successfulEndpoint = endpoint;
                        console.log(`✅ Thành công với endpoint: ${endpoint}`);
                        break;
                    } else {
                        console.log(`❌ Endpoint ${endpoint}: ${response.status} ${response.statusText}`);
                    }
                } catch (err) {
                    console.log(`❌ Lỗi với ${endpoint}:`, err.message);
                }
            }

            if (!data) {
                throw new Error('Không thể kết nối đến Python API. Kiểm tra CORS trên server.');
            }

            console.log(`✅ Sử dụng endpoint thành công: ${successfulEndpoint}`);

            let restaurantsList = [];

            if (Array.isArray(data)) {
                restaurantsList = data;
            } else if (data.data && Array.isArray(data.data)) {
                restaurantsList = data.data;
            } else if (data.restaurants && Array.isArray(data.restaurants)) {
                restaurantsList = data.restaurants;
            } else if (data.results && Array.isArray(data.results)) {
                restaurantsList = data.results;
            } else if (typeof data === 'object') {
                const possibleArrays = Object.values(data).filter(item => Array.isArray(item));
                if (possibleArrays.length > 0) {
                    restaurantsList = possibleArrays[0];
                } else {
                    restaurantsList = [data];
                }
            }

            const cleanedRestaurants = restaurantsList
                .map((restaurant, index) => {
                    // ✅ ƯU TIÊN sử dụng tọa độ từ database trước
                    const lat = toNumber(
                        restaurant.lat ||
                        restaurant.latitude ||
                        (restaurant.location && restaurant.location.lat) ||
                        0
                    );

                    const lng = toNumber(
                        restaurant.lng ||
                        restaurant.longitude ||
                        (restaurant.location && restaurant.location.lng) ||
                        0
                    );

                    const address = restaurant.address ||
                        restaurant.dia_chi ||
                        'Đang cập nhật';

                    // ✅ Kiểm tra xem có tọa độ hợp lệ từ database không
                    const hasValidCoordsFromDB = isValidLatLng({ lat, lng });

                    // ✅ Kiểm tra xem nhà hàng có trong Đà Nẵng không
                    let in_da_nang = null;
                    if (hasValidCoordsFromDB) {
                        in_da_nang = isInDaNang(lat, lng);
                        console.log(`📍 ${restaurant.name}: Tọa độ từ DB - Lat: ${lat}, Lng: ${lng}, Trong ĐN: ${in_da_nang}`);
                    }

                    return {
                        id: restaurant.id || restaurant._id || `temp-${index}`,
                        name: restaurant.name || restaurant.ten_quan || 'Nhà hàng',
                        address: address,
                        cuisine: restaurant.cuisine ||
                            restaurant.cuisine_type ||
                            'Đa dạng',
                        rating: restaurant.rating || 0,
                        lat: lat,
                        lng: lng,
                        phone: restaurant.phone || restaurant.dien_thoai,
                        opening_hours: restaurant.opening_hours || restaurant.gio_mo_cua,
                        description: restaurant.description,
                        // ✅ Chỉ cần geocoding nếu KHÔNG có tọa độ hợp lệ từ database
                        // HOẶC có tọa độ nhưng nằm ngoài Đà Nẵng (có thể sai)
                        needs_geocoding: (!hasValidCoordsFromDB || (hasValidCoordsFromDB && !in_da_nang)) &&
                            address && address !== 'Đang cập nhật',
                        in_da_nang: in_da_nang,
                        has_coords_from_db: hasValidCoordsFromDB,
                        address_components: extractAddressComponents(address),
                        // Only show distance after user explicitly geocodes this restaurant
                        show_distance: false
                    };
                })
                .filter(restaurant => {
                    const hasAddress = restaurant.address &&
                        restaurant.address.trim() !== '' &&
                        restaurant.address !== 'Đang cập nhật';
                    const hasValidCoords = isValidLatLng(restaurant);

                    return hasValidCoords || hasAddress;
                });

            // ✅ Thống kê chi tiết
            const withCoordsFromDB = cleanedRestaurants.filter(r => r.has_coords_from_db).length;
            const daNangRestaurants = cleanedRestaurants.filter(r => r.in_da_nang === true).length;
            const outsideDaNang = cleanedRestaurants.filter(r => r.in_da_nang === false).length;
            const unknownLocation = cleanedRestaurants.filter(r => r.in_da_nang === null).length;
            const needsGeocoding = cleanedRestaurants.filter(r => r.needs_geocoding).length;

            console.log(`✅ Đã tải ${cleanedRestaurants.length} nhà hàng`);
            console.log(`📊 Thống kê:`);
            console.log(`   📍 Có tọa độ từ DB: ${withCoordsFromDB}`);
            console.log(`   🏠 Trong Đà Nẵng: ${daNangRestaurants}`);
            console.log(`   🚫 Ngoài Đà Nẵng: ${outsideDaNang}`);
            console.log(`   ❓ Chưa xác định: ${unknownLocation}`);
            console.log(`   🎯 Cần định vị: ${needsGeocoding}`);

            setRestaurants(cleanedRestaurants);
            setFilteredRestaurants(cleanedRestaurants);

        } catch (error) {
            console.error('❌ Lỗi khi tải dữ liệu từ Python API:', error);
            setError(`Lỗi: ${error.message}. Kiểm tra CORS trên server Python.`);
            setRestaurants([]);
            setFilteredRestaurants([]);
        } finally {
            setLoading(false);
        }
    };

    // ✅ Hàm tìm kiếm nhà hàng từ database
    const searchRestaurants = async (query) => {
        if (!query.trim()) {
            setFilteredRestaurants(restaurants);
            setSearchError(null);
            return;
        }

        try {
            setSearchLoading(true);
            setSearchError(null);

            console.log(`🔍 Đang tìm kiếm nhà hàng: "${query}"`);

            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

            // Gọi API tìm kiếm từ backend Python
            const response = await fetch(`${apiUrl}/api/restaurants/search?q=${encodeURIComponent(query)}`);

            if (!response.ok) {
                throw new Error('Không thể kết nối đến server tìm kiếm');
            }

            const data = await response.json();

            let searchResults = [];

            if (Array.isArray(data)) {
                searchResults = data;
            } else if (data.data && Array.isArray(data.data)) {
                searchResults = data.data;
            } else if (data.restaurants && Array.isArray(data.restaurants)) {
                searchResults = data.restaurants;
            } else if (data.results && Array.isArray(data.results)) {
                searchResults = data.results;
            }

            // Xử lý và làm sạch dữ liệu kết quả tìm kiếm
            const cleanedResults = searchResults.map((restaurant, index) => {
                const lat = toNumber(
                    restaurant.lat ||
                    restaurant.latitude ||
                    (restaurant.location && restaurant.location.lat) ||
                    0
                );

                const lng = toNumber(
                    restaurant.lng ||
                    restaurant.longitude ||
                    (restaurant.location && restaurant.location.lng) ||
                    0
                );

                const address = restaurant.address ||
                    restaurant.dia_chi ||
                    'Đang cập nhật';

                const hasValidCoordsFromDB = isValidLatLng({ lat, lng });

                let in_da_nang = null;
                if (hasValidCoordsFromDB) {
                    in_da_nang = isInDaNang(lat, lng);
                }

                return {
                    id: restaurant.id || restaurant._id || `search-${index}`,
                    name: restaurant.name || restaurant.ten_quan || 'Nhà hàng',
                    address: address,
                    cuisine: restaurant.cuisine ||
                        restaurant.cuisine_type ||
                        'Đa dạng',
                    rating: restaurant.rating || 0,
                    lat: lat,
                    lng: lng,
                    phone: restaurant.phone || restaurant.dien_thoai,
                    opening_hours: restaurant.opening_hours || restaurant.gio_mo_cua,
                    description: restaurant.description,
                    needs_geocoding: !hasValidCoordsFromDB && address && address !== 'Đang cập nhật',
                    in_da_nang: in_da_nang,
                    has_coords_from_db: hasValidCoordsFromDB,
                    is_search_result: true
                };
            }).filter(restaurant => {
                const hasAddress = restaurant.address &&
                    restaurant.address.trim() !== '' &&
                    restaurant.address !== 'Đang cập nhật';
                const hasValidCoords = isValidLatLng(restaurant);

                return hasValidCoords || hasAddress;
            });

            console.log(`✅ Tìm thấy ${cleanedResults.length} kết quả cho "${query}"`);

            if (cleanedResults.length === 0) {
                setSearchError(`Không tìm thấy nhà hàng nào phù hợp với "${query}"`);
            }

            setFilteredRestaurants(cleanedResults);

            // Nếu có kết quả, fly đến kết quả đầu tiên
            if (cleanedResults.length > 0 && isValidLatLng(cleanedResults[0])) {
                setUserLocation({ lat: cleanedResults[0].lat, lng: cleanedResults[0].lng });
                setMapZoom(15);
            }

        } catch (error) {
            console.error('❌ Lỗi tìm kiếm nhà hàng:', error);
            setSearchError(`Lỗi tìm kiếm: ${error.message}`);

            // Fallback: tìm kiếm cục bộ nếu API fail
            searchLocally(query);
        } finally {
            setSearchLoading(false);
        }
    };

    // ✅ Fallback: Tìm kiếm cục bộ trong danh sách đã có
    const searchLocally = (query) => {
        const lowerQuery = query.toLowerCase().trim();

        const results = restaurants.filter(restaurant => {
            const searchFields = [
                restaurant.name,
                restaurant.address,
                restaurant.cuisine,
                restaurant.description
            ].filter(Boolean).join(' ').toLowerCase();

            return searchFields.includes(lowerQuery);
        });

        if (results.length === 0) {
            setSearchError(`Không tìm thấy nhà hàng nào phù hợp với "${query}" trong dữ liệu hiện có`);
        } else {
            console.log(`🔍 Tìm thấy ${results.length} kết quả cục bộ cho "${query}"`);
        }

        setFilteredRestaurants(results);

        // Fly đến kết quả đầu tiên nếu có
        if (results.length > 0 && isValidLatLng(results[0])) {
            setUserLocation({ lat: results[0].lat, lng: results[0].lng });
            setMapZoom(15);
        }
    };

    // ✅ Hàm tìm kiếm địa chỉ trên bản đồ (geocoding)
    const searchAndGeocode = async () => {
        if (!searchQuery.trim()) {
            setFilteredRestaurants(restaurants);
            setSearchError(null);
            return;
        }

        await searchRestaurants(searchQuery);
    };

    // ✅ Hàm reset tìm kiếm
    const resetSearch = () => {
        setSearchQuery('');
        setFilteredRestaurants(restaurants);
        setSearchError(null);
        setUserLocation(DEFAULT_CENTER);
        setMapZoom(13);
    };

    // Chọn nhà hàng và hiển thị đường đi
    const selectRestaurantAndShowRoute = async (restaurant) => {
        // If the restaurant doesn't have valid coords, try to geocode it on demand
        if (!isValidLatLng(restaurant)) {
            const ok = window.confirm('Nhà hàng này chưa có tọa độ. Bạn muốn định vị địa chỉ (chỉ nhà hàng này) trước khi chỉ đường?');
            if (!ok) return;

            const success = await geocodeSingleRestaurant(restaurant.id);
            if (!success) {
                alert('Không thể định vị nhà hàng này. Vui lòng thử lại sau hoặc chỉnh sửa địa chỉ.');
                return;
            }

            // refresh the restaurant object reference after geocoding
            restaurant = restaurants.find(r => r.id === restaurant.id) || restaurant;
        }

        // ✅ Cảnh báo nếu nhà hàng ngoài Đà Nẵng
        if (restaurant.in_da_nang === false) {
            if (!window.confirm('⚠️ Nhà hàng này có vẻ nằm ngoài khu vực Đà Nẵng. Bạn có muốn tiếp tục không?')) {
                return;
            }
        }

        setSelectedRestaurant(restaurant);
        await getDirections(restaurant);
    };

    // Cache tuyến đường để tránh tính lại (sử dụng sessionStorage)

    // Hàm tạo key cho cache
    const getRouteCacheKey = (start, end) => `${start.lat.toFixed(4)},${start.lng.toFixed(4)}-${end.lat.toFixed(4)},${end.lng.toFixed(4)}`;

    // Hàm lấy tuyến đường từ cache (sessionStorage)
    const getCachedRoute = (start, end) => {
        try {
            const key = getRouteCacheKey(start, end);
            const cachedData = sessionStorage.getItem(`route_${key}`);
            if (cachedData) {
                const cached = JSON.parse(cachedData);
                if (cached && (Date.now() - cached.timestamp) < 30 * 60 * 1000) { // Cache 30 phút
                    console.log('✅ Sử dụng tuyến đường từ cache');
                    return cached.data;
                } else {
                    // Xóa cache cũ
                    sessionStorage.removeItem(`route_${key}`);
                }
            }
        } catch (err) {
            console.warn('Lỗi đọc cache:', err);
        }
        return null;
    };

    // Hàm lưu tuyến đường vào cache (sessionStorage)
    const setCachedRoute = (start, end, data) => {
        try {
            const key = getRouteCacheKey(start, end);
            const cacheData = {
                data,
                timestamp: Date.now()
            };
            sessionStorage.setItem(`route_${key}`, JSON.stringify(cacheData));
            console.log('💾 Đã lưu tuyến đường vào cache');
        } catch (err) {
            console.warn('Lỗi lưu cache:', err);
        }
    };

    // Gọi OpenRouteService để lấy tuyến đường (tối ưu hóa)
    const getDirections = async (r) => {
        try {
            setLoadingRoute(true);
            setRouteError(null);
            setRouteCoords([]);
            setRouteDistanceKm(null);

            const apiKey = import.meta.env.VITE_ORS_API_KEY;

            console.log('🔄 Đang tính toán tuyến đường... (ưu tiên OSRM -> proxy -> ORS)');

            const coordinates = [
                [userLocation.lng, userLocation.lat],
                [r.lng, r.lat],
            ];

            // Kiểm tra cache trước
            const cachedRoute = getCachedRoute(userLocation, r);
            if (cachedRoute) {
                console.log('✅ Sử dụng tuyến đường từ cache');
                setRouteCoords(cachedRoute.coords);
                setRouteDistanceKm(cachedRoute.distance);
                setLoadingRoute(false);
                return;
            }

            // Normalize base API URL and derive endpoints to avoid duplicate '/api/api'
            const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const base = String(rawApiUrl).replace(/\s+$/g, '').replace(/\/+$/g, '');
            const candidatePaths = ['api/route/', 'route/', 'api/calculate_route/'];
            const endpoints = candidatePaths.map(p => {
                const cleanP = p.replace(/^\/+/, '');
                if (base.endsWith('/api') && cleanP.startsWith('api/')) {
                    return `${base.replace(/\/+$/, '')}/${cleanP.replace(/^api\//, '')}`;
                }
                return `${base}/${cleanP}`;
            });

            let routeFound = false;
            let successfulEndpoint = '';
            let latlngs = [];
            let meters = null;

            // 1) ƯU TIÊN: OSRM public (miễn phí, ổn định)
            let retryCount = 0;
            const maxRetries = 2;
            const retryDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff

            while (retryCount <= maxRetries && !routeFound) {
                try {
                    console.log(`🔍 Thử OSRM public lần ${retryCount + 1}...`);
                    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${r.lng},${r.lat}?overview=full&geometries=geojson`;

                    // Tạo AbortController để timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    const resp = await fetch(osrmUrl, {
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'DaNangFoodFinder/1.0'
                        }
                    });
                    clearTimeout(timeoutId);

                    if (resp && resp.ok) {
                        const data = await resp.json();
                        if (data && data.routes && data.routes.length > 0) {
                            const route = data.routes[0];
                            const coords = route.geometry?.coordinates || [];
                            latlngs = coords.map(([lng, lat]) => [toNumber(lat), toNumber(lng)])
                                .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
                            meters = route.distance || null;
                            routeFound = latlngs.length > 0;
                            if (routeFound) successfulEndpoint = 'OSRM public';
                        }
                    } else {
                        console.log(`❌ OSRM failed (attempt ${retryCount + 1}):`, resp && resp.status);
                        if (retryCount < maxRetries) {
                            console.log(`⏳ Retry sau ${retryDelay(retryCount)}ms...`);
                            await new Promise(resolve => setTimeout(resolve, retryDelay(retryCount)));
                        }
                    }
                } catch (err) {
                    console.log(`🚫 OSRM error (attempt ${retryCount + 1}):`, err.message);
                    if (retryCount < maxRetries && !err.name.includes('AbortError')) {
                        console.log(`⏳ Retry sau ${retryDelay(retryCount)}ms...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay(retryCount)));
                    }
                }
                retryCount++;
            }

            // 2) Nếu OSRM thất bại, thử proxy endpoints
            if (!routeFound) {
                for (const endpoint of endpoints) {
                    try {
                        console.log(`🔍 Thử proxy endpoint: ${endpoint}`);

                        const csrftoken = getCookie('csrftoken');
                        const response = await fetch(endpoint, {
                            method: 'POST',
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
                            },
                            body: JSON.stringify({
                                coordinates: coordinates,
                                api_key: apiKey,
                            }),
                        });

                        if (!response) continue;
                        if (!response.ok) {
                            console.log(`❌ Proxy ${endpoint}: ${response.status}`);
                            continue;
                        }

                        const geo = await response.json();
                        const feature = geo.features?.[0] || geo;
                        const coords = feature?.geometry?.coordinates || feature?.geometry?.coordinates || [];
                        if (coords && coords.length > 0) {
                            latlngs = coords.map(([lng, lat]) => [toNumber(lat), toNumber(lng)])
                                .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
                            meters = feature?.properties?.summary?.distance || geo?.properties?.summary?.distance || null;
                            routeFound = latlngs.length > 0;
                            successfulEndpoint = endpoint;
                            if (routeFound) break;
                        }
                    } catch (err) {
                        console.log(`🚫 Lỗi proxy ${endpoint}:`, err.message);
                    }
                }
            }

            // 3) Cuối cùng thử direct ORS nếu có API key hợp lệ
            if (!routeFound && apiKey && apiKey !== 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjQ3NzE3OGM2MzgyZDY4MDNkOWZkMjBkOTYxZTFhZjZjZWZiYTk1MzkzNjNlOGEzZDQ0ODYzMWMwIiwiaCI6Im11cm11cjY0In0') {
                try {
                    console.log('🔍 Thử direct OpenRouteService...');
                    const orsUrl = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
                    const resp = await fetch(orsUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': apiKey,
                        },
                        body: JSON.stringify({ coordinates }),
                        timeout: 10000
                    });

                    if (resp && resp.ok) {
                        const geo = await resp.json();
                        const feature = geo.features?.[0] || geo;
                        const coords = feature?.geometry?.coordinates || [];
                        latlngs = coords.map(([lng, lat]) => [toNumber(lat), toNumber(lng)])
                            .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
                        meters = feature?.properties?.summary?.distance || null;
                        routeFound = latlngs.length > 0;
                        if (routeFound) successfulEndpoint = 'OpenRouteService (direct)';
                    } else {
                        console.log('❌ Direct ORS failed:', resp && resp.status);
                        if (resp && resp.status === 403) {
                            console.warn('Direct ORS returned 403. Likely cause: ORS blocks browser requests (CORS) or API key permissions.');
                        }
                    }
                } catch (err) {
                    console.log('🚫 Direct ORS error:', err.message);
                }
            }

            if (!routeFound) {
                throw new Error('Không tìm thấy tuyến đường qua các dịch vụ (OSRM, proxy, ORS)');
            }

            // Lưu vào cache
            const routeData = {
                coords: latlngs,
                distance: typeof meters === 'number' ? (meters / 1000).toFixed(1) : null
            };
            setCachedRoute(userLocation, r, routeData);

            setRouteCoords(latlngs);
            if (typeof meters === 'number') {
                setRouteDistanceKm((meters / 1000).toFixed(1));
            }

            console.log(`✅ Đã tính toán tuyến đường thành công qua: ${successfulEndpoint}`);

        } catch (e) {
            console.error('Route calculation error:', e);

            if (e.message.includes('API key')) {
                setRouteError(`Lỗi API key: ${e.message}. Vui lòng kiểm tra VITE_ORS_API_KEY trong file .env`);
            } else if (e.message.includes('proxy')) {
                setRouteError(`Lỗi proxy: ${e.message}. Kiểm tra Django server và endpoints.`);
            } else {
                setRouteError('Không lấy được tuyến đường. Sử dụng tính năng mở bản đồ bên ngoài.');

                // Fallback: vẽ đường thẳng và tính khoảng cách trực tiếp
                const directDistance = haversineKm(userLocation, { lat: r.lat, lng: r.lng });
                setRouteDistanceKm(directDistance.toFixed(1));
                setRouteCoords([
                    [userLocation.lat, userLocation.lng],
                    [r.lat, r.lng],
                ]);
            }
        } finally {
            setLoadingRoute(false);
        }
    };

    // Xoá đường đi đã chọn
    const clearRoute = () => {
        setRouteCoords([]);
        setRouteDistanceKm(null);
        setRouteError(null);
        setSelectedRestaurant(null);
    };

    // Mở chỉ đường ngoài (OSM)
    const openExternalDirections = (r) => {
        if (!isValidLatLng(r)) {
            alert('Nhà hàng này chưa có tọa độ để chỉ đường');
            return;
        }
        // Always open Google Maps directions directly (lat,lng)
        try {
            const start = `${encodeURIComponent(userLocation.lat)},${encodeURIComponent(userLocation.lng)}`;
            const end = `${encodeURIComponent(r.lat)},${encodeURIComponent(r.lng)}`;
            const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${start}&destination=${end}&travelmode=driving`;
            const win = window.open(gmapsUrl, '_blank');
            if (!win) {
                // popup blocked — open a search URL as a last resort
                const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.lat + ',' + r.lng)}`;
                window.open(fallback, '_blank');
            }
        } catch (err) {
            console.error('Failed to open Google Maps directions:', err);
        }
    };

    // Fetch restaurants khi component mount
    useEffect(() => {
        fetchRestaurants();
    }, []);

    // Lấy vị trí người dùng
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    if (isValidLatLng(next)) {
                        if (isInDaNang(next.lat, next.lng)) {
                            setUserLocation(next);
                            console.log('📍 Đã lấy vị trí người dùng trong Đà Nẵng');
                        } else {
                            console.log('⚠️ Vị trí người dùng nằm ngoài Đà Nẵng, sử dụng vị trí mặc định');
                        }
                    }
                },
                (error) => {
                    console.error('❌ Lỗi lấy vị trí người dùng:', error);
                }
            );
        }
    }, []);

    const center = useMemo(
        () => (isValidLatLng(userLocation) ? userLocation : DEFAULT_CENTER),
        [userLocation]
    );

    const getDistance = (r) => {
        if (!isValidLatLng(r)) return '?';
        const distance = haversineKm(userLocation, { lat: r.lat, lng: r.lng });
        return Number.isFinite(distance) ? distance.toFixed(1) : '?';
    };

    const stats = useMemo(() => {
        const total = filteredRestaurants.length;
        const withCoords = filteredRestaurants.filter(r => isValidLatLng(r)).length;
        const needsGeocoding = filteredRestaurants.filter(r => r.needs_geocoding).length;
        const inDaNang = filteredRestaurants.filter(r => r.in_da_nang === true).length;
        const outsideDaNang = filteredRestaurants.filter(r => r.in_da_nang === false).length;
        const fromDB = filteredRestaurants.filter(r => r.has_coords_from_db).length;
        const fromGeocoding = filteredRestaurants.filter(r => r.geocoded).length;
        const geocodingInProgress = filteredRestaurants.filter(r => r.geocoding_in_progress).length;
        const highConfidence = filteredRestaurants.filter(r => r.geocoding_confidence >= 7).length;
        const lowConfidence = filteredRestaurants.filter(r => r.geocoding_confidence && r.geocoding_confidence < 5).length;

        return {
            total, withCoords, needsGeocoding, inDaNang, outsideDaNang,
            fromDB, fromGeocoding, geocodingInProgress, highConfidence, lowConfidence
        };
    }, [filteredRestaurants]);

    const hasORSKey = useMemo(() => {
        const apiKey = import.meta.env.VITE_ORS_API_KEY;
        return apiKey && apiKey !== 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjJlZWZjM2U2N2JhNDUzODQxMzQzZDA0OGJmMDA2YTYxMzAxNzRlYzllY2VmMTM5YjA4OGQ3ZDIxIiwiaCI6Im11cm11cjY0In0';
    }, []);

    if (!showMap) {
        return (
            <div className="app-container">
                <div className="header">
                    <div className="header-content">
                        <h1 className="header-title">DaNang Food Finder</h1>
                        <div className="header-avatar">
                            <User size={20} color="#D84315" />
                        </div>
                    </div>
                </div>

                <div className="map-card">
                    <div className="map-icon-wrapper">
                        <MapPin size={40} color="#D84315" />
                    </div>
                    <h2 className="map-card-title">Khám phá ẩm thực Đà Nẵng</h2>
                    <p className="map-card-description">
                        Tìm kiếm các nhà hàng ngon tại Đà Nẵng với bản đồ tương tác và định vị địa chỉ chính xác
                    </p>
                    <button onClick={() => setShowMap(true)} className="open-map-button">
                        Mở Bản Đồ Đà Nẵng
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="map-view">
            {/* Sidebar hiển thị danh sách nhà hàng */}
            <div className="restaurants-sidebar">
                <div className="sidebar-header">
                    <h3>Nhà Hàng Đà Nẵng</h3>
                    <div className="sidebar-controls">
                        <button onClick={clearRoute} className="clear-route-button">
                            Xoá Đường Đi
                        </button>
                        <button onClick={fetchRestaurants} className="refresh-button" disabled={loading}>
                            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                        </button>
                    </div>
                </div>

                {/* Thanh tìm kiếm nhà hàng */}
                <div className="search-container">
                    <div className="search-input-group">
                        <input
                            type="text"
                            placeholder="Tìm nhà hàng theo tên, địa chỉ, món ăn..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && searchAndGeocode()}
                            className="search-input"
                        />
                        <button
                            onClick={searchAndGeocode}
                            className="search-button"
                            disabled={searchLoading}
                        >
                            <Search size={16} />
                        </button>
                        {searchQuery && (
                            <button
                                onClick={resetSearch}
                                className="clear-search-button"
                                title="Xoá tìm kiếm"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    {searchLoading && (
                        <div className="search-loading">
                            🔄 Đang tìm kiếm...
                        </div>
                    )}
                    {searchError && (
                        <div className="error-message small">
                            ⚠️ {searchError}
                        </div>
                    )}
                </div>

                {/* Hiển thị lỗi */}
                {error && (
                    <div className="error-message">
                        ⚠️ {error}
                    </div>
                )}

                {/* Hiển thị loading */}
                {loading && (
                    <div className="loading-message">
                        🔄 Đang tải dữ liệu nhà hàng Đà Nẵng...
                    </div>
                )}

                {/* Thống kê chi tiết */}
                <div className="stats-panel">
                    <small>
                        📊 {stats.total} nhà hàng •
                        📍 {stats.inDaNang} trong Đà Nẵng •
                        🎯 {stats.needsGeocoding} cần định vị
                    </small>
                    <small>
                        📋 Tọa độ: {stats.fromDB} từ DB • {stats.fromGeocoding} từ GPS •
                        {stats.highConfidence > 0 && ` ✅ ${stats.highConfidence} tin cậy cao`}
                        {stats.lowConfidence > 0 && ` ⚠️ ${stats.lowConfidence} tin cậy thấp`}
                    </small>
                    {searchQuery && (
                        <small style={{ color: '#1976d2', fontWeight: 'bold' }}>
                            🔍 Đang hiển thị kết quả tìm kiếm cho: "{searchQuery}"
                        </small>
                    )}
                </div>

                <div className="restaurants-list">
                    {filteredRestaurants.length === 0 && !loading ? (
                        <div className="no-data-message">
                            {searchQuery ? '📭 Không tìm thấy nhà hàng phù hợp' : '📭 Không có dữ liệu nhà hàng'}
                        </div>
                    ) : (
                        filteredRestaurants.map(restaurant => (
                            <div
                                key={restaurant.id}
                                className={`restaurant-card ${selectedRestaurant?.id === restaurant.id ? 'selected' : ''} ${!isValidLatLng(restaurant) ? 'no-coordinates' : ''} ${restaurant.in_da_nang === false ? 'outside-danang' : ''}`}
                            >
                                <div className="restaurant-icon">
                                    <Utensils size={16} />
                                    {!isValidLatLng(restaurant) && (
                                        <span className="coordinate-warning" title="Chưa có tọa độ">⚠️</span>
                                    )}
                                </div>
                                <div className="restaurant-info">
                                    <h4>
                                        {restaurant.name}
                                        <span className={`coordinate-source ${restaurant.has_coords_from_db ? 'db' : restaurant.geocoded ? 'geocoded' : 'unknown'}`}>
                                            {restaurant.has_coords_from_db ? '📍DB' : restaurant.geocoded ? '📍GPS' : '❓'}
                                        </span>
                                        {restaurant.geocoder_used && (
                                            <span className="geocoder-badge" title={`Định vị bằng: ${restaurant.geocoder_used}`}>
                                                {restaurant.geocoder_used === 'google' ? '🔍G' : '🌐N'}
                                            </span>
                                        )}
                                    </h4>
                                    <p className="restaurant-cuisine">{restaurant.cuisine}</p>
                                    <p className="restaurant-address">{restaurant.address}</p>

                                    {/* Hiển thị thông tin geocoding */}
                                    {restaurant.geocoded && restaurant.geocoding_confidence && (
                                        <div className="geocoding-info">
                                            <small>
                                                📍 Đã định vị (độ tin cậy: {restaurant.geocoding_confidence}/10)
                                                {restaurant.geocoding_confidence < 5 && (
                                                    <span style={{ color: '#ff9800' }}> ⚠️ Độ tin cậy thấp</span>
                                                )}
                                                {restaurant.geocoding_confidence >= 7 && (
                                                    <span style={{ color: '#4caf50' }}> ✅ Độ tin cậy cao</span>
                                                )}
                                            </small>
                                        </div>
                                    )}

                                    <div className="restaurant-meta">
                                        <span className="rating">
                                            <Star size={14} color="#FFC107" fill="#FFC107" />
                                            {restaurant.rating}
                                        </span>
                                        {restaurant.show_distance && (
                                            <span className="distance">
                                                {getDistance(restaurant)} km
                                            </span>
                                        )}
                                    </div>

                                    {/* Nút định vị cho từng nhà hàng */}
                                    {restaurant.needs_geocoding && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                geocodeSingleRestaurant(restaurant.id);
                                            }}
                                            className="geocode-single-button"
                                            disabled={restaurant.geocoding_in_progress}
                                        >
                                            {restaurant.geocoding_in_progress ? '🔄 Đang định vị...' : '🗺️ Định Vị  '}
                                        </button>
                                    )}
                                </div>

                                <button
                                    className="select-restaurant-button"
                                    onClick={() => selectRestaurantAndShowRoute(restaurant)}
                                    title={isValidLatLng(restaurant) ? 'Chỉ đường' : 'Định vị rồi chỉ đường'}
                                >
                                    <Navigation size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Hiển thị thông tin tuyến đường */}
                {routeDistanceKm && (
                    <div className="route-info">
                        <h4>Thông Tin Tuyến Đường</h4>
                        <p><strong>Đến:</strong> {selectedRestaurant?.name}</p>
                        <p><strong>Khoảng cách:</strong> {routeDistanceKm} km</p>
                        <p><strong>Thời gian ước tính:</strong> {Math.round(Number(routeDistanceKm) * 2.5)} phút</p>
                    </div>
                )}
            </div>

            {/* Bản đồ */}
            <div className="map-container">
                {/* Loading overlay */}
                {(loading || searchLoading) && (
                    <div className="loading-overlay">
                        <div className="loading-spinner">
                            {searchLoading ? 'Đang tìm kiếm nhà hàng...' : 'Đang tải bản đồ Đà Nẵng...'}
                        </div>
                    </div>
                )}

                {/* Map Controls */}
                <div className="map-controls">
                    <button
                        onClick={toggleFullscreen}
                        className="refresh-button"
                        title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                    >
                        {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                    </button>
                </div>

                <MapContainer
                    center={center}
                    zoom={mapZoom}
                    style={{ width: '100%', height: '100%' }}
                    bounds={[
                        [DA_NANG_BOUNDS.south - 0.2, DA_NANG_BOUNDS.west - 0.2],
                        [DA_NANG_BOUNDS.north + 0.2, DA_NANG_BOUNDS.east + 0.2]
                    ]}
                >
                    <FlyTo center={center} zoom={mapZoom} />
                    <ZoomListener onZoom={setMapZoom} />

                    <TileLayer
                        attribution="&copy; OpenStreetMap contributors"
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Marker vị trí người dùng */}
                    {isValidLatLng(userLocation) && (
                        <Marker position={[userLocation.lat, userLocation.lng]}>
                            <Popup>
                                <strong>Vị trí của bạn</strong><br />
                                {isInDaNang(userLocation.lat, userLocation.lng) ? '📍 Trong khu vực Đà Nẵng' : '⚠️ Ngoài khu vực Đà Nẵng'}
                            </Popup>
                        </Marker>
                    )}

                    {/* Markers nhà hàng - chỉ hiển thị những nhà hàng có tọa độ hợp lệ */}
                    {filteredRestaurants.filter(isValidLatLng).map((r) => (
                        <Marker
                            key={r.id}
                            position={[r.lat, r.lng]}
                            eventHandlers={{
                                click: () => {
                                    selectRestaurantAndShowRoute(r);
                                },
                            }}
                        >
                            <Popup>
                                <div className="restaurant-popup">
                                    <h3>
                                        {r.name}
                                        <span className={`coordinate-source ${r.has_coords_from_db ? 'db' : r.geocoded ? 'geocoded' : 'unknown'}`}>
                                            {r.has_coords_from_db ? '📍DB' : r.geocoded ? '📍GPS' : '❓'}
                                        </span>
                                        {r.geocoder_used && (
                                            <span className="geocoder-badge" title={`Định vị bằng: ${r.geocoder_used}`}>
                                                {r.geocoder_used === 'google' ? '🔍G' : '🌐N'}
                                            </span>
                                        )}
                                    </h3>
                                    <p><strong>Ẩm thực:</strong> {r.cuisine}</p>
                                    <p><strong>Địa chỉ:</strong> {r.address}</p>
                                    <p className="rating-line">
                                        <Star size={16} color="#FFC107" fill="#FFC107" />
                                        {r.rating}
                                    </p>
                                    <p><strong>Cách bạn:</strong> {getDistance(r)} km</p>

                                    {/* ✅ Hiển thị cảnh báo vị trí */}
                                    {r.in_da_nang === false && (
                                        <p style={{ color: '#ff6b35', fontWeight: 'bold' }}>
                                            ⚠️ Có thể ngoài khu vực Đà Nẵng
                                        </p>
                                    )}

                                    {r.geocoded && r.geocoding_confidence && (
                                        <p>
                                            <small>
                                                📍 Đã định vị (độ tin cậy: {r.geocoding_confidence}/10)
                                                {r.geocoding_confidence < 5 && ' ⚠️ Độ tin cậy thấp'}
                                                {r.geocoding_confidence >= 7 && ' ✅ Độ tin cậy cao'}
                                            </small>
                                        </p>
                                    )}

                                    {r.description && (
                                        <p><strong>Mô tả:</strong> {r.description}</p>
                                    )}

                                    <button
                                        onClick={() => selectRestaurantAndShowRoute(r)}
                                        className="direction-button"
                                        disabled={loadingRoute || !hasORSKey}
                                    >
                                        <Navigation size={20} />
                                        {loadingRoute ? 'Đang tính tuyến...' :
                                            !hasORSKey ? 'Định vị thành công' : 'Chỉ Đường'}
                                    </button>

                                    <button
                                        onClick={() => openExternalDirections(r)}
                                        className="direction-button direction-button--secondary"
                                        style={{ marginTop: 8 }}
                                    >
                                        <Navigation size={20} />
                                        Mở Google Map
                                    </button>

                                    {routeError && (
                                        <p style={{ color: '#d33', marginTop: 8 }}>{routeError}</p>
                                    )}

                                    {!hasORSKey && (
                                        <p style={{ color: '#f57c00', marginTop: 8, fontSize: '12px' }}>
                                        </p>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Vẽ tuyến đường */}
                    {routeCoords.length > 0 && (
                        <>
                            <Polyline
                                positions={routeCoords}
                                color="blue"
                                weight={5}
                                opacity={0.7}
                            />
                            <FitBoundsOnRoute coords={routeCoords} />
                        </>
                    )}
                </MapContainer>
            </div>
        </div>
    );
};

export default RestaurantMap;