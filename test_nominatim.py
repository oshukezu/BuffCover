import urllib.request
import urllib.parse
import json

def test_search(q):
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(q)}&limit=1"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Taichung-Xitun-GIS-App/2.0 (oshukezu@gemini.agent; test)"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            print(f"查詢 [{q}]: 成功，結果數={len(data)}")
            if data:
                print(f"  地址: {data[0].get('display_name')}")
                print(f"  座標: lat={data[0].get('lat')}, lon={data[0].get('lon')}")
            else:
                print("  沒有找到任何結果。")
    except Exception as e:
        print(f"查詢 [{q}]: 失敗 -> {e}")

if __name__ == "__main__":
    test_search("台中市西屯區重慶路99號")
    test_search("台中市西屯區重慶路")
