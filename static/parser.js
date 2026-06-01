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
