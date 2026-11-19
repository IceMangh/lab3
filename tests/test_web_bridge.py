import heapq
import io
import itertools
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import Handler, solve


class FakeConnection:
    def __init__(self, request_bytes):
        self.input = io.BytesIO(request_bytes)
        self.output = bytearray()

    def makefile(self, *args, **kwargs):
        return self.input

    def sendall(self, data):
        self.output.extend(data)


class QuietHandler(Handler):
    def log_message(self, *args):
        pass


def http_request(method, path, body=b""):
    request_bytes = (f"{method} {path} HTTP/1.1\r\nHost: localhost\r\n"
                     f"Content-Length: {len(body)}\r\nConnection: close\r\n\r\n").encode() + body
    connection = FakeConnection(request_bytes)
    QuietHandler(connection, ("127.0.0.1", 0), object())
    headers, content = bytes(connection.output).split(b"\r\n\r\n", 1)
    return int(headers.split()[1]), content


def request(algorithm, n, edges, **options):
    return solve({"algorithm": algorithm, "vertexCount": n,
                  "edges": [{"from": a, "to": b, "weight": w} for a, b, w in edges],
                  "start": 0, "target": max(0, n - 1), "weighted": True, **options})


def reference_distances(n, edges, start, directed):
    adjacency = [[] for _ in range(n)]
    for a, b, weight in edges:
        adjacency[a].append((b, weight))
        if not directed:
            adjacency[b].append((a, weight))
    distances = [float("inf")] * n
    distances[start] = 0
    queue = [(0, start)]
    while queue:
        distance, vertex = heapq.heappop(queue)
        if distance != distances[vertex]:
            continue
        for to, weight in adjacency[vertex]:
            if distance + weight < distances[to]:
                distances[to] = distance + weight
                heapq.heappush(queue, (distances[to], to))
    return [-1 if distance == float("inf") else distance for distance in distances]


