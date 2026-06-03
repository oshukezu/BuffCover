// 1. 第一層記憶體快取：防範單次匯入重複地址
const memoryCache = new Map();

/**
 * 2. 前端地址「減重與標準化」預處理 (Regex Clean)
 */
function cleanAddress(rawAddress) {
    if (!rawAddress) return '';
    let address = rawAddress.trim()
        .replace(/[\uFF10-\uFF19]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xfee0)) // 全形數字轉半形
        .replace(/臺/g, '台'); // 統一「台」字

    // 關鍵減重：利用正規表達式，直接砍掉「樓、室、之幾」後面的無效干擾字串
    // 例如："台中市西屯區台灣大道三段99號5樓之3" -> "台中市西屯區台灣大道三段99號"
    const match = address.match(/(.*?[路街坡巷弄號]))/);
    return match ? match[1] : address;
}

/**
 * 3. 核心調度主指令：雙層快取 + 異步並發控制
 * @param {Array} addressList - 診所匯出的原始地址陣列
 * @param {Function} tgosApiCall - 你原本串接 TGOS / Nominatim 的 Fetch 函式
 */
async function antigravityGeocodeDispatcher(addressList, tgosApiCall) {
    const results = [];
    const db = await initIndexedDB(); // 初始化地端 IndexedDB
    
    // 設定併發上限（Promise Pool），防止速度過快被 TGOS 封鎖 (HTTP 429)
    const CONCURRENCY_LIMIT = 3; 
    const queue = [...addressList];
    
    async function worker() {
        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) continue;
            
            const cleaned = cleanAddress(item.address);
            let coordinate = null;

            // 【第一層快取】檢查記憶體
            if (memoryCache.has(cleaned)) {
                coordinate = memoryCache.get(cleaned);
            } else {
                // 【第二層快取】檢查地端 IndexedDB
                coordinate = await getFromIndexedDB(db, cleaned);
                
                if (!coordinate) {
                    // 兩層都沒命中，才真正發送網路請求 (加上冷卻時間防封鎖)
                    try {
                        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms 冷卻
                        coordinate = await tgosApiCall(cleaned); 
                        
                        if (coordinate) {
                            // 解析成功，立刻寫入雙層快取，下次直接秒殺
                            memoryCache.set(cleaned, coordinate);
                            await saveToIndexedDB(db, cleaned, coordinate);
                        }
                    } catch (error) {
                        console.error(`解析失敗: ${cleaned}`, error);
                    }
                } else {
                    // IndexedDB 命中，順手回填記憶體快取
                    memoryCache.set(cleaned, coordinate);
                }
            }

            results.push({ ...item, cleanedAddress: cleaned, coordinate });
        }
    }

    // 啟動多個平行 Worker 執行緒
    const workers = Array(CONCURRENCY_LIMIT).fill(null).map(worker);
    await Promise.all(workers);
    return results;
}

// --- 以下為 IndexedDB 底層極簡封裝指令 ---
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("BuffCoverCacheDB", 1);
        request.onupgradeneeded = e => e.target.result.createObjectStore("addresses", { keyPath: "address" });
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
}
function getFromIndexedDB(db, address) {
    return new Promise(resolve => {
        const tx = db.transaction("addresses", "readonly");
        const req = tx.objectStore("addresses").get(address);
        req.onsuccess = () => resolve(req.result ? req.result.coord : null);
        req.onerror = () => resolve(null);
    });
}
function saveToIndexedDB(db, address, coord) {
    return new Promise(resolve => {
        const tx = db.transaction("addresses", "readwrite");
        tx.objectStore("addresses").put({ address, coord });
        tx.oncomplete = () => resolve();
    });
}