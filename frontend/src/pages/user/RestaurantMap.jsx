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
    import { MapPin, Navigation, Star, User, Utensils, RefreshCw, Search, Maximize, Minimize, Home } from 'lucide-react';
    import '../../styles/user/RestaurantMap.css';

    /** Sửa icon mặc định của Leaflet khi dùng Vite */
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // ✅ Tập trung vào Đà Nẵng - điều chỉnh tọa độ trung tâm và phạm vi
    const DEFAULT_CENTER = { lat: 16.0678, lng: 108.2208 };
    const DA_NANG_BOUNDS = {
        north: 16.1800,
        south: 15.9500,
        east: 108.3600,
        west: 108.1000
    };

    /* ================= CẢI THIỆN: Geocoding chính xác ================= */

    // ✅ Hàm chuẩn hóa địa chỉ Đà Nẵng
    const normalizeDaNangAddress = (address) => {
        if (!address || typeof address !== 'string') return '';

        let normalized = address.trim();
        normalized = normalized.toLowerCase();

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

        Object.keys(replacements).forEach(key => {
            const regex = new RegExp(`(^|\\s|,|\\.|-)${key}(?=\\s|,|\\.|-|$)`, 'gi');
            normalized = normalized.replace(regex, (m, p1) => `${p1}${replacements[key]}`);
        });

        normalized = normalized.replace(/\s*,\s*/g, ', ').replace(/\s{2,}/g, ' ');
        normalized = normalized.replace(/(phường|phuong)(?=[a-z])/g, '$1 ');
        normalized = normalized.replace(/(quận|quan)(?=[a-z])/g, '$1 ');

        if (!normalized.includes('đà nẵng') && !normalized.includes('da nang')) {
            normalized += ', đà nẵng';
        }

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

        const districts = [
            'hải châu', 'thanh khê', 'sơn trà', 'ngũ hành sơn',
            'liên chiểu', 'cẩm lệ', 'hòa vang', 'hoàng sa', 'trường sa'
        ];

        districts.forEach(district => {
            if (lowerAddr.includes(district)) {
                components.district = district;
            }
        });

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

            const nominatimQuery = encodeURIComponent(normalizedAddress);
            const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${nominatimQuery}&limit=5&countrycodes=vn&accept-language=vi`;

            let response = await fetch(nominatimUrl);

            if (!response.ok) {
                throw new Error(`Nominatim error: ${response.status}`);
            }

            let data = await response.json();

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

        const daNangKeywords = ['đà nẵng', 'da nang', 'thanh pho da nang'];
        const hasDaNang = daNangKeywords.some(keyword => geocodedLower.includes(keyword));
        if (hasDaNang) score += 3;

        const preferredTypes = ['restaurant', 'cafe', 'food', 'eating', 'amenity'];
        const isPreferredType = preferredTypes.some(type =>
            geocodedType.includes(type) || geocodedLower.includes(type)
        );
        if (isPreferredType) score += 2;

        const districts = ['hải châu', 'thanh khê', 'sơn trà', 'ngũ hành sơn', 'liên chiểu', 'cẩm lệ'];
        districts.forEach(district => {
            if (geocodedLower.includes(district)) score += 2;
            if (originalLower.includes(district)) score += 1;
        });

        const numberMatch = originalLower.match(/\d+/);
        if (numberMatch && geocodedLower.includes(numberMatch[0])) {
            score += 2;
        }

        const streetKeywords = ['đường', 'street', 'avenue', 'road'];
        streetKeywords.forEach(keyword => {
            if (originalLower.includes(keyword) && geocodedLower.includes(keyword)) {
                score += 1;
            }
        });

        if (restaurantName) {
            const nameWords = restaurantName.toLowerCase().split(' ').filter(word => word.length > 2);
            nameWords.forEach(word => {
                if (geocodedLower.includes(word)) score += 1;
            });
        }

        const lat = parseFloat(geocodedResult.lat);
        const lng = parseFloat(geocodedResult.lon || geocodedResult.lng);
        if (isInDaNang(lat, lng)) {
            score += 2;
        } else {
            score -= 3;
        }

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

    /* =============== HÀM KIỂM TRA VÀ XÁC THỰC =============== */

    // ✅ Hàm kiểm tra và xác nhận địa chỉ trước khi chỉ đường
    const validateRestaurantLocation = (restaurant) => {
        if (!isValidLatLng(restaurant)) {
            return { valid: false, reason: 'Không có tọa độ hợp lệ' };
        }

        const inDaNang = isInDaNang(restaurant.lat, restaurant.lng);
        if (!inDaNang) {
            return {
                valid: false,
                reason: 'Nhà hàng có thể nằm ngoài khu vực Đà Nẵng'
            };
        }

        // Kiểm tra độ tin cậy geocoding
        if (restaurant.geocoding_confidence && restaurant.geocoding_confidence < 5) {
            return {
                valid: true,
                warning: 'Địa chỉ có độ tin cậy thấp, có thể không chính xác'
            };
        }

        return { valid: true };
    };

    // ✅ Hàm hiển thị thông tin chi tiết về địa chỉ
    const showAddressDetails = (restaurant) => {
        let details = `📋 **Thông tin địa chỉ:**\n`;
        details += `📍 Tên: ${restaurant.name}\n`;
        details += `🏠 Địa chỉ: ${restaurant.address}\n`;

        if (restaurant.has_coords_from_db) {
            details += `🗄️ Nguồn: Database\n`;
        } else if (restaurant.geocoded) {
            details += `🗺️ Nguồn: Geocoding\n`;
            details += `✅ Độ tin cậy: ${restaurant.geocoding_confidence}/10\n`;
            details += `🔧 Công cụ: ${restaurant.geocoder_used || 'unknown'}\n`;
        } else {
            details += `❓ Nguồn: Chưa xác định\n`;
        }

        details += `📌 Tọa độ: ${restaurant.lat?.toFixed(6)}, ${restaurant.lng?.toFixed(6)}\n`;

        const inDaNang = isInDaNang(restaurant.lat, restaurant.lng);
        details += inDaNang ? `📍 Trong Đà Nẵng: CÓ ✅` : `📍 Trong Đà Nẵng: KHÔNG ❌`;

        return details;
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

    function FitBoundsOnResults({ results, userLocation }) {
        const map = useMap();
        useEffect(() => {
            if (results && results.length > 0 && userLocation) {
                const validResults = results.filter(isValidLatLng);
                if (validResults.length > 0) {
                    // ✅ TẠO BOUNDS BAO GỒM CẢ VỊ TRÍ NGƯỜI DÙNG VÀ NHÀ HÀNG
                    const allPoints = [
                        [userLocation.lat, userLocation.lng],
                        ...validResults.map(r => [r.lat, r.lng])
                    ];

                    const bounds = L.latLngBounds(allPoints);
                    if (bounds.isValid()) {
                        setTimeout(() => {
                            map.fitBounds(bounds, {
                                padding: [40, 40],
                                maxZoom: 15
                            });
                        }, 100);
                    }
                }
            }
        }, [results, userLocation, map]);
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
        const [mapZoom, setMapZoom] = useState(12);
        const [selectedRestaurant, setSelectedRestaurant] = useState(null);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState(null);
        const [loadingProgress, setLoadingProgress] = useState(0);
        const [pagination, setPagination] = useState({
            currentPage: 1,
            totalPages: 1,
            pageSize: 100,
            total: 0,
            hasMore: true
        });

        // ORS routing state
        const [routeCoords, setRouteCoords] = useState([]);
        const [routeDistanceKm, setRouteDistanceKm] = useState(null);
        const [loadingRoute, setLoadingRoute] = useState(false);
        const [routeError, setRouteError] = useState(null);

        // State cho chức năng tìm kiếm
        const [searchQuery, setSearchQuery] = useState('');
        const [searchLoading, setSearchLoading] = useState(false);
        const [searchError, setSearchError] = useState(null);
        const [showSearchResults, setShowSearchResults] = useState(false);

        // State cho fullscreen mode
        const [isFullscreen, setIsFullscreen] = useState(false);

        // State cho reset
        const [isResetting, setIsResetting] = useState(false);

        // ✅ SỬA: State để theo dõi nhà hàng đã được định vị - sử dụng useMemo
        const geocodedRestaurants = useMemo(() =>
            new Set(restaurants.filter(r => r.is_ready_for_map).map(r => r.id)),
            [restaurants]
        );

        // ✅ SỬA: Hàm fit bounds cho kết quả tìm kiếm - CẬP NHẬT ĐỂ TRÁNH TRÙNG
        const fitMapToSearchResults = () => {
            const validResults = filteredRestaurants.filter(r =>
                isValidLatLng(r) && geocodedRestaurants.has(r.id)
            );

            if (validResults.length === 0) return;

            // ✅ THÊM: Tính bounds bao gồm cả vị trí người dùng và nhà hàng
            const allPoints = [
                [userLocation.lat, userLocation.lng],
                ...validResults.map(r => [r.lat, r.lng])
            ];

            setTimeout(() => {
                const map = document.querySelector('.leaflet-container')?._leaflet_map;
                if (map) {
                    const bounds = L.latLngBounds(allPoints);
                    if (bounds.isValid()) {
                        // ✅ THÊM: Padding để đảm bảo không bị che
                        map.fitBounds(bounds, {
                            padding: [40, 40],
                            maxZoom: 15
                        });
                    }
                }
            }, 500);
        };

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

        // ✅ Hàm reset toàn bộ dữ liệu NHƯNG giữ nguyên vị trí cá nhân
        const resetAllData = async () => {
            try {
                setIsResetting(true);
                setError(null);
                setSearchError(null);
                setRouteError(null);

                console.log('🔄 Đang reset dữ liệu nhà hàng Đà Nẵng...');

                // Reset tất cả state NHƯNG GIỮ VỊ TRÍ CÁ NHÂN
                setRestaurants([]);
                setFilteredRestaurants([]);
                setSelectedRestaurant(null);
                setRouteCoords([]);
                setRouteDistanceKm(null);
                setSearchQuery('');
                setLoadingProgress(0);
                setShowSearchResults(false);

                setPagination({
                    currentPage: 1,
                    totalPages: 1,
                    pageSize: 100,
                    total: 0,
                    hasMore: true
                });

                // Đợi một chút để UI cập nhật
                await new Promise(resolve => setTimeout(resolve, 500));

                // Tải lại dữ liệu mới
                await fetchRestaurants(1, true);

                console.log('✅ Reset dữ liệu thành công! Vị trí cá nhân được giữ nguyên.');

            } catch (error) {
                console.error('❌ Lỗi khi reset dữ liệu:', error);
                setError(`Lỗi reset: ${error.message}`);
            } finally {
                setIsResetting(false);
            }
        };

        // ✅ SỬA: Hàm định vị lại một nhà hàng cụ thể với retry logic
        const geocodeSingleRestaurant = async (restaurantId, maxRetries = 2) => {
            // robust id matching (number vs string) and support geocoding from search results
            const matchById = (list, id) => list.find(r => r && String(r.id) === String(id));

            let restaurant = matchById(restaurants, restaurantId);

            // If not present in master list, try the filtered (search) results and add to master
            if (!restaurant) {
                const fromFiltered = matchById(filteredRestaurants, restaurantId);
                if (!fromFiltered) return false;
                // Ensure master list includes this item so geocoded state and sets are consistent
                setRestaurants(prev => {
                    if (prev.some(r => String(r.id) === String(fromFiltered.id))) return prev;
                    return [...prev, fromFiltered];
                });
                // also ensure filtered list includes it (should already) and keep instances consistent
                setFilteredRestaurants(prev => {
                    if (prev.some(r => String(r.id) === String(fromFiltered.id))) return prev;
                    return [...prev, fromFiltered];
                });
                restaurant = fromFiltered;
            }

            console.log(`📍 Đang định vị lại: ${restaurant.name}`);

            setRestaurants(prev => prev.map(r => String(r.id) === String(restaurantId) ? { ...r, geocoding_in_progress: true } : r));
            setFilteredRestaurants(prev => prev.map(r => String(r.id) === String(restaurantId) ? { ...r, geocoding_in_progress: true } : r));

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
                        show_distance: true,
                        is_ready_for_map: true // ✅ ĐÁNH DẤU ĐÃ SẴN SÀNG
                    };

                    setRestaurants(prev => prev.map(r => String(r.id) === String(restaurantId) ? updatedRestaurant : r));
                    setFilteredRestaurants(prev => prev.map(r => String(r.id) === String(restaurantId) ? updatedRestaurant : r));

                    console.log(`✅ Đã định vị lại: ${restaurant.name} - Độ tin cậy: ${geocoded.confidence}/10`);

                    // ✅ THÊM: Tự động fit bounds sau khi định vị thành công
                    setTimeout(() => {
                        fitMapToSearchResults();
                        // Focus on the restaurant and open popup by selecting it
                        try {
                            focusOnRestaurant(updatedRestaurant);
                            setSelectedRestaurant(updatedRestaurant);
                        } catch (e) {
                            console.warn('Unable to focus/open popup:', e);
                        }
                    }, 300);

                    return true;
                }

                if (attempt < maxRetries) {
                    await new Promise(res => setTimeout(res, 1000));
                    continue;
                }

                const failedRestaurant = {
                    ...restaurant,
                    geocoding_in_progress: false,
                    geocoding_failed: true,
                    geocoding_retries: maxRetries + 1
                };

                setRestaurants(prev => prev.map(r => String(r.id) === String(restaurantId) ? failedRestaurant : r));
                setFilteredRestaurants(prev => prev.map(r => String(r.id) === String(restaurantId) ? failedRestaurant : r));

                console.log(`❌ Không thể định vị lại sau ${maxRetries + 1} lần thử: ${restaurant.name}`);
                return false;
            }
        };

        // ✅ SỬA: Hàm chỉ đường với validation và kiểm tra trùng vị trí
        const selectRestaurantAndShowRoute = async (restaurant) => {
            // Kiểm tra xem nhà hàng đã được định vị chưa
            if (!geocodedRestaurants.has(restaurant.id) && !restaurant.has_coords_from_db) {
                const userChoice = window.confirm(
                    `📍 Nhà hàng này chưa được định vị trên bản đồ.\n\n` +
                    `Tên: ${restaurant.name}\n` +
                    `Địa chỉ: ${restaurant.address}\n\n` +
                    'Bạn có muốn định vị địa chỉ này không?'
                );

                if (userChoice) {
                    const success = await geocodeSingleRestaurant(restaurant.id);
                    if (!success) {
                        alert('Không thể định vị nhà hàng này. Vui lòng kiểm tra địa chỉ.');
                        return;
                    }
                } else {
                    return;
                }
            }

            // ✅ THÊM: Kiểm tra xem nhà hàng có trùng vị trí với người dùng không
            if (isValidLatLng(restaurant) && isValidLatLng(userLocation)) {
                const distance = haversineKm(userLocation, restaurant);
                if (distance < 0.01) { // Dưới 10m coi như trùng
                    const proceed = window.confirm(
                        '⚠️ Nhà hàng này có vị trí rất gần với bạn. ' +
                        'Có thể đây là lỗi định vị. Bạn có muốn tiếp tục chỉ đường không?'
                    );
                    if (!proceed) return;
                }
            }

            // Kiểm tra tính hợp lệ của địa chỉ
            const validation = validateRestaurantLocation(restaurant);

            if (!validation.valid) {
                alert(`⚠️ ${validation.reason}\n\nKhông thể chỉ đường đến nhà hàng này.`);
                return;
            }

            if (validation.warning) {
                const proceed = window.confirm(`⚠️ ${validation.warning}\n\nTiếp tục chỉ đường?`);
                if (!proceed) return;
            }

            setSelectedRestaurant(restaurant);
            await getDirections(restaurant);

            // ✅ THÊM: Zoom đến khu vực có cả người dùng và nhà hàng
            if (isValidLatLng(restaurant) && isValidLatLng(userLocation)) {
                setTimeout(() => {
                    const map = document.querySelector('.leaflet-container')?._leaflet_map;
                    if (map) {
                        const bounds = L.latLngBounds([
                            [userLocation.lat, userLocation.lng],
                            [restaurant.lat, restaurant.lng]
                        ]);
                        if (bounds.isValid()) {
                            map.fitBounds(bounds, { padding: [50, 50] });
                        }
                    }
                }, 100);
            }
        };

        // ✅ THÊM: Hàm focus vào nhà hàng cụ thể
        const focusOnRestaurant = (restaurant) => {
            if (!isValidLatLng(restaurant)) return;

            setUserLocation(prev => ({ ...prev })); // Trigger re-render
            setTimeout(() => {
                const map = document.querySelector('.leaflet-container')?._leaflet_map;
                if (map) {
                    map.setView([restaurant.lat, restaurant.lng], 15);
                }
            }, 100);
        };

        // ✅ CẢI THIỆN: Fetch tất cả nhà hàng (hỗ trợ nhiều định dạng phản hồi và phân trang)
        const fetchRestaurants = async (page = 1, resetData = false) => {
            // Accumulate across pages
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const pageSize = pagination.pageSize || 100;

            // Helper to build endpoint for a page based on a template
            const buildEndpoint = (template, p) => {
                if (!template) return `${apiUrl}/api/restaurants/?page=${p}&page_size=${pageSize}`;
                if (template.includes('{page}')) return template.replace('{page}', String(p)).replace('{page_size}', String(pageSize));
                // replace existing page param if present
                if (/[?&]page=/.test(template)) {
                    let t = template.replace(/([?&])page=\d+/,'$1page=' + p);
                    if (!/[?&]page_size=/.test(t)) t += (t.includes('?') ? '&' : '?') + `page_size=${pageSize}`;
                    return t;
                }
                // fallback: append
                return template + (template.includes('?') ? '&' : '?') + `page=${p}&page_size=${pageSize}`;
            };

            // On reset, clear existing data
            if (resetData) {
                setRestaurants([]);
                setFilteredRestaurants([]);
                setPagination({
                    currentPage: 1,
                    totalPages: 1,
                    pageSize: pageSize,
                    total: 0,
                    hasMore: true
                });
            }

            setLoading(true);
            setError(null);

            // First try a direct 'fetch-all' endpoint variants (no pagination or explicit limit)
            const directFetchCandidates = [
                `${apiUrl}/api/restaurants/`,
                `${apiUrl}/api/restaurants/?limit=${pageSize}`,
                `${apiUrl}/api/restaurants/?limit=all`,
                `${apiUrl}/restaurants/`,
            ];

            for (const df of directFetchCandidates) {
                try {
                    const resp = await fetch(df);
                    if (!resp.ok) continue;
                    const j = await resp.json();

                    // If this looks like a full list (array or object containing an array), use it as the full dataset
                    let fullList = null;
                    if (Array.isArray(j)) {
                        fullList = j;
                    } else if (j && typeof j === 'object') {
                        if (Array.isArray(j.results)) fullList = j.results;
                        else if (Array.isArray(j.data)) fullList = j.data;
                        else if (Array.isArray(j.restaurants)) fullList = j.restaurants;
                        else {
                            const arr = Object.values(j).find(v => Array.isArray(v));
                            if (arr) fullList = arr;
                        }
                    }

                    if (fullList && fullList.length > 0) {
                        // Normalize and dedupe the fullList and set state
                        fullList.forEach((restaurant, index) => {
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
                            const address = restaurant.address || restaurant.dia_chi || 'Đang cập nhật';
                            const hasValidCoordsFromDB = isValidLatLng({ lat, lng });
                            const in_da_nang = hasValidCoordsFromDB ? isInDaNang(lat, lng) : null;

                            const item = {
                                id: restaurant.id || restaurant._id || `temp-0-${index}`,
                                name: restaurant.name || restaurant.ten_quan || 'Nhà hàng',
                                address,
                                cuisine: restaurant.cuisine || restaurant.cuisine_type || 'Đa dạng',
                                rating: restaurant.average_rating || restaurant.rating || 0,
                                lat,
                                lng,
                                phone: restaurant.phone || restaurant.dien_thoai,
                                opening_hours: restaurant.opening_hours || restaurant.gio_mo_cua,
                                description: restaurant.description,
                                needs_geocoding: (!hasValidCoordsFromDB || (hasValidCoordsFromDB && !in_da_nang)) && address && address !== 'Đang cập nhật',
                                in_da_nang,
                                has_coords_from_db: hasValidCoordsFromDB,
                                address_components: extractAddressComponents(address),
                                show_distance: false,
                                is_ready_for_map: hasValidCoordsFromDB && in_da_nang
                            };

                            const idKey = item.id ? String(item.id) : null;
                            const nameAddrKey = `${(item.name || '').toLowerCase().trim()}|${normalizeDaNangAddress(item.address || '')}`;
                            const key = idKey || nameAddrKey;

                            if (!dedupeMap.has(key)) {
                                dedupeMap.set(key, item);
                            } else {
                                const existing = dedupeMap.get(key);
                                const merged = { ...existing, ...item };
                                if ((item.has_coords_from_db || item.is_ready_for_map) && !(existing.has_coords_from_db || existing.is_ready_for_map)) {
                                    merged.lat = item.lat;
                                    merged.lng = item.lng;
                                    merged.has_coords_from_db = item.has_coords_from_db;
                                    merged.is_ready_for_map = item.is_ready_for_map;
                                }
                                merged.geocoding_confidence = Math.max(existing.geocoding_confidence || 0, item.geocoding_confidence || 0);
                                dedupeMap.set(key, merged);
                            }
                        });

                        const finalList = Array.from(dedupeMap.values()).filter(r => r.name && r.name.trim() !== '');
                        setRestaurants(finalList);
                        setFilteredRestaurants(finalList);
                        setPagination(prev => ({ ...prev, total: finalList.length, totalPages: 1, currentPage: 1 }));
                        setLoading(false);
                        setLoadingProgress(100);
                        return;
                    }
                } catch {
                    // ignore and try next direct candidate
                    continue;
                }
            }

            // We'll try a few endpoint templates only for the first page to detect the correct path
                const endpointCandidates = [
                // DRF-style pagination
                `${apiUrl}/api/restaurants/?page={page}&page_size={page_size}`,
                `${apiUrl}/api/restaurants?page={page}&page_size={page_size}`,
                `${apiUrl}/restaurants/?page={page}&page_size={page_size}`,
                `${apiUrl}/restaurants?page={page}&page_size={page_size}`,
                // Backends that use `limit` instead of page_size (this project uses `limit=8` by default)
                `${apiUrl}/api/restaurants/?limit={page_size}`,
                `${apiUrl}/api/restaurants?limit={page_size}`,
                `${apiUrl}/restaurants/?limit={page_size}`,
                `${apiUrl}/restaurants?limit={page_size}`,
            ];

            let successfulTemplate = null;
            let accumulated = [];
            // dedupe map: key -> restaurant object
            const dedupeMap = new Map();
            let currentPage = page;
            let knownTotalPages = null;

            try {
                // detect template on first iteration
                if (!successfulTemplate) {
                    for (const t of endpointCandidates) {
                        const ep = buildEndpoint(t, currentPage);
                        try {
                            const resp = await fetch(ep);
                            if (!resp.ok) {
                                continue;
                            }
                            const j = await resp.json();
                            // if we got data, choose this template
                            successfulTemplate = t;
                            // process this page's data below by setting a placeholder 'firstResponse'
                            // but to avoid duplicating code we'll set a variable and reuse the logic
                            // assign j to a variable we will process in the loop
                            accumulated.push(j);
                            break;
                        } catch {
                            // try next
                            continue;
                        }
                    }
                    // if detection failed, fall back to default template
                    if (!successfulTemplate) successfulTemplate = `${apiUrl}/api/restaurants/?page={page}&page_size={page_size}`;
                }

                // Iterate pages until we've collected everything
                while (true) {
                    // if we already have a queued response (only possible for the first page detection), use it
                    let pageData = null;
                    if (accumulated.length > 0 && currentPage === page) {
                        pageData = accumulated.shift();
                    } else {
                        const endpoint = buildEndpoint(successfulTemplate, currentPage);
                        const resp = await fetch(endpoint);
                        if (!resp.ok) throw new Error(`HTTP ${resp.status} when fetching ${endpoint}`);
                        pageData = await resp.json();
                    }

                    // normalize list and metadata
                    let restaurantsList = [];
                    let totalItems = null;
                    if (pageData == null) {
                        restaurantsList = [];
                    } else if (Array.isArray(pageData)) {
                        restaurantsList = pageData;
                    } else if (pageData.results && Array.isArray(pageData.results)) {
                        restaurantsList = pageData.results;
                        totalItems = pageData.count || pageData.total || null;
                    } else if (pageData.data && Array.isArray(pageData.data)) {
                        restaurantsList = pageData.data;
                        totalItems = pageData.total || pageData.count || null;
                    } else if (pageData.restaurants && Array.isArray(pageData.restaurants)) {
                        restaurantsList = pageData.restaurants;
                        totalItems = pageData.total || pageData.count || null;
                    } else if (typeof pageData === 'object') {
                        // try to find an array value inside
                        const arr = Object.values(pageData).find(v => Array.isArray(v));
                        if (arr) {
                            restaurantsList = arr;
                            totalItems = pageData.total || pageData.count || null;
                        } else {
                            restaurantsList = [pageData];
                        }
                    }

                    // clean and append
                    const cleaned = restaurantsList.map((restaurant, index) => {
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
                        const address = restaurant.address || restaurant.dia_chi || 'Đang cập nhật';
                        const hasValidCoordsFromDB = isValidLatLng({ lat, lng });
                        const in_da_nang = hasValidCoordsFromDB ? isInDaNang(lat, lng) : null;

                        return {
                            id: restaurant.id || restaurant._id || `temp-${currentPage}-${index}`,
                            name: restaurant.name || restaurant.ten_quan || 'Nhà hàng',
                            address,
                            cuisine: restaurant.cuisine || restaurant.cuisine_type || 'Đa dạng',
                            rating: restaurant.average_rating || restaurant.rating || 0,
                            lat,
                            lng,
                            phone: restaurant.phone || restaurant.dien_thoai,
                            opening_hours: restaurant.opening_hours || restaurant.gio_mo_cua,
                            description: restaurant.description,
                            needs_geocoding: (!hasValidCoordsFromDB || (hasValidCoordsFromDB && !in_da_nang)) && address && address !== 'Đang cập nhật',
                            in_da_nang,
                            has_coords_from_db: hasValidCoordsFromDB,
                            address_components: extractAddressComponents(address),
                            show_distance: false,
                            is_ready_for_map: hasValidCoordsFromDB && in_da_nang
                        };
                    }).filter(r => r.name && r.name.trim() !== '');

                    // accumulate into dedupeMap to avoid duplicate restaurants across pages
                    cleaned.forEach((r) => {
                        const idKey = r.id ? String(r.id) : null;
                        const nameAddrKey = `${(r.name || '').toLowerCase().trim()}|${normalizeDaNangAddress(r.address || '')}`;
                        const key = idKey || nameAddrKey;

                        if (!dedupeMap.has(key)) {
                            dedupeMap.set(key, r);
                        } else {
                            // merge: prefer coordinates and higher confidence
                            const existing = dedupeMap.get(key);
                            const merged = { ...existing, ...r };
                            // prefer coords from DB or ready-for-map flags
                            if ((r.has_coords_from_db || r.is_ready_for_map) && !(existing.has_coords_from_db || existing.is_ready_for_map)) {
                                merged.lat = r.lat;
                                merged.lng = r.lng;
                                merged.has_coords_from_db = r.has_coords_from_db;
                                merged.is_ready_for_map = r.is_ready_for_map;
                            }
                            // keep highest geocoding confidence
                            merged.geocoding_confidence = Math.max(existing.geocoding_confidence || 0, r.geocoding_confidence || 0);
                            dedupeMap.set(key, merged);
                        }
                    });

                    // update pagination metadata
                    if (totalItems == null && pageData && (pageData.count || pageData.total)) {
                        totalItems = pageData.count || pageData.total;
                    }
                    if (totalItems != null) {
                        knownTotalPages = Math.ceil(totalItems / pageSize);
                        setPagination(prev => ({ ...prev, currentPage, totalPages: knownTotalPages, total: totalItems, pageSize }));
                    } else {
                        // unknown total: keep updating current page
                        setPagination(prev => ({ ...prev, currentPage, pageSize }));
                    }

                    // progress
                    if (knownTotalPages) {
                        setLoadingProgress(Math.min(100, Math.round((currentPage / knownTotalPages) * 100)));
                    } else {
                        setLoadingProgress(Math.min(95, (currentPage * 5)));
                    }

                    // decide to continue
                    const hasNext = pageData && (Boolean(pageData.next) || (knownTotalPages && currentPage < knownTotalPages));
                    if (hasNext) {
                        currentPage += 1;
                        // small delay to be gentle to backend
                        await new Promise(r => setTimeout(r, 200));
                        continue;
                    }
                    break;
                }
                // after collecting pages, set state from dedupeMap
                const finalList = Array.from(dedupeMap.values());
                setRestaurants(finalList);
                setFilteredRestaurants(finalList);

            } catch (err) {
                console.error('❌ Lỗi khi tải dữ liệu từ API:', err);
                setError(`Lỗi: ${err.message}`);
            } finally {
                setLoading(false);
                setLoadingProgress(100);
            }
        };

        // ✅ CẢI THIỆN: Hàm tìm kiếm nhà hàng từ database - KHÔNG tự động geocoding
        const searchRestaurants = async (query) => {
            if (!query.trim()) {
                setFilteredRestaurants(restaurants);
                setSearchError(null);
                setShowSearchResults(false);
                return;
            }

            try {
                setSearchLoading(true);
                setSearchError(null);
                setShowSearchResults(true);

                console.log(`🔍 Đang tìm kiếm nhà hàng: "${query}"`);

                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

                const response = await fetch(`${apiUrl}/api/restaurants/search?q=${encodeURIComponent(query)}`);

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

                // ✅ SỬA ĐỔI: Không tự động geocoding, chỉ xử lý dữ liệu cơ bản
                const processedResults = searchResults.map((restaurant, index) => {
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
                        is_search_result: true,
                        geocoding_in_progress: false,
                        is_ready_for_map: hasValidCoordsFromDB && in_da_nang
                    };
                });

                const cleanedResults = processedResults.filter(restaurant => {
                    const hasAddress = restaurant.address &&
                        restaurant.address.trim() !== '' &&
                        restaurant.address !== 'Đang cập nhật';
                    return hasAddress;
                });

                console.log(`✅ Tìm thấy ${cleanedResults.length} kết quả cho "${query}"`);

                if (cleanedResults.length === 0) {
                    setSearchError(`Không tìm thấy nhà hàng nào phù hợp với "${query}"`);
                }

                setFilteredRestaurants(cleanedResults);

            } catch (error) {
                console.error('❌ Lỗi tìm kiếm nhà hàng:', error);
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
                setShowSearchResults(true);
            }

            setFilteredRestaurants(results);
        };

        // ✅ SỬA: Hàm tìm kiếm - KHÔNG tự động geocoding
        const searchAndGeocode = async () => {
            if (!searchQuery.trim()) {
                setFilteredRestaurants(restaurants);
                setSearchError(null);
                setShowSearchResults(false);

                // ✅ THÊM: Reset về view mặc định khi xóa tìm kiếm
                setUserLocation(prev => ({ ...prev })); // Trigger re-render
                setMapZoom(12);
                return;
            }

            await searchRestaurants(searchQuery);

            // ✅ ĐẢM BẢO: Chỉ fit bounds khi có kết quả tìm kiếm
            setTimeout(() => {
                fitMapToSearchResults();
            }, 300);
        };

        // ✅ SỬA: Hàm reset tìm kiếm - CẬP NHẬT ĐỂ RESET VỀ VIEW MẶC ĐỊNH
        const resetSearch = () => {
            setSearchQuery('');
            setFilteredRestaurants(restaurants);
            setSearchError(null);
            setShowSearchResults(false);

            // ✅ THÊM: Reset map về vị trí người dùng
            if (isValidLatLng(userLocation)) {
                setUserLocation(prev => ({ ...prev }));
                setMapZoom(12);
            }
        };

        // Cache tuyến đường để tránh tính lại
        const getRouteCacheKey = (start, end) => `${start.lat.toFixed(4)},${start.lng.toFixed(4)}-${end.lat.toFixed(4)},${end.lng.toFixed(4)}`;

        const getCachedRoute = (start, end) => {
            try {
                const key = getRouteCacheKey(start, end);
                const cachedData = sessionStorage.getItem(`route_${key}`);
                if (cachedData) {
                    const cached = JSON.parse(cachedData);
                    if (cached && (Date.now() - cached.timestamp) < 30 * 60 * 1000) {
                        console.log('✅ Sử dụng tuyến đường từ cache');
                        return cached.data;
                    } else {
                        sessionStorage.removeItem(`route_${key}`);
                    }
                }
            } catch (err) {
                console.warn('Lỗi đọc cache:', err);
            }
            return null;
        };

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

                const cachedRoute = getCachedRoute(userLocation, r);
                if (cachedRoute) {
                    console.log('✅ Sử dụng tuyến đường từ cache');
                    setRouteCoords(cachedRoute.coords);
                    setRouteDistanceKm(cachedRoute.distance);
                    setLoadingRoute(false);
                    return;
                }

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

                // 1) ƯU TIÊN: OSRM public
                let retryCount = 0;
                const maxRetries = 2;
                const retryDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000);

                while (retryCount <= maxRetries && !routeFound) {
                    try {
                        console.log(`🔍 Thử OSRM public lần ${retryCount + 1}...`);
                        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${r.lng},${r.lat}?overview=full&geometries=geojson`;

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
            try {
                const start = `${encodeURIComponent(userLocation.lat)},${encodeURIComponent(userLocation.lng)}`;
                const end = `${encodeURIComponent(r.lat)},${encodeURIComponent(r.lng)}`;
                const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${start}&destination=${end}&travelmode=driving`;
                const win = window.open(gmapsUrl, '_blank');
                if (!win) {
                    const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.lat + ',' + r.lng)}`;
                    window.open(fallback, '_blank');
                }
            } catch (err) {
                console.error('Failed to open Google Maps directions:', err);
            }
        };

        // Fetch restaurants khi component mount
        useEffect(() => {
            fetchRestaurants(1, true);
            // eslint-disable-next-line react-hooks/exhaustive-deps
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
            const readyForMap = filteredRestaurants.filter(r => geocodedRestaurants.has(r.id)).length;

            return {
                total, withCoords, needsGeocoding, inDaNang, outsideDaNang,
                fromDB, fromGeocoding, geocodingInProgress, highConfidence, lowConfidence, readyForMap
            };
        }, [filteredRestaurants, geocodedRestaurants]);

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
                            <button
                                onClick={resetAllData}
                                className="refresh-button"
                                disabled={loading || isResetting}
                                title="Reset toàn bộ dữ liệu nhà hàng"
                            >
                                <RefreshCw size={14} className={loading || isResetting ? 'spinning' : ''} />
                                {isResetting ? ' Đang reset...' : ''}
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
                    {(loading || isResetting) && (
                        <div className="loading-message">
                            {isResetting ? '🔄 Đang reset dữ liệu nhà hàng Đà Nẵng...' : '🔄 Đang tải dữ liệu nhà hàng Đà Nẵng...'}
                        </div>
                    )}

                    {/* Thống kê chi tiết */}
                    <div className="stats-panel">
                        <small>
                            📋 Tổng số: {stats.total} nhà hàng
                        </small>
                        {stats.highConfidence > 0 && (
                            <small> • ✅ {stats.highConfidence} tin cậy cao</small>
                        )}
                        {stats.lowConfidence > 0 && (
                            <small> • ⚠️ {stats.lowConfidence} tin cậy thấp</small>
                        )}
                        {showSearchResults && (
                            <small style={{ color: '#1976d2', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>
                                🔍 Đang hiển thị {filteredRestaurants.length} kết quả tìm kiếm cho: "{searchQuery}"
                            </small>
                        )}
                    </div>

                    <div className="restaurants-list">
                        {filteredRestaurants.length === 0 && !loading && !isResetting ? (
                            <div className="no-data-message">
                                {searchQuery ? '📭 Không tìm thấy nhà hàng phù hợp' : '📭 Không có dữ liệu nhà hàng'}
                            </div>
                        ) : (
                            filteredRestaurants.map(restaurant => (
                                <div
                                    key={restaurant.id}
                                    className={`restaurant-card ${selectedRestaurant?.id === restaurant.id ? 'selected' : ''} ${!geocodedRestaurants.has(restaurant.id) ? 'not-on-map' : ''} ${restaurant.in_da_nang === false ? 'outside-danang' : ''}`}
                                >
                                    <div className="restaurant-icon">
                                        <Utensils size={16} />
                                        {!geocodedRestaurants.has(restaurant.id) && (
                                            <span className="coordinate-warning" title="Chưa hiển thị trên bản đồ">🗺️</span>
                                        )}
                                        {restaurant.in_da_nang === false && (
                                            <span className="location-warning" title="Có thể ngoài khu vực Đà Nẵng">📍</span>
                                        )}
                                    </div>
                                    <div className="restaurant-info">
                                        <h4>
                                            {restaurant.name}
                                            <span className={`coordinate-source ${restaurant.has_coords_from_db ? 'db' : restaurant.geocoded ? 'geocoded' : 'unknown'}`}>
                                                {geocodedRestaurants.has(restaurant.id) ? '📍' : '🗺️'}
                                            </span>
                                            {restaurant.geocoder_used && (
                                                <span className="geocoder-badge" title={`Định vị bằng: ${restaurant.geocoder_used}`}>
                                                    {restaurant.geocoder_used === 'google'}
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
                                                {restaurant.rating || 'Chưa có'}
                                            </span>
                                            {geocodedRestaurants.has(restaurant.id) && isValidLatLng(restaurant) && (
                                                <span className="distance">
                                                    {getDistance(restaurant)} km
                                                </span>
                                            )}
                                        </div>

                                        {/* Nút định vị cho từng nhà hàng - CHỈ HIỆN KHI CHƯA ĐƯỢC ĐỊNH VỊ */}
                                        {!geocodedRestaurants.has(restaurant.id) && restaurant.needs_geocoding && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    geocodeSingleRestaurant(restaurant.id);
                                                }}
                                                className="geocode-single-button"
                                                disabled={restaurant.geocoding_in_progress}
                                            >
                                                {restaurant.geocoding_in_progress ? '🔄 Đang định vị...' : '🗺️ Định Vị Trên Bản Đồ'}
                                            </button>
                                        )}

                                        {/* Hiển thị trạng thái đã định vị */}
                                        {geocodedRestaurants.has(restaurant.id) && (
                                            <div className="geocoding-success">
                                                <small style={{ color: '#4caf50' }}>
                                                    ✅ Đã hiển thị trên bản đồ
                                                </small>
                                            </div>
                                        )}
                                    </div>

                                    <div className="restaurant-actions">
                                        {/* ✅ THÊM: Nút focus vào nhà hàng trên bản đồ */}
                                        {geocodedRestaurants.has(restaurant.id) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    focusOnRestaurant(restaurant);
                                                }}
                                                className="focus-button"
                                                title="Xem trên bản đồ"
                                            >
                                                👁️
                                            </button>
                                        )}

                                        {/* Nút chỉ đường */}
                                        <button
                                            className="select-restaurant-button"
                                            onClick={() => selectRestaurantAndShowRoute(restaurant)}
                                            disabled={!geocodedRestaurants.has(restaurant.id)}
                                            title={geocodedRestaurants.has(restaurant.id) ? 'Chỉ đường' : 'Cần định vị trước khi chỉ đường'}
                                        >
                                            <Navigation size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Hiển thị thông tin tuyến đường */}
                    {routeDistanceKm && (
                        <div className="route-info">
                            <h4>📌 Thông Tin Tuyến Đường</h4>
                            <p><strong>Đến:</strong> {selectedRestaurant?.name}</p>
                            <p><strong>Khoảng cách:</strong> {routeDistanceKm} km</p>
                            <p><strong>Thời gian ước tính:</strong> {Math.round(Number(routeDistanceKm) * 2.5)} phút</p>
                            {routeError && (
                                <p style={{ color: '#d32f2f', fontSize: '12px', marginTop: '8px' }}>
                                    ⚠️ {routeError}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Bản đồ */}
                <div className="map-container">
                    {/* Back button positioned over the map (styled in CSS) */}
                    <button
                        onClick={() => setShowMap(false)}
                        className="back-button"
                        title="Quay lại"
                    >
                        ← Quay lại
                    </button>
                    {/* Loading overlay */}
                    {(loading || searchLoading || isResetting) && (
                        <div className="loading-overlay">
                            <div className="loading-spinner">
                                {searchLoading ? '🔍 Đang tìm kiếm nhà hàng...' : isResetting ? (
                                    <>
                                        <div>🔄 Đang reset dữ liệu nhà hàng Đà Nẵng...</div>
                                        {loadingProgress > 0 && (
                                            <div className="loading-progress">
                                                <div
                                                    className="progress-bar"
                                                    style={{ width: `${loadingProgress}%` }}
                                                />
                                                <div className="progress-text">
                                                    {Math.round(loadingProgress)}% - Trang {pagination.currentPage}/{pagination.totalPages}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div>🔄 Đang tải dữ liệu nhà hàng Đà Nẵng...</div>
                                        {loading && loadingProgress > 0 && (
                                            <div className="loading-progress">
                                                <div
                                                    className="progress-bar"
                                                    style={{ width: `${loadingProgress}%` }}
                                                />
                                                <div className="progress-text">
                                                    {Math.round(loadingProgress)}% - Trang {pagination.currentPage}/{pagination.totalPages}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Map Controls */}
                    <div className="map-controls">
                        <button
                            onClick={toggleFullscreen}
                            className="map-control-button"
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

                        {/* ✅ THÊM: Fit bounds cho kết quả tìm kiếm */}
                        {showSearchResults && (
                            <FitBoundsOnResults
                                results={filteredRestaurants.filter(r => geocodedRestaurants.has(r.id))}
                                userLocation={userLocation}
                            />
                        )}

                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {/* ✅ CẢI THIỆN: Marker vị trí người dùng với style khác biệt */}
                        {isValidLatLng(userLocation) && (
                            <Marker
                                position={[userLocation.lat, userLocation.lng]}
                                icon={L.divIcon({
                                    className: 'user-location-marker',
                                    html: '<div style="background: #1976d2; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
                                    iconSize: [26, 26],
                                    iconAnchor: [13, 13]
                                })}
                            >
                                <Popup>
                                    <strong>📍 Vị trí của bạn</strong><br />
                                    {isInDaNang(userLocation.lat, userLocation.lng) ?
                                        'Bạn đang trong khu vực Đà Nẵng' :
                                        '⚠️ Bạn đang ngoài khu vực Đà Nẵng'
                                    }
                                </Popup>
                            </Marker>
                        )}

                        {/* ✅ CẢI THIỆN: Markers nhà hàng với style khác biệt */}
                        {filteredRestaurants
                            .filter(r => geocodedRestaurants.has(r.id) && isValidLatLng(r))
                            .map((r) => (
                                <Marker
                                    key={r.id}
                                    position={[r.lat, r.lng]}
                                    icon={L.divIcon({
                                        className: `restaurant-marker ${r.in_da_nang === false ? 'outside-danang' : ''} ${showSearchResults ? 'search-result' : ''}`,
                                        html: `<div style="background: ${r.in_da_nang === false ? '#ff9800' : '#d84315'}; color: white; width: 22px; height: 22px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
                                                <span style="transform: rotate(45deg); font-size: 10px;">🍽️</span>
                                            </div>`,
                                        iconSize: [24, 24],
                                        iconAnchor: [12, 24]
                                    })}
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
                                                        {r.geocoder_used === 'google'}
                                                    </span>
                                                )}
                                                {showSearchResults && (
                                                    <span className="search-result-badge" title="Kết quả tìm kiếm">
                                                        🔍
                                                    </span>
                                                )}
                                            </h3>

                                            {/* Hiển thị cảnh báo nổi bật nếu có vấn đề */}
                                            {r.in_da_nang === false && (
                                                <div style={{
                                                    background: '#fff3e0',
                                                    padding: '8px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ffb74d',
                                                    marginBottom: '8px'
                                                }}>
                                                    <strong>⚠️ CẢNH BÁO:</strong> Có thể ngoài khu vực Đà Nẵng
                                                </div>
                                            )}

                                            {r.geocoding_confidence && r.geocoding_confidence < 5 && (
                                                <div style={{
                                                    background: '#ffebee',
                                                    padding: '8px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ef5350',
                                                    marginBottom: '8px'
                                                }}>
                                                    <strong>⚠️ CHÚ Ý:</strong> Địa chỉ có độ tin cậy thấp ({r.geocoding_confidence}/10)
                                                </div>
                                            )}

                                            <p><strong>Ẩm thực:</strong> {r.cuisine}</p>
                                            <p><strong>Địa chỉ:</strong> {r.address}</p>

                                            <div className="location-details">
                                                <small>
                                                    <strong>Chi tiết định vị:</strong><br />
                                                    • Nguồn: {r.has_coords_from_db ? 'Database' : r.geocoded ? 'Geocoding' : 'Chưa rõ'}<br />
                                                    • Độ tin cậy: {r.geocoding_confidence ? `${r.geocoding_confidence}/10` : 'Không có'}<br />
                                                    • Trong ĐN: {r.in_da_nang === true ? '✅' : r.in_da_nang === false ? '❌' : '❓'}
                                                </small>
                                            </div>

                                            <p className="rating-line">
                                                <Star size={16} color="#FFC107" fill="#FFC107" />
                                                {r.rating || 'Chưa có đánh giá'}
                                            </p>
                                            <p><strong>Cách bạn:</strong> {getDistance(r)} km</p>

                                            <div className="popup-actions">
                                                <button
                                                    onClick={() => selectRestaurantAndShowRoute(r)}
                                                    className="direction-button primary"
                                                    disabled={loadingRoute}
                                                >
                                                    <Navigation size={16} />
                                                    {loadingRoute ? 'Đang tính...' : 'Chỉ Đường'}
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        const details = showAddressDetails(r);
                                                        alert(details);
                                                    }}
                                                    className="direction-button secondary"
                                                >
                                                    ℹ️ Chi Tiết
                                                </button>
                                            </div>

                                            <button
                                                onClick={() => openExternalDirections(r)}
                                                className="direction-button direction-button--secondary"
                                                style={{ marginTop: '8px', width: '100%' }}
                                            >
                                                <Navigation size={16} />
                                                Mở Google Maps
                                            </button>

                                            {routeError && (
                                                <p style={{ color: '#d33', marginTop: '8px', fontSize: '11px' }}>
                                                    {routeError}
                                                </p>
                                            )}

                                            {!hasORSKey && (
                                                <p style={{ color: '#f57c00', marginTop: '8px', fontSize: '11px' }}>
                                                    💡 Sử dụng Google Maps để chỉ đường chi tiết
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
                                    color="#1976d2"
                                    weight={5}
                                    opacity={0.7}
                                    dashArray="10, 10"
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