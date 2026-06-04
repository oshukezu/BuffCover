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
 * TWD97 TM2 坐標反算為 WGS84 經緯度
 */
function twd97_to_wgs84(x, y) {
    const a = 6378137.0;
    const b = 6356752.314245;
    const lon0 = 121 * Math.PI / 180;
    const k0 = 0.9999;
    const dx = 250000;
    
    const dy = y;
    const dx_proj = x - dx;
    
    const e = Math.sqrt(1 - Math.pow(b / a, 2));
    const e2 = Math.pow(e, 2) / (1 - Math.pow(e, 2));
    const M = dy / k0;
    
    const mu = M / (a * (1 - Math.pow(e, 2)/4 - 3*Math.pow(e, 4)/64 - 5*Math.pow(e, 6)/256));
    const e1 = (1 - Math.sqrt(1 - Math.pow(e, 2))) / (1 + Math.sqrt(1 - Math.pow(e, 2)));
    
    const J1 = (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32);
    const J2 = (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32);
    const J3 = (151 * Math.pow(e1, 3) / 96);
    
    const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu);
    
    const C1 = e2 * Math.pow(Math.cos(fp), 2);
    const T1 = Math.pow(Math.tan(fp), 2);
    const R1 = a * (1 - Math.pow(e, 2)) / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2), 1.5);
    const N1 = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2));
    const D = dx_proj / (N1 * k0);
    
    const Q1 = D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6;
    const Q2 = (5 - 2 * C1 + 28 * T1 - 3 * Math.pow(C1, 2) + 8 * T1 * C1 + 24 * Math.pow(T1, 2)) * Math.pow(D, 5) / 120;
    const Q3 = fp - (N1 * Math.tan(fp) / R1) * (Math.pow(D, 2) / 2 - (5 + 3 * T1 + 10 * C1 - 4 * Math.pow(C1, 2) - 9 * e2) * Math.pow(D, 4) / 24 + (61 + 90 * T1 + 298 * C1 + 45 * Math.pow(T1, 2) - 252 * e2 - 3 * Math.pow(C1, 2)) * Math.pow(D, 6) / 720);
    
    const lat = Q3 * 180 / Math.PI;
    const lng = (lon0 + (Q1 + Q2) / Math.cos(fp)) * 180 / Math.PI;
    
    return { lat, lng };
}

/**
 * 透過 TGOS.TGLocateService 進行地址定位 (保證與 OSM WGS84 坐標一致)
 */
function tgosGeocodePromise(address) {
    return new Promise((resolve, reject) => {
        if (typeof TGOS === 'undefined' || !TGOS.TGLocateService) {
            return reject(new Error("TGOS SDK 未載入"));
        }
        
        try {
            const locator = new TGOS.TGLocateService();
            // 優先嘗試 locateWGS84
            const locateFn = locator.locateWGS84 ? locator.locateWGS84.bind(locator) : locator.locateTWD97.bind(locator);
            const isWGS84Direct = !!locator.locateWGS84;
            
            locateFn({ address: address }, (result, status) => {
                if (status === TGOS.TGLocatorStatus.OK && result && result.length > 0) {
                    const loc = result[0].geometry.location;
                    let lat = loc.y;
                    let lng = loc.x;
                    
                    // 座標一致性檢查：若 X 大於 180，說明 TGOS 給的是 TWD97 座標，進行轉換
                    if (lng > 180) {
                        const wgs84 = twd97_to_wgs84(lng, lat);
                        lat = wgs84.lat;
                        lng = wgs84.lng;
                    }
                    
                    resolve({
                        address: address,
                        lat: lat,
                        lng: lng,
                        success: true,
                        cached: false
                    });
                } else {
                    reject(new Error(`TGOS 定位無有效結果，狀態: ${status}`));
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * 請求單一地址地理編碼 (優先請求 FastAPI 後端快取，若未命中則在前端利用 TGOS 定位並同步至後端，最後退化為 OSM Nominatim)
 * @param {string} address - 門牌地址
 * @returns {Promise<object>} 解析結果物件，包含 lat, lng, success, cached
 */
export async function fetchGeocodeSingle(address) {
    // 1. 優先嘗試請求本地後端 API 快取
    try {
        const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
        if (response.ok) {
            const cacheResult = await response.json();
            if (cacheResult && cacheResult.success) {
                return cacheResult;
            }
        }
    } catch (e) {
        console.warn("後端連線失敗，改用前端即時定位流程:", e);
    }
    
    // 2. 後端未命中或不可用，優先嘗試 TGOS 定位並非同步寫回後端快取
    if (typeof TGOS !== 'undefined') {
        try {
            const tgosResult = await tgosGeocodePromise(address);
            if (tgosResult && tgosResult.success) {
                // 非同步將結果同步回後端快取，供下次快速查詢
                fetch('/api/cache-address', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        address: address,
                        lat: tgosResult.lat,
                        lng: tgosResult.lng
                    })
                }).catch(err => console.warn("同步寫入後端快取失敗:", err));
                
                return tgosResult;
            }
        } catch (tgosErr) {
            console.warn(`TGOS 定位失敗，將 Fallback 至 OSM: ${tgosErr.message}`);
        }
    }
    
    // 3. TGOS 失敗或未載入時，退化為 OSM Nominatim 公用 API
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
            cached: false
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
