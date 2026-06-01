import { DEFAULT_LAT, DEFAULT_LNG, DEFAULT_RADIUS, DEFAULT_ADDRESS } from './config.js';
import { saveStoredCenter, saveStoredRadius, getStoredData } from './storage.js';
import { parseMarkdownAddresses, parseImportedFile } from './parser.js';
import { fetchGeocodeSingle, fetchAnalyzeBuffer } from './api.js';
import { 
    initMapInstance, 
    setCenterPosition, 
    setBufferRadius, 
    drawLandmarks, 
    drawImportedPoints,
    forceInvalidateSize,
    focusOnLocation
} from './map.js';

document.addEventListener('DOMContentLoaded', () => {
    // 優先從 localStorage 讀取記憶點，否則使用預設值
    const stored = getStoredData();
    let currentLat = stored.lat || DEFAULT_LAT;
    let currentLng = stored.lng || DEFAULT_LNG;
    let currentRadius = stored.radius || DEFAULT_RADIUS;
    let currentAddress = stored.address || DEFAULT_ADDRESS;
    
    // 初始化多行文字框的核心起始點地址
    const coreAddressInput = document.getElementById('core-address-input');
    coreAddressInput.value = currentAddress;

    let importedPoints = [];  // 快取批次匯入點的經緯度與地址資料 [{address, lat, lng}]

    // UI 元素
    const radiusSlider = document.getElementById('radius-slider');
    const radiusVal = document.getElementById('radius-val');
    const centerLatEl = document.getElementById('center-lat');
    const centerLngEl = document.getElementById('center-lng');
    const statAreaEl = document.getElementById('stat-area');
    const statCountEl = document.getElementById('stat-count');
    const landmarksList = document.getElementById('landmarks-list');
    const toggleOutsideCheckbox = document.getElementById('toggle-outside');
    
    const geocodeBtn = document.getElementById('geocode-btn');
    const batchAddressInput = document.getElementById('batch-address-input');
    const importCustomBtn = document.getElementById('import-custom-btn');
    const importMdBtn = document.getElementById('import-md-btn');
    const mdFileInput = document.getElementById('md-file-input');
    const importStatusMsg = document.getElementById('import-status-msg');
    
    const parseProgressContainer = document.getElementById('parse-progress-container');
    const parseProgressFill = document.getElementById('parse-progress-fill');
    const parseProgressVal = document.getElementById('parse-progress-val');
    const parseProgressDetail = document.getElementById('parse-progress-detail');
    
    const importTotalCountEl = document.getElementById('import-total-count');
    const importInsideCountEl = document.getElementById('import-inside-count');
    const importCoverageRateEl = document.getElementById('import-coverage-rate');
    const importCoverageRateFill = document.getElementById('import-coverage-rate-fill');
    
    const downloadScreenshotBtn = document.getElementById('download-screenshot-btn');
    const mdPathInput = document.getElementById('md-path-input');
    const importMdPathBtn = document.getElementById('import-md-path-btn');

    // 設定初始 UI 數值
    radiusSlider.value = currentRadius;
    radiusVal.textContent = currentRadius;
    updateCoordDisplay(currentLat, currentLng);

    // 1. 初始化地圖
    initMapInstance(
        'map', 
        currentLat, 
        currentLng, 
        currentRadius,
        // 拖曳中 callback
        (lat, lng) => {
            currentLat = lat;
            currentLng = lng;
            updateCoordDisplay(lat, lng);
            updateImportedPointsCoverage();
        },
        // 點擊/拖曳結束 callback
        (lat, lng) => {
            currentLat = lat;
            currentLng = lng;
            // 記憶中心點座標（此時地址變更，故用座標格式替代）
            currentAddress = `經緯度座標: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            coreAddressInput.value = currentAddress;
            saveStoredCenter(lat, lng, currentAddress);
            performAnalysis();
        }
    );

    // 更新經緯度 UI 顯示
    function updateCoordDisplay(lat, lng) {
        centerLatEl.textContent = lat.toFixed(5);
        centerLngEl.textContent = lng.toFixed(5);
    }
    
    // JS Haversine 距離計算
    function jsHaversine(lat1, lon1, lat2, lon2) {
        const R = 6371000.0;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function formatDistance(meters) {
        if (meters < 1000) {
            return `${meters.toFixed(0)} 公尺`;
        } else {
            return `${(meters / 1000).toFixed(2)} 公里`;
        }
    }

    // 地址定位定位中心
    async function locateAddress() {
        const address = coreAddressInput.value.trim();
        if (!address) {
            showStatusMsg(importStatusMsg, "請輸入中心點地址", "error");
            return;
        }

        showStatusMsg(importStatusMsg, "正在搜尋地址...", "info");
        try {
            const data = await fetchGeocodeSingle(address);
            if (data.success) {
                currentLat = data.lat;
                currentLng = data.lng;
                currentAddress = address;
                
                // 儲存至 localStorage 記憶中心點
                saveStoredCenter(currentLat, currentLng, currentAddress);
                
                // 更新地圖與 Marker 位置
                setCenterPosition(currentLat, currentLng);
                updateCoordDisplay(currentLat, currentLng);
                
                // 觸發重新分析與即時涵蓋率
                updateImportedPointsCoverage();
                performAnalysis();
                if (data.fallback) {
                    showStatusMsg(importStatusMsg, `門牌定位失敗，已自動降級定位至路段：${data.fallback_address}`, "info");
                } else {
                    showStatusMsg(importStatusMsg, `已定位至: ${address}`, "success");
                }
            } else {
                throw new Error("解析失敗");
            }
        } catch (error) {
            console.error("Geocoding center error:", error);
            showStatusMsg(importStatusMsg, `定位失敗: ${error.message}。您可以點擊地圖手動進行定位。`, "error");
        }
    }

    // 狀態訊息提示輔助函式
    function showStatusMsg(el, text, type) {
        el.textContent = text;
        el.className = `status-msg ${type}`;
        setTimeout(() => {
            if (type !== 'error') {
                el.textContent = '';
                el.className = 'status-msg';
            }
        }, 5000);
    }

    // 空間交集與涵蓋率即時計算
    function updateImportedPointsCoverage() {
        const totalPoints = importedPoints.length;
        if (totalPoints === 0) {
            importTotalCountEl.textContent = "0";
            importInsideCountEl.textContent = "0";
            importCoverageRateEl.textContent = "0%";
            importCoverageRateFill.style.width = "0%";
            return;
        }

        // 調用 map 繪製模組
        const insideCount = drawImportedPoints(
            importedPoints, 
            currentLat, 
            currentLng, 
            currentRadius, 
            jsHaversine, 
            formatDistance
        );

        // 更新 UI
        const coverageRate = (insideCount / totalPoints) * 100;
        importTotalCountEl.textContent = totalPoints;
        importInsideCountEl.textContent = insideCount;
        importCoverageRateEl.textContent = `${coverageRate.toFixed(1)}%`;
        importCoverageRateFill.style.width = `${coverageRate}%`;
    }

    // 批次地址非同步佇列解析
    async function queueImportAddresses(addresses) {
        if (!addresses || addresses.length === 0) {
            showStatusMsg(importStatusMsg, "無有效的匯入地址", "error");
            return;
        }

        parseProgressContainer.style.display = 'block';
        parseProgressFill.style.width = '0%';
        parseProgressVal.textContent = '0%';
        parseProgressDetail.textContent = `準備解析... 0 / ${addresses.length} 筆`;
        showStatusMsg(importStatusMsg, `開始非同步解析 ${addresses.length} 筆地址，請稍候...`, "info");
        
        importedPoints = []; 
        updateImportedPointsCoverage();
        
        let successCount = 0;
        let failCount = 0;
        const total = addresses.length;
        
        for (let i = 0; i < total; i++) {
            const addr = addresses[i];
            const pct = Math.round((i / total) * 100);
            parseProgressFill.style.width = `${pct}%`;
            parseProgressVal.textContent = `${pct}%`;
            parseProgressDetail.textContent = `解析中: ${i} / ${total} 筆 (成功: ${successCount}, 失敗: ${failCount})`;
            
            try {
                const data = await fetchGeocodeSingle(addr);
                if (data.success) {
                    successCount++;
                    importedPoints.push({
                        address: data.address,
                        lat: data.lat,
                        lng: data.lng,
                        fallback: data.fallback || false,
                        fallback_address: data.fallback_address || null
                    });
                    updateImportedPointsCoverage();
                } else {
                    failCount++;
                }
                
                if (!data.cached) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error(`解析地址失敗 (${addr}):`, error);
                failCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        parseProgressFill.style.width = '100%';
        parseProgressVal.textContent = '100%';
        parseProgressDetail.textContent = `解析完成: 共 ${total} 筆 (成功: ${successCount}, 失敗: ${failCount})`;
        
        if (failCount > 0) {
            showStatusMsg(importStatusMsg, `匯入完成。成功: ${successCount}，失敗: ${failCount}`, "info");
        } else {
            showStatusMsg(importStatusMsg, `成功匯入所有 ${successCount} 個地址！`, "success");
        }
        
        setTimeout(() => {
            parseProgressContainer.style.display = 'none';
        }, 5000);
    }

    // 後端預設地標環域分析
    async function performAnalysis() {
        showLoading();
        try {
            const data = await fetchAnalyzeBuffer(currentLat, currentLng, currentRadius);
            renderResults(data);
        } catch (error) {
            console.error('環域分析錯誤:', error);
            landmarksList.innerHTML = `
                <div class="error-state">
                    <span class="error-icon">⚠️</span>
                    <p>無法取得環域分析資料，請確認後端服務是否已啟動。</p>
                </div>
            `;
        }
    }
    
    function showLoading() {
        landmarksList.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>正在分析空間緩衝區...</p>
            </div>
        `;
    }
    
    function renderResults(data) {
        updateCoordDisplay(data.center.lat, data.center.lng);
        statAreaEl.textContent = data.summary.area_sq_km.toFixed(2);
        statCountEl.textContent = data.summary.inside_count;
        
        landmarksList.innerHTML = '';
        
        const showOutside = toggleOutsideCheckbox.checked;
        const allLandmarks = [
            ...data.inside.map(item => ({ ...item, isInside: true })),
            ...data.outside.map(item => ({ ...item, isInside: false }))
        ].sort((a, b) => a.distance - b.distance);
        
        if (allLandmarks.length === 0) {
            landmarksList.innerHTML = '<p class="empty-state">無地標資料</p>';
            return;
        }
        
        // 呼叫地圖繪製模組
        drawLandmarks(allLandmarks, showOutside);
        
        // 渲染側邊欄卡片
        allLandmarks.forEach(landmark => {
            const { name, category, lat, lng, description, distance, isInside } = landmark;
            
            const card = document.createElement('div');
            card.className = `landmark-card ${isInside ? 'in-buffer' : 'out-buffer'}`;
            if (!isInside && !showOutside) {
                card.classList.add('hidden');
            }
            
            card.innerHTML = `
                <div class="card-header-row">
                    <span class="landmark-name">${name}</span>
                    <span class="badge badge-category">${category}</span>
                </div>
                <p class="landmark-desc">${description}</p>
                <div class="card-footer-row">
                    <span class="distance-tag">距離: ${formatDistance(distance)}</span>
                    <span class="status-badge">${isInside ? '● 範圍內' : '○ 範圍外'}</span>
                </div>
            `;
            
            card.addEventListener('click', () => {
                // 移動並顯示 Popup
                focusOnLocation(lat, lng, landmark.markerInstance);
            });
            
            landmarksList.appendChild(card);
        });
    }

    // 事件註冊與綁定
    geocodeBtn.addEventListener('click', locateAddress);
    coreAddressInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            locateAddress();
        }
    });

    importCustomBtn.addEventListener('click', () => {
        const text = batchAddressInput.value.trim();
        if (!text) {
            showStatusMsg(importStatusMsg, "請輸入要解析的地址列表", "error");
            return;
        }
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        queueImportAddresses(lines);
    });

    importMdBtn.addEventListener('click', () => {
        mdFileInput.click();
    });

    mdFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showStatusMsg(importStatusMsg, `已選取檔案: ${file.name}，正在讀取...`, "info");
        const reader = new FileReader();
        reader.onload = function(evt) {
            const content = evt.target.result;
            
            // 取得檔案副檔名
            const dotIdx = file.name.lastIndexOf('.');
            const ext = dotIdx !== -1 ? file.name.substring(dotIdx + 1) : '';
            
            const parsedAddresses = parseImportedFile(content, ext);
            
            if (parsedAddresses.length === 0) {
                showStatusMsg(importStatusMsg, "在選取的檔案中未發現有效地址！", "error");
                return;
            }

            batchAddressInput.value = parsedAddresses.join('\n');
            queueImportAddresses(parsedAddresses);
        };
        reader.onerror = function() {
            showStatusMsg(importStatusMsg, "讀取檔案失敗！", "error");
        };
        reader.readAsText(file);
        
        e.target.value = '';
    });

    radiusSlider.addEventListener('input', (e) => {
        currentRadius = parseInt(e.target.value);
        radiusVal.textContent = currentRadius;
        setBufferRadius(currentRadius);
        saveStoredRadius(currentRadius);
        updateImportedPointsCoverage();
    });
    
    radiusSlider.addEventListener('change', () => {
        performAnalysis();
    });
    
    toggleOutsideCheckbox.addEventListener('change', () => {
        performAnalysis();
    });
    
    // 載入本地電腦指定的絕對路徑檔案
    importMdPathBtn.addEventListener('click', async () => {
        const path = mdPathInput.value.trim();
        if (!path) {
            showStatusMsg(importStatusMsg, "請輸入本地檔案絕對路徑", "error");
            return;
        }

        showStatusMsg(importStatusMsg, `正在向後端請求讀取本地檔案: ${path}...`, "info");
        try {
            const response = await fetch(`/api/read-local-md?path=${encodeURIComponent(path)}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "讀取檔案失敗");
            }
            const data = await response.json();
            if (data.success && data.content) {
                // 取得檔案副檔名以利智慧解析
                const dotIdx = path.lastIndexOf('.');
                const ext = dotIdx !== -1 ? path.substring(dotIdx + 1) : '';
                
                const parsedAddresses = parseImportedFile(data.content, ext);
                if (parsedAddresses.length === 0) {
                    showStatusMsg(importStatusMsg, "在該檔案中未發現有效地址！", "error");
                    return;
                }
                batchAddressInput.value = parsedAddresses.join('\n');
                queueImportAddresses(parsedAddresses);
            } else {
                throw new Error("讀取到的檔案內容為空");
            }
        } catch (error) {
            console.error("讀取本地檔案失敗:", error);
            showStatusMsg(importStatusMsg, `載入失敗: ${error.message}`, "error");
        }
    });

    // 點擊截圖下載
    downloadScreenshotBtn.addEventListener('click', () => {
        showStatusMsg(importStatusMsg, "正在產生網頁截圖，請稍候...", "info");
        
        const container = document.getElementById('app-container');
        html2canvas(container, {
            useCORS: true,
            allowTaint: false,
            scale: 2, // 提升清晰度，適合 Retina 螢幕
            backgroundColor: '#080C14' // 對應 CSS 的 --bg-base
        }).then(canvas => {
            try {
                const link = document.createElement('a');
                link.download = `GIS_Studio_Screenshot_${new Date().toISOString().slice(0,10)}_${Math.floor(Math.random()*1000)}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showStatusMsg(importStatusMsg, "截圖下載完成！📸", "success");
            } catch (err) {
                console.error("產生圖片網址失敗，可能為 CORS 限制或畫布污染 (Tainted Canvas)：", err);
                showStatusMsg(importStatusMsg, `截圖失敗: ${err.message}`, "error");
            }
        }).catch(err => {
            console.error("html2canvas 轉換失敗:", err);
            showStatusMsg(importStatusMsg, `截圖失敗: ${err.message}`, "error");
        });
    });
    
    // 初始化執行首次分析與大小重新計算，保證載入時正常呈現
    performAnalysis();
    setTimeout(() => forceInvalidateSize(), 300);
});
