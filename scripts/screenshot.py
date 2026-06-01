import asyncio
import os
import shutil
from playwright.async_api import async_playwright

async def main():
    print("啟動 Playwright 瀏覽器...")
    async with async_playwright() as p:
        # 啟動 Headless 瀏覽器
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        
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
        
        # 等待地圖中心經緯度改變為歌劇院座標附近 (24.1626)
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

        # 4. 模擬拉動滑桿 (Slider) 調整環域半徑至 2000m
        # 在 1000m 半徑下，只有河南路地址 (1.3km) 能在 2000m 時被涵蓋，其他兩個 (3.2km, 3.6km) 依然在範圍外。
        # 故涵蓋率應會變為 1 / 3 = 33.3%
        print("調整分析半徑滑桿至 2000 公尺...")
        slider = await page.query_selector("#radius-slider")
        await slider.evaluate("el => { el.value = 2000; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }")
        
        # 等待網頁數值更新
        await page.wait_for_function(
            "document.getElementById('radius-val').textContent === '2000'"
        )
        await page.wait_for_function(
            "document.getElementById('import-coverage-rate').textContent === '33.3%'"
        )
        print("半徑已調整至 2000m，地址涵蓋率已更新為 33.3%！")
        
        # 4.5 切換地圖底圖風格為極簡曜石黑，以獲得最乾淨的截圖
        print("切換地圖風格至極簡曜石黑 (CartoDB)...")
        await page.select_option("#map-style-select", "carto-dark")
        await page.evaluate("document.getElementById('map-style-select').dispatchEvent(new Event('change'))")
        
        # 額外等待 3 秒讓地圖動畫與曜石黑圖磚完全就緒
        await asyncio.sleep(3)
        
        # 5. 拍攝截圖
        local_screenshot_path = "screenshot.png"
        artifact_dir = "/Users/oshukezu/.gemini/antigravity-ide/brain/2b237918-6004-465c-97e7-1e48764213ce"
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
        print("瀏覽器已關閉。V2 升級測試與截圖流程完成！")

if __name__ == "__main__":
    asyncio.run(main())
