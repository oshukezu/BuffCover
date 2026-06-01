// 台中市西屯區環域分析系統 - 全域預設設定值
export const DEFAULT_LAT = 24.1622;
export const DEFAULT_LNG = 120.6470;
export const DEFAULT_RADIUS = 1000; // 預設分析半徑 (公尺)
export const DEFAULT_ADDRESS = "台中市西屯區台灣大道三段99號"; // 預設核心起始點地址

// 預設 10 個西屯區地標資料，用於無伺服器純前端退化分析
export const LANDMARKS = [
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
];

