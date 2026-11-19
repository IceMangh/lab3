#ifndef LAB3_GRAPH_H
#define LAB3_GRAPH_H

#include "../atd/DynamicArray.h"
#include <functional>
#include <optional>

struct Edge {
    int to;
    int weight;

    Edge(int to = 0, int weight = 1): to(to), weight(weight) {}
};

class Graph {
private:
    bool weighted;
    bool directed;

    DynamicArray<DynamicArray<Edge>> adjacency;

    Graph(int vertexCount, bool weighted, bool directed): weighted(weighted), directed(directed), adjacency(vertexCount) {}

public:
    static std::optional<Graph> Create(int vertexCount, bool weighted, bool directed) {
        if (vertexCount < 0) {
            return std::nullopt;
        }
        return Graph(vertexCount, weighted, directed);
    }

    int GetVertexCount() const {
        return adjacency.GetLength();
    }

    std::optional<Edge> AddEdge(int from, int to, int weight = 1) {
        if (from < 0 || from >= GetVertexCount() || to < 0 || to >= GetVertexCount()) {
            return std::nullopt;
        }
        if (!weighted) {
            weight = 1;
        }

        Edge edge(to, weight);
        adjacency[from].Append(edge);
        if (!directed) {
            adjacency[to].Append(Edge(from, weight));
        }
        return edge;
    }

    std::optional<std::reference_wrapper<const DynamicArray<Edge>>> GetNeighbors(int vertex) const {
        if (vertex < 0 || vertex >= GetVertexCount()) {
            return std::nullopt;
        }
        return std::cref(adjacency[vertex]);
    }

    bool IsWeighted() const {
        return weighted;
    }

    bool IsDirected() const {
        return directed;
    }
};

#endif //LAB3_GRAPH_H
