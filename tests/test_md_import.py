import asyncio
import os
import shutil
from playwright.async_api import async_playwright

async def main():
    print("啟動 Playwright 瀏覽器...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        
        url = "http://127.0.0.1:8000"
        print(f"導航至 {url}...")
        await page.goto(url)
        
        print("等待網頁核心地圖組件載入...")
        await page.wait_for_selector(".leaflet-container", timeout=10000)
        
        # 定義 test.md 的路徑
        md_file_path = os.path.abspath("test_addresses.md")
        print(f"模擬上傳 Markdown 檔案: {md_file_path}")
        
        # Playwright 的 set_input_files 模擬檔案選擇
        await page.set_input_files("#md-file-input", md_file_path)
        
        # 等待進度條顯示
        print("等待地址解析進度條完成...")
        await page.wait_for_selector("#parse-progress-container", state="visible", timeout=5000)
        
        # 等待進度條跑滿 (100%) 或進度條容器隱藏
        # 由於 7 個地址可能有些已命中快取、有些需要秒級延遲，我們等待進度文字更新為 100%
        await page.wait_for_function(
            "document.getElementById('parse-progress-val').textContent === '100%'",
            timeout=20000
        )
        print("地址解析完畢！")
        
        # 驗證統計數字是否已更新為 7 個地址
        print("驗證匯入地址統計筆數...")
        await page.wait_for_function(
            "document.getElementById('import-total-count').textContent === '7'",
            timeout=5000
        )
        
        total_count = await page.eval_on_selector("#import-total-count", "el => el.textContent")
        inside_count = await page.eval_on_selector("#import-inside-count", "el => el.textContent")
        coverage_rate = await page.eval_on_selector("#import-coverage-rate", "el => el.textContent")
        
        print(f"統計結果 -> 總匯入: {total_count} 筆, 範圍內: {inside_count} 筆, 涵蓋率: {coverage_rate}")
        
        # 額外等待 2 秒以確保地圖圓圈與標記點繪製完全
        await asyncio.sleep(2)
        
        # 拍攝截圖
        local_screenshot = "screenshot_v2.png"
        artifact_dir = "/Users/oshukezu/.gemini/antigravity-ide/brain/f68abd28-cded-4fa3-881d-743ebf656c55"
        artifact_screenshot = os.path.join(artifact_dir, "screenshot_v2.png")
        
        print("拍攝網頁截圖...")
        await page.screenshot(path=local_screenshot, full_page=False)
        print(f"本地截圖儲存至: {os.path.abspath(local_screenshot)}")
        
        # 複製截圖到 artifact 目錄
        if os.path.exists(artifact_dir):
            shutil.copy(local_screenshot, artifact_screenshot)
            print(f"Artifact 截圖已複製至: {artifact_screenshot}")
        else:
            print("警告: 找不到當前 Conversation Artifact 目錄，未複製截圖。")
            
        await browser.close()
        print("測試與截圖流程順利完成！")

if __name__ == "__main__":
    asyncio.run(main())
