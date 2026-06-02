// 本地儲存 (localStorage 與 Cookie) 管理模組，用於記憶最後一次定位的核心與設定值

/**
 * 寫入 Cookie
 * @param {string} name - Cookie 名稱
 * @param {string} value - Cookie 值
 * @param {number} days - 保存天數
 */
export function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    // 使用 encodeURIComponent 處理中文字元以防編碼錯誤，並設定 path=/ 保證全站可用
    document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/; SameSite=Lax";
}

/**
 * 讀取 Cookie
 * @param {string} name - Cookie 名稱
 * @returns {string|null} Cookie 值，若不存在則回傳 null
 */
export function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    return null;
}

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
        
        // 核心需求：核心起始點地址在瀏覽器生成 cookie 記憶 (保存 365 天)
        setCookie('center_address', address, 365);
        
        // 同步在 localStorage 也留一份備份
        localStorage.setItem('center_address', address);
    } catch (e) {
        console.error("無法寫入本地儲存 (緯度/經度/地址):", e);
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
        
        // 核心需求：優先自 Cookie 讀取核心地址，若無則降級讀取 localStorage
        let address = getCookie('center_address');
        if (!address) {
            address = localStorage.getItem('center_address');
        }
        
        return {
            lat: latStr ? parseFloat(latStr) : null,
            lng: lngStr ? parseFloat(lngStr) : null,
            radius: radiusStr ? parseInt(radiusStr, 10) : null,
            address: address || null
        };
    } catch (e) {
        console.error("無法自本地儲存讀取設定:", e);
        return { lat: null, lng: null, radius: null, address: null };
    }
}
