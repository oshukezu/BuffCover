import math
import time
import urllib.request
import urllib.parse
import json
import os
import re
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any

# 初始化 FastAPI 應用程式
app = FastAPI(title="台中市西屯區環域分析 API V2", description="提供環域分析、地址定位與批次地理編碼服務")

# 地址座標快取 (加速 Demo 與常用地址定位，遵守 Nominatim API 規範)
ADDRESS_CACHE = {
    # 核心起始點常用地址
    "台中市西屯區台灣大道三段99號": {"lat": 24.1622, "lng": 120.6470},
    "台中市西屯區惠來路二段101號": {"lat": 24.1626, "lng": 120.6406},
    "台中市西屯區朝富路30號": {"lat": 24.1673, "lng": 120.6397},
    "台中市西屯區台灣大道四段1727號": {"lat": 24.1812, "lng": 120.6062},
    
    # 預設 10 個模擬地址
    "台中市西屯區河南路二段301巷77號": {"lat": 24.1742, "lng": 120.6451},
    "台中市西屯區文華路100號": {"lat": 24.1790, "lng": 120.6482},
    "台中市西屯區青海路二段242-2號": {"lat": 24.1691, "lng": 120.6433},
    "台中市西屯區西屯路三段97-1號": {"lat": 24.1802, "lng": 120.6272},
    "台中市西屯區工業區一路2號": {"lat": 24.1592, "lng": 120.6015},
    "台中市西屯區市政路402號": {"lat": 24.1609, "lng": 120.6375},
    "台中市西屯區福科路200號": {"lat": 24.1868, "lng": 120.6190},
    "台中市西屯區黎明路三段368號": {"lat": 24.1782, "lng": 120.6322},
    "台中市西屯區福星路427號": {"lat": 24.1758, "lng": 120.6458},
    "台中市西屯區上石路2號": {"lat": 24.1705, "lng": 120.6481}
}

CACHE_FILE = "address_cache.json"

def load_cache():
    global ADDRESS_CACHE
    try:
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                ADDRESS_CACHE.update(loaded)
                print(f"成功自 {CACHE_FILE} 載入 {len(loaded)} 筆快取地址點位。")
    except Exception as e:
        print(f"載入快取檔案失敗: {e}")

def save_cache():
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(ADDRESS_CACHE, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"儲存快取檔案失敗: {e}")

# 在啟動時載入快取
load_cache()

