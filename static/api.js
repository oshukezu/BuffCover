// 後端 API 通訊請求模組

/**
 * 請求單一地址地理編碼 (Nominatim API / 本地 Cache)
 * @param {string} address - 門牌地址
 * @returns {Promise<object>} 解析結果物件，包含 lat, lng, success, cached
 */
export async function fetchGeocodeSingle(address) {
    const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "地理編碼失敗");
    }
    return await response.json();
}

/**
 * 請求環域緩衝區空間分析
 * @param {number} lat - 中心點緯度
 * @param {number} lng - 中心點經度
 * @param {number} radius - 分析半徑 (公尺)
 * @returns {Promise<object>} 分析結果，包含範圍內外的地標與統計摘要
 */
export async function fetchAnalyzeBuffer(lat, lng, radius) {
    const url = `/api/analyze?lat=${lat}&lng=${lng}&radius=${radius}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('網路回應錯誤，無法取得分析結果');
    }
    return await response.json();
}
