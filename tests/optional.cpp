#undef NDEBUG
#include <cassert>
#include "../PowerSupply.h"

int main() {
    assert(!Graph::Create(-1, false, false));
    auto empty = Graph::Create(0, false, false);
    assert(empty && !empty->GetNeighbors(0));
    assert(ConnectedComponents(*empty)->GetLength() == 0);
    assert(GreedyColoring(*empty)->GetLength() == 0);
    assert(Kruskal(*empty)->GetVertexCount() == 0);
    assert(!PlanPowerSupply(*empty));

    auto graph = Graph::Create(5, true, false);
    assert(graph);
    assert(!graph->AddEdge(0, 5));
    assert(!graph->AddEdge(-1, 0));
    assert(!graph->GetNeighbors(-1) && !graph->GetNeighbors(5));
    assert(graph->GetNeighbors(0)->get().GetLength() == 0);
    assert(graph->AddEdge(0, 1, 7)->weight == 7);
    assert(graph->AddEdge(1, 2, 2));
    assert(graph->AddEdge(3, 4, 0));
    assert(graph->GetNeighbors(1)->get()[0].to == 0);

    for (int start : {-1, 5}) {
        assert(!BFS(*graph, start) && !DFS(*graph, start) && !Dijkstra(*graph, start));
    }
    const auto distances = BFS(*graph, 0);
    assert(distances && (*distances)[2] == 2 && (*distances)[3] == -1);
    const auto visited = DFS(*graph, 3);
    assert(visited && !(*visited)[0] && (*visited)[4]);
    const auto plan = PlanPowerSupply(*graph);
    assert(plan && plan->totalCost == 9 && plan->unreachable.GetLength() == 2);
    assert(graph->AddEdge(3, 4, -1));
    assert(!Dijkstra(*graph, 0) && !PlanPowerSupply(*graph));
    assert(graph->AddEdge(0, 0));
    assert(!GreedyColoring(*graph));

    auto directed = Graph::Create(3, false, true);
    assert(directed && directed->AddEdge(0, 1, 9)->weight == 1);
    assert(directed->AddEdge(1, 2));
    const auto forward = BFS(*directed, 0);
    const auto backward = BFS(*directed, 2);
    assert(forward && (*forward)[2] == 2);
    assert(backward && (*backward)[0] == -1);
    const auto colors = GreedyColoring(*directed);
    assert(colors && (*colors)[0] != (*colors)[1] && (*colors)[1] != (*colors)[2]);
    assert(!Kruskal(*directed) && !ConnectedComponents(*directed));
}
