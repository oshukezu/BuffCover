// 本地儲存 (localStorage) 管理模組，用於記憶最後一次定位的核心與設定值

/**
 * 記憶最後一次定位的中心座標與地址
 * @param {number} lat - 緯度
 * @param {number} lng - 經度
 * @param {string} address - 地址名稱
 */
export function saveStoredCenter(lat, lng, address) {
    try {
        localStorage.setItem('center_lat', lat);
        localStorage.setItem('center_lng', lng);
        localStorage.setItem('center_address', address);
    } catch (e) {
        console.error("無法寫入 localStorage (緯度/經度):", e);
    }
}

/**
 * 記憶最後設定的分析半徑
 * @param {number} radius - 半徑 (公尺)
 */
export function saveStoredRadius(radius) {
    try {
        localStorage.setItem('center_radius', radius);
    } catch (e) {
        console.error("無法寫入 localStorage (半徑):", e);
    }
}

/**
 * 讀取已記憶的本地設定值
 * @returns {object} 包含 lat, lng, radius, address 的物件（若無快取則值為 null）
 */
export function getStoredData() {
    try {
        const latStr = localStorage.getItem('center_lat');
        const lngStr = localStorage.getItem('center_lng');
        const radiusStr = localStorage.getItem('center_radius');
        const address = localStorage.getItem('center_address');
        
        return {
            lat: latStr ? parseFloat(latStr) : null,
            lng: lngStr ? parseFloat(lngStr) : null,
            radius: radiusStr ? parseInt(radiusStr, 10) : null,
            address: address || null
        };
    } catch (e) {
        console.error("無法自 localStorage 讀取快取設定:", e);
        return { lat: null, lng: null, radius: null, address: null };
    }
}
