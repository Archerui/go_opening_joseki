#!/usr/bin/env python3
"""Build the offline joseki tree from pinned, attributed SGF sources.

No third-party Python packages are required. The default build is offline and
checks every input against source-manifest.json. --fetch restores those exact
upstream versions; it never follows a moving branch.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import urllib.request

BASE = Path(__file__).resolve().parents[1]
DATA = BASE / "data"


class SGFParser:
    """Parse collections, escaped values, properties, sequences and variations."""

    def __init__(self, text):
        # GNU Go stores a GPL notice before its SGF game tree.
        self.text = text[text.index("(;"):]
        self.pos = 0

    def whitespace(self):
        while self.pos < len(self.text) and self.text[self.pos].isspace():
            self.pos += 1

    def value(self):
        assert self.text[self.pos] == "["
        self.pos += 1
        result = []
        while self.pos < len(self.text):
            char = self.text[self.pos]
            self.pos += 1
            if char == "]":
                return "".join(result)
            if char == "\\":
                if self.pos >= len(self.text):
                    break
                char = self.text[self.pos]
                self.pos += 1
                if char in "\r\n":
                    if (self.pos < len(self.text)
                            and self.text[self.pos] in "\r\n"
                            and self.text[self.pos] != char):
                        self.pos += 1
                    continue
            result.append(char)
        raise ValueError("Unterminated SGF property value")

    def tree(self):
        self.whitespace()
        assert self.text[self.pos] == "("
        self.pos += 1
        root = last = None
        while True:
            self.whitespace()
            char = self.text[self.pos]
            if char == ";":
                self.pos += 1
                node = {"props": {}, "children": []}
                if last is not None:
                    last["children"].append(node)
                else:
                    root = node
                last = node
                while True:
                    self.whitespace()
                    start = self.pos
                    while self.pos < len(self.text) and self.text[self.pos].isalpha():
                        self.pos += 1
                    if start == self.pos:
                        break
                    key = self.text[start:self.pos].upper()
                    self.whitespace()
                    values = []
                    while self.text[self.pos] == "[":
                        values.append(self.value())
                        self.whitespace()
                    if not values:
                        raise ValueError(f"SGF property {key} has no value")
                    node["props"].setdefault(key, []).extend(values)
            elif char == "(":
                if last is None:
                    raise ValueError("Variation without parent")
                last["children"].append(self.tree())
            elif char == ")":
                self.pos += 1
                return root
            else:
                raise ValueError(f"Unexpected SGF character {char!r} at {self.pos}")


SOURCES = [
    {"id": "pachi", "name": "Pachi 定式库", "url": "https://github.com/pasky/pachi/tree/master/joseki",
     "license": "GPL-2.0-only", "licenseFile": "data/raw/pachi/COPYING",
     "description": "传统定式与偏离应对。保留原始 <bad>、<don't>、<avoid> 标记及全部后续。",
     "qualityPolicy": "<bad> 为错误；<don't>/<avoid> 为规避或存疑（也可能只是引擎暂不采用）；其余为此库采用的应法。"},
    {"id": "gnugo", "name": "GNU Go 定式库", "url": "https://www.gnu.org/software/gnugo/",
     "license": "GPL-3.0-or-later", "licenseFile": "data/raw/gnugo/COPYING",
     "description": "七组传统定式 SGF，保留布局、脱先、手筋和错误应对。",
     "qualityPolicy": "保留编译器的 S/J/U、T、0/A/a 标签。0/A/a 包含引擎禁选的复杂手，故只标存疑；仅明确描述本手错误的注释标红。"},
    {"id": "josekle", "name": "Josekle / OGS 定式树", "url": "https://github.com/okonomichiyaki/josekle/tree/master/sgf",
     "license": "MIT", "licenseFile": "data/raw/josekle/LICENSE",
     "description": "Josekle 发布的 OGS GOOD/IDEAL 筛选树。保留 OGS 条目编号以回查。没有从该源推造错误变化。",
     "qualityPolicy": "上游 scrape.rb 明确只选 GOOD 与 IDEAL；统一标为库中推荐，无法还原两级的区别。该导出没有注释或错误支线。"},
]

FILES = [
    ("pachi", "joseki_44.sgf", "星位 · Pachi"),
    ("pachi", "joseki_34.sgf", "小目 · Pachi"),
    ("pachi", "joseki_33.sgf", "三三 · Pachi"),
    ("pachi", "joseki_54.sgf", "高目 · Pachi"),
    ("josekle", "dictionary.sgf", "OGS 定式总库"),
    ("gnugo", "hoshi_keima.sgf", "星位小飞挂 · GNU Go"),
    ("gnugo", "hoshi_other.sgf", "星位其他变化 · GNU Go"),
    ("gnugo", "komoku.sgf", "小目 · GNU Go"),
    ("gnugo", "sansan.sgf", "三三 · GNU Go"),
    ("gnugo", "mokuhazushi.sgf", "目外 · GNU Go"),
    ("gnugo", "takamoku.sgf", "高目 · GNU Go"),
    ("gnugo", "gogo.sgf", "五五 · GNU Go"),
]


def point(value, color):
    if len(value) != 2 or not all("a" <= c <= "s" for c in value):
        return {"color": color, "x": -1, "y": -1, "pass": True}
    return {"color": color, "x": ord(value[0]) - 97, "y": ord(value[1]) - 97}


def expanded_points(values, color):
    result = []
    for value in values:
        if ":" not in value:
            result.append(point(value, color))
            continue
        left, right = value.split(":", 1)
        for x in range(ord(left[0]), ord(right[0]) + 1):
            for y in range(ord(left[1]), ord(right[1]) + 1):
                result.append(point(chr(x) + chr(y), color))
    return result


def quality(source, props, comment, has_move):
    if not has_move:
        return "unknown", "metadata"
    if "BM" in props:
        return "bad", "SGF BM"
    if "DO" in props or "IT" in props:
        return "questionable", "SGF DO/IT"
    if "TE" in props:
        return "good", "SGF TE"
    if source == "josekle":
        return "good", "OGS GOOD/IDEAL filter"
    if source == "pachi":
        tags = comment.split("\n", 1)[0].lower()
        if "<bad>" in tags:
            return "bad", "Pachi <bad>"
        if "<don't>" in tags or "<avoid>" in tags:
            return "questionable", "Pachi <don't>/<avoid>"
        return "good", "Pachi accepted variation"
    if source == "gnugo":
        # This deliberately does not search arbitrary prose for the word "bad":
        # descriptions of a future/alternative move must not label the current one.
        own_lines = [line.strip().lstrip("#").strip().lower()
                     for line in comment.splitlines() if line.strip().startswith("#")]
        exact_errors = {"bad", "bad.", "bad too.", "mistake.", "bad for white",
                        "an obvious, but wrong, move", "gnugo likes this move, which is bad.",
                        "bad idea without the peep first"}
        if any(line in exact_errors for line in own_lines):
            return "bad", "GNU Go explicit current-move comment"
        if any(line.lstrip().startswith(";") for line in comment.splitlines()):
            return "questionable", "GNU Go conditional pattern"
        first = comment[:1]
        if first in ("0", "a", "A", "T"):
            return "questionable", "GNU Go ANTISUJI/TRICK tag"
        return "good", "GNU Go STANDARD/URGENT/MINOR variation"
    return "unknown", "unrated"


def clean_comment(source, comment):
    if source == "josekle":
        return ""
    if source == "pachi":
        return re.sub(r"<[^>]*>", "", comment).strip()
    if source == "gnugo":
        return "\n".join(line.strip().lstrip("#").strip()
                         for line in comment.splitlines()
                         if line.strip().startswith("#"))
    return comment.strip()


def build(manifest):
    nodes, collections = [], []

    def visit(raw, parent, source, filename, ordinal, depth):
        props = raw["props"]
        comment = "\n".join(props.get("C", []))
        move = None
        for color in ("B", "W"):
            if color in props:
                move = point(props[color][0], color)
                break
        rating, evidence = quality(source, props, comment, move is not None)
        node_id = len(nodes)
        ordinal[0] += 1
        node = {"id": node_id, "parent": parent, "move": move, "children": [],
                "quality": rating, "qualityEvidence": evidence,
                "name": props.get("N", [""])[0], "comment": clean_comment(source, comment),
                "sourceId": source, "sourceFile": filename, "sourceNode": ordinal[0],
                "depth": depth + int(move is not None)}
        if comment and source != "josekle":
            node["rawComment"] = comment
        if source == "gnugo" and any(line.lstrip().startswith(";") for line in comment.splitlines()):
            node["conditional"] = True
            node["condition"] = "原谱为此手设置了棋形或征子判断条件，使用前须核对局面。"
        if source == "josekle" and comment.strip().isdigit():
            node["externalId"] = int(comment.strip())
        setup = []
        for prop, color in (("AB", "B"), ("AW", "W"), ("AE", "E")):
            setup.extend(expanded_points(props.get(prop, []), color))
        if setup:
            node["setup"] = setup
        if "PL" in props:
            node["toPlay"] = props["PL"][0]
        # Preserve source labels separately from ratings. LB/MA/TR are never
        # interpreted as evidence that a move is good or bad.
        marks = {key: props[key] for key in ("LB", "TR", "SQ", "MA", "CR") if key in props}
        if marks:
            node["marks"] = marks
        nodes.append(node)
        for child in raw["children"]:
            node["children"].append(visit(child, node_id, source, filename, ordinal, node["depth"]))
        return node_id

    for source, filename, title in FILES:
        raw = SGFParser((DATA / "raw" / source / filename).read_text(encoding="utf-8-sig")).tree()
        root = visit(raw, None, source, filename, [0], 0)
        nodes[root]["name"] = title
        collections.append({"id": f"{source}-{Path(filename).stem}", "title": title,
                            "root": root, "sourceId": source})

    # Empty annotation nodes are retained in the source tree. A UI can descend
    # through them without counting an extra move or inventing a pass.
    counts = Counter(node["quality"] for node in nodes if node["move"] is not None)
    stats = {"nodes": len(nodes), "moves": sum(node["move"] is not None for node in nodes),
             "leaves": sum(not node["children"] for node in nodes),
             "bad": counts["bad"], "questionable": counts["questionable"],
             "good": counts["good"], "unknown": counts["unknown"],
             "badWithFollowups": sum(node["quality"] == "bad" and bool(node["children"]) for node in nodes),
             "sources": len(SOURCES), "collections": len(collections),
             "maxDepth": max(node["depth"] for node in nodes),
             "passes": sum(bool(node["move"] and node["move"].get("pass")) for node in nodes),
             "setupNodes": sum("setup" in node for node in nodes)}
    stats["bySource"] = {source["id"]: {
        "nodes": sum(n["sourceId"] == source["id"] for n in nodes),
        "leaves": sum(n["sourceId"] == source["id"] and not n["children"] for n in nodes),
        "bad": sum(n["sourceId"] == source["id"] and n["quality"] == "bad" for n in nodes),
        "questionable": sum(n["sourceId"] == source["id"] and n["quality"] == "questionable" for n in nodes),
    } for source in SOURCES}
    sources = [dict(source, revision=manifest["repositories"][source["id"]]["commit"],
                    downloadedAt=manifest["downloadedAt"]) for source in SOURCES]
    return {"version": 1, "builtAt": manifest["downloadedAt"], "boardSize": 19,
            "sources": sources, "stats": stats, "nodes": nodes,
            "roots": [c["root"] for c in collections], "collections": collections}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true", help="Fetch pinned input files before building")
    args = parser.parse_args()
    manifest = json.loads((DATA / "source-manifest.json").read_text())
    for entry in manifest["files"]:
        path = DATA / entry["path"]
        if args.fetch:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(urllib.request.urlopen(entry["url"], timeout=30).read())
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != entry["sha256"]:
            raise ValueError(f"Source checksum mismatch: {path}")
    database = build(manifest)
    text = json.dumps(database, ensure_ascii=False, separators=(",", ":"))
    (DATA / "joseki-db.js").write_text(
        "// Generated by scripts/build-joseki.py. Source notices: data/SOURCES.md.\n"
        "// Data retains each source's license; see data/raw/*/COPYING or LICENSE.\n"
        "window.JOSEKI_DB=" + text + ";\n", encoding="utf-8")
    (DATA / "stats.json").write_text(json.dumps(database["stats"], ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(database["stats"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
