#!/usr/bin/env python3
"""Локальный HTTP-адаптер к C++ и сервер собранного фронтенда, без зависимостей."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
BUILD = ROOT / "web" / ".build"
BINARY = BUILD / "graph-bridge"
DIST = ROOT / "web" / "dist"
COMPILE_LOCK = threading.Lock()


def compile_bridge():
    dependencies = [ROOT / "Graph.h", ROOT / "Algorithms.h", ROOT / "PowerSupply.h",
                    *list((ROOT / "web" / "backend").glob("*")),
                    *list((ROOT.parent / "atd").glob("*.h"))]
    with COMPILE_LOCK:
        if BINARY.exists() and all(p.stat().st_mtime <= BINARY.stat().st_mtime for p in dependencies):
            return
        BUILD.mkdir(parents=True, exist_ok=True)
        compiler = os.environ.get("CXX") or shutil.which("clang++") or shutil.which("g++")
        if not compiler:
            raise RuntimeError("Не найден C++ компилятор. Установите clang++ или g++.")
        result = subprocess.run([compiler, "-std=c++20", "-O2", "-Wall", "-Wextra",
                                 str(ROOT / "web/backend/bridge.cpp"), "-o", str(BINARY)],
                                capture_output=True, text=True, timeout=60)
        if result.returncode:
            raise RuntimeError("Ошибка сборки C++: " + result.stderr[-4000:])


def integer(value, title, minimum, maximum):
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError(f"{title}: ожидается целое число от {minimum} до {maximum}.")
    return value


def solve(data):
    if not isinstance(data, dict):
        raise ValueError("Ожидается JSON-объект.")
    algorithm = data.get("algorithm")
    if not isinstance(algorithm, str) or algorithm not in {"greedy", "bfs", "dijkstra", "kruskal", "components", "power"}:
        raise ValueError("Неизвестный алгоритм.")
    power = algorithm == "power"
    n = integer(data.get("vertexCount"), "Количество объектов" if power else "Количество вершин", int(power), 100)
    edges = data.get("edges")
    if not isinstance(edges, list) or len(edges) > 5000:
        raise ValueError("Допустимо до 5000 рёбер.")
    directed, weighted = data.get("directed", False), data.get("weighted", True)
    if not isinstance(directed, bool) or not isinstance(weighted, bool):
        raise ValueError("Параметры графа должны быть логическими значениями.")
    if power and (directed or not weighted):
        raise ValueError("Кабельные соединения должны быть взвешенными и неориентированными.")
    if directed and algorithm in {"kruskal", "components"}:
        raise ValueError("Для выбранной задачи нужен неориентированный граф.")
    start = target = 0
    if algorithm in {"bfs", "dijkstra"}:
        if n == 0:
            raise ValueError("Добавьте хотя бы одну вершину для поиска пути.")
        start = integer(data.get("start", 0), "Начальная вершина", 0, n - 1)
        target = integer(data.get("target", n - 1), "Конечная вершина", 0, n - 1)
    rows = [f"{algorithm} {n} {len(edges)} {int(directed)} {int(weighted)} {start} {target}"]
    seen = set()
    for edge in edges:
        if not isinstance(edge, dict):
            raise ValueError("Некорректное ребро.")
        source = integer(edge.get("from"), "Начало ребра", 0, n - 1)
        target_node = integer(edge.get("to"), "Конец ребра", 0, n - 1)
        if power:
            weight = integer(edge.get("weight"), "Стоимость соединения", 0, 2_147_483_647)
            if source == target_node:
                raise ValueError("Нельзя соединить объект с самим собой.")
            rows.append(f"{source} {target_node} {weight}")
            continue
        weight = integer(edge.get("weight", 1), "Вес ребра", -10000, 10000)
        key = (source, target_node) if directed else tuple(sorted((source, target_node)))
        if key in seen:
            raise ValueError("Повторяющиеся рёбра не поддерживаются редактором.")
        seen.add(key)
        if source == target_node and algorithm == "greedy":
            raise ValueError("Граф с петлёй нельзя правильно раскрасить. Удалите петлю.")
        if weighted and weight < 0 and algorithm == "dijkstra":
            raise ValueError("Дейкстра не поддерживает отрицательные веса.")
        rows.append(f"{source} {target_node} {weight}")
    compile_bridge()
    result = subprocess.run([str(BINARY)], input="\n".join(rows), text=True,
                            capture_output=True, timeout=10)
    if result.returncode:
        raise ValueError("C++ не смог обработать граф: " + (result.stderr or "проверьте входные данные"))
    return json.loads(result.stdout)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/health":
            self.send_json(200, {"ok": True, "engine": "C++", "algorithms": ["greedy", "bfs", "dijkstra", "kruskal", "components", "power"]})
        elif path.startswith("/api/"):
            self.send_json(404, {"error": "Маршрут не найден."})
        elif not DIST.exists():
            self.send_json(503, {"error": "Соберите фронтенд: cd web && npm install && npm run build"})
        else:
            super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path != "/api/solve":
            return self.send_json(404, {"error": "Маршрут не найден."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 1_000_000:
                raise ValueError("Размер запроса должен быть от 1 байта до 1 МБ.")
            body = json.loads(self.rfile.read(length))
            self.send_json(200, solve(body))
        except (ValueError, TypeError, UnicodeError) as error:
            self.send_json(400, {"error": str(error)})
        except subprocess.TimeoutExpired:
            self.send_json(504, {"error": "Превышено время выполнения C++."})
        except (RuntimeError, OSError) as error:
            self.send_json(500, {"error": str(error)})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--check", action="store_true", help="Только собрать C++-адаптер")
    args = parser.parse_args()
    compile_bridge()
    if args.check:
        print("C++-адаптер собран:", BINARY)
    else:
        print(f"GRAPH / LAB → http://127.0.0.1:{args.port}", flush=True)
        try:
            ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
        except KeyboardInterrupt:
            pass
