# BuffCover
---
## 🌐 Language
- [繁體中文說明](#-繁體中文說明)
- [English Documentation](#-english-documentation)
- [日本語ドキュメント](#-日本語ドキュメント)
---

## 🇹🇼 繁體中文說明

### 1. 產品特性
BuffCover 是一款為醫療診所或零售據點設計的「空間環域分析與地址涵蓋率計算」工具。
* **高併發非同步地理編碼調度**：整合專用調度器 `geocodingdispatcher.js`，預設以 3 組並行 Worker 進行地址定位解析，在加速解析的同時，避免因請求過快而觸發 API 限流 (HTTP 429)。
* **雙層地端快取機制**：第一層為記憶體快取（Memory Map），防範單次解析重複地址；第二層為本機瀏覽器資料庫快取（IndexedDB），即使關閉網頁也能保留已解析點位，極大化二次載入效能。
* **零延遲即時空間計算**：拖曳「分析半徑」滑桿時，前端即時執行 Haversine 球面距離計算。分析圓圈內外的參考點位顏色將毫無延遲地更新（綠色代表涵蓋，灰色代表未涵蓋），並同步更新指標。
* **高質感曜石黑 Dark Mode**：專為大螢幕與大眾展示設計的極簡 Dark Mode 地圖與玻璃帷幕卡片面板，完美呈現高品質的科技質感。
* **完整多語系相容**：一鍵在「繁體中文」、「英文」與「日文」介面間自由切換，地圖風格與浮動控制選單均已多語系化。

### 2. 系統架構
本系統採用輕量級的「前後端分離與代理」架構：
* **前端 (Vanilla HTML/CSS/JS + Leaflet.js)**：
  負責地圖渲染、圖層標記交互、以及即時球面距離計算。引入 `IndexedDB` 進行本地持久化經緯度快取。
* **後端 (Python FastAPI)**：
  提供靜態檔案分發、常用地址的後端快取（`address_cache.json`）讀寫 API，並代理與 Nominatim API 的非同步通訊。
* **地圖底圖**：
  採用 OpenStreetMap (OSM) 標準圖磚，並利用 CSS 的 `filter` 濾鏡反轉為深色曜石黑主題，同時支援標準淡色與標準原色風格。

### 3. 目錄結構說明
```text
BuffCover/
├── pyproject.toml         # Python 專案依賴管理檔案 (使用 uv 管理)
├── uv.lock                # uv 鎖定之依賴版本控制檔
├── main.py                # FastAPI 後端主程式 (提供 API 與靜態檔案服務)
├── address_cache.json     # 本地地址經緯度快取資料庫 (自動動態寫入與讀取)
├── Buffcover.jpg          # 原始產品 Logo 圖片
├── README.md              # 本說明文件 (中/英/日三語版)
├── scripts/
│   └── screenshot.py      # 自動化測試與網頁截圖腳本 (基於 Playwright)
└── assets/                # 前端靜態資源目錄
    ├── Buffcover.jpg      # 複製之 Logo 圖片 (供前端直接引用)
    ├── index.html         # 網頁結構檔案 (引入 Leaflet CDN 與前端模組)
    ├── style.css          # CSS 樣式表 (包含發光動畫、自訂折疊箭頭與翡翠綠標籤)
    ├── app.js             # 前端控制主邏輯 (處理 DOM 事件與流程控制)
    ├── config.js          # 全域配置常數 (預設座標與地標清單)
    ├── storage.js         # 本地 localStorage 快取管理 (記住環域半徑與中心點)
    ├── parser.js          # Markdown 檔案解析器 (正規表達式地址智慧提取)
    ├── api.js             # 後端 API 與前端 Fallback 退化定位模組
    ├── map.js             # Leaflet 地圖操作與向量要素 (GeoJSON, KML) 渲染模組
    └── geocodingdispatcher.js # 核心調度器 (IndexedDB 雙層快取與併發 3 限制)
```

### 4. 核心功能特點
* **核心起始點翡翠綠視覺凸顯**：地圖的「環域中心」核心起點標籤採用精緻的翡翠綠（Emerald Green）並放大至與卡片標題同級，視覺焦點更加明確。
* **批次 Markdown 智慧提取**：支援直接貼入或上載 `.md` 檔案，自動過濾表格符號，辨識並提取字數大於 5 且含地理特徵的地址清單。
* **GIS 空間圖層多格式相容**：可動態載入本地 GeoJSON/KML 檔案，自動判定要素（點、線、面）與中心點的最小球面距離，並排版呈現於「其他圖層參考」折疊面板中。
* **純地端安全隱私**：所有 GIS 圖層數據的計算均在瀏覽器沙盒中完成，絕不上傳至任何伺服器。

### 5. 使用限制
* **TGOS 服務地區限制**：內政部 TGOS 地址定位服務**僅限解析台灣地區之門牌**。若輸入海外地址，系統將自動退化 (Fallback) 使用 OSM Nominatim 服務，解析精度與速度可能受影響。
* **Nominatim 速率限制政策**：為符合 OSM Nominatim 使用規範，調度器在未命中任何快取時，每筆網路請求會自動加入 200ms 的冷卻時間以防止被暫時封鎖。
* **瀏覽器儲存權限依賴**：本地快取依賴瀏覽器的 `IndexedDB` 和 `localStorage`。若使用無痕模式或清理瀏覽器快取，本地已定位的點位紀錄將會被重設。

---

## 🇺🇸 English Documentation

### 1. Product Features
BuffCover is a spatial buffer analysis and address coverage rate tool tailored for medical clinics or retail sites.
* **Concurrent Async Geocoding Dispatcher**: Integrated with `geocodingdispatcher.js`, it manages a pool of 3 concurrent workers to resolve coordinates efficiently without triggering rate limit blocks (HTTP 429).
* **Dual-Layer Client-Side Caching**: A memory cache handles deduplication in a single session, while an IndexedDB database preserves successfully geocoded points across browser restarts.
* **Zero-Latency Spatial Buffer Calculation**: Dragging the radius slider instantly triggers Haversine spherical calculations. Reference points inside/outside the buffer turn green/gray on-the-fly.
* **Premium Obsidian Dark Theme**: Designed with custom glassmorphism panels, glowing indicator highlights, and dark mode basemaps.
* **Multilingual UI Support**: Switch between Traditional Chinese, English, and Japanese. The basemap style selectors and toggle options adapt seamlessly.

### 2. System Architecture
This application runs on a lightweight, decoupled frontend-backend architecture:
* **Frontend (Vanilla HTML/CSS/JS + Leaflet.js)**:
  Renders map tiles, overlays vector layers, and calculates real-time distances. Utilizes `IndexedDB` for localized persistence.
* **Backend (Python FastAPI)**:
  Serves static files, manages a centralized cache (`address_cache.json`), and proxies async requests to OSM Nominatim API.
* **Basemaps**:
  Renders OpenStreetMap (OSM) tiles reversed to obsidian dark using CSS filter attributes, alongside standard light tiles.

### 3. Directory Structure
```text
BuffCover/
├── pyproject.toml         # Python package dependencies (managed via uv)
├── uv.lock                # uv dependency lockfile
├── main.py                # FastAPI main backend
├── address_cache.json     # Local address coordinates cache database
├── Buffcover.jpg          # Original product logo image
├── README.md              # This documentation (Tri-lingual)
├── scripts/
│   └── screenshot.py      # E2E Playwright test script
└── assets/                # Static assets directory
    ├── Buffcover.jpg      # Copied logo image for frontend loading
    ├── index.html         # Main page HTML structures
    ├── style.css          # CSS styles (animations, custom details arrows)
    ├── app.js             # Main frontend app controller
    ├── config.js          # App configurations (defaults and backup landmarks)
    ├── storage.js         # LocalStorage cookies helper
    ├── parser.js          # Markdown list/table address text parser
    ├── api.js             # API communications wrapper
    ├── map.js             # Leaflet operations and GeoJSON/KML rendering
    └── geocodingdispatcher.js # Concurrent geocoding pool & IndexedDB cache
```

### 4. Core Capabilities
* **Emerald Highlight for Core Center**: The primary center address label features a premium emerald green shade, scaled to match card title font sizes to focus user attention.
* **Intelligent Markdown Import**: Paste or browse `.md` files to automatically parse and extract lists or tables containing valid address strings.
* **Multi-Format Vector Overlays**: Dynamic import of KML/GeoJSON files, automatically evaluating distances from polygons, lines, or points.
* **Client-Side Privacy Guard**: All buffer computations execute locally inside the browser. No geographic files are uploaded to external servers.

### 5. Limitations
* **TGOS Regional Restriction**: The official TGOS API **only parses addresses in the Taiwan region**. For overseas addresses, the system falls back to OSM Nominatim.
* **Nominatim Cooling Interval**: In compliance with Nominatim usage guidelines, a 200ms sleep cooldown is appended to each non-cached network request.
* **Browser Sandbox Dependency**: Local caching relies on `IndexedDB` and `localStorage`. Using Incognito mode will reset your cached addresses upon closing the tab.

---

## 🇯🇵 日本語ドキュメント

### 1. 製品特性
BuffCoverは、クリニックの立地分析や店舗開発向けに開発された「バッファ分析と住所カバー率」空間データ可視化ツールです。
* **非同期並行ジオコーディング・ディスパッチャー**：専用の `geocodingdispatcher.js` を導入し、最大3つのワーカーによる並行検索を実行。API制限（HTTP 429）を回避しながら一括インポートを加速します。
* **2層式のローカルキャッシュ**：1層目はメモリ上のマップ（Memory Map）で重複住所を排除し、2層目はブラウザの「IndexedDB」に座標データを保存して高速な再読み込みを実現します。
* **遅延ゼロのリアルタイム空間計算**：スライダーで分析半径を変更すると、ブラウザ側でHaversine球面距離計算を即時実行。バッファ内外のマーク色（緑色：カバー、グレー：未カバー）を瞬時に切り替えます。
* **高質感なオブシディアンダークテーマ**：大画面表示を考慮し、SFライクなダークモードマップと美しい半透明グラスモーフィズムカードUIを採用。
* **マルチ言語対応**：中国語（繁体字）、英語、日本語に完全対応。マップスタイルやオプション項目もシームレスに切り替わります。

### 2. システム構造
本システムは前後端分離およびプロキシ型設計を採用しています：
* **フロントエンド (Vanilla HTML/CSS/JS + Leaflet.js)**：
  マップ描画、各種ベクター要素の交差判定、および IndexedDB を用いた座標データのローカル永続化キャッシュ。
* **バックエンド (Python FastAPI)**：
  静態ファイルの配信、バックエンド共有キャッシュ（`address_cache.json`）の読み書きAPI、およびNominatim APIとの通信。
* **地図タイル**：
  安定したOpenStreetMapタイルをCSSフィルターで黒色に反転させた独自のダークモードを標準搭載。

### 3. ディレクトリ構成
```text
BuffCover/
├── pyproject.toml         # Pythonプロジェクト管理ファイル (uvを使用)
├── uv.lock                # uv依存関係のロックファイル
├── main.py                # FastAPIメインプログラム (サーバー起動)
├── address_cache.json     # ローカル住所座標キャッシュデータベース
├── Buffcover.jpg          # オリジナル製品ロゴ画像
├── README.md              # 説明ファイル (中国語/英語/日本語対応)
├── scripts/
│   └── screenshot.py      # E2Eテストおよび自動スクリーンショット (Playwright)
└── assets/                # フロントエンド静的アセット
    ├── Buffcover.jpg      # 表示用ロゴ画像
    ├── index.html         # メインHTML
    ├── style.css          # CSSスタイルシート (アニメーション、アコーディオン矢印)
    ├── app.js             # アプリのメイン制御ロジック
    ├── config.js          # 設定値 (既定座標およびバックアップ目標)
    ├── storage.js         # ローカルストレージおよびクッキー管理
    ├── parser.js          # Markdown・テキスト住所自動抽出パーサー
    ├── api.js             # バックエンドAPI接続およびフォールバック制御
    ├── map.js             # Leaflet地図操作およびGeoJSON/KMLデータ描画
    └── geocodingdispatcher.js # 并行ジオコーディング制御とIndexedDB
```

### 4. 核心機能
* **起点のプレミアムエメラルドグリーン強調**：バッファ中心地住所ラベルの色をエメラルドグリーンにし、フォントサイズをカードタイトルと同等に拡大することで、起点を明確に強調します。
* **Markdownからのインテリジェント抽出**：`.md` ファイルから、リストやテーブル内の5文字以上の地理的特徴を持つ住所文字列を正規表現で自動抽出します。
* **各種GISレイヤー対応**：GeoJSON/KMLファイルをインポートし、ポリゴン、ライン、ポイントとバッファ中心との最短球面距離を分析します。
* **ローカルでの安全な計算**：すべての空間データ計算はブラウザ内で完結し、外部のサーバーには一切アップロードされません。

### 5. 利用制限
* **TGOSの地域制限**：台湾内政部の住所検索API（TGOS）は**台湾国内の住所のみ対応**しています。海外住所が入力された場合、自動的にOSM Nominatimで解析されるため、精度と速度が低下する可能性があります。
* **Nominatimレート制限ポリシー**：キャッシュ未登録住所を解析する場合、アクセス制限を避けるため、1リクエストごとに200ミリ秒のウェイト（待機時間）を自動適用します。
* **ブラウザストレージへの依存**：キャッシュはブラウザの `IndexedDB` および `localStorage` に依存します。プライベートモード（シークレットモード）で利用した場合、タブを閉じるとキャッシュは削除されます。
