import { DEFAULT_LAT, DEFAULT_LNG, DEFAULT_RADIUS, DEFAULT_ADDRESS } from './config.js';
import { applyTranslations, translations } from './i18n.js';
import { saveStoredCenter, saveStoredRadius, getStoredData, setCookie, getCookie } from './storage.js';
import { parseMarkdownAddresses, parseImportedFile } from './parser.js';
import { fetchGeocodeSingle } from './api.js';
import { 
    initMapInstance, 
    setCenterPosition, 
    setBufferRadius, 
    drawGisLayer,
    getCentroid,
    drawImportedPoints,
    forceInvalidateSize,
    focusOnLocation,
    switchMapStyle
} from './map.js';

document.addEventListener('DOMContentLoaded', () => {
    // 優先從 localStorage 讀取記憶點，否則使用預設值
    const stored = getStoredData();
    let currentLat = stored.lat || DEFAULT_LAT;
    let currentLng = stored.lng || DEFAULT_LNG;
    let currentRadius = stored.radius || DEFAULT_RADIUS;
    let currentAddress = stored.address || DEFAULT_ADDRESS;
    
    // V2.9 優先從 Cookie 讀取語系，若無則預設為 zh (繁中)
    let currentLang = getCookie('gis_lang') || 'zh';
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        langSelect.value = currentLang;
    }
    applyTranslations(currentLang);
    
    // 初始化多行文字框的核心起始點地址
    const coreAddressInput = document.getElementById('core-address-input');
    coreAddressInput.value = currentAddress;

    let importedPoints = [];      // 快取批次匯入點的經緯度與地址資料 [{address, lat, lng}]
    let gisGeoJson = null;        // 快取載入的 GIS GeoJSON 資料
    let isParsingAborted = false; // 地址解析中斷 Flag

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
    const mapStyleSelect = document.getElementById('map-style-select');

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
            currentAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            coreAddressInput.value = currentAddress;
            saveStoredCenter(lat, lng, currentAddress);
            updateImportedPointsCoverage();
            performGisAnalysis();
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
            return `${meters.toFixed(0)} ${currentLang === 'zh' ? '公尺' : (currentLang === 'en' ? 'm' : 'メートル')}`;
        } else {
            return `${(meters / 1000).toFixed(2)} ${currentLang === 'zh' ? '公里' : (currentLang === 'en' ? 'km' : 'キロ')}`;
        }
    }

    // 地址定位定位中心
    async function locateAddress() {
        const address = coreAddressInput.value.trim();
        if (!address) {
            showStatusMsg(importStatusMsg, currentLang === 'zh' ? "請輸入中心點地址" : (currentLang === 'en' ? "Please enter center address" : "中心の住所を入力してください"), "error");
            return;
        }

        const infoMsg = currentLang === 'zh' ? "正在搜尋地址..." : (currentLang === 'en' ? "Searching address..." : "住所を検索中...");
        showStatusMsg(importStatusMsg, infoMsg, "info");
        try {
            const data = await fetchGeocodeSingle(address);
            if (data.success) {
                currentLat = data.lat;
                currentLng = data.lng;
                currentAddress = address;
                
                // 儲存至 Cookie (V2.8)
                saveStoredCenter(currentLat, currentLng, currentAddress);
                
                // 更新地圖與 Marker 位置
                setCenterPosition(currentLat, currentLng);
                updateCoordDisplay(currentLat, currentLng);
                
                // 觸發重新分析與即時涵蓋率
                updateImportedPointsCoverage();
                performGisAnalysis();
                if (data.fallback) {
                    const fallbackMsg = currentLang === 'zh' ? `門牌定位失敗，已自動降級定位至路段：${data.fallback_address}` : (currentLang === 'en' ? `Doorplate failed, auto fallback to road: ${data.fallback_address}` : `正確な番地が見つからないため、道路レベルに退避しました：${data.fallback_address}`);
                    showStatusMsg(importStatusMsg, fallbackMsg, "info");
                } else {
                    const successMsg = currentLang === 'zh' ? `已定位至: ${address}` : (currentLang === 'en' ? `Located: ${address}` : `位置特定完了: ${address}`);
                    showStatusMsg(importStatusMsg, successMsg, "success");
                }
            } else {
                throw new Error("Geocoding failed");
            }
        } catch (error) {
            console.error("Geocoding center error:", error);
            const errMsg = currentLang === 'zh' ? `定位失敗。您可以點擊地圖手動進行定位。` : (currentLang === 'en' ? `Locate failed. You can click map to set center manually.` : `位置特定に失敗しました。地図をクリックして手動で設定できます。`);
            showStatusMsg(importStatusMsg, errMsg, "error");
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
            statCountEl.textContent = "0"; // 涵蓋地址數量同步歸零
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
        statCountEl.textContent = insideCount; // 核心修正：涵蓋地址數量等同涵蓋地址的結果
    }

    // 批次地址非同步佇列解析
    async function queueImportAddresses(addresses) {
        if (!addresses || addresses.length === 0) {
            showStatusMsg(importStatusMsg, currentLang === 'zh' ? '無有效的匯入地址' : (currentLang === 'en' ? 'No valid import addresses' : '有効な住所がありません'), "error");
            return;
        }

        isParsingAborted = false; // 每次開始前重設
        parseProgressContainer.style.display = 'block';
        parseProgressFill.style.width = '0%';
        parseProgressVal.textContent = '0%';
        parseProgressDetail.textContent = currentLang === 'zh' ? `準備解析... 0 / ${addresses.length} 筆` : (currentLang === 'en' ? `Preparing... 0 / ${addresses.length}` : `解析準備中... 0 / ${addresses.length}`);
        
        const infoMsg = currentLang === 'zh' ? `開始非同步解析 ${addresses.length} 筆地址，請稍候...` : (currentLang === 'en' ? `Starting async geocoding of ${addresses.length} addresses, please wait...` : `非同期で ${addresses.length} 件の住所を解析中、お待ちください...`);
        showStatusMsg(importStatusMsg, infoMsg, "info");
        
        importedPoints = []; 
        updateImportedPointsCoverage();
        
        let successCount = 0;
        let failCount = 0;
        const total = addresses.length;
        
        for (let i = 0; i < total; i++) {
            const dict = translations[currentLang] || translations.zh;
            if (isParsingAborted) {
                parseProgressDetail.textContent = currentLang === 'zh' ? `解析已手動停止: 已處理 ${i} / ${total} 筆 (成功: ${successCount}, 失敗: ${failCount})` : (currentLang === 'en' ? `Cancelled: Processed ${i}/${total} (Success: ${successCount}, Fail: ${failCount})` : `中断: 処理済み ${i}/${total} (成功: ${successCount}, 失敗: ${failCount})`);
                showStatusMsg(importStatusMsg, dict.status_parsing_aborted, "info");
                setTimeout(() => {
                    parseProgressContainer.style.display = 'none';
                }, 5000);
                return;
            }
            
            const addr = addresses[i];
            const pct = Math.round((i / total) * 100);
            parseProgressFill.style.width = `${pct}%`;
            parseProgressVal.textContent = `${pct}%`;
            parseProgressDetail.textContent = currentLang === 'zh' ? `解析中: ${i} / ${total} 筆 (成功: ${successCount}, 失敗: ${failCount})` : (currentLang === 'en' ? `Geocoding: ${i}/${total} (Success: ${successCount}, Fail: ${failCount})` : `解析中: ${i}/${total} (成功: ${successCount}, 失敗: ${failCount})`);
            
            try {
                const data = await fetchGeocodeSingle(addr);
                if (isParsingAborted) {
                    parseProgressDetail.textContent = currentLang === 'zh' ? `解析已手動停止: 已處理 ${i + 1} / ${total} 筆 (成功: ${successCount}, 失敗: ${failCount})` : (currentLang === 'en' ? `Cancelled: Processed ${i+1}/${total} (Success: ${successCount}, Fail: ${failCount})` : `中断: 処理済み ${i+1}/${total} (成功: ${successCount}, 失敗: ${failCount})`);
                    showStatusMsg(importStatusMsg, dict.status_parsing_aborted, "info");
                    setTimeout(() => {
                        parseProgressContainer.style.display = 'none';
                    }, 5000);
                    return;
                }
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
        parseProgressDetail.textContent = currentLang === 'zh' ? `解析完成: 共 ${total} 筆 (成功: ${successCount}, 失敗: ${failCount})` : (currentLang === 'en' ? `Done: Total ${total} (Success: ${successCount}, Fail: ${failCount})` : `完了: 合計 ${total} (成功: ${successCount}, 失敗: ${failCount})`);
        
        const doneMsg = currentLang === 'zh' ? `匯入完成。成功: ${successCount}，失敗: ${failCount}` : (currentLang === 'en' ? `Import finished. Success: ${successCount}, Fail: ${failCount}` : `インポート完了。成功: ${successCount}、失敗: ${failCount}`);
        showStatusMsg(importStatusMsg, doneMsg, "info");
        
        setTimeout(() => {
            parseProgressContainer.style.display = 'none';
        }, 5000);
    }

    // 客製化 GIS 圖層環域分析 (取代舊的 performAnalysis)
    function performGisAnalysis() {
        const dict = translations[currentLang] || translations.zh;
        
        // 更新中心點座標 UI 與面積顯示
        updateCoordDisplay(currentLat, currentLng);
        
        // 面積計算 A = Math.PI * (R_km)^2
        const radiusInKm = currentRadius / 1000;
        const areaSqKm = Math.PI * radiusInKm * radiusInKm;
        statAreaEl.textContent = areaSqKm.toFixed(2);
        
        if (!gisGeoJson || !gisGeoJson.features || gisGeoJson.features.length === 0) {
            // 還沒有載入 GIS 資料
            landmarksList.innerHTML = `
                <div class="empty-state">
                    <p data-i18n="landmarks_empty">${dict.landmarks_empty}</p>
                </div>
            `;
            return;
        }

        const showOutside = toggleOutsideCheckbox.checked;
        
        // 呼叫 map.js 的 drawGisLayer 進行地圖渲染與空間分析，取得落入範圍內的 features 陣列
        const insideFeatures = drawGisLayer(
            gisGeoJson,
            showOutside,
            currentLat,
            currentLng,
            currentRadius,
            jsHaversine,
            formatDistance
        );

        // 收集所有需要列出渲染的 features (如果顯示範圍外，則包含全部 features，否則僅包含範圍內)
        let renderFeatures = [];
        if (showOutside) {
            renderFeatures = [...gisGeoJson.features];
        } else {
            renderFeatures = [...insideFeatures];
        }

        // 照距離由近到遠排序
        renderFeatures.sort((a, b) => {
            const distA = a.properties._distance !== undefined ? a.properties._distance : Infinity;
            const distB = b.properties._distance !== undefined ? b.properties._distance : Infinity;
            return distA - distB;
        });

        if (renderFeatures.length === 0) {
            landmarksList.innerHTML = `
                <div class="empty-state">
                    <p data-i18n="landmarks_no_features">${dict.landmarks_no_features}</p>
                </div>
            `;
            return;
        }

        landmarksList.innerHTML = '';

        renderFeatures.forEach(feature => {
            const name = feature.properties.name || feature.properties.title || (currentLang === 'zh' ? '未命名要素' : (currentLang === 'en' ? 'Unnamed Feature' : '未命名の地物'));
            const geomType = feature.geometry.type;
            const distance = feature.properties._distance;
            const isInside = feature.properties._isInside;
            const centroid = feature.properties._centroid;
            
            // 決定幾何類型 Badge CSS 類別
            let badgeClass = 'badge-point';
            if (geomType === 'LineString' || geomType === 'MultiLineString') {
                badgeClass = 'badge-linestring';
            } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
                badgeClass = 'badge-polygon';
            }

            const statusLabel = isInside ? dict.map_inside : dict.map_outside;
            const card = document.createElement('div');
            card.className = `landmark-card ${isInside ? 'in-buffer' : 'out-buffer'}`;
            
            card.innerHTML = `
                <div class="card-header-row">
                    <span class="landmark-name" style="word-break: break-all; padding-right: 6px;">${name}</span>
                    <span class="badge ${badgeClass}">${geomType}</span>
                </div>
                <div class="card-footer-row" style="margin-top: 8px;">
                    <span class="distance-tag">${dict.map_dist_to_center}: ${formatDistance(distance)}</span>
                    <span class="status-badge" style="font-size:0.75rem; font-weight:700;">${statusLabel}</span>
                </div>
            `;

            card.addEventListener('click', () => {
                if (centroid && feature.properties._leafletLayer) {
                    focusOnLocation(centroid.lat, centroid.lng, feature.properties._leafletLayer);
                }
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
            showStatusMsg(importStatusMsg, currentLang === 'zh' ? "請輸入要解析的地址列表" : (currentLang === 'en' ? "Please enter addresses to parse" : "解析する住所リストを入力してください"), "error");
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

        const infoMsg = currentLang === 'zh' ? `已選取檔案: ${file.name}，正在讀取...` : (currentLang === 'en' ? `Selected file: ${file.name}, reading...` : `ファイル選択: ${file.name}、読み込み中...`);
        showStatusMsg(importStatusMsg, infoMsg, "info");
        const reader = new FileReader();
        reader.onload = function(evt) {
            const content = evt.target.result;
            
            // 取得檔案副檔名
            const dotIdx = file.name.lastIndexOf('.');
            const ext = dotIdx !== -1 ? file.name.substring(dotIdx + 1) : '';
            
            const parsedAddresses = parseImportedFile(content, ext);
            
            if (parsedAddresses.length === 0) {
                showStatusMsg(importStatusMsg, currentLang === 'zh' ? "在選取的檔案中未發現有效地址！" : (currentLang === 'en' ? "No valid address found in selected file!" : "選択したファイルに有効な住所が見つかりませんでした！"), "error");
                return;
            }

            batchAddressInput.value = parsedAddresses.join('\n');
            queueImportAddresses(parsedAddresses);
        };
        reader.onerror = function() {
            showStatusMsg(importStatusMsg, currentLang === 'zh' ? "讀取檔案失敗！" : (currentLang === 'en' ? "Read file failed!" : "ファイル読み込み失敗！"), "error");
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
        performGisAnalysis();
    });
    
    toggleOutsideCheckbox.addEventListener('change', () => {
        performGisAnalysis();
    });

    // 綁定停止解析按鈕
    const stopParseBtn = document.getElementById('stop-parse-btn');
    if (stopParseBtn) {
        stopParseBtn.addEventListener('click', () => {
            isParsingAborted = true;
        });
    }

    // 綁定 GIS 圖層載入與解析
    const importGisBtn = document.getElementById('import-gis-btn');
    const gisFileInput = document.getElementById('gis-file-input');
    const gisImportStatus = document.getElementById('gis-import-status');

    if (importGisBtn && gisFileInput) {
        importGisBtn.addEventListener('click', () => {
            gisFileInput.click();
        });

        gisFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            showStatusMsg(gisImportStatus, currentLang === 'zh' ? `正在讀取圖層: ${file.name}...` : (currentLang === 'en' ? `Reading layer: ${file.name}...` : `レイヤーを読み込み中: ${file.name}...`), "info");
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const text = evt.target.result;
                    const fileNameLower = file.name.toLowerCase();
                    
                    if (fileNameLower.endsWith('.kml')) {
                        const kmlDoc = new DOMParser().parseFromString(text, 'text/xml');
                        const parserError = kmlDoc.querySelector('parsererror');
                        if (parserError) {
                            throw new Error(currentLang === 'zh' ? "KML 格式解析失敗，非有效的 XML 格式！" : (currentLang === 'en' ? "KML parsing failed, invalid XML!" : "KMLの解析に失敗しました。無効なXMLです！"));
                        }
                        
                        gisGeoJson = toGeoJSON.kml(kmlDoc);
                        if (!gisGeoJson || !gisGeoJson.features || gisGeoJson.features.length === 0) {
                            throw new Error(currentLang === 'zh' ? "KML 檔案中未包含任何有效的地理要素！" : (currentLang === 'en' ? "KML file does not contain valid features!" : "KMLファイルに有効な地物が含まれていません！"));
                        }
                        
                        const successMsg = currentLang === 'zh' ? `成功載入 KML 圖層（${gisGeoJson.features.length} 個要素）` : (currentLang === 'en' ? `Successfully loaded KML (${gisGeoJson.features.length} features)` : `KMLの読み込みに成功しました（${gisGeoJson.features.length} 個の地物）`);
                        showStatusMsg(gisImportStatus, successMsg, "success");
                    } else {
                        gisGeoJson = JSON.parse(text);
                        if (!gisGeoJson || !gisGeoJson.features) {
                            throw new Error(currentLang === 'zh' ? "GeoJSON 格式不正確，缺乏 features 欄位！" : (currentLang === 'en' ? "Invalid GeoJSON, missing features field!" : "無効なGeoJSON、featuresフィールドがありません！"));
                        }
                        const successMsg = currentLang === 'zh' ? `成功載入 GeoJSON 圖層（${gisGeoJson.features.length} 個要素）` : (currentLang === 'en' ? `Successfully loaded GeoJSON (${gisGeoJson.features.length} features)` : `GeoJSONの読み込みに成功しました（${gisGeoJson.features.length} 個の地物）`);
                        showStatusMsg(gisImportStatus, successMsg, "success");
                    }
                    
                    performGisAnalysis();
                } catch (err) {
                    console.error("GIS 圖層載入錯誤:", err);
                    showStatusMsg(gisImportStatus, (currentLang === 'zh' ? '載入圖層失敗: ' : (currentLang === 'en' ? 'Load failed: ' : '読み込み失敗: ')) + err.message, "error");
                }
            };
            reader.onerror = function() {
                showStatusMsg(gisImportStatus, currentLang === 'zh' ? "讀取圖層檔案失敗！" : (currentLang === 'en' ? "Read file failed!" : "ファイル読み込み失敗！"), "error");
            };
            reader.readAsText(file);
            
            e.target.value = '';
        });
    }

    // 語言切換選擇 change 監聽 (V2.9)
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            currentLang = e.target.value;
            setCookie('gis_lang', currentLang, 365);
            applyTranslations(currentLang);
            
            // 即時多語重繪地圖 Popup 與側邊欄要素清單
            updateImportedPointsCoverage();
            performGisAnalysis();
        });
    }

    // 說明與宣告 Modal 彈窗 (V2.8)
    const tutorialModal = document.getElementById('tutorial-modal');
    const tutorialBtn = document.getElementById('tutorial-btn');
    const modalCloseX = document.getElementById('modal-close-x');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    function closeTutorialModal() {
        if (tutorialModal) {
            tutorialModal.style.display = 'none';
            setCookie('has_seen_tutorial', 'true', 30);
        }
    }

    function openTutorialModal() {
        if (tutorialModal) {
            tutorialModal.style.display = 'flex';
        }
    }

    if (tutorialBtn) {
        tutorialBtn.addEventListener('click', openTutorialModal);
    }
    if (modalCloseX) {
        modalCloseX.addEventListener('click', closeTutorialModal);
    }
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeTutorialModal);
    }
    if (tutorialModal) {
        tutorialModal.addEventListener('click', (e) => {
            if (e.target === tutorialModal) {
                closeTutorialModal();
            }
        });
    }

    // 首次造訪自動彈窗檢測
    const hasSeenTutorial = getCookie('has_seen_tutorial');
    if (!hasSeenTutorial) {
        setTimeout(() => {
            openTutorialModal();
        }, 600);
    }
    
    // 讀取與套用地圖底圖風格 (預設使用極簡曜石黑)
    const storedStyle = localStorage.getItem('gis-map-style') || 'carto-dark';
    if (mapStyleSelect) {
        mapStyleSelect.value = storedStyle;
        
        // 註冊地圖風格切換事件
        mapStyleSelect.addEventListener('change', (e) => {
            const selectedStyle = e.target.value;
            switchMapStyle(selectedStyle);
            localStorage.setItem('gis-map-style', selectedStyle);
        });
    }

    // 點擊截圖下載
    downloadScreenshotBtn.addEventListener('click', () => {
        showStatusMsg(importStatusMsg, currentLang === 'zh' ? "正在產生網頁截圖，請稍候..." : (currentLang === 'en' ? "Generating screenshot, please wait..." : "スクリーンショット作成中..."), "info");
        
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
                showStatusMsg(importStatusMsg, currentLang === 'zh' ? "截圖下載完成！📸" : (currentLang === 'en' ? "Screenshot downloaded! 📸" : "スクリーンショットをダウンロードしました！ 📸"), "success");
            } catch (err) {
                console.error("產生圖片網址失敗，可能為 CORS 限制或畫布污染 (Tainted Canvas)：", err);
                showStatusMsg(importStatusMsg, (currentLang === 'zh' ? '截圖失敗: ' : (currentLang === 'en' ? 'Screenshot failed: ' : 'キャプチャ失敗: ')) + err.message, "error");
            }
        }).catch(err => {
            console.error("html2canvas 轉換失敗:", err);
            showStatusMsg(importStatusMsg, (currentLang === 'zh' ? '截圖失敗: ' : (currentLang === 'en' ? 'Screenshot failed: ' : 'キャプチャ失敗: ')) + err.message, "error");
        });
    });
    
    // 初始化執行首次分析與大小重新計算，保證載入時正常呈現
    updateImportedPointsCoverage();
    performGisAnalysis();
    switchMapStyle(storedStyle); // 載入預設/快取的底圖風格
    setTimeout(() => forceInvalidateSize(), 300);
});