# 台中市西屯區預設地標數據 (背景展示用)
LANDMARKS = [
    {"id": "fengjia_market", "name": "逢甲夜市", "category": "觀光景點", "lat": 24.1787, "lng": 120.6465, "description": "台灣最著名的夜市之一，以各種創意小吃聞名。"},
    {"id": "national_theater", "name": "台中國家歌劇院", "category": "藝文地標", "lat": 24.1626, "lng": 120.6406, "description": "由日本建築師伊東豊雄設計，無梁無柱的獨特美聲涵洞建築。"},
    {"id": "tunghai_univ", "name": "東海大學 (路思義教堂)", "category": "教育機構", "lat": 24.1801, "lng": 120.6033, "description": "擁有著名路思義教堂與美麗校園的歷史悠久大學。"},
    {"id": "maple_garden", "name": "秋紅谷景觀生態公園", "category": "公園綠地", "lat": 24.1673, "lng": 120.6397, "description": "都市中的綠洲，具備滯洪、排水與休閒功能的下凹式綠地公園。"},
    {"id": "city_hall", "name": "台中市政府 (市政大樓)", "category": "政府機關", "lat": 24.1622, "lng": 120.6470, "description": "台中市的行政中心，建築設計宏偉現代。"},
    {"id": "district_office", "name": "西屯區公所", "category": "政府機關", "lat": 24.1627, "lng": 120.6402, "description": "西屯區的地方行政機關，鄰近市政中心。"},
    {"id": "skm_mall", "name": "新光三越 台中中港店", "category": "購物商場", "lat": 24.1648, "lng": 120.6438, "description": "台灣百貨單店營業額王，引領中部時尚潮流的購物商場。"},
    {"id": "industrial_park", "name": "台中工業區", "category": "工業園區", "lat": 24.1601, "lng": 120.5966, "description": "中部重要的產業聚落，匯集眾多製造與高科技企業。"},
    {"id": "chaoma_sports", "name": "朝馬國民運動中心", "category": "運動場館", "lat": 24.1633, "lng": 120.6346, "description": "台中市首座啟用的國民運動中心，擁有專業羽球場與溫水游泳池。"},
    {"id": "veterans_hospital", "name": "台中榮民總醫院", "category": "醫療機構", "lat": 24.1818, "lng": 120.6052, "description": "中部地區的醫學中心，提供高品質的醫療與照護服務。"}
]

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    使用 Haversine 公式計算兩點經緯度之間的大圓距離 (單位：公尺)
    """
    R = 6371000.0  # 地球半徑 (公尺)
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def geocode_address(address: str) -> dict:
    """
    利用 OSM Nominatim API 解析單一地址為經緯度 (支援快取以優化效能)
    """
    address_stripped = address.strip()
    if not address_stripped:
        return {"success": False, "error": "地址為空"}
        
    # 1. 優先查快取
    if address_stripped in ADDRESS_CACHE:
        cache_data = ADDRESS_CACHE[address_stripped]
        return {
            "address": address_stripped,
            "lat": cache_data["lat"],
            "lng": cache_data["lng"],
            "success": True,
            "cached": True
        }
        
    # 2. 查無快取，呼叫外部 API
    try:
        # Nominatim 需要正確的 User-Agent 否則會回傳 403 Forbidden
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(address_stripped)}&limit=1"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Taichung-Xitun-GIS-App/2.0 (oshukezu@gemini.agent; simple buffer analysis app)"
            }
        )
        # 設定 5 秒逾時
        with urllib.request.urlopen(req, timeout=5) as response:
            res_data = json.loads(response.read().decode())
            if res_data and len(res_data) > 0:
                result = {
                    "address": address_stripped,
                    "lat": float(res_data[0]["lat"]),
                    "lng": float(res_data[0]["lon"]),
                    "success": True,
                    "cached": False
                }
                # 寫回快取以利下次快速存取
                ADDRESS_CACHE[address_stripped] = {"lat": result["lat"], "lng": result["lng"]}
                save_cache()
                return result
    except Exception as e:
        print(f"地理編碼失敗 ({address_stripped}): {e}")
        
    # 3. 模糊退化比對：若直接定位失敗，嘗試僅搜尋路段 (例如：台中市西屯區重慶路99號 -> 台中市西屯區重慶路)
    match = re.search(r"^(.*?(?:路|街|大道|段))", address_stripped)
    if match:
        fallback_q = match.group(1)
        if fallback_q != address_stripped:
            # 優先查快取
            if fallback_q in ADDRESS_CACHE:
                cache_data = ADDRESS_CACHE[fallback_q]
                # 寫回原地址快取，避免下次再次查詢
                ADDRESS_CACHE[address_stripped] = {"lat": cache_data["lat"], "lng": cache_data["lng"]}
                save_cache()
                return {
                    "address": address_stripped,
                    "lat": cache_data["lat"],
                    "lng": cache_data["lng"],
                    "success": True,
                    "cached": True,
                    "fallback": True,
                    "fallback_address": fallback_q
                }
            # 查無快取，向 Nominatim 查詢退化路段
            try:
                url = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(fallback_q)}&limit=1"
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": "Taichung-Xitun-GIS-App/2.0 (oshukezu@gemini.agent; fallback-search)"
                    }
                )
                with urllib.request.urlopen(req, timeout=5) as response:
                    res_data = json.loads(response.read().decode())
                    if res_data and len(res_data) > 0:
                        result = {
                            "address": address_stripped,
                            "lat": float(res_data[0]["lat"]),
                            "lng": float(res_data[0]["lon"]),
                            "success": True,
                            "cached": False,
                            "fallback": True,
                            "fallback_address": fallback_q
                        }
                        # 同步寫入雙重快取
                        ADDRESS_CACHE[fallback_q] = {"lat": result["lat"], "lng": result["lng"]}
                        ADDRESS_CACHE[address_stripped] = {"lat": result["lat"], "lng": result["lng"]}
                        save_cache()
                        return result
            except Exception as fe:
                print(f"退化地理編碼失敗 ({fallback_q}): {fe}")

    return {"address": address_stripped, "success": False, "error": "無法解析該地址"}

# 定義 API 輸入與輸出格式
class AnalyzeResult(BaseModel):
    center: Dict[str, float]
    radius: float
    inside: List[Dict[str, Any]]
    outside: List[Dict[str, Any]]
    summary: Dict[str, Any]

class BatchGeocodeRequest(BaseModel):
    addresses: List[str]

class CacheAddressRequest(BaseModel):
    address: str
    lat: float
    lng: float

@app.get("/api/analyze", response_model=AnalyzeResult)
def analyze_buffer(
    lat: float = Query(..., description="中心點緯度", ge=-90.0, le=90.0),
    lng: float = Query(..., description="中心點經度", ge=-180.0, le=180.0),
    radius: float = Query(..., description="分析半徑 (公尺)", gt=0.0)
):
    """
    進行環域分析，計算給定中心與半徑範圍內外的預設地標
    """
    inside_list = []
    outside_list = []
    
    for landmark in LANDMARKS:
        distance = haversine_distance(lat, lng, landmark["lat"], landmark["lng"])
        landmark_info = {
            **landmark,
            "distance": round(distance, 1)
        }
        
        if distance <= radius:
            inside_list.append(landmark_info)
        else:
            outside_list.append(landmark_info)
            
    inside_list.sort(key=lambda x: x["distance"])
    outside_list.sort(key=lambda x: x["distance"])
    area_sq_km = math.pi * ((radius / 1000.0) ** 2)
    
    return {
        "center": {"lat": lat, "lng": lng},
        "radius": radius,
        "inside": inside_list,
        "outside": outside_list,
        "summary": {
            "total_landmarks": len(LANDMARKS),
            "inside_count": len(inside_list),
            "outside_count": len(outside_list),
            "area_sq_km": round(area_sq_km, 3)
        }
    }

@app.get("/api/geocode")
def geocode_single(address: str = Query(..., description="要定位的門牌地址")):
    """
    單一地址地理編碼 API
    """
    res = geocode_address(address)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res.get("error", "地理編碼失敗"))
    return res

@app.post("/api/geocode/batch")
def geocode_batch(request: BatchGeocodeRequest):
    """
    批次地址地理編碼 API (支援批次輸入與 Nominatim 的速率限制保護)
    """
    results = []
    for addr in request.addresses:
        addr_clean = addr.strip()
        if not addr_clean:
            continue
            
        # 進行解析
        res = geocode_address(addr_clean)
        results.append(res)
        
        # 如果沒有命中快取，則需要 sleep 1 秒以符合 Nominatim 的使用政策限制
        if not res["success"] or not res.get("cached", False):
            time.sleep(1.0)
            
    return results

@app.post("/api/cache-address")
def cache_address(request: CacheAddressRequest):
    """
    新增或更新地址座標快取 API (由前端定位成功後回傳同步)
    """
    address_stripped = request.address.strip()
    if not address_stripped:
        raise HTTPException(status_code=400, detail="地址不可為空")
        
    ADDRESS_CACHE[address_stripped] = {
        "lat": request.lat,
        "lng": request.lng
    }
    save_cache()
    return {"success": True, "message": "快取同步成功"}



# 提供首頁 index.html
@app.get("/")
def read_root():
    return FileResponse("index.html")

# 掛載前端靜態資源目錄 (assets 僅包含 CSS/JS 等靜態資源，無後端敏感檔案，直接掛載非常安全)
app.mount("/assets", StaticFiles(directory="assets"), name="assets")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

