"""Refresh project price summaries from official historical and current records."""

from __future__ import annotations

import argparse
import csv
import json
import re
import statistics
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
PROJECTS_PATH = ROOT / "data" / "processed" / "projects.json"
HISTORY_DIR = ROOT / "data" / "source" / "a7-history"
CURRENT_FALLBACK = ROOT / "data" / "source" / "lvr_landcsv" / "h_lvr_land_b.csv"
OFFICIAL_BASE = "https://plvr.land.moi.gov.tw"
OFFICIAL_PAGE = f"{OFFICIAL_BASE}/DownloadOpenData"
FIRST_SEASON = "112S1"


def normalize_name(value: str) -> str:
    return re.sub(r"[\s\-—–・．.（）()第期]", "", value or "").upper()


def roc_to_iso(value: str) -> str | None:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) < 7:
        return None
    year = int(digits[:-4]) + 1911
    return f"{year:04d}-{digits[-4:-2]}-{digits[-2:]}"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return [row for row in rows if row.get("鄉鎮市區") not in {"TOWN", "The villages and towns urban district"}]


def request_bytes(url: str, *, method: str = "GET") -> bytes:
    request = urllib.request.Request(
        url,
        method=method,
        headers={"User-Agent": "Mozilla/5.0 (compatible; JujianDataRefresh/1.0)"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def download_official_sources() -> list[str]:
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    season_html = request_bytes(f"{OFFICIAL_BASE}/DownloadSeason_ajax_list", method="POST").decode("utf-8", errors="replace")
    seasons = sorted(set(re.findall(r'<option value="(\d{3}S[1-4])">', season_html)))
    seasons = [season for season in seasons if season >= FIRST_SEASON]
    if not seasons:
        raise RuntimeError("官方歷史季度清單沒有回傳可用資料")

    for season in seasons:
        query = urllib.parse.urlencode({"season": season, "fileName": "H_lvr_land_B.csv"})
        target = HISTORY_DIR / f"{season}_H_lvr_land_B.csv"
        target.write_bytes(request_bytes(f"{OFFICIAL_BASE}/DownloadSeason?{query}"))

    current_query = urllib.parse.urlencode({"fileName": "h_lvr_land_b.csv"})
    (HISTORY_DIR / "current_H_lvr_land_B.csv").write_bytes(
        request_bytes(f"{OFFICIAL_BASE}/Download?{current_query}")
    )
    return seasons


def history_files() -> list[Path]:
    files = sorted(HISTORY_DIR.glob("*_H_lvr_land_B.csv"))
    if not files and CURRENT_FALLBACK.exists():
        files = [CURRENT_FALLBACK]
    if not files:
        raise FileNotFoundError("找不到桃園市預售屋成交來源，請先使用 --download")
    return files


def load_a7_transactions() -> tuple[dict[str, list[dict[str, str]]], int]:
    unique_rows: dict[str, dict[str, str]] = {}
    anonymous_index = 0
    for path in history_files():
        for row in read_csv(path):
            if row.get("鄉鎮市區") != "龜山區" or (row.get("解約情形") or "").strip():
                continue
            serial = (row.get("編號") or "").strip()
            if not serial:
                anonymous_index += 1
                serial = f"anonymous-{path.name}-{anonymous_index}"
            unique_rows[serial] = row

    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in unique_rows.values():
        name = normalize_name(row.get("建案名稱", ""))
        try:
            unit_price = float(row.get("單價元平方公尺", ""))
        except (TypeError, ValueError):
            continue
        if name and unit_price > 0:
            grouped[name].append(row)
    return grouped, len(unique_rows)


def street_tokens(value: str) -> list[str]:
    return sorted(set(re.findall(r"[\u4e00-\u9fff0-9一二三四五六七八九十]+(?:路|街|巷)", value or "")))


def summarize(rows: list[dict[str, str]]) -> dict[str, object]:
    prices = sorted(float(row["單價元平方公尺"]) * 3.305785 / 10_000 for row in rows)
    dates = sorted(filter(None, (roc_to_iso(row.get("交易年月日", "")) for row in rows)))
    return {
        "median": round(statistics.median(prices), 1),
        "low": round(prices[0], 1),
        "high": round(prices[-1], 1),
        "count": len(prices),
        "latestDate": dates[-1] if dates else None,
        "source": "內政部預售屋實價登錄（歷史季度＋本期）",
    }


def refresh_projects() -> dict[str, int]:
    payload = json.loads(PROJECTS_PATH.read_text(encoding="utf-8"))
    grouped, reviewed_count = load_a7_transactions()
    checked_at = datetime.now(ZoneInfo("Asia/Taipei")).date().isoformat()
    matched_a7 = 0
    unmatched_a7 = 0

    for project in payload["projects"]:
        if project["region"] == "A7":
            rows = grouped.get(normalize_name(project["name"]), [])
            if rows:
                project["price"] = summarize(rows)
                project["dataCompleteness"] = max(project.get("dataCompleteness", 0), 90)
                tokens = street_tokens(project.get("address", ""))
                corroborated = sorted({token for token in tokens if any(token in row.get("土地位置建物門牌", "") for row in rows)})
                project["priceEvidence"] = {
                    "status": "matched",
                    "statusLabel": "官方成交已配對",
                    "matchMethod": "建案名稱正規化完全相符",
                    "addressCorroborated": bool(corroborated),
                    "addressTokens": corroborated,
                    "lastCheckedAt": checked_at,
                    "sourceUrl": OFFICIAL_PAGE,
                }
                matched_a7 += 1
            else:
                project["price"] = None
                project["dataCompleteness"] = min(project.get("dataCompleteness", 70), 70)
                project["priceEvidence"] = {
                    "status": "official-no-match",
                    "statusLabel": "官方尚無已發布成交",
                    "matchMethod": "官方成交建案名稱未找到可安全歸戶紀錄；地號與地址不足以單獨判定同案",
                    "addressCorroborated": False,
                    "addressTokens": [],
                    "lastCheckedAt": checked_at,
                    "sourceUrl": OFFICIAL_PAGE,
                }
                unmatched_a7 += 1
        else:
            project["priceEvidence"] = {
                "status": "matched" if project.get("price") else "source-no-match",
                "statusLabel": "官方成交已配對" if project.get("price") else "官方來源尚未配對",
                "matchMethod": "新北市開放資料建案名稱配對",
                "addressCorroborated": None,
                "addressTokens": [],
                "lastCheckedAt": checked_at,
                "sourceUrl": "https://data.gov.tw/dataset/146480",
            }

    payload["generatedAt"] = checked_at
    payload["priceCoverage"] = {
        "pricedProjects": sum(1 for project in payload["projects"] if project.get("price")),
        "totalProjects": len(payload["projects"]),
        "a7MatchedProjects": matched_a7,
        "a7OfficialNoMatchProjects": unmatched_a7,
        "a7OfficialRecordsReviewed": reviewed_count,
        "historyFrom": FIRST_SEASON,
        "checkedAt": checked_at,
    }
    for source in payload.get("sources", []):
        if source.get("name") == "內政部預售屋實價登錄":
            source["name"] = "內政部預售屋實價登錄（歷史季度＋本期）"
            source["url"] = OFFICIAL_PAGE
            source["role"] = "A7 自 2023 年起歷史季度與本期成交單價、筆數及最新交易"

    PROJECTS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        "matched_a7": matched_a7,
        "unmatched_a7": unmatched_a7,
        "priced_total": payload["priceCoverage"]["pricedProjects"],
        "reviewed_records": reviewed_count,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true", help="先從內政部下載 2023 年起歷史季度與本期資料")
    args = parser.parse_args()
    if args.download:
        seasons = download_official_sources()
        print(f"Downloaded {len(seasons)} official history seasons plus current records")
    result = refresh_projects()
    print(
        f"A7 matched {result['matched_a7']}, official no match {result['unmatched_a7']}; "
        f"total priced {result['priced_total']}/40; reviewed {result['reviewed_records']} official records"
    )


if __name__ == "__main__":
    main()
