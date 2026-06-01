import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # 監聽 console 訊息
        page.on("console", lambda msg: print(f"CONSOLE: [{msg.type}] {msg.text}"))
        # 監聽未捕獲的錯誤
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
        # 監聽請求失敗
        page.on("requestfailed", lambda req: print(f"REQ FAILED: {req.url} - {req.failure}"))
        
        await page.goto("http://127.0.0.1:8000")
        # 稍微等待讓 JS 執行
        await asyncio.sleep(5)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
