"""Build the first verified project catalogue from Taiwan open-data CSV files."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import statistics
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
OUTPUT = ROOT / "data" / "processed" / "projects.json"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    # Government CSVs include an English field-name row immediately after the header.
    return [row for row in rows if row.get("鄉鎮市區") not in {"TOWN", "The villages and towns urban district"}]


def clean_builder(value: str) -> str:
    value = re.split(r"(?:（|\()?負責人|(?:（|\()?代表人", value or "", maxsplit=1)[0]
    return value.strip(" 　（(,，;") or "未提供"


def roc_to_iso(value: str) -> str | None:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) < 7:
        return None
    year = int(digits[:-4]) + 1911
    return f"{year:04d}-{digits[-4:-2]}-{digits[-2:]}"


def normalize_name(value: str) -> str:
    return re.sub(r"[\s\-—–・．.（）()第期]", "", value or "").upper()


def seeded_position(name: str, region: str) -> tuple[int, int]:
    digest = hashlib.sha256(name.encode("utf-8")).digest()
    if region == "林口":
        return 25 + digest[0] % 20, 31 + digest[1] % 38
    return 57 + digest[0] % 19, 42 + digest[1] % 31


def price_summary(values: list[tuple[float, str | None]], source: str) -> dict[str, object] | None:
    if not values:
        return None
    prices = sorted(value for value, _ in values)
    dates = sorted(date for _, date in values if date)
    return {
        "median": round(statistics.median(prices), 1),
        "low": round(prices[0], 1),
        "high": round(prices[-1], 1),
        "count": len(prices),
        "latestDate": dates[-1] if dates else None,
        "source": source,
    }


def load_linkou_prices() -> dict[str, dict[str, object]]:
    grouped: dict[str, list[tuple[float, str | None]]] = defaultdict(list)
    path = SOURCE / "linkou_presale_transactions.csv"
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("district") != "林口區" or (row.get("rps30") or "").strip():
                continue
            name = normalize_name(row.get("rps28", ""))
            try:
                ntd_m2 = float(row.get("rps22_amountsunitdollars", ""))
            except (TypeError, ValueError):
                continue
            if not name or ntd_m2 <= 0:
                continue
            grouped[name].append((ntd_m2 * 3.305785 / 10_000, roc_to_iso(row.get("rps07", ""))))
    return {
        name: price_summary(values, "新北市林口區預售屋實價登錄")
        for name, values in grouped.items()
        if price_summary(values, "新北市林口區預售屋實價登錄")
    }


def load_a7_prices() -> dict[str, dict[str, object]]:
    grouped: dict[str, list[tuple[float, str | None]]] = defaultdict(list)
    path = SOURCE / "lvr_landcsv" / "h_lvr_land_b.csv"
    for row in read_csv(path):
        if row.get("鄉鎮市區") != "龜山區" or (row.get("解約情形") or "").strip():
            continue
        name = normalize_name(row.get("建案名稱", ""))
        try:
            ntd_m2 = float(row.get("單價元平方公尺", ""))
        except (TypeError, ValueError):
            continue
        if not name or ntd_m2 <= 0:
            continue
        grouped[name].append((ntd_m2 * 3.305785 / 10_000, roc_to_iso(row.get("交易年月日", ""))))
    return {
        name: price_summary(values, "內政部本期預售屋實價登錄")
        for name, values in grouped.items()
        if price_summary(values, "內政部本期預售屋實價登錄")
    }


def valid_name(value: str) -> bool:
    return bool(value and "?" not in value and "�" not in value)


def is_residential(row: dict[str, str]) -> bool:
    return "住宅" in (row.get("主要用途") or "")


def household_count(row: dict[str, str]) -> int:
    match = re.search(r"\d+", row.get("層棟戶數", ""))
    return int(match.group()) if match else 0


def is_a7(row: dict[str, str]) -> bool:
    haystack = " ".join((row.get("坐落基地", ""), row.get("坐落街道", "")))
    return bool(re.search(r"善捷段|樂捷段|樂善段|文桃路|樂學路|樂善一路|文青路|長慶", haystack))


def select_projects(rows: list[dict[str, str]], region: str, prices: dict[str, dict[str, object]]) -> list[dict[str, str]]:
    filtered = []
    for row in rows:
        if not valid_name(row.get("建案名稱", "")) or not is_residential(row) or household_count(row) < 20:
            continue
        if region == "林口" and row.get("鄉鎮市區") != "林口區":
            continue
        if region == "A7" and (row.get("鄉鎮市區") != "龜山區" or not is_a7(row)):
            continue
        filtered.append(row)

    # Keep the catalogue current, but bring verified-price records to the front.
    filtered.sort(
        key=lambda row: (
            normalize_name(row.get("建案名稱", "")) in prices,
            re.sub(r"\D", "", row.get("申報備查日期", "")),
            household_count(row),
        ),
        reverse=True,
    )
    return filtered[:20]


def build_project(row: dict[str, str], region: str, prices: dict[str, dict[str, object]], index: int) -> dict[str, object]:
    name = row.get("建案名稱", "").strip()
    price = prices.get(normalize_name(name))
    first_registration = roc_to_iso(row.get("第1次登記日期", ""))
    completeness = 70 + (20 if price else 0) + (10 if first_registration else 0)
    map_x, map_y = seeded_position(name, region)
    builder = clean_builder(row.get("起造人", ""))
    project_id = f"{region.lower()}-{index + 1:02d}-{hashlib.md5(name.encode('utf-8')).hexdigest()[:6]}"

    return {
        "id": project_id,
        "name": name,
        "region": region,
        "city": "新北市" if region == "林口" else "桃園市",
        "district": row.get("鄉鎮市區", ""),
        "builder": builder,
        "households": household_count(row),
        "zoning": (row.get("使用分區") or "未提供").strip(),
        "mainUse": (row.get("主要用途") or "未提供").strip(),
        "material": (row.get("主要建材") or "未提供").strip(),
        "address": (row.get("坐落街道") or "未提供").strip(),
        "buildingLand": (row.get("坐落基地") or "未提供").strip(),
        "declaredDate": roc_to_iso(row.get("申報備查日期", "")),
        "permitDate": roc_to_iso(row.get("建照核發日期", "")),
        "permitNo": (row.get("建造執照") or "未提供").strip(),
        "firstRegistrationDate": first_registration,
        "registryNumber": (row.get("編號") or "未提供").strip(),
        "price": price,
        "qualityStatus": "尚未查核",
        "amenityStatus": "待串接地圖資料",
        "dataCompleteness": completeness,
        "mapX": map_x,
        "mapY": map_y,
    }


def main() -> None:
    linkou_rows = read_csv(SOURCE / "lvr_buildcasecsv" / "f_lvr_buildcase.csv")
    taoyuan_rows = read_csv(SOURCE / "lvr_buildcasecsv" / "h_lvr_buildcase.csv")
    linkou_prices = load_linkou_prices()
    a7_prices = load_a7_prices()
    selected_linkou = select_projects(linkou_rows, "林口", linkou_prices)
    selected_a7 = select_projects(taoyuan_rows, "A7", a7_prices)

    projects = [
        *[build_project(row, "林口", linkou_prices, index) for index, row in enumerate(selected_linkou)],
        *[build_project(row, "A7", a7_prices, index) for index, row in enumerate(selected_a7)],
    ]
    payload = {
        "generatedAt": "2026-07-13",
        "scope": "林口＋A7 第一批",
        "projectCount": len(projects),
        "projects": projects,
        "sources": [
            {
                "name": "內政部預售屋建案備查資料",
                "url": "https://data.gov.tw/dataset/176351",
                "role": "建案名稱、起造人、戶數、基地、建照",
            },
            {
                "name": "新北市林口區預售屋實價登錄",
                "url": "https://data.gov.tw/dataset/146480",
                "role": "林口成交單價與交易筆數",
            },
            {
                "name": "內政部預售屋實價登錄",
                "url": "https://data.gov.tw/dataset/6215",
                "role": "A7 本期成交單價",
            },
        ],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(projects)} verified projects to {OUTPUT}")
    print(f"Price coverage: {sum(1 for p in projects if p['price'])}/{len(projects)}")
    for project in projects:
        price_label = f"{project['price']['median']} 萬/坪" if project["price"] else "待補"
        print(f"{project['region']:>2} | {project['name']:<20} | {project['households']:>4} 戶 | {price_label}")


if __name__ == "__main__":
    main()
