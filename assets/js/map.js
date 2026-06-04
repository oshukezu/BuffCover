import { getCookie } from './storage.js';
import { translations } from './i18n.js';

let mapInstance = null;
let centerMarker = null;
let bufferCircle = null;
let gisLayerInstance = null;
let markerClusterInstance = null; // 患者點聚合群組實例
let importedMarkers = [];
let currentTileLayer = null;

/**
 * 初始化地圖實例與基本圖層
 * @param {string} elementId - 地圖 HTML 容器 ID (例如 'map')
 * @param {number} initialLat - 初始中心緯度
 * @param {number} initialLng - 初始中心經度
 * @param {number} initialRadius - 初始分析半徑 (公尺)
 * @param {function} onDragCallback - 中心 Marker 拖曳中回呼函數 (lat, lng) => {}
 * @param {function} onClickCallback - 中心 Marker 拖曳結束或地圖點擊回呼函數 (lat, lng) => {}
 * @returns {object} Leaflet 地圖物件
 */
export function initMapInstance(elementId, initialLat, initialLng, initialRadius, onDragCallback, onClickCallback) {
    // 防禦性檢查：確保地圖容器存在於 DOM 中，防範 DOM 尚未就緒即初始化引起的 JS 致命崩潰
    const container = document.getElementById(elementId);
    if (!container) {
        console.error(`無法初始化地圖：未找到 ID 為 #${elementId} 的容器！`);
        return null;
    }

    // 建立地圖
    mapInstance = L.map(elementId, {
        zoomControl: true,
        attributionControl: true
    }).setView([initialLat, initialLng], 14);
    
    // 預設載入曜石黑風格地圖 (CartoDB Dark Matter，截圖超乾淨)
    currentTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        crossOrigin: 'anonymous'
    }).addTo(mapInstance);
    
    // 建立一個客製化中心標記 Icon (藍紫色發光外圈)
    const centerIcon = L.divIcon({
        html: `
            <div class="center-marker-container">
                <div class="center-marker-core"></div>
                <div class="center-marker-halo"></div>
            </div>
        `,
        className: 'custom-center-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    // 建立可拖曳的中心 Marker
    centerMarker = L.marker([initialLat, initialLng], {
        draggable: true,
        icon: centerIcon
    }).addTo(mapInstance);
    
    // 建立環域分析圓圈
    bufferCircle = L.circle([initialLat, initialLng], {
        radius: initialRadius,
        color: '#3B82F6',       
        weight: 2,
        opacity: 0.8,
        fillColor: '#8B5CF6',   
        fillOpacity: 0.15       
    }).addTo(mapInstance);
    
    // 註冊中心 Marker 拖曳與地圖點擊事件
    centerMarker.on('drag', (e) => {
        const position = centerMarker.getLatLng();
        bufferCircle.setLatLng(position);
        onDragCallback(position.lat, position.lng);
    });
    
    centerMarker.on('dragend', (e) => {
        const position = centerMarker.getLatLng();
        mapInstance.invalidateSize(); // 拖曳結束時，重新校正地圖大小以防破圖
        onClickCallback(position.lat, position.lng);
    });
    
    // 觸控設備防誤觸優化：若為觸控設備，地圖空白處改為雙擊（dblclick）觸發變更中心，防範平移地圖時誤觸
    const clickEventName = L.Browser.touch ? 'dblclick' : 'click';
    mapInstance.on(clickEventName, (e) => {
        const position = e.latlng;
        centerMarker.setLatLng(position);
        bufferCircle.setLatLng(position);
        mapInstance.invalidateSize(); // 點擊/雙擊時，重新校正地圖大小以防破圖
        onClickCallback(position.lat, position.lng);
    });

    // 使用 ResizeObserver 自動且即時地在容器大小變化時更新地圖大小，徹底解決 CSS Grid/Flex 等佈局渲染時間差造成的黑屏與底圖不全問題
    try {
        const resizeObserver = new ResizeObserver(() => {
            if (mapInstance) {
                mapInstance.invalidateSize();
            }
        });
        const mapEl = document.getElementById(elementId);
        if (mapEl) {
            resizeObserver.observe(mapEl);
        }
    } catch (e) {
        console.error("無法初始化 ResizeObserver:", e);
    }

    // 延遲一段時間重新校正大小，確保在 CSS 容器高度完全渲染後，地圖圖磚能正確撐開
    setTimeout(() => {
        if (mapInstance) {
            mapInstance.invalidateSize();
        }
    }, 300);

    return mapInstance;
}

/**
 * 更新中心點座標位置
 * @param {number} lat - 緯度
 * @param {number} lng - 經度
 */
export function setCenterPosition(lat, lng) {
    if (mapInstance && centerMarker && bufferCircle) {
        mapInstance.setView([lat, lng], mapInstance.getZoom());
        centerMarker.setLatLng([lat, lng]);
        bufferCircle.setLatLng([lat, lng]);
        
        // 延遲更新以防動畫衝突造成容器未同步
        setTimeout(() => {
            mapInstance.invalidateSize();
        }, 100);
    }
}

/**
 * 更新緩衝圓圈分析半徑
 * @param {number} radius - 半徑 (公尺)
 */
export function setBufferRadius(radius) {
    if (bufferCircle) {
        bufferCircle.setRadius(radius);
    }
}

/**
 * 清除地圖上現存的 GIS 圖層
 */
export function clearGisLayer() {
    if (mapInstance && gisLayerInstance) {
        mapInstance.removeLayer(gisLayerInstance);
        gisLayerInstance = null;
    }
}

/**
 * 清除地圖上現存的匯入參考點 Marker
 */
export function clearImportedMarkers() {
    if (mapInstance) {
        // 從地圖移除各個點的 Marker
        importedMarkers.forEach(marker => {
            if (markerClusterInstance) {
                markerClusterInstance.removeLayer(marker);
            } else {
                mapInstance.removeLayer(marker);
            }
        });
        importedMarkers = [];

        // 移除聚合群組實例
        if (markerClusterInstance) {
            mapInstance.removeLayer(markerClusterInstance);
            markerClusterInstance = null;
        }
    }
}

/**
 * 計算 GeoJSON 幾何物件的質心
 * @param {object} geometry - GeoJSON 幾何物件
 * @returns {object|null} {lat, lng} 格式的質心座標，若不支援則回傳 null
 */
export function getCentroid(geometry) {
    if (!geometry || !geometry.type || !geometry.coordinates) return null;
    
    const type = geometry.type;
    const coords = geometry.coordinates;
    
    if (type === 'Point') {
        return { lat: coords[1], lng: coords[0] };
    }
    
    if (type === 'LineString') {
        let sumLat = 0;
        let sumLng = 0;
        const len = coords.length;
        if (len === 0) return null;
        for (let i = 0; i < len; i++) {
            sumLng += coords[i][0];
            sumLat += coords[i][1];
        }
        return { lat: sumLat / len, lng: sumLng / len };
    }
    
    if (type === 'Polygon') {
        // 通常取第一層外環即可
        const ring = coords[0];
        if (!ring || ring.length === 0) return null;
        let sumLat = 0;
        let sumLng = 0;
        const len = ring.length;
        for (let i = 0; i < len; i++) {
            sumLng += ring[i][0];
            sumLat += ring[i][1];
        }
        return { lat: sumLat / len, lng: sumLng / len };
    }
    
    if (type === 'MultiPoint') {
        if (coords.length === 0) return null;
        let sumLat = 0;
        let sumLng = 0;
        const len = coords.length;
        for (let i = 0; i < len; i++) {
            sumLng += coords[i][0];
            sumLat += coords[i][1];
        }
        return { lat: sumLat / len, lng: sumLng / len };
    }

    if (type === 'MultiLineString') {
        let sumLat = 0;
        let sumLng = 0;
        let count = 0;
        for (let i = 0; i < coords.length; i++) {
            const line = coords[i];
            for (let j = 0; j < line.length; j++) {
                sumLng += line[j][0];
                sumLat += line[j][1];
                count++;
            }
        }
        if (count === 0) return null;
        return { lat: sumLat / count, lng: sumLng / count };
    }

    if (type === 'MultiPolygon') {
        let sumLat = 0;
        let sumLng = 0;
        let count = 0;
        for (let i = 0; i < coords.length; i++) {
            const poly = coords[i];
            const ring = poly[0]; // 僅取外環
            if (ring) {
                for (let j = 0; j < ring.length; j++) {
                    sumLng += ring[j][0];
                    sumLat += ring[j][1];
                    count++;
                }
            }
        }
        if (count === 0) return null;
        return { lat: sumLat / count, lng: sumLng / count };
    }
    
    return null;
}

/**
 * 在地圖上繪製 GeoJSON GIS 圖層，並進行範圍內外樣式套用與相交判定
 * @param {object} geoJsonData - GeoJSON 格式資料
 * @param {boolean} showOutside - 是否顯示範圍外的要素
 * @param {number} centerLat - 環域中心緯度
 * @param {number} centerLng - 環域中心經度
 * @param {number} centerRadius - 環域半徑 (公尺)
 * @param {function} jsHaversine - 計算距離的函數
 * @param {function} formatDistance - 格式化距離的函數
 * @returns {Array} 落入範圍內的 Feature 陣列
 */
export function drawGisLayer(geoJsonData, showOutside, centerLat, centerLng, centerRadius, jsHaversine, formatDistance) {
    clearGisLayer();
    
    if (!geoJsonData || !geoJsonData.features) {
        return [];
    }
    
    const insideFeatures = [];
    
    const lang = getCookie('gis_lang') || 'zh';
    const dict = translations[lang] || translations.zh;
    
    // 定義範圍內與範圍外的幾何樣式 (LineString, Polygon 等)
    const styleInside = {
        color: '#10B981',
        weight: 3,
        opacity: 0.8,
        fillColor: '#10B981',
        fillOpacity: 0.25
    };
    
    const styleOutside = {
        color: '#64748B',
        weight: 2,
        opacity: 0.4,
        fillColor: '#64748B',
        fillOpacity: 0.1
    };

    // 定義範圍內與範圍外的點圖示 (Point)
    const markerIconInside = L.divIcon({
        html: `<div class="import-marker-inside marker-pulse-glow" style="width: 14px; height: 14px; background-color: #10B981; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);"></div>`,
        className: 'custom-import-marker',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    const markerIconOutside = L.divIcon({
        html: `<div class="import-marker-outside" style="width: 12px; height: 12px; background-color: #64748B; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 6px rgba(100, 116, 139, 0.4);"></div>`,
        className: 'custom-import-marker',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });

    gisLayerInstance = L.geoJSON(geoJsonData, {
        filter: (feature) => {
            const centroid = getCentroid(feature.geometry);
            if (!centroid) return false;
            
            const distance = jsHaversine(centerLat, centerLng, centroid.lat, centroid.lng);
            const isInside = distance <= centerRadius;
            
            // 快取這兩個分析值到 feature 中，供後續 UI 列表直接調用，避免重複計算
            feature.properties._distance = distance;
            feature.properties._isInside = isInside;
            feature.properties._centroid = centroid;
            
            if (isInside) {
                insideFeatures.push(feature);
            }
            
            // 如果不在範圍內，且使用者關閉了「顯示範圍外」，則過濾掉不繪製
            if (!isInside && !showOutside) {
                return false;
            }
            return true;
        },
        style: (feature) => {
            return feature.properties._isInside ? styleInside : styleOutside;
        },
        pointToLayer: (feature, latlng) => {
            return L.marker(latlng, {
                icon: feature.properties._isInside ? markerIconInside : markerIconOutside
            });
        },
        onEachFeature: (feature, layer) => {
            const name = feature.properties.name || feature.properties.title || (lang === 'zh' ? '未命名要素' : (lang === 'en' ? 'Unnamed Feature' : '未命名の地物'));
            const geomType = feature.geometry.type;
            const distance = feature.properties._distance;
            const isInside = feature.properties._isInside;
            const statusLabel = isInside ? dict.map_inside : dict.map_outside;
            const statusColor = isInside ? '#10B981' : '#64748B';
            
            const popupHtml = `
                <div class="map-popup-card">
                    <h3>${name}</h3>
                    <p style="font-size:0.8rem; margin-top:2px;">${dict.map_geom_type}：${geomType}</p>
                    <span class="popup-dist">${dict.map_dist_to_center}：${formatDistance(distance)}</span><br/>
                    <span class="popup-status" style="color:${statusColor}; font-weight:600; font-size:0.75rem;">${statusLabel}</span>
                </div>
            `;
            layer.bindPopup(popupHtml);
            
            // 綁定 Leaflet layer 實例，清單點擊時可藉此觸發 openPopup
            feature.properties._leafletLayer = layer;
        }
    }).addTo(mapInstance);
    
    return insideFeatures;
}

/**
 * 在地圖上繪製匯入的參考地址點，並計算範圍內的點數
 * @param {Array} points - 已地理編碼成功的匯入地址點
 * @param {number} centerLat - 當前中心緯度
 * @param {number} centerLng - 當前中心經度
 * @param {number} centerRadius - 當前半徑 (公尺)
 * @param {function} jsHaversine - 計算距離的函式
 * @param {function} formatDistance - 格式化距離的函式
 * @returns {number} 落入範圍內的點數
 */
export function drawImportedPoints(points, centerLat, centerLng, centerRadius, jsHaversine, formatDistance) {
    clearImportedMarkers();
    
    const lang = getCookie('gis_lang') || 'zh';
    const dict = translations[lang] || translations.zh;
    
    const markerIconInside = L.divIcon({
        html: `<div class="import-marker-inside" style="width: 14px; height: 14px; background-color: #10B981; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);"></div>`,
        className: 'custom-import-marker',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    const markerIconOutside = L.divIcon({
        html: `<div class="import-marker-outside" style="width: 12px; height: 12px; background-color: #EF4444; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);"></div>`,
        className: 'custom-import-marker',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });

    let insideCount = 0;

    // 初始化 L.markerClusterGroup 實例 (開啟 chunkedLoading 與自訂外觀樣式)
    markerClusterInstance = L.markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true, // 點擊叢集時會平滑飛越與放大
        spiderfyOnMaxZoom: true,   // 放大到極致時 spiderfy 展開
        iconCreateFunction: function(cluster) {
            const childCount = cluster.getChildCount();
            let bgClass = 'cluster-small';
            
            if (childCount >= 500) {
                bgClass = 'cluster-large';     // 大於等於 500 人：顯示深綠色核心圈
            } else if (childCount >= 100) {
                bgClass = 'cluster-medium';    // 100-500 人：顯示黃綠色圈
            } // 少於 100 人：顯示淡綠色圈 (cluster-small)
            
            return L.divIcon({
                html: `<div><span>${childCount}</span></div>`,
                className: `marker-cluster marker-cluster-custom ${bgClass}`,
                iconSize: L.point(40, 40)
            });
        }
    });

    points.forEach(point => {
        const distance = jsHaversine(centerLat, centerLng, point.lat, point.lng);
        const isInside = distance <= centerRadius;

        if (isInside) {
            insideCount++;
        }

        const marker = L.marker([point.lat, point.lng], {
            icon: isInside ? markerIconInside : markerIconOutside
        });

        const statusLabel = isInside ? dict.map_inside : dict.map_outside;
        const fallbackLabel = point.fallback ? `<br/><span style="color: var(--text-muted); font-size: 0.7rem; font-style: italic;">(${dict.map_fallback_addr}：${point.fallback_address})</span>` : '';
        const statusClass = isInside ? 'inside' : 'outside';
        const popupHtml = `
            <div class="map-popup-card">
                <h3>${dict.map_ref_address}</h3>
                <p style="font-size:0.85rem; margin-top:4px;">${point.address}${fallbackLabel}</p>
                <span class="popup-dist">${dict.map_dist_to_center}：${formatDistance(distance)}</span><br/>
                <span class="popup-status ${statusClass}" style="color:${isInside ? '#10B981' : '#EF4444'}; font-weight:600;">${statusLabel}</span>
            </div>
        `;
        marker.bindPopup(popupHtml);
        
        // 將 Marker 加入聚合群組
        markerClusterInstance.addLayer(marker);
        importedMarkers.push(marker);
    });

    // 將群組加入地圖
    mapInstance.addLayer(markerClusterInstance);

    return insideCount;
}

/**
 * 提供外部手動呼叫地圖尺寸重繪，徹底防止破圖與黑屏問題
 */
export function forceInvalidateSize() {
    if (mapInstance) {
        mapInstance.invalidateSize();
    }
}

/**
 * 移動地圖視野到特定座標點，並開啟彈窗
 * @param {number} lat - 緯度
 * @param {number} lng - 經度
 * @param {object} markerInstance - 標記點實例
 */
export function focusOnLocation(lat, lng, markerInstance) {
    if (mapInstance) {
        mapInstance.setView([lat, lng], mapInstance.getZoom() < 15 ? 15 : mapInstance.getZoom());
        if (markerInstance) {
            // 若為患者聚合點，需調用 zoomToShowLayer 以免因聚合狀態無法彈出 Popup
            if (markerClusterInstance && markerClusterInstance.hasLayer(markerInstance)) {
                markerClusterInstance.zoomToShowLayer(markerInstance, () => {
                    markerInstance.openPopup();
                });
            } else {
                markerInstance.openPopup();
            }
        }
        setTimeout(() => {
            mapInstance.invalidateSize();
        }, 100);
    }
}

/**
 * 動態切換地圖底圖風格
 * @param {string} styleName - 風格名稱，支援 'carto-dark' | 'osm-dark' | 'osm-light'
 */
export function switchMapStyle(styleName) {
    if (!mapInstance) return;
    
    // 移除舊有圖層
    if (currentTileLayer) {
        mapInstance.removeLayer(currentTileLayer);
    }
    
    const mapElement = document.getElementById('map');
    
    if (styleName === 'carto-dark') {
        // 使用 CartoDB Dark Matter (無伺服器極簡黑，超乾淨底圖)
        if (mapElement) mapElement.classList.remove('theme-osm-dark');
        currentTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20,
            crossOrigin: 'anonymous'
        }).addTo(mapInstance);
    } else if (styleName === 'carto-light') {
        // 使用 OSM 標準地圖加上深色 CSS 濾鏡，形成淡雅深灰色底圖，與原色區隔
        if (mapElement) mapElement.classList.add('theme-osm-dark');
        currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            subdomains: 'abc',
            maxZoom: 19,
            crossOrigin: 'anonymous'
        }).addTo(mapInstance);
    } else {
        // 標準 OSM 地圖原色
        if (mapElement) mapElement.classList.remove('theme-osm-dark');
        currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            subdomains: 'abc',
            maxZoom: 19,
            crossOrigin: 'anonymous'
        }).addTo(mapInstance);
    }
    
    // 重繪地圖大小以防閃爍
    setTimeout(() => {
        mapInstance.invalidateSize();
    }, 50);
}
