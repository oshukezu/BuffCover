# 環域分析涵蓋率工具
這是一個現代化、高質感的互動式地理資訊系統（GIS）Web 應用程式。使用者可以設定核心起始點地址並調整環域半徑，同時批次匯入多個參考地址（支援自訂輸入、Demo 資料或 Markdown 檔案自動解析）。系統會即時進行空間交集計算，呈現參考點的落入狀態（綠色代表範圍內，紅色代表範圍外），並動態回饋「地址涵蓋率」指標與進度條。

---

## 🏗️ 系統架構

本應用程式採用前後端分離架構：
* **後端 (Python FastAPI)**：負責提供核心地址的地理編碼（Geocoding，代理 OSM Nominatim API）、地標分析以及點位快取的本地持久化。
* **前端 (Vanilla HTML/CSS/JS + Leaflet.js)**：負責地圖視覺化渲染、標記交互、以及滑動半徑時的**前端即時空間距離計算 (Haversine)**。

---

## 📂 目錄結構說明

新目錄下的專案目錄結構如下：

```text
BuffCover/
├── pyproject.toml         # Python 專案依賴管理檔案 (使用 uv 管理)
├── uv.lock                # uv 鎖定之依賴版本控制檔
├── main.py                # FastAPI 後端主程式 (提供 API 與靜態檔案服務)
├── address_cache.json     # 本地地址經緯度快取資料庫 (自動動態寫入與讀取)
├── README.md              # 本說明文件
├── screenshot.py          # 自動化測試與網頁截圖腳本 (基於 Playwright)
├── diagnose.py            # 瀏覽器控制台與網路診斷腳本 (用於故障排查)
└── static/                # 前端靜態資源目錄
    ├── index.html         # 網頁結構檔案 (引入 Leaflet CDN 與前端模組)
    ├── style.css          # CSS 樣式表 (現代 Dark Mode 樣式與進度條發光動畫)
    ├── app.js             # 前端控制主邏輯 (處理 DOM 事件與流程控制)
    ├── config.js          # 全域配置常數 (預設座標與地標清單)
    ├── storage.js         # 本地 localStorage 快取管理
    ├── parser.js          # Markdown 文件解析器 (正則地址智慧提取)
    ├── api.js             # 後端 API 非同步請求封裝
    └── map.js             # Leaflet 地圖操作與 Marker 渲染繪製模組
```

---

## 🌟 核心功能特點

1. **核心地址地理定位**：
   * 於介面輸入門牌地址，後端自動代理解析為經緯度並滑行定位。優先讀取快取以優化載入效能。
2. **非同步佇列解析與進度條**：
   * 批次匯入地址時，前端會以「非同步佇列」逐一發送解析請求，並展示精美的動畫進度條，即時更新成功、失敗筆數與完成百分比。
   * 非快取地址自動延遲 1 秒發送，遵守 Nominatim API 速率政策。
3. **Markdown 檔案匯入**：
   * 支援直接讀取 `.md` 檔案，系統會智慧解析並提取其中的地址清單，自動填入並開始定位。
4. **0 延遲空間涵蓋率計算**：
   * 當調整半徑滑桿時，前端在本地即時完成 Haversine 球面距離計算。落入環域的點變為發光綠色 Marker，圓圈外的保持紅色。
5. **相容性 Dark Mode 底圖**：
   * 載入 OpenStreetMap 官方圖磚（最穩定且絕不被 AdBlockers 阻擋），並在 CSS 中使用 `filter` 濾鏡反轉為深色主題，兼顧視覺質感與系統穩定度。

---

## 🚀 啟動與使用指南

### 1. 安裝環境與相依套件
本專案使用 `uv` 管理 Python 虛擬環境：
```bash
# 進入專案目錄
cd "/Users/oshukezu/Documents/Knowledge Vault/Codex/BuffCover"

# 使用 uv 建立虛擬環境並安裝相依套件
uv sync
```

### 2. 啟動後端服務
```bash
uv run uvicorn main:app --host 127.0.0.1 --port 8000
```
* 啟動後，請在瀏覽器中打開：[http://127.0.0.1:8000](http://127.0.0.1:8000)

### 3. 自動化測試與截圖 (選用)
本專案附帶自動化測試腳本，可用於確認地圖在 Headless 瀏覽器中的渲染是否正確：
```bash
# 安裝 Playwright 瀏覽器核心 (若尚未安裝)
uv run playwright install chromium

# 執行自動化測試與截圖 (會將最新畫面儲存為 screenshot.png)
uv run python screenshot.py
```
