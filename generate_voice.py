"""
生成導航語音包 (zh-TW-HsiaoYuNeural)
安裝：pip install edge-tts
執行：python generate_voice.py
音檔輸出至 voice_pack/ 資料夾
"""

import asyncio
import os
import edge_tts

VOICE = "zh-TW-HsiaoYuNeural"
OUT  = "voice_pack"

# ── 所有片語 ──────────────────────────────────────────────
CLIPS = {

    # 系統訊息（完整句）
    "arrived":        "您已到達目的地",
    "rerouting":      "您已偏航，正在重新規劃路線",
    "rerouted":       "路線已重新規劃",
    "reroute_failed": "重新規劃失敗，請手動搜尋目的地",

    # 前綴片段
    "qing":    "請",
    "qianfang":"前方",

    # 方向（接在「請」或「前方X公尺」後面）
    "right":       "右轉",
    "left":        "左轉",
    "straight":    "直行",
    "uturn":       "迴轉",
    "bear_right":  "靠右行駛",
    "bear_left":   "靠左行駛",
    "exit_right":  "右邊出口",
    "exit_left":   "左邊出口",
    "merge":       "合流",
    "roundabout":  "進入圓環",

    # 距離片段
    "10m":   "十公尺",
    "20m":   "二十公尺",
    "30m":   "三十公尺",
    "40m":   "四十公尺",
    "50m":   "五十公尺",
    "60m":   "六十公尺",
    "70m":   "七十公尺",
    "80m":   "八十公尺",
    "90m":   "九十公尺",
    "100m":  "一百公尺",
    "150m":  "一百五十公尺",
    "200m":  "兩百公尺",
    "250m":  "兩百五十公尺",
    "300m":  "三百公尺",
    "400m":  "四百公尺",
    "500m":  "五百公尺",
    "600m":  "六百公尺",
    "700m":  "七百公尺",
    "800m":  "八百公尺",
    "900m":  "九百公尺",
    "1km":   "一公里",
    "1_5km": "一點五公里",
    "2km":   "兩公里",
    "3km":   "三公里",
    "5km":   "五公里",
    "10km":  "十公里",
}

# ── 生成 ──────────────────────────────────────────────────
async def gen(key: str, text: str, sem: asyncio.Semaphore):
    async with sem:
        path = os.path.join(OUT, f"{key}.mp3")
        comm = edge_tts.Communicate(text, VOICE)
        await comm.save(path)
        print(f"  ✓ {key}.mp3")

async def main():
    os.makedirs(OUT, exist_ok=True)
    sem = asyncio.Semaphore(5)   # 同時最多 5 個請求
    tasks = [gen(k, v, sem) for k, v in CLIPS.items()]
    print(f"生成 {len(tasks)} 個音檔 → {OUT}/\n")
    await asyncio.gather(*tasks)
    print(f"\n✅ 完成！語音：{VOICE}")

asyncio.run(main())
