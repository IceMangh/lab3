#include "../../PowerSupply.h"
#include <algorithm>
#include <chrono>
#include <iostream>
#include <numeric>
#include <sstream>
#include <string>
#include <vector>

template<class T> void printArray(const T& values, int length) {
    std::cout << '[';
    for (int i = 0; i < length; ++i) {
        if (i) std::cout << ',';
        std::cout << values[i];
    }
    std::cout << ']';
}

void printArray(const std::vector<int>& values) {
    printArray(values, static_cast<int>(values.size()));
}

void printEdges(const Graph& graph) {
    std::cout << '[';
    bool first = true;
    for (int from = 0; from < graph.GetVertexCount(); ++from) {
        const auto& neighbors = graph.GetNeighbors(from)->get();
        for (int i = 0; i < neighbors.GetLength(); ++i) {
            const auto& edge = neighbors[i];
            if (from >= edge.to) continue;
            if (!first) std::cout << ',';
            first = false;
            std::cout << "{\"from\":" << from << ",\"to\":" << edge.to << ",\"weight\":" << edge.weight << '}';
        }
    }
    std::cout << ']';
}

void printPowerSupply(const PowerSupplyPlan& plan) {
    const int unreachableCount = plan.unreachable.GetLength();
    const bool feasible = unreachableCount == 0;
    std::cout << "{\"feasible\":" << (feasible ? "true" : "false") << ",\"tree\":";
    if (feasible) printEdges(plan.cables);
    else {
        std::cout << "[],\"forest\":";
        printEdges(plan.cables);
    }
    std::cout << ",\"totalCost\":";
    if (feasible) std::cout << plan.totalCost;
    else std::cout << "null";
    std::cout << ",\"unreachable\":";
    printArray(plan.unreachable, unreachableCount);
    std::cout << ",\"elapsedMs\":" << plan.elapsedMs << '}';
}

// Восстанавливаем путь по готовым расстояниям исходных BFS / Dijkstra.
// Поиск по рёбрам точных расстояний корректен и при нулевых весах.
std::vector<int> restorePath(const Graph& graph, const DynamicArray<int>& dist,
                             int start, int target, bool weighted) {
    std::vector<int> parent(graph.GetVertexCount(), -1), queue{start};
    parent[start] = start;
    for (size_t head = 0; head < queue.size(); ++head) {
        int from = queue[head];
        const auto& neighbors = graph.GetNeighbors(from)->get();
        for (int i = 0; i < neighbors.GetLength(); ++i) {
            const auto& edge = neighbors[i];
            const long long next = static_cast<long long>(dist[from]) + (weighted ? edge.weight : 1);
            if (parent[edge.to] == -1 && next == dist[edge.to]) {
                parent[edge.to] = from;
                queue.push_back(edge.to);
            }
        }
    }
    if (parent[target] == -1) return {};
    std::vector<int> path;
    for (int vertex = target;; vertex = parent[vertex]) {
        path.push_back(vertex);
        if (vertex == start) break;
    }
    std::reverse(path.begin(), path.end());
    return path;
}

