import itertools
import json
import random
import unittest

from test_web_bridge import http_request, reference_distances, request


def brute_force(n, edges):
    totals = (
        sum(weight for _, _, weight in choice)
        for choice in itertools.combinations(edges, n - 1)
        if -1 not in reference_distances(n, choice, 0, False)
    )
    return min(totals, default=None)


class PowerSupplyTests(unittest.TestCase):
    def test_example_over_http(self):
        edges = [(0, 1, 4), (0, 2, 7), (1, 2, 2), (1, 3, 6), (2, 3, 3)]
        payload = {"algorithm": "power", "vertexCount": 4,
                   "edges": [{"from": a, "to": b, "weight": w} for a, b, w in edges]}
        status, body = http_request("POST", "/api/solve", json.dumps(payload).encode())
        self.assertEqual(status, 200)
        result = json.loads(body)
        self.assertTrue(result["feasible"])
        self.assertEqual(result["totalCost"], 9)
        self.assertEqual(result["unreachable"], [])
        self.assertGreaterEqual(result["elapsedMs"], 0)
        self.assertEqual({tuple(edge[key] for key in ("from", "to", "weight")) for edge in result["tree"]},
                         {(0, 1, 4), (1, 2, 2), (2, 3, 3)})

    def test_matches_exhaustive_search(self):
        rng = random.Random(174)
        for n in range(1, 6):
            for _ in range(12):
                edges = [(a, b, rng.randrange(8)) for a in range(n) for b in range(a + 1, n) if rng.random() < .65]
                with self.subTest(n=n, edges=edges):
                    expected = brute_force(n, edges)
                    result = request("power", n, edges)
                    self.assertEqual(result["feasible"], expected is not None)
                    self.assertEqual(result["totalCost"], expected)
                    unreachable = [i for i, distance in enumerate(reference_distances(n, edges, 0, False)) if distance == -1]
                    self.assertEqual(result["unreachable"], unreachable)
                    if expected is None:
                        self.assertEqual(result["tree"], [])
                        forest = [(e["from"], e["to"], e["weight"]) for e in result["forest"]]
                        self.assertTrue(set(forest) <= set(edges))
                        self.assertEqual([i for i, d in enumerate(reference_distances(n, forest, 0, False)) if d == -1],
                                         unreachable)
                    else:
                        tree = [(item["from"], item["to"], item["weight"]) for item in result["tree"]]
                        self.assertEqual(len(tree), n - 1)
                        self.assertTrue(set(tree) <= set(edges))
                        self.assertNotIn(-1, reference_distances(n, tree, 0, False))
                        self.assertEqual(sum(weight for _, _, weight in tree), expected)

    def test_parallel_cables_and_large_sum(self):
        edges = [(0, 1, 0), (1, 0, 8), (1, 2, 2_147_483_647), (2, 3, 2_147_483_647)]
        self.assertEqual(request("power", 4, edges)["totalCost"], 4_294_967_294)

    def test_invalid_connections(self):
        for n, edges, options in [
            (0, [], {}), (2, [(0, 0, 5)], {}), (2, [(0, 2, 5)], {}),
            (2, [(0, 1, -1)], {}), (2, [(0, 1, 1.5)], {}), (2, [(0, 1, True)], {}),
            (2, [(0, 1, 2_147_483_648)], {}), (2, [(0, 1, 5)], {"directed": True}),
        ]:
            with self.subTest(n=n, edges=edges, options=options), self.assertRaises(ValueError):
                request("power", n, edges, **options)
