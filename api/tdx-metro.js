// api/tdx-metro.js
// Vercel Serverless Function:當 TDX(運輸資料流通服務平台)的代理。
//
// TDX API 需要用 Client ID / Client Secret 換 access token 才能查資料,
// Client Secret 不能出現在前端(瀏覽器 F12 就看得到、也會進 git 歷史),
// 所以由這支後端代為保管憑證、跟 TDX 換 token,再把整理好的資料回傳給前端。
//
// 需要在 Vercel 專案的 Environment Variables 設定:
//   TDX_CLIENT_ID
//   TDX_CLIENT_SECRET
// (在 TDX 會員中心 -> 金鑰管理 建立應用程式後取得)

const AUTH_URL = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token";
const API_BASE = "https://tdx.transportdata.tw/api/basic/v2/Rail/Metro";

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) {
    return cachedToken;
  }

  const clientId = process.env.TDX_CLIENT_ID;
  const clientSecret = process.env.TDX_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("尚未設定 TDX_CLIENT_ID / TDX_CLIENT_SECRET 環境變數");
  }

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`TDX 換取 token 失敗: HTTP ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // 提前 60 秒視為過期,避免邊界情況下用到快過期的 token。
  cachedTokenExpiry = now + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function tdxGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`TDX API 錯誤(${path}): HTTP ${res.status}`);
  }
  return res.json();
}

// TDX 的 Shape 資料是 WKT 格式的字串,例如 "LINESTRING(121.5 25.0, 121.51 25.01, ...)",
// 要轉成 MapLibre GeoJSON 需要的 [[lon,lat], [lon,lat], ...] 座標陣列。
function parseWktLineString(wkt) {
  if (!wkt) return null;
  const match = wkt.match(/LINESTRING\s*\(([^)]+)\)/i);
  if (!match) return null;
  return match[1]
    .split(",")
    .map((pair) => pair.trim().split(/\s+/).map(Number));
}

module.exports = async (req, res) => {
  try {
    const railSystem = (req.query.railSystem || "TRTC").toString();
    const token = await getAccessToken();

    const [lines, stations, shapes] = await Promise.all([
      tdxGet(`/Line/${railSystem}?%24format=JSON`, token),
      tdxGet(`/Station/${railSystem}?%24format=JSON`, token),
      tdxGet(`/Shape/${railSystem}?%24format=JSON`, token),
    ]);

    const lineColorById = {};
    for (const line of lines) {
      lineColorById[line.LineID] = line.LineColor
        ? `#${String(line.LineColor).replace(/^#/, "")}`
        : "#888888";
    }

    const lineFeatures = shapes
      .map((shape) => {
        const coords = parseWktLineString(shape.Geometry);
        if (!coords || coords.length < 2) return null;
        return {
          type: "Feature",
          properties: {
            lineId: shape.LineID,
            color: lineColorById[shape.LineID] || "#888888",
          },
          geometry: { type: "LineString", coordinates: coords },
        };
      })
      .filter(Boolean);

    const stationFeatures = stations
      .filter((s) => s.StationPosition)
      .map((s) => ({
        type: "Feature",
        properties: {
          stationId: s.StationID,
          name: (s.StationName && (s.StationName.Zh_tw || s.StationName.En)) || "",
        },
        geometry: {
          type: "Point",
          coordinates: [s.StationPosition.PositionLon, s.StationPosition.PositionLat],
        },
      }));

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).json({
      lines: { type: "FeatureCollection", features: lineFeatures },
      stations: { type: "FeatureCollection", features: stationFeatures },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
