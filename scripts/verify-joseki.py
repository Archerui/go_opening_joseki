#!/usr/bin/env python3
"""Verify every offline branch with stone placement, captures and liberties.

This is a data-integrity check, not an evaluation engine. It deliberately permits
same-colour continuation moves: the upstream books use them for tenuki followups.
"""
from collections import Counter
import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]


def neighbors(point):
    x, y = point
    return [(a, b) for a, b in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            if 0 <= a < 19 and 0 <= b < 19]


def group(board, point):
    stones, pending, liberties = {point}, [point], set()
    while pending:
        for neighbor in neighbors(pending.pop()):
            if neighbor not in board:
                liberties.add(neighbor)
            elif board[neighbor] == board[point] and neighbor not in stones:
                stones.add(neighbor)
                pending.append(neighbor)
    return stones, liberties


def verify(db):
    nodes = db["nodes"]
    seen, errors, duplicates = set(), [], []

    def walk(node_id, board):
        node = nodes[node_id]
        assert node_id not in seen, f"Cycle or shared child at {node_id}"
        seen.add(node_id)
        assert node["id"] == node_id
        board = board.copy()
        for stone in node.get("setup", []):
            point = stone["x"], stone["y"]
            if stone["color"] == "E":
                board.pop(point, None)
            else:
                board[point] = stone["color"]
        move = node["move"]
        if move and not move.get("pass"):
            point = move["x"], move["y"]
            assert all(0 <= coordinate < 19 for coordinate in point)
            if point in board:
                errors.append({"node": node_id, "source": node["sourceId"],
                               "file": node["sourceFile"], "sourceNode": node["sourceNode"],
                               "error": "occupied", "point": point})
                return
            board[point] = move["color"]
            for neighbor in neighbors(point):
                if neighbor in board and board[neighbor] != move["color"]:
                    stones, liberties = group(board, neighbor)
                    if not liberties:
                        for stone in stones:
                            del board[stone]
            if not group(board, point)[1]:
                errors.append({"node": node_id, "source": node["sourceId"],
                               "file": node["sourceFile"], "sourceNode": node["sourceNode"],
                               "error": "suicide", "point": point})
                return
        points = Counter(json.dumps(nodes[child]["move"], sort_keys=True)
                         for child in node["children"] if nodes[child]["move"])
        if any(count > 1 for count in points.values()):
            duplicates.append(node_id)
        for child in node["children"]:
            assert nodes[child]["parent"] == node_id
            walk(child, board)

    for root in db["roots"]:
        assert nodes[root]["parent"] is None
        walk(root, {})
    return {"totalNodes": len(nodes), "visitedNodes": len(seen),
            "placementErrors": errors, "parentsWithDuplicateMoves": duplicates}


def main():
    text = (BASE / "data" / "joseki-db.js").read_text()
    db = json.loads(text.split("window.JOSEKI_DB=", 1)[1].removesuffix(";\n"))
    result = verify(db)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if result["placementErrors"]:
        raise SystemExit(1)
    assert result["visitedNodes"] == result["totalNodes"]


if __name__ == "__main__":
    main()