int main() {
    try {
        std::string algorithm;
        int n, m, directed, weighted, start, target;
        if (!(std::cin >> algorithm >> n >> m >> directed >> weighted >> start >> target)
            || n < 0 || n > 100 || m < 0 || m > 5000) return 2;
        const bool power = algorithm == "power";
        if (!power && algorithm != "greedy" && algorithm != "bfs" && algorithm != "dijkstra" && algorithm != "kruskal" && algorithm != "components") return 2;
        if (power && (n == 0 || directed || !weighted)) return 2;
        if (directed && (algorithm == "kruskal" || algorithm == "components")) return 2;
        auto graph = Graph::Create(n, weighted, directed);
        if (!graph) return 2;
        for (int i = 0; i < m; ++i) {
            int from, to, weight;
            if (!(std::cin >> from >> to >> weight)) return 2;
            if (power ? weight < 0 || from == to : weight < -10000 || weight > 10000) return 2;
            if (!graph->AddEdge(from, to, weight)) return 2;
        }
        if (power) {
            const auto plan = PlanPowerSupply(*graph);
            if (!plan) return 2;
            printPowerSupply(*plan);
            return 0;
        }
        auto begin = std::chrono::steady_clock::now();
        std::vector<int> colors, distances, path, order, components;
        std::optional<Graph> tree;
        int colorCount = 0;
        int totalWeight = 0;
        int componentCount = 0;
        std::ostringstream steps;
        steps << '[';
        if (algorithm == "greedy") {
            const auto answer = GreedyColoring(*graph);
            if (!answer) return 2;
            for (int i = 0; i < n; ++i) {
                int color = (*answer)[i];
                colors.push_back(color);
                order.push_back(i);
                colorCount = std::max(colorCount, color + 1);
            }
        } else if (algorithm == "components") {
            DynamicArray<int> trace;
            const auto answer = ConnectedComponents(*graph, &trace);
            if (!answer) return 2;
            for (int i = 0; i < n; ++i) {
                int component = (*answer)[i];
                components.push_back(component);
                componentCount = std::max(componentCount, component + 1);
            }
            std::vector<int> stack;
            for (int i = 0; i < trace.GetLength(); ++i) {
                const bool entering = trace[i] >= 0;
                const int vertex = entering ? trace[i] : -trace[i] - 1;
                if (!entering) stack.pop_back();
                const int parent = stack.empty() ? -1 : stack.back();
                if (i) steps << ',';
                steps << "{\"vertex\":" << vertex << ",\"parent\":" << parent
                      << ",\"component\":" << components[vertex]
                      << ",\"entering\":" << (entering ? "true" : "false") << '}';
                if (entering) stack.push_back(vertex);
            }
        } else if (algorithm == "kruskal") {
            tree = Kruskal(*graph);
            if (!tree) return 2;
            componentCount = tree->GetVertexCount();
            for (int from = 0; from < tree->GetVertexCount(); ++from) {
                const auto& neighbors = tree->GetNeighbors(from)->get();
                for (int i = 0; i < neighbors.GetLength(); ++i) {
                    if (from < neighbors[i].to) {
                        totalWeight += neighbors[i].weight;
                        --componentCount;
                    }
                }
            }
        } else {
            if (target < 0 || target >= n) return 2;
            const auto result = algorithm == "bfs" ? BFS(*graph, start) : Dijkstra(*graph, start);
            if (!result) return 2;
            const auto& answer = *result;
            for (int i = 0; i < n; ++i) {
                const bool reachable = answer[i] != -1 && answer[i] != std::numeric_limits<int>::max();
                distances.push_back(reachable ? answer[i] : -1);
                if (reachable) order.push_back(i);
            }
            std::stable_sort(order.begin(), order.end(), [&](int a, int b) { return answer[a] < answer[b]; });
            path = restorePath(*graph, answer, start, target, algorithm == "dijkstra");
        }
        steps << ']';
        const double elapsed = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - begin).count();
        std::cout << "{\"algorithm\":\"" << algorithm << "\",\"colors\":"; printArray(colors);
        std::cout << ",\"distances\":"; printArray(distances);
        std::cout << ",\"path\":"; printArray(path);
        std::cout << ",\"order\":"; printArray(order);
        std::cout << ",\"components\":"; printArray(components);
        std::cout << ",\"steps\":" << steps.str();
        std::cout << ",\"tree\":";
        if (tree) printEdges(*tree);
        else std::cout << "[]";
        std::cout << ",\"colorCount\":" << colorCount << ",\"totalWeight\":" << totalWeight
                  << ",\"componentCount\":" << componentCount << ",\"elapsedMs\":" << elapsed << '}';
    } catch (const std::exception& error) {
        std::cerr << error.what();
        return 1;
    }
}
