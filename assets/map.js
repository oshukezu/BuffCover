// Leaflet 地圖操作與 Marker 繪製模組

let mapInstance = null;
let centerMarker = null;
let bufferCircle = null;
let landmarkMarkers = [];
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
    
    mapInstance.on('click', (e) => {
        const position = e.latlng;
        centerMarker.setLatLng(position);
        bufferCircle.setLatLng(position);
        mapInstance.invalidateSize(); // 點擊時，重新校正地圖大小以防破圖
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
 * 清除地圖上現存的地標 Marker
 */
export function clearLandmarkMarkers() {
    if (mapInstance) {
        landmarkMarkers.forEach(marker => mapInstance.removeLayer(marker));
        landmarkMarkers = [];
    }
}

/**
 * 清除地圖上現存的匯入參考點 Marker
 */
export function clearImportedMarkers() {
    if (mapInstance) {
        importedMarkers.forEach(marker => mapInstance.removeLayer(marker));
        importedMarkers = [];
    }
}

/**
 * 建立地標客製化 Marker Icon
 * @param {boolean} isInside - 是否在環域範圍內
 */
function createLandmarkIcon(isInside) {
    const color = isInside ? '#10B981' : '#64748B'; 
    const glowClass = isInside ? 'marker-pulse-glow' : '';
    const htmlContent = `
        <div style="position: relative; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;">
            <div class="${glowClass}" style="
                position: absolute;
                width: 12px;
                height: 12px;
                background-color: ${color};
                border: 2px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
                z-index: 2;
            "></div>
        </div>
    `;
    
    return L.divIcon({
        html: htmlContent,
        className: 'custom-landmark-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
}

/**
 * 在地圖上繪製預設地標，並綁定 Popup 點擊彈窗
 * @param {Array} landmarks - 後端回傳的地標陣列
 * @param {boolean} showOutside - 是否顯示範圍外的地標
 */
export function drawLandmarks(landmarks, showOutside) {
    clearLandmarkMarkers();
    
    landmarks.forEach(landmark => {
        const { name, category, lat, lng, description, distance, isInside } = landmark;
        
        // 地圖上僅繪製範圍內地標 (isInside 為 true)，範圍外地標完全不繪製，保持畫面乾淨
        if (isInside) {
            const markerIcon = createLandmarkIcon(isInside);
            const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(mapInstance);
            
            const popupContent = `
                <div class="map-popup-card">
                    <h3>${name}</h3>
                    <p>${description}</p>
                    <span class="popup-dist">距離中心：${(distance / 1000).toFixed(2)} 公里</span>
                </div>
            `;
            marker.bindPopup(popupContent);
            landmarkMarkers.push(marker);
            
            // 綁定地圖 Marker 實例到物件上，供外部點擊列表聯動
            landmark.markerInstance = marker;
        }
    });
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

    points.forEach(point => {
        const distance = jsHaversine(centerLat, centerLng, point.lat, point.lng);
        const isInside = distance <= centerRadius;

        if (isInside) {
            insideCount++;
        }

        const marker = L.marker([point.lat, point.lng], {
            icon: isInside ? markerIconInside : markerIconOutside
        }).addTo(mapInstance);

        const statusLabel = isInside ? '範圍內 (已涵蓋)' : '範圍外 (未涵蓋)';
        const fallbackLabel = point.fallback ? `<br/><span style="color: var(--text-muted); font-size: 0.7rem; font-style: italic;">(找不到精確門牌，已退化定位至：${point.fallback_address})</span>` : '';
        const statusClass = isInside ? 'inside' : 'outside';
        const popupHtml = `
            <div class="map-popup-card">
                <h3>匯入參考地址</h3>
                <p style="font-size:0.85rem; margin-top:4px;">${point.address}${fallbackLabel}</p>
                <span class="popup-dist">距離中心：${formatDistance(distance)}</span><br/>
                <span class="popup-status ${statusClass}">${statusLabel}</span>
            </div>
        `;
        marker.bindPopup(popupHtml);
        importedMarkers.push(marker);
    });

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
            markerInstance.openPopup();
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
