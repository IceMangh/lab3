#include "Algorithms.h"

int main() {
    auto graph = Graph::Create(3, true, false);
    if (!graph) return 1;

    if (!graph->AddEdge(0, 1, 10) || !graph->AddEdge(1, 2, 5) || !graph->AddEdge(2, 0, 3)) {
        return 1;
    }

    const auto tree = Kruskal(*graph);
    return tree ? 0 : 1;
}
