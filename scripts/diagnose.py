import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    print("啟動 Playwright 診斷瀏覽器...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        
        # 收集控制台訊息
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type.upper()}] {msg.text}"))
        
        # 收集未捕獲的錯誤
        page.on("pageerror", lambda err: console_logs.append(f"[PAGE_ERROR] {err.message}"))
        
        # 收集網路請求失敗的訊息
        failed_requests = []
        page.on("requestfailed", lambda req: failed_requests.append(f"[REQ_FAILED] {req.method} {req.url} - {req.failure.error_text if req.failure else 'Unknown'}"))

        url = "http://127.0.0.1:8000"
        print(f"存取網頁 {url}...")
        try:
            await page.goto(url)
            await page.wait_for_selector(".leaflet-container", timeout=10000)
            
            # 等待 5 秒讓圖磚有充足時間加載
            print("等待底圖與資源加載...")
            await asyncio.sleep(5)
            
            # 獲取地圖容器大小
            map_rect = await page.eval_on_selector("#map", "el => { return {width: el.clientWidth, height: el.clientHeight, display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility}; }")
            print(f"\n--- 地圖容器狀態 ---")
            print(f"寬度: {map_rect['width']}px")
            print(f"高度: {map_rect['height']}px")
            print(f"Display: {map_rect['display']}")
            print(f"Visibility: {map_rect['visibility']}")
            
            # 檢查地圖圖磚（Tile）圖片元素的個數
            tiles_count = await page.eval_on_selector_all(".leaflet-tile", "tiles => tiles.length")
            print(f"已生成的 Leaflet 圖磚數量: {tiles_count}")
            
            if tiles_count > 0:
                first_tile_src = await page.eval_on_selector(".leaflet-tile", "el => el.src")
                print(f"第一個圖磚網址: {first_tile_src}")
            
        except Exception as e:
            print(f"載入網頁失敗: {e}")
            
        print("\n--- 瀏覽器控制台日誌 (Console Logs) ---")
        for log in console_logs:
            print(log)
            
        print("\n--- 網路請求失敗日誌 (Failed Requests) ---")
        for req in failed_requests:
            print(req)
            
        await browser.close()
        print("\n診斷結束。")

if __name__ == "__main__":
    asyncio.run(main())
