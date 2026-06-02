import asyncio
import os
import shutil
import json
from playwright.async_api import async_playwright

# 產生測試 GeoJSON 檔案
def create_test_geojson(filepath):
    test_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "台中國家歌劇院噴水池"
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [120.6408, 24.1624]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "name": "朝馬綠色步道"
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [120.635, 24.160],
                        [120.640, 24.161]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "name": "秋紅谷景觀生態公園"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [120.635, 24.166],
                            [120.639, 24.166],
                            [120.639, 24.168],
                            [120.635, 24.168],
                            [120.635, 24.166]
                        ]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "name": "台中港旅客服務中心"
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [120.528, 24.264]
                }
            }
        ]
    }
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(test_data, f, ensure_ascii=False, indent=2)

async def main():
    geojson_filename = "test_layers.geojson"
    create_test_geojson(geojson_filename)
    geojson_abs_path = os.path.abspath(geojson_filename)
    print(f"已生成測試 GeoJSON 檔案: {geojson_abs_path}")
    
    print("啟動 Playwright 瀏覽器...")
    async with async_playwright() as p:
        # 啟動 Headless 瀏覽器
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        # 注入 Cookie 以防止教學 Modal 自動彈出干擾測試與截圖
        await context.add_cookies([
            {
                "name": "has_seen_tutorial",
                "value": "true",
                "domain": "127.0.0.1",
                "path": "/"
            },
            {
                "name": "gis_lang",
                "value": "zh",
                "domain": "127.0.0.1",
                "path": "/"
            }
        ])
        page = await context.new_page()
        
        url = "http://127.0.0.1:8000"
        print(f"導航至 {url}...")
        await page.goto(url)
        
        # 1. 等待網頁核心組件載入
        print("等待網頁載入...")
        await page.wait_for_selector(".leaflet-container", timeout=10000)
        
        # 2. 模擬定位「核心起始點地址」
        # 我們將中心設定為台中國家歌劇院 (惠來路二段101號) 以測試定位功能
        target_center_address = "台中市西屯區惠來路二段101號"
        print(f"輸入核心起始點地址: {target_center_address}...")
        await page.fill("#core-address-input", "")
        await page.fill("#core-address-input", target_center_address)
        
        print("點擊定位按鈕...")
        await page.click("#geocode-btn")
        
        # 等待地圖中心經緯度改變為歌劇院座標附近 (24.162)
        print("等待定位完成...")
        await page.wait_for_function(
            "document.getElementById('center-lat').textContent.includes('24.162')"
        )
        print("中心點已成功定位至國家歌劇院！")
        
        # 3. 模擬「匯入參考地址 (Batch Import)」輸入 3 個測試地址
        test_addresses = [
            "台中市西屯區河南路二段301巷77號",  # 距離歌劇院約 1.3 公里
            "台中市西屯區福科路200號",          # 距離歌劇院約 3.2 公里
            "台中市西屯區工業區一路2號"         # 距離歌劇院約 3.6 公里
        ]
        address_text = "\n".join(test_addresses)
        print("展開匯入參考地址卡片...")
        await page.evaluate("document.getElementById('import-collapsible-card').setAttribute('open', '')")
        print(f"在批次匯入框中輸入 3 個測試地址:\n{address_text}")
        await page.fill("#batch-address-input", address_text)
        
        print("點擊匯入地址按鈕...")
        await page.click("#import-custom-btn")
        
        # 等待批次解析完成 (由於後端有快取，這 3 個地址都會秒回)
        # 等待匯入總數顯示為 3
        print("等待批次地址解析繪製...")
        await page.wait_for_function(
            "document.getElementById('import-total-count').textContent === '3'"
        )
        print("3 個參考地址解析匯入成功！")
        
        # 4. 模擬載入自訂 GIS 圖層
        print("模擬上傳 GIS 圖層 GeoJSON 檔案...")
        file_input = await page.query_selector("#gis-file-input")
        await file_input.set_input_files(geojson_abs_path)
        
        # 等待 GIS 載入完成狀態
        print("等待 GIS 檔案載入與分析完成...")
        await page.wait_for_function(
            "document.getElementById('gis-import-status').textContent.includes('成功載入')"
        )
        
        # 5. 模擬拉動滑桿 (Slider) 調整環域半徑至 2000m
        # 在 2000m 半徑下，河南路地址（1.3km）落入，故參考點涵蓋率為 1/3 = 33.3%
        # 自訂 GIS 要素中，歌劇院噴水池、朝馬步道、秋紅谷（3個）在 2000m 範圍內，台中港在範圍外。
        # 故涵蓋地址數量應為 3
        print("調整分析半徑滑桿至 2000 公尺...")
        slider = await page.query_selector("#radius-slider")
        await slider.evaluate("el => { el.value = 2000; el.dispatchEvent(new Event('input')); }")
        
        # 等待網頁數值更新
        await page.wait_for_function(
            "document.getElementById('radius-val').textContent === '2000'"
        )
        await page.wait_for_function(
            "document.getElementById('import-coverage-rate').textContent === '33.3%'"
        )
        await page.wait_for_function(
            "document.getElementById('stat-count').textContent === '3'"
        )
        print("半徑已調整至 2000m，參考點涵蓋率為 33.3%，GIS 圖層要素涵蓋數量為 3！")
        
        # 6. 切換地圖底圖風格為極簡曜石黑，以獲得最乾淨的截圖
        print("切換地圖風格至極簡曜石黑 (CartoDB)...")
        await page.select_option("#map-style-select", "carto-dark")
        await page.evaluate("document.getElementById('map-style-select').dispatchEvent(new Event('change'))")
        
        # 收合「匯入參考地址」摺疊卡片，使截圖展現最清爽的一頁高整合畫面
        print("收合匯入參考地址卡片...")
        await page.evaluate("document.getElementById('import-collapsible-card').removeAttribute('open')")
        
        # 額外等待 3 秒讓地圖動畫與曜石黑圖磚完全就緒
        await asyncio.sleep(3)
        
        # 7. 拍攝截圖
        local_screenshot_path = "screenshot.png"
        artifact_dir = "/Users/oshukezu/.gemini/antigravity-ide/brain/287e4260-b049-448f-93a4-a200b756b0c1"
        artifact_screenshot_path = os.path.join(artifact_dir, "screenshot.png")
        
        print("拍攝網頁截圖...")
        await page.screenshot(path=local_screenshot_path, full_page=False)
        print(f"本地截圖已儲存至: {os.path.abspath(local_screenshot_path)}")
        
        # 複製截圖到 artifact 目錄
        if os.path.exists(artifact_dir):
            shutil.copy(local_screenshot_path, artifact_screenshot_path)
            print(f"Artifact 截圖已複製至: {artifact_screenshot_path}")
        else:
            print("警告: 找不到 Artifact 目錄，未複製截圖。")
            
        await browser.close()
        print("瀏覽器已關閉。V2.7 升級測試與截圖流程完成！")
        
        # 移除暫存 of GeoJSON 檔
        try:
            os.remove(geojson_abs_path)
            print("已清理測試 GeoJSON 檔案。")
        except Exception as ex:
            print(f"清理測試檔案失敗: {ex}")

if __name__ == "__main__":
    asyncio.run(main())
