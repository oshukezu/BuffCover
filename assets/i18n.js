// 多國語言 (i18n) 翻譯字典與更新邏輯模組

export const translations = {
    zh: {
        brand_title: "🌐 GIS Studio",
        tutorial_btn: "說明 📖",
        screenshot_btn: "截圖 📸",
        
        // 卡片 1 (設定)
        card_setting_title: "環域中心與半徑設定",
        core_address_label: "核心起始點地址",
        core_address_placeholder: "輸入台中市西屯區地址...",
        geocode_btn: "定位",
        center_lat_label: "中心緯度",
        center_lng_label: "中心經度",
        radius_label: "分析半徑",
        
        // 卡片 2 (批次匯入)
        card_import_title: "匯入參考地址 (Batch Import)",
        local_file_import_label: "📁 從電腦匯入檔案 (支援 .md, .txt, .csv, .json)",
        browse_file_label: "從本機選取並載入檔案：",
        browse_file_btn: "瀏覽檔案 📂",
        manual_paste_label: "✍️ 手動貼入地址",
        textarea_placeholder: "請在此一行輸入一個地址...",
        import_custom_btn: "解析並匯入貼入的地址",
        format_help_title: "💡 支援的 Markdown 匯入格式規範",
        format_help_content: `
            <p>本系統能自動辨識並解析 Markdown 檔案中的地址，支援以下格式：</p>
            <ul>
                <li><strong>項目清單</strong>：<code>- 台中市西屯區...</code></li>
                <li><strong>任務列表</strong>：<code>- [ ] 台中市西屯區...</code></li>
                <li><strong>編號清單</strong>：<code>1. 台中市西屯區...</code></li>
                <li><strong>Markdown 表格</strong>：會自動拆分 <code>|</code> 欄位並過濾。</li>
            </ul>
            <p style="color:var(--text-muted); font-size:0.7rem; margin-top:4px;">⚠️ 注意：地址字串長度需大於 5 個字，並包含市、區、路等特徵。</p>
        `,
        
        // 卡片 3 (統計)
        card_stats_title: "空間分析與涵蓋率",
        stat_area_label: "環域面積 (km²)",
        stat_count_label: "涵蓋地址數量",
        coverage_rate_label: "參考點地址涵蓋率",
        covered_points_label: "涵蓋地址：",
        points_unit: " 個",
        
        // 卡片 4 (圖層)
        card_results_title: "空間圖層要素分析結果",
        show_outside_label: "顯示範圍外",
        gis_layer_import_title: "匯入 GIS 圖層 (.geojson, .kml)",
        gis_import_btn: "載入圖層 📂",
        landmarks_empty: "尚未載入自訂圖層。請點擊上方按鈕載入空間圖層檔案 (.geojson, .kml)",
        landmarks_no_features: "在當前篩選條件下無任何空間要素。",
        
        // 教學 Modal
        modal_title: "📖 系統使用指引與宣告",
        modal_sec_tutorial: "💡 快速新手上手教學",
        modal_sec_declaration: "🛡️ 網站服務聲明",
        modal_close_btn: "我瞭解了，開始使用",
        
        modal_step_1: "<strong>設定環域中心：</strong>在左側輸入核心地址點擊「定位」，或直接在地圖上任何位置點擊滑鼠，即可設定環域分析中心。中心點支援拖曳調整。",
        modal_step_2: "<strong>匯入參考地址：</strong>展開「匯入參考地址 (Batch Import)」，可以透過貼入多行地址或直接瀏覽本機 CSV/JSON/MD 檔案，進行非同步批量門牌解析。",
        modal_step_3: "<strong>載入 GIS 空間檔案：</strong>在右側下方「空間圖層要素分析結果」點選「載入圖層 📂」，選擇本機的 <strong>GeoJSON (.geojson, .json)</strong> 或 <strong>KML (.kml)</strong> 圖層檔案。",
        modal_step_4: "<strong>調整半徑即時分析：</strong>拖曳「分析半徑」滑桿，地圖上的點、線、面要素將會即時計算距離並改變顏色（綠色為範圍內，灰色為範圍外），右側清單將即時更新。",
        modal_step_5: "<strong>地圖聯動與風格：</strong>點擊右側要素清單卡片可飛越 Focus 並展開氣泡泡泡；點選地圖左下角風格選單可隨時切換極簡曜石黑等三種地圖風格。",
        
        modal_dec_1_title: "🔒 隱私與本機安全保護",
        modal_dec_1_desc: "本工具為 100% 純前端離線沙盒運算。您匯入的任何 KML、GeoJSON 空間圖層數據與批次地址，皆完全留在您的瀏覽器本地進行質心與 Haversine 距離計算，<strong>絕不會上傳至任何外部伺服器或後端保存</strong>，確保極致的資訊安全與個人隱私。",
        modal_dec_2_title: "🌐 地圖與定位 API 來源",
        modal_dec_2_desc: "本系統地圖底圖採用 OpenStreetMap 數據，地理編碼（門牌定位）服務介接中華民國內政部 TGOS 門牌地址定位 API（Lite）以及 Nominatim 服務，自動進行 TWD97 至 WGS84 座標一致性投影反算。",
        modal_dec_3_title: "⚠️ 系統免責聲明",
        modal_dec_3_desc: "本工具提供之環域交集、涵蓋率與距離分析結果僅供參考，不具備法律與測量實質效力。實際空間交集情況，請以政府地政機關官方發布之登記或測量數據為準。",

        // 地圖相關動態詞彙
        map_gis_feature: "空間要素",
        map_geom_type: "幾何類型",
        map_dist_to_center: "距離中心",
        map_inside: "範圍內 (已涵蓋)",
        map_outside: "範圍外 (未涵蓋)",
        map_ref_address: "匯入參考地址",
        map_fallback_addr: "找不到精確門牌，已退化定位至",
        
        status_parsing_aborted: "解析已由使用者中斷。"
    },
    en: {
        brand_title: "🌐 GIS Studio",
        tutorial_btn: "Guide 📖",
        screenshot_btn: "Capture 📸",
        
        // Card 1
        card_setting_title: "Buffer Center & Radius",
        core_address_label: "Core Center Address",
        core_address_placeholder: "Enter address in Xitun Taichung...",
        geocode_btn: "Locate",
        center_lat_label: "Latitude",
        center_lng_label: "Longitude",
        radius_label: "Radius",
        
        // Card 2
        card_import_title: "Batch Import Addresses",
        local_file_import_label: "📁 Import from Computer (.md, .txt, .csv, .json)",
        browse_file_label: "Select file from local computer:",
        browse_file_btn: "Browse File 📂",
        manual_paste_label: "✍️ Paste Addresses Manually",
        textarea_placeholder: "Enter one address per line...",
        import_custom_btn: "Parse & Import Addresses",
        format_help_title: "💡 Supported Markdown Import Guide",
        format_help_content: `
            <p>Addresses in Markdown files are parsed automatically. Formats:</p>
            <ul>
                <li><strong>Bullet List</strong>: <code>- Address...</code></li>
                <li><strong>Task List</strong>: <code>- [ ] Address...</code></li>
                <li><strong>Numbered List</strong>: <code>1. Address...</code></li>
                <li><strong>Markdown Tables</strong>: Auto splits by <code>|</code> columns.</li>
            </ul>
            <p style="color:var(--text-muted); font-size:0.7rem; margin-top:4px;">⚠️ Note: Address length must > 5 characters, containing keywords like City, Rd, etc.</p>
        `,
        
        // Card 3
        card_stats_title: "Spatial Analysis & Coverage",
        stat_area_label: "Buffer Area (km²)",
        stat_count_label: "Covered Address Count",
        coverage_rate_label: "Ref Points Coverage Rate",
        covered_points_label: "Covered Points: ",
        points_unit: " pt(s)",
        
        // Card 4
        card_results_title: "Custom GIS Layer Features",
        show_outside_label: "Show Outside",
        gis_layer_import_title: "Import GIS Layer (.geojson, .kml)",
        gis_import_btn: "Load Layer 📂",
        landmarks_empty: "No custom layer loaded. Click above to load a .geojson or .kml file.",
        landmarks_no_features: "No spatial features found under current filters.",
        
        // Tutorial Modal
        modal_title: "📖 System Guide & Terms",
        modal_sec_tutorial: "💡 Quick Start Guide",
        modal_sec_declaration: "🛡️ Terms & Declarations",
        modal_close_btn: "Got it, Let's Start",
        
        modal_step_1: "<strong>Set Center:</strong> Enter address on the left and click 'Locate', or click anywhere directly on the map to set the analysis center. Drag center marker to adjust.",
        modal_step_2: "<strong>Import Addresses:</strong> Expand 'Batch Import Addresses' to paste multi-line addresses or browse local CSV/JSON/MD files for async geocoding.",
        modal_step_3: "<strong>Load GIS Layer:</strong> Click 'Load Layer 📂' inside 'Custom GIS Layer Features' to import your local <strong>GeoJSON (.geojson, .json)</strong> or <strong>KML (.kml)</strong> files.",
        modal_step_4: "<strong>Real-time Analysis:</strong> Drag the radius slider. GIS points, lines, and polygons will calculate center distance on-the-fly and update colors (green inside, gray outside).",
        modal_step_5: "<strong>Map Interactivity:</strong> Click card in list to FlyTo center and open details popup. Use style dropdown in map bottom-left to toggle 3 map basemaps.",
        
        modal_dec_1_title: "🔒 Privacy & Local Security",
        modal_dec_1_desc: "This tool runs 100% client-side inside browser sandbox. Your GIS vector layers and address lists are calculated entirely locally. <strong>No data will be uploaded to any external server</strong>, ensuring complete data security and privacy.",
        modal_dec_2_title: "🌐 Map & Geocoding Sources",
        modal_dec_2_desc: "Map data is powered by OpenStreetMap. Address geocoding is integrated with Taiwan Ministry of Interior TGOS API (Lite) and Nominatim service, with automatic projection coordinate conversion from TWD97 to WGS84.",
        modal_dec_3_title: "⚠️ Disclaimer",
        modal_dec_3_desc: "The spatial buffer calculations, coverage rate, and centroid distance results are for general reference only and have no legal or official survey validity. Please consult public land offices for official boundary surveys.",

        // Map relative
        map_gis_feature: "GIS Feature",
        map_geom_type: "Geometry Type",
        map_dist_to_center: "Distance to Center",
        map_inside: "Inside Buffer (Covered)",
        map_outside: "Outside Buffer (Uncovered)",
        map_ref_address: "Imported Ref Address",
        map_fallback_addr: "Address precise match failed. Fallback to",
        
        status_parsing_aborted: "Parsing has been cancelled by user."
    },
    ja: {
        brand_title: "🌐 GIS Studio",
        tutorial_btn: "ガイド 📖",
        screenshot_btn: "スクショ 📸",
        
        // Card 1
        card_setting_title: "バッファ中心と半径設定",
        core_address_label: "中心起点住所",
        core_address_placeholder: "台中市西屯区の住所を入力...",
        geocode_btn: "検索",
        center_lat_label: "中心緯度",
        center_lng_label: "中心経度",
        radius_label: "分析半径",
        
        // Card 2
        card_import_title: "参照住所の一括インポート",
        local_file_import_label: "📁 パソコンからファイルをインポート (対応 .md, .txt, .csv, .json)",
        browse_file_label: "ローカルからファイルを選択:",
        browse_file_btn: "ファイルを参照 📂",
        manual_paste_label: "✍️ 住所を手動で貼り付け",
        textarea_placeholder: "1行に1つの住所を入力してください...",
        import_custom_btn: "住所を解析してインポート",
        format_help_title: "💡 サポートされている Markdown 形式",
        format_help_content: `
            <p>Markdownファイル内の住所を自動的に抽出します。フォーマット：</p>
            <ul>
                <li><strong>リスト</strong>: <code>- 住所...</code></li>
                <li><strong>タスクリスト</strong>: <code>- [ ] 住所...</code></li>
                <li><strong>番号付きリスト</strong>: <code>1. 住所...</code></li>
                <li><strong>Markdownテーブル</strong>: <code>|</code> 記号で自動列分割。</li>
            </ul>
            <p style="color:var(--text-muted); font-size:0.7rem; margin-top:4px;">⚠️ 注意：住所は5文字以上、市、区、通りなどのキーワードを含む必要があります。</p>
        `,
        
        // Card 3
        card_stats_title: "空間分析と統計",
        stat_area_label: "バッファ面積 (km²)",
        stat_count_label: "カバーされた参照住所数",
        coverage_rate_label: "参照点カバー率",
        covered_points_label: "カバーされた住所：",
        points_unit: " 個",
        
        // Card 4
        card_results_title: "空間レイヤー地物分析結果",
        show_outside_label: "範囲外を表示",
        gis_layer_import_title: "GISレイヤーをインポート (.geojson, .kml)",
        gis_import_btn: "レイヤーを読み込む 📂",
        landmarks_empty: "カスタムレイヤーはまだ読み込まれていません。上のボタンをクリックして .geojson または .kml ファイルを読み込んでください。",
        landmarks_no_features: "現在のフィルター条件に一致する地物はありません。",
        
        // Tutorial Modal
        modal_title: "📖 システム利用ガイドと宣言",
        modal_sec_tutorial: "💡 クイックスタートガイド",
        modal_sec_declaration: "🛡️ サイトサービス宣言",
        modal_close_btn: "了解しました、利用を開始する",
        
        modal_step_1: "<strong>中心の設定：</strong> 左側に住所を入力して「検索」をクリックするか、地図上の任意の場所をクリックして、分析バッファの中心を設定します。ドラッグでの調整も可能です。",
        modal_step_2: "<strong>住所の一括インポート：</strong> 「参照住所の一括インポート」を展開し、複数行の住所を貼り付けるか、ローカルのCSV/JSON/MDファイルを参照して非同期に解析します。",
        modal_step_3: "<strong>GISデータの読み込み：</strong> 「空間レイヤー地物分析結果」パネルの「レイヤーを読み込む 📂」をクリックし、ローカルの <strong>GeoJSON (.geojson, .json)</strong> または <strong>KML (.kml)</strong> データをインポートします。",
        modal_step_4: "<strong>リアルタイム空間分析：</strong> 半径スライダーを調整すると、地物の重心と中心との距離をその場で計算し、マップ上の色を切り替えます（緑は範囲内、グレーは範囲外）。",
        modal_step_5: "<strong>マップとの連動：</strong> 地物カードをクリックすると、その地物の重心へスムーズに移動し、ポップアップを開きます。マップ左下のスタイル選択で3つの背景地図を切り替えられます。",
        
        modal_dec_1_title: "🔒 プライバシーとローカルセキュリティ",
        modal_dec_1_desc: "このツールはブラウザのサンドボックス内で動作する 100% クライアントサイドのオフラインアプリです。インポートされたKML、GeoJSON空間データはローカルブラウザでのみ計算され、<strong>外部サーバーやバックエンドにアップロードされることはありません</strong>。",
        modal_dec_2_title: "🌐 地図と住所検索ソース",
        modal_dec_2_desc: "地図背景はOpenStreetMapを採用しています。住所ジオコーディングは、台湾内政部TGOS住所検索API（Lite）およびNominatimと統合されており、TWD97投影座標からWGS84への自動逆算も行われます。",
        modal_dec_3_title: "⚠️ 免責事項",
        modal_dec_3_desc: "このツールが提供するバッファ交差、カバー率、距離計算結果は参考情報であり、測量上または法的な効力はありません。公式な境界や測量データが必要な場合は、所管の土地登記所へご確認ください。",

        // Map relative
        map_gis_feature: "空間地物",
        map_geom_type: "幾何タイプ",
        map_dist_to_center: "中心からの距離",
        map_inside: "範囲内 (カバー)",
        map_outside: "範囲外 (未カバー)",
        map_ref_address: "インポート住所",
        map_fallback_addr: "正確な住所が見つからないため、位置を退避しました：",
        
        status_parsing_aborted: "住所の解析処理がユーザーによって中断されました。"
    }
};

/**
 * 套用指定語系的翻譯到頁面上標記了 data-i18n 與 data-i18n-placeholder 的 DOM 節點
 * @param {string} lang - 語言代碼 (zh, en, ja)
 */
export function applyTranslations(lang) {
    const dict = translations[lang] || translations.zh;
    
    // 1. 翻譯 textContent / innerHTML
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key] !== undefined) {
            // 如果是 format_help_content，則使用 innerHTML，否則使用安全 textContent
            if (key === 'format_help_content') {
                el.innerHTML = dict[key];
            } else {
                el.textContent = dict[key];
            }
        }
    });
    
    // 2. 翻譯 placeholder
    const inputs = document.querySelectorAll('[data-i18n-placeholder]');
    inputs.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key] !== undefined) {
            el.setAttribute('placeholder', dict[key]);
        }
    });
    
    // 3. 特殊處理 html lang 屬性與 document title
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant-TW' : lang;
    const titleKey = 'brand_title';
    const subTitle = lang === 'zh' ? '環域分析涵蓋率工具' : (lang === 'en' ? 'Buffer Coverage Tool' : 'バッファ分析ツール');
    document.title = `${subTitle} - GIS Studio`;
}