class BridgeTests(unittest.TestCase):
    def test_http_health_contract(self):
        import json
        status, body = http_request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["engine"], "C++")
        self.assertIn("components", json.loads(body)["algorithms"])

    def test_http_solve_contract(self):
        import json
        payload = {"algorithm": "dijkstra", "vertexCount": 2, "start": 0, "target": 1,
                   "edges": [{"from": 0, "to": 1, "weight": 7}]}
        status, body = http_request("POST", "/api/solve", json.dumps(payload).encode())
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["distances"], [0, 7])

    def test_http_rejects_bad_json_and_unknown_route(self):
        import json
        status, body = http_request("POST", "/api/solve", b"{invalid")
        self.assertEqual(status, 400)
        self.assertIn("error", json.loads(body))
        status, _ = http_request("POST", "/api/unknown", b"{}")
        self.assertEqual(status, 404)

    def test_coloring_respects_every_edge(self):
        rng = random.Random(37)
        for n in range(1, 14):
            edges = [(a, b, 1) for a in range(n) for b in range(a + 1, n) if rng.random() < .4]
            result = request("greedy", n, edges)
            self.assertEqual(len(result["colors"]), n)
            for a, b, _ in edges:
                self.assertNotEqual(result["colors"][a], result["colors"][b])

    def test_directed_coloring_respects_incoming_outgoing_and_reciprocal_arcs(self):
        for edges in [[(0, 1, 1), (1, 2, 1), (0, 2, 1)],
                      [(1, 0, 1), (1, 2, 1), (2, 0, 1), (0, 2, 8)]]:
            result = request("greedy", 4, edges, directed=True)
            self.assertEqual(result["colorCount"], 3)
            self.assertEqual(result["colors"][3], 0)
            for a, b, _ in edges:
                self.assertNotEqual(result["colors"][a], result["colors"][b])

    def test_complete_graph_needs_one_color_per_vertex(self):
        result = request("greedy", 6, [(a, b, 1) for a in range(6) for b in range(a + 1, 6)])
        self.assertEqual(result["colorCount"], 6)

    def test_dijkstra_matches_independent_heap_reference(self):
        rng = random.Random(42)
        for directed in (False, True):
            for n in range(1, 15):
                edges = [(a, b, rng.randrange(10)) for a in range(n) for b in range(n)
                         if a != b and (directed or a < b) and rng.random() < .24]
                result = request("dijkstra", n, edges, directed=directed)
                self.assertEqual(result["distances"], reference_distances(n, edges, 0, directed))
                if result["path"]:
                    self.assertEqual(result["path"][0], 0)
                    self.assertEqual(result["path"][-1], n - 1)
                    weights = {(a, b): weight for a, b, weight in edges}
                    if not directed:
                        weights.update({(b, a): weight for a, b, weight in edges})
                    cost = sum(weights[a, b] for a, b in zip(result["path"], result["path"][1:]))
                    self.assertEqual(cost, result["distances"][-1])

    def test_bfs_ignores_weights(self):
        edges = [(0, 1, 2), (1, 2, 3), (0, 2, 99)]
        self.assertEqual(request("bfs", 3, edges)["path"], [0, 2])
        self.assertEqual(request("dijkstra", 3, edges)["path"], [0, 1, 2])

    def test_unit_weight_bfs_and_dijkstra_agree(self):
        rng = random.Random(17)
        for n in range(2, 12):
            edges = [(a, b, 1) for a in range(n) for b in range(a + 1, n) if rng.random() < .3]
            self.assertEqual(request("bfs", n, edges)["distances"], request("dijkstra", n, edges)["distances"])

    def test_zero_weight_cycle_has_finite_path(self):
        result = request("dijkstra", 4, [(0, 1, 0), (1, 2, 0), (2, 0, 0), (2, 3, 3)], directed=True)
        self.assertEqual(result["path"], [0, 1, 2, 3])
        self.assertEqual(result["distances"], [0, 0, 0, 3])

    def test_unreachable_and_start_equals_target(self):
        result = request("dijkstra", 3, [(0, 1, 1)])
        self.assertEqual(result["path"], [])
        self.assertEqual(result["distances"], [0, 1, -1])
        self.assertEqual(request("bfs", 3, [], start=2, target=2)["path"], [2])

    def test_direction_is_respected(self):
        self.assertEqual(request("bfs", 2, [(1, 0, 1)], directed=True)["distances"], [0, -1])

    def test_components_include_isolated_vertices(self):
        result = request("components", 6, [(0, 1, 4), (1, 2, -3), (3, 4, 0)])
        self.assertEqual(result["components"], [0, 0, 0, 1, 1, 2])
        self.assertEqual(result["componentCount"], 3)

    def test_component_trace_follows_dfs_and_backtracks(self):
        result = request("components", 5, [(0, 1, 1), (0, 2, 1), (1, 3, 1)])
        actual = [(step["vertex"], step["parent"], step["component"], step["entering"]) for step in result["steps"]]
        self.assertEqual(actual, [(0, -1, 0, True), (1, 0, 0, True), (3, 1, 0, True),
                                  (3, 1, 0, False), (1, 0, 0, False), (2, 0, 0, True),
                                  (2, 0, 0, False), (0, -1, 0, False),
                                  (4, -1, 1, True), (4, -1, 1, False)])

    def test_component_trace_is_balanced_for_cycles_isolates_and_empty_graph(self):
        for n, edges in [(0, []), (4, []), (4, [(0, 1, 1), (1, 2, 1), (2, 0, 1), (3, 3, 1)])]:
            with self.subTest(n=n, edges=edges):
                result = request("components", n, edges)
                self.assertEqual(len(result["steps"]), 2 * n)
                visited, stack = set(), []
                for step in result["steps"]:
                    vertex = step["vertex"]
                    self.assertEqual(step["component"], result["components"][vertex])
                    if step["entering"]:
                        self.assertNotIn(vertex, visited)
                        self.assertEqual(step["parent"], stack[-1] if stack else -1)
                        visited.add(vertex)
                        stack.append(vertex)
                    else:
                        self.assertEqual(stack.pop(), vertex)
                        self.assertEqual(step["parent"], stack[-1] if stack else -1)
                self.assertEqual(len(visited), n)
                self.assertEqual(stack, [])

    def test_components_connected_empty_and_edgeless_graphs(self):
        cases = [(0, [], [], 0), (1, [], [0], 1), (4, [], [0, 1, 2, 3], 4),
                 (3, [(0, 1, 1), (1, 2, 1)], [0, 0, 0], 1),
                 (2, [(0, 0, 1)], [0, 1], 2)]
        for n, edges, components, count in cases:
            with self.subTest(n=n, edges=edges):
                result = request("components", n, edges)
                self.assertEqual(result["components"], components)
                self.assertEqual(result["componentCount"], count)

    def test_components_match_independent_reachability(self):
        rng = random.Random(21)
        for n in range(1, 14):
            edges = [(a, b, rng.randint(-5, 5)) for a in range(n) for b in range(a + 1, n) if rng.random() < .15]
            result = request("components", n, edges)
            for start in range(n):
                distances = reference_distances(n, [(a, b, 1) for a, b, _ in edges], start, False)
                for target in range(n):
                    self.assertEqual(result["components"][start] == result["components"][target], distances[target] != -1)

    def test_components_http_contract_and_direction_validation(self):
        import json
        payload = {"algorithm": "components", "vertexCount": 3,
                   "edges": [{"from": 0, "to": 1, "weight": 1}]}
        status, body = http_request("POST", "/api/solve", json.dumps(payload).encode())
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["components"], [0, 0, 1])
        payload["directed"] = True
        status, body = http_request("POST", "/api/solve", json.dumps(payload).encode())
        self.assertEqual(status, 400)
        self.assertIn("неориентированный", json.loads(body)["error"])

    def test_kruskal_matches_exhaustive_spanning_trees(self):
        rng = random.Random(90)
        for _ in range(12):
            edges = [(a, b, rng.randint(-4, 9)) for a in range(4) for b in range(a + 1, 4)]
            best = float("inf")
            for choice in itertools.combinations(edges, 3):
                reached = {0}
                for _ in range(4):
                    for a, b, _ in choice:
                        if a in reached or b in reached:
                            reached.update((a, b))
                if len(reached) == 4:
                    best = min(best, sum(weight for _, _, weight in choice))
            result = request("kruskal", 4, edges)
            self.assertEqual(result["totalWeight"], best)
            self.assertEqual(len(result["tree"]), 3)
            self.assertEqual(result["componentCount"], 1)

    def test_disconnected_forest_and_isolates(self):
        result = request("kruskal", 5, [(0, 1, 3), (2, 3, 2)])
        self.assertEqual(result["componentCount"], 3)
        self.assertEqual(result["totalWeight"], 5)
        self.assertEqual(len(result["tree"]), 2)

    def test_unweighted_graph_uses_unit_cost(self):
        result = request("kruskal", 3, [(0, 1, -100), (1, 2, 99)], weighted=False)
        self.assertEqual(result["totalWeight"], 2)
        self.assertEqual(request("dijkstra", 3, [(0, 1, -100), (1, 2, 99)], weighted=False)["distances"], [0, 1, 2])

    def test_empty_graph(self):
        self.assertEqual(request("greedy", 0, [])["colors"], [])
        self.assertEqual(request("kruskal", 0, [])["componentCount"], 0)
        with self.assertRaises(ValueError):
            request("bfs", 0, [])

    def test_negative_weights_rejected_even_when_unreachable(self):
        with self.assertRaisesRegex(ValueError, "отрицательные"):
            request("dijkstra", 4, [(2, 3, -1)])

    def test_invalid_input(self):
        for algorithm, n, edges, options in [
            ("greedy", 2, [(0, 0, 1)], {}),
            ("greedy", 2, [(0, 0, 1)], {"directed": True}),
            ("kruskal", 2, [(0, 1, 1)], {"directed": True}),
            ("bfs", 2, [(0, 2, 1)], {}),
            ("bfs", 2, [], {"start": -1}),
            ("bfs", 2, [], {"target": 2}),
            ("bfs", 101, [], {}),
            ("bfs", 2, [(0, 1, 1), (1, 0, 2)], {}),
            ("bfs", 2, [(0, 1, 1.5)], {}),
            ("bfs", 2, [], {"weighted": "false"}),
        ]:
            with self.subTest(algorithm=algorithm, edges=edges, options=options):
                with self.assertRaises(ValueError):
                    request(algorithm, n, edges, **options)


if __name__ == "__main__":
    unittest.main()
