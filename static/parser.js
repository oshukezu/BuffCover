// Markdown 地址解析器模組

/**
 * 解析 Markdown 文字內容，從清單、表格、純文字中自動提取地址清單
 * @param {string} text - 要解析的 Markdown 文字
 * @returns {Array<string>} 提取出的乾淨地址陣列
 */
export function parseMarkdownAddresses(text) {
    if (!text) return [];
    const lines = text.split('\n');
    const addresses = [];
    
    // 匹配常見的 Markdown 列表、標題、引用等開頭符號，例如 `- [ ]`, `*`, `1.`, `#`, `>`
    const mdCleanRegex = /^\s*([-\*\+]\s+\[[ xX]\]\s+|[-\*\+]\s+|\d+\.\s+|#+\s+|>\s*)/;
    
    lines.forEach(line => {
        // 如果這行包含表格的管線符號 '|'
        if (line.includes('|')) {
            // 將該行依 '|' 拆分，去除每個欄位的 Markdown 強調符號與前後空白
            const columns = line.split('|').map(col => col.replace(/[\*\_~`]/g, '').trim());
            columns.forEach(col => {
                // 如果欄位長度大於等於 5 且符合地址特徵，將其視為獨立地址
                if (col.length >= 5 && /([市縣區鄉鎮路街號]|^[a-zA-Z0-9\s]+$)/.test(col)) {
                    addresses.push(col);
                }
            });
        } else {
            // 一般行處理
            let clean = line.replace(mdCleanRegex, '').trim();
            clean = clean.replace(/[\*\_~`]/g, '').trim();
            
            // 如果清理後的字串長度足夠，且包含中文地址關鍵字或英文門牌格式
            if (clean.length >= 5 && /([市縣區鄉鎮路街號]|^[a-zA-Z0-9\s]+$)/.test(clean)) {
                addresses.push(clean);
            }
        }
    });
    
    return addresses;
}

/**
 * 智慧解析不同格式的檔案內容
 * @param {string} content - 檔案文字內容
 * @param {string} fileExtension - 檔案副檔名 (例如 'json', 'csv', 'md', 'txt' 等)
 * @returns {Array<string>} 解析出來的地址陣列
 */
export function parseImportedFile(content, fileExtension) {
    if (!content) return [];
    
    const ext = (fileExtension || '').toLowerCase().trim();
    
    // 1. JSON 格式解析
    if (ext === 'json' || content.trim().startsWith('{') || content.trim().startsWith('[')) {
        try {
            const data = JSON.parse(content);
            const list = [];
            
            // 遞迴搜尋所有符合地址特徵的字串
            function extractStrings(obj) {
                if (typeof obj === 'string') {
                    if (obj.length >= 5 && /([市縣區鄉鎮路街號]|^[a-zA-Z0-9\s]+$)/.test(obj)) {
                        list.push(obj.trim());
                    }
                } else if (Array.isArray(obj)) {
                    obj.forEach(extractStrings);
                } else if (typeof obj === 'object' && obj !== null) {
                    Object.values(obj).forEach(extractStrings);
                }
            }
            
            extractStrings(data);
            return list;
        } catch (e) {
            console.warn("JSON 解析失敗，降級為普通文字解析", e);
        }
    }
    
    // 2. CSV 格式解析
    if (ext === 'csv') {
        const lines = content.split('\n');
        const list = [];
        lines.forEach(line => {
            if (!line.trim()) return;
            // 依逗號或管線符分割
            const cols = line.split(/[,|]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
            cols.forEach(c => {
                if (c.length >= 5 && /([市縣區鄉鎮路街號]|^[a-zA-Z0-9\s]+$)/.test(c)) {
                    list.push(c);
                }
            });
        });
        return list;
    }
    
    // 3. 預設 (Markdown 或 TXT) 格式解析
    return parseMarkdownAddresses(content);
}

