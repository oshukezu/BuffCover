// 1. 第一層記憶體快取：防範單次匯入重複地址，提升二次查詢速度
const memoryCache = new Map();

/**
 * 2. 前端地址「減重與標準化」預處理 (Regex Clean)
 * 移除無助於定位的門牌後半段干擾字（如：樓層、室等）
 */
function cleanAddress(rawAddress) {
    if (!rawAddress) return '';
    let address = rawAddress.trim()
        .replace(/[\uFF10-\uFF19]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xfee0)) // 全形數字轉半形
        .replace(/臺/g, '台'); // 統一「台」字

    // 關鍵減重：利用正規表達式，直接砍掉「樓、室、之幾」後面的無效干擾字串
    // 例如："台中市西屯區台灣大道三段99號5樓之3" -> "台中市西屯區台灣大道三段99號"
    const match = address.match(/(.*?[路街坡巷弄號])/);
    return match ? match[1] : address;
}

/**
 * 3. 核心調度主指令：時間切片 + 雙層快取 + 異步並發控制 + 批量寫入
 * 
 * @param {Array} addressList - 原始地址物件陣列，例如 [{ address: "..." }]
 * @param {Function} tgosApiCall - 前端單一地址定位 Fetch 函式
 * @param {Function} onItemProcessed - 每筆地址解析完成的回呼函式 (item, coordinate) => {}
 * @param {Function} isAbortedFn - 檢查是否手動中斷解析的函式 () => boolean
 */
async function antigravityGeocodeDispatcher(addressList, tgosApiCall, onItemProcessed, isAbortedFn) {
    const results = [];
    const db = await initIndexedDB(); // 初始化瀏覽器地端 IndexedDB
    
    // 設定併發上限（Promise Pool），防止速度過快被 API 封鎖 (HTTP 429)
    const CONCURRENCY_LIMIT = 3; 
    
    // 設定時間切片大小：每處理完 100 筆地址就釋放 CPU 執行緒一次，避免 UI 假死與卡頓
    const TIME_SLICE_SIZE = 100;
    
    // API 請求防封鎖冷卻時間 (毫秒)
    const RATE_LIMIT_DELAY = 200; 

    // 用於收集本次解析中新成功定位的點，在最後統一進行一次性的批量寫入 (Bulk Insert) 避開頻繁 I/O 交易
    const pendingBulkInserts = [];
    
    const queue = [...addressList];
    const total = addressList.length;
    let processedCount = 0;
    
    // 實作 Promise Pool Worker 執行緒
    async function worker() {
        while (queue.length > 0) {
            // 檢查是否已手動點擊停止中斷
            if (isAbortedFn && isAbortedFn()) {
                break;
            }
            
            const item = queue.shift();
            if (!item) continue;
            
            const cleaned = cleanAddress(item.address);
            let coordinate = null;

            // 【第一層快取】檢查記憶體 Map
            if (memoryCache.has(cleaned)) {
                coordinate = memoryCache.get(cleaned);
            } else {
                // 【第二層快取】檢查瀏覽器 IndexedDB
                coordinate = await getFromIndexedDB(db, cleaned);
                
                if (!coordinate) {
                    // 雙層快取均未命中，發送真實定位 API 請求
                    try {
                        // 加上冷卻時間防封鎖
                        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
                        
                        // 呼叫定位 API（傳入原始完整地址以獲取精確經緯度並配對後端快取）
                        coordinate = await tgosApiCall(item.address); 
                        
                        if (coordinate && coordinate.success) {
                            // 解析成功，立刻寫入第一層記憶體快取
                            memoryCache.set(cleaned, coordinate);
                            // 暫存至批量寫入佇列，不在此時發送頻繁磁碟交易
                            pendingBulkInserts.push({ address: cleaned, coord: coordinate });
                        }
                    } catch (error) {
                        console.error(`解析失敗: ${cleaned}`, error);
                    }
                } else {
                    // IndexedDB 命中，順手回填記憶體快取
                    memoryCache.set(cleaned, coordinate);
                }
            }

            const resultItem = { ...item, cleanedAddress: cleaned, coordinate };
            results.push(resultItem);
            processedCount++;

            // 觸發每筆處理完成的回呼，以即時更新網頁 UI 進度與點位
            if (onItemProcessed) {
                onItemProcessed(item, coordinate);
            }

            // 【時間切片 (Time Slicing)】
            // 每當處理筆數達到 TIME_SLICE_SIZE 的整倍數時，利用 setTimeout(..., 0) 暫時讓出主執行緒控制權
            // 讓瀏覽器有機會渲染 DOM，更新進度條，避免觸發「網頁沒有回應」的警告
            if (processedCount % TIME_SLICE_SIZE === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    // 啟動指定數量的 Worker 並發執行
    const workers = Array(CONCURRENCY_LIMIT).fill(null).map(worker);
    await Promise.all(workers);

    // 【批量寫入 (Bulk Insert)】
    // 若有新成功定位的點，且解析中途未被手動停止，則開啟單一次的 readwrite 交易進行批量持久化寫入
    if (pendingBulkInserts.length > 0 && !(isAbortedFn && isAbortedFn())) {
        try {
            await saveToIndexedDBBulk(db, pendingBulkInserts);
            console.log(`成功將 ${pendingBulkInserts.length} 筆地址批量寫入本地 IndexedDB 快取`);
        } catch (dbError) {
            console.error("IndexedDB 批量儲存失敗:", dbError);
        }
    }

    return results;
}

// --- 以下為 IndexedDB 底層高性能封裝封裝指令 ---

/**
 * 初始化地端 IndexedDB 資料庫
 */
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("BuffCoverCacheDB", 1);
        request.onupgradeneeded = e => e.target.result.createObjectStore("addresses", { keyPath: "address" });
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
}

/**
 * 讀取本地快取
 */
function getFromIndexedDB(db, address) {
    return new Promise(resolve => {
        const tx = db.transaction("addresses", "readonly");
        const req = tx.objectStore("addresses").get(address);
        req.onsuccess = () => resolve(req.result ? req.result.coord : null);
        req.onerror = () => resolve(null);
    });
}

/**
 * 批量持久化寫入本地快取 (Bulk Insert)
 * 只開啟一次 readwrite 事務，大幅度降低 I/O 開銷與鎖競爭
 * 
 * @param {IDBDatabase} db - IndexedDB 實例
 * @param {Array} addressPairs - 鍵值對陣列，例如 [{ address: "...", coord: {...} }]
 */
function saveToIndexedDBBulk(db, addressPairs) {
    return new Promise((resolve, reject) => {
        if (!addressPairs || addressPairs.length === 0) {
            resolve();
            return;
        }

        // 開啟單一次交易 (Transaction)
        const tx = db.transaction("addresses", "readwrite");
        const store = tx.objectStore("addresses");

        // 交易事件監聽
        tx.oncomplete = () => resolve();
        tx.onerror = e => reject(tx.error || e.target.error);
        tx.onabort = e => reject(tx.error || e.target.error);

        // 循序在同一次交易內寫入所有快取點
        for (const pair of addressPairs) {
            store.put({ address: pair.address, coord: pair.coord });
        }
    });
}

// 匯出調度器以供 ES Module 引用
export { antigravityGeocodeDispatcher, cleanAddress };