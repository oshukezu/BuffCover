// 後端 API 通訊請求與純前端自動退化 (Fallback) 模組
import { LANDMARKS } from './config.js';

/**
 * 空間距離計算 (Haversine 公式)
 */
function localHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371000.0;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * 請求單一地址地理編碼 (優先請求 FastAPI 後端快取，若失敗或處於純靜態託管則自動向 OSM Nominatim 公用 API 請求)
 * @param {string} address - 門牌地址
 * @returns {Promise<object>} 解析結果物件，包含 lat, lng, success, cached
 */
export async function fetchGeocodeSingle(address) {
    try {
        // 1. 優先嘗試請求本地後端 API
        const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.warn("無法連接本地後端服務，自動退化為純前端公用 Nominatim 定位Fallback機制:", e);
    }
    
    // 2. 後端不可用時，直接請求 OSM Nominatim 公用 API
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("公用地理定位服務請求失敗");
    }
    
    const resData = await response.json();
    if (resData && resData.length > 0) {
        return {
            address: address,
            lat: parseFloat(resData[0].lat),
            lng: parseFloat(resData[0].lon),
            success: true,
            cached: false // 純前端不支援本地持久化快取
        };
    } else {
        // 如果直接定位失敗，嘗試模糊退化定位（僅搜尋路段）
        const match = address.match(/^(.*?(?:路|街|大道|段))/);
        if (match) {
            const fallbackQ = match[1];
            if (fallbackQ !== address) {
                const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQ)}&limit=1`;
                const fallbackRes = await fetch(fallbackUrl);
                if (fallbackRes.ok) {
                    const fallbackData = await fallbackRes.json();
                    if (fallbackData && fallbackData.length > 0) {
                        return {
                            address: address,
                            lat: parseFloat(fallbackData[0].lat),
                            lng: parseFloat(fallbackData[0].lon),
                            success: true,
                            cached: false,
                            fallback: true,
                            fallback_address: fallbackQ
                        };
                    }
                }
            }
        }
        throw new Error("無法解析該地址");
    }
}

/**
 * 請求環域緩衝區空間分析 (優先請求 FastAPI 後端，若失敗或處於純靜態託管則自動在前端執行 Haversine 距離統計)
 * @param {number} lat - 中心點緯度
 * @param {number} lng - 中心點經度
 * @param {number} radius - 分析半徑 (公尺)
 * @returns {Promise<object>} 分析結果，包含範圍內外的地標與統計摘要
 */
export async function fetchAnalyzeBuffer(lat, lng, radius) {
    try {
        // 1. 優先嘗試請求本地後端 API
        const url = `/api/analyze?lat=${lat}&lng=${lng}&radius=${radius}`;
        const response = await fetch(url);
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.warn("無法連接本地後端服務，自動退化為純前端 Haversine 空間分析Fallback機制:", e);
    }
    
    // 2. 後端不可用時，執行純前端分析邏輯 (無伺服器模式)
    const insideList = [];
    const outsideList = [];
    
    LANDMARKS.forEach(landmark => {
        const distance = localHaversine(lat, lng, landmark.lat, landmark.lng);
        const landmarkInfo = {
            ...landmark,
            distance: Math.round(distance * 10) / 10
        };
        
        if (distance <= radius) {
            insideList.push(landmarkInfo);
        } else {
            outsideList.push(landmarkInfo);
        }
    });
    
    insideList.sort((a, b) => a.distance - b.distance);
    outsideList.sort((a, b) => a.distance - b.distance);
    const areaSqKm = Math.PI * Math.pow(radius / 1000, 2);
    
    return {
        center: { lat: lat, lng: lng },
        radius: radius,
        inside: insideList,
        outside: outsideList,
        summary: {
            total_landmarks: LANDMARKS.length,
            inside_count: insideList.length,
            outside_count: outsideList.length,
            area_sq_km: Math.round(areaSqKm * 1000) / 1000
        }
    };
}
