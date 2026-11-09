#!/usr/bin/env python3
"""Collect a bounded, factual OGS ordering snapshot without copying prose.

Default: regenerate reviewed-library.js from the checked-in JSON, offline.
--fetch: sequential GETs, at most one request per second, with a fixed budget.
The positions endpoint returns a position and its direct children together.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

BASE = Path(__file__).resolve().parents[1]
JSON_FILE = BASE / "data/reviewed-library.json"
JS_FILE = BASE / "data/reviewed-library.js"
API = "https://online-go.com/oje/positions?id="
FAMILIES = {"Q16": "星位", "R16": "小目", "R17": "三三", "R15": "目外", "Q15": "高目", "P15": "五五"}
FOCUS = {15467, 22923, 22817, 20810, 24146, 26969, 31350, 31231, 31333, 31600, 31464, 30755, 30723, 15200, 15135}


def number(label):
    return int(label) if str(label).isdigit() else None


def child(raw):
    return {"placement": raw["placement"], "externalId": int(raw["node_id"]),
            "category": raw["category"], "sourceOrder": number(raw.get("variation_label")),
            "sourceLabel": raw.get("variation_label")}


def clean(raw):
    moves = [move for move in raw["play"].split(".") if move and move != "root"]
    result = child(raw)
    result.update({"play": raw["play"], "moves": moves,
                   "done": any(tag["description"] == "Joseki: Done" for tag in raw.get("tags", [])),
                   "sourceId": "ogs", "upstreamSourceId": raw.get("joseki_source_id"),
                   "url": "https://online-go.com/joseki/" + str(raw["node_id"]),
                   "nextMoves": [child(item) for item in raw.get("next_moves", [])],
                   "tags": [tag["description"] for tag in raw.get("tags", [])]})
    if raw.get("joseki_source"):
        result["upstreamSource"] = {key: raw["joseki_source"].get(key) for key in ("id", "description", "url")}
    result["nextMoves"].sort(key=sort_key)
    return result


def sort_key(item):
    return ({"IDEAL": 0, "GOOD": 1, "TRICK": 2, "QUESTION": 3, "MISTAKE": 4}.get(item["category"], 5),
            item.get("sourceOrder") if item.get("sourceOrder") is not None else 999,
            item["placement"], item["externalId"])


class Snapshot:
    def __init__(self, cache, budget):
        self.cache = cache
        self.cache.mkdir(parents=True, exist_ok=True)
        self.budget = budget
        self.count = 0
        self.last_request = 0
        self.positions = {}
        self.requests = []

    def fetch(self, external_id):
        cache = self.cache / (str(external_id) + ".json")
        if cache.exists():
            records = json.loads(cache.read_text())
        else:
            if self.count >= self.budget:
                raise RuntimeError("Request budget reached; increase --max-requests explicitly to continue")
            time.sleep(max(0, 1.0 - (time.monotonic() - self.last_request)))
            req = urllib.request.Request(API + str(external_id), headers={"User-Agent": "JosekiSourceReview/1.0 (bounded metadata fetch)"})
            self.last_request = time.monotonic()
            self.count += 1
            with urllib.request.urlopen(req, timeout=30) as response:
                raw = json.load(response)
            if not isinstance(raw, list):
                raise ValueError("OGS positions response must be a list")
            records = [clean(item) for item in raw]
            cache.write_text(json.dumps(records, ensure_ascii=False))
        digest = hashlib.sha256(json.dumps(records, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        self.requests.append({"externalId": external_id, "url": API + str(external_id), "factSha256": digest})
        for position in records:
            self.positions[position["externalId"]] = position
        return records


def write(snapshot):
    indexed = {node["externalId"]: node for node in snapshot["positions"]}
    if len(indexed) != len(snapshot["positions"]):
        raise ValueError("Duplicate OGS position IDs")
    for node in indexed.values():
        for option in node["nextMoves"]:
            target = indexed.get(option["externalId"])
            if target and target["play"] != node["play"] + "." + option["placement"]:
                raise ValueError("OGS child has an inconsistent move sequence")
    JSON_FILE.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
    JS_FILE.write_text("/* OGS source metadata; source labels are not strength scores. */\nwindow.REVIEWED_LIBRARY=" + json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + ";\n")


def snapshot_data(fetcher, stage, traces):
    positions = sorted(fetcher.positions.values(), key=lambda item: (len(item["moves"]), item["play"], item["externalId"]))
    coverage = []
    for opening, title in FAMILIES.items():
        nodes = [node for node in positions if node["moves"] and node["moves"][0] == opening]
        coverage.append({"opening": opening, "title": title, "positions": len(nodes),
                         "maximumPly": max([len(node["moves"]) for node in nodes] or [0]),
                         "allBranchesThroughPly": 3 if stage != "roots" else 2,
                         "donePositions": sum(node["done"] for node in nodes),
                         "mistakePositions": sum(node["category"] == "MISTAKE" for node in nodes),
                         "categories": dict(Counter(node["category"] for node in nodes))})
    return {"version": 1, "reviewedAt": datetime.now(ZoneInfo("Europe/Berlin")).date().isoformat(),
            "sources": [{"id": "ogs", "title": "OGS 定式库：跨开局元数据核对", "url": "https://online-go.com/joseki/15081"}],
            "policy": {
                "coordinates": "19 路，A–T 跳过 I；原始右上方向，第一手黑；pass 表示原谱脱先。",
                "sourceOrder": "数字来自 OGS variation_label。官方将其作为其他条件相同时常见/优先应法的初始指引；它不是胜率、分差或无条件最优排名。非数字保留 null；重复数字不强行打破并列。",
                "category": "保留 OGS IDEAL/GOOD/MISTAKE/TRICK/QUESTION 原始分类；分类针对该手，不能代替全盘形势判断。",
                "done": "只取 Joseki: Done 标签；源定式终点不必等于可以脱先（可能仍需战斗）。",
                "coverage": "六个主要起手前三手全部来源分支；选取常见挂角及主要应法向后核对到来源终点或16手。未覆盖局面不得宣称已核对。",
                "provenance": "仅 GET 官方公开 positions 接口，每次含当前节点及直接子节点；单连接，至少1秒间隔。不复制局面评论。",
                "rebuild": "python3 scripts/fetch-review-library.py 离线重建 JS；加 --fetch 显式联网重取。"},
            "stage": stage, "coverage": coverage, "traces": traces, "requests": fetcher.requests,
            "stats": {"positions": len(positions), "requests": len(fetcher.requests),
                      "indexedChoices": sum(len(node["nextMoves"]) for node in positions),
                      "numberedChoices": sum(option["sourceOrder"] is not None for node in positions for option in node["nextMoves"]),
                      "donePositions": sum(node["done"] for node in positions)}, "positions": positions}


def collect(args):
    fetcher = Snapshot(args.cache_dir, args.max_requests)
    root_records = fetcher.fetch("root")
    openings = [node for node in root_records if len(node["moves"]) == 1 and node["placement"] in FAMILIES]
    for opening in openings:
        fetcher.fetch(opening["externalId"])
    write(snapshot_data(fetcher, "roots", []))
    seconds = [node for node in fetcher.positions.values() if len(node["moves"]) == 2 and node["moves"][0] in FAMILIES]
    for index, node in enumerate(seconds):
        fetcher.fetch(node["externalId"])
        if index % 10 == 0:
            print("opening coverage", index + 1, "/", len(seconds), "positions", len(fetcher.positions), flush=True)
    write(snapshot_data(fetcher, "first-three", []))
    if args.stage == "first-three":
        return
    # Every numerical 1/2/3 third-move reply to these common approaches, plus
    # one reply to each explicit mistake, is traced along the source's first
    # IDEAL/GOOD continuation. This is a coverage choice, not our own ranking.
    branch_groups = []
    for external_id in sorted(FOCUS):
        node = fetcher.positions.get(external_id)
        if node:
            branch_groups.append([item["externalId"] for item in node["nextMoves"]
                                  if item.get("sourceOrder") in (1, 2, 3) or item["category"] == "MISTAKE"])
    # Give every common approach a continuation before deepening the next
    # alternative. A fixed request budget must not silently favor one family.
    starts = [group[index] for index in range(max(map(len, branch_groups), default=0))
              for group in branch_groups if len(group) > index]
    traces = []
    for index, start in enumerate(dict.fromkeys(starts)):
        visited = []
        current = start
        reason = ""
        while current not in visited:
            if fetcher.count >= fetcher.budget:
                reason = "request-limit"
                break
            visited.append(current)
            node = fetcher.positions.get(current)
            if node is None:
                fetcher.fetch(current)
                node = fetcher.positions[current]
            if node["done"]:
                reason = "source-done"
                break
            if len(node["moves"]) >= 16:
                reason = "depth-limit"
                break
            continuations = [item for item in node["nextMoves"] if item["category"] in ("IDEAL", "GOOD")]
            if not continuations:
                reason = "no-recorded-continuation"
                break
            next_id = sorted(continuations, key=sort_key)[0]["externalId"]
            if next_id not in fetcher.positions:
                fetcher.fetch(current)
            current = next_id
        traces.append({"start": start, "positions": visited, "stoppedBecause": reason or "cycle"})
        write(snapshot_data(fetcher, "bounded-continuations", traces))
        print("trace", index + 1, "/", len(set(starts)), reason, "positions", len(fetcher.positions), "requests", fetcher.count, flush=True)
        if reason == "request-limit":
            break


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--cache-dir", type=Path, default=Path("/tmp/ogs-review-library-facts"))
    parser.add_argument("--max-requests", type=int, default=160)
    parser.add_argument("--stage", choices=["first-three", "continuations"], default="continuations")
    args = parser.parse_args()
    if args.fetch:
        collect(args)
    else:
        write(json.loads(JSON_FILE.read_text()))


if __name__ == "__main__":
    main()
