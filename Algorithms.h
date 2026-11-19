#ifndef LAB3_ALGORITHMS_H
#define LAB3_ALGORITHMS_H

#include "Graph.h"
#include <limits>

std::optional<DynamicArray<int>> BFS(const Graph &graph, int start) {
    if (start < 0 || start >= graph.GetVertexCount()) {
        return std::nullopt;
    }

    DynamicArray<int> dist(graph.GetVertexCount());
    DynamicArray<int> q;
    int head = 0;

    for (int i = 0; i < dist.GetLength(); ++i) {
        dist[i] = -1;
    }

    dist[start] = 0;
    q.Append(start);

    while (head < q.GetLength()) {
        int vertex = q[head++];
        const DynamicArray<Edge> &neighbors = graph.GetNeighbors(vertex)->get();
        for (int i = 0; i < neighbors.GetLength(); ++i) {
            if (dist[neighbors[i].to] == -1) {
                int to = neighbors[i].to;
                dist[to] = dist[vertex] + 1;
                q.Append(to);
            }
        }
    }

    return dist;
}

namespace detail {

void DFSVisit(const Graph& graph, int vertex, DynamicArray<bool>& visited) {
    visited[vertex] = true;
    const DynamicArray<Edge> &neighbors = graph.GetNeighbors(vertex)->get();
    for (int i = 0; i < neighbors.GetLength(); ++i) {
        if (!visited[neighbors[i].to]) {
            DFSVisit(graph, neighbors[i].to, visited);
        }
    }
}

void MarkComponent(const Graph& graph, int vertex, int componentId, DynamicArray<int>& components, DynamicArray<int>* trace = nullptr) {
    components[vertex] = componentId;
    if (trace) {
        trace->Append(vertex);
    }

    const DynamicArray<Edge> &neighbors = graph.GetNeighbors(vertex)->get();
    for (int i = 0; i < neighbors.GetLength(); ++i) {
        if (components[neighbors[i].to] == -1) {
            MarkComponent(graph, neighbors[i].to, componentId, components, trace);
        }
    }
    if (trace) {
        trace->Append(-vertex - 1);
    }
}

}

std::optional<DynamicArray<bool>> DFS(const Graph& graph, int start) {
    if (start < 0 || start >= graph.GetVertexCount()) {
        return std::nullopt;
    }

    DynamicArray<bool> visited(graph.GetVertexCount());

    for (int i = 0; i < visited.GetLength(); ++i) {
        visited[i] = false;
    }

    detail::DFSVisit(graph, start, visited);

    return visited;
}

std::optional<DynamicArray<int>> ConnectedComponents(const Graph& graph, DynamicArray<int>* trace = nullptr) {
    if (trace) {
        trace->Resize(0);
    }

    if (graph.IsDirected()) {
        return std::nullopt;
    }

    DynamicArray<int> components(graph.GetVertexCount());

    for (int i = 0; i < components.GetLength(); ++i) {
        components[i] = -1;
    }

    int componentId = 0;

    for (int vertex = 0; vertex < graph.GetVertexCount(); ++vertex) {
        if (components[vertex] == -1) {
            detail::MarkComponent(graph, vertex, componentId, components, trace);
            ++componentId;
        }
    }

    return components;
}

std::optional<DynamicArray<int>> GreedyColoring(const Graph& graph) {
    int n = graph.GetVertexCount();
    if (graph.IsDirected()) {
        auto undirected = Graph::Create(n, false, false);
        for (int from = 0; from < n; ++from) {
            const auto& neighbors = graph.GetNeighbors(from)->get();
            for (int i = 0; i < neighbors.GetLength(); ++i) {
                undirected->AddEdge(from, neighbors[i].to);
            }
        }
        return GreedyColoring(*undirected);
    }

    DynamicArray<int> colors(n);

    for (int i = 0; i < n; ++i) {
        colors[i] = -1;
    }

    for (int vertex = 0; vertex < n; ++vertex) {
        DynamicArray<bool> used(n);

        for (int i = 0; i < n; ++i) {
            used[i] = false;
        }

        const DynamicArray<Edge>& neighbors = graph.GetNeighbors(vertex)->get();

        for (int i = 0; i < neighbors.GetLength(); ++i) {
            int to = neighbors[i].to;

            if (to == vertex) {
                return std::nullopt;
            }

            if (colors[to] != -1) {
                used[colors[to]] = true;
            }
        }

        int color = 0;
        while (used[color]) {
            ++color;
        }

        colors[vertex] = color;
    }

    return colors;
}

std::optional<DynamicArray<int>> Dijkstra(const Graph& graph, int start) {
    if (start < 0 || start >= graph.GetVertexCount()) {
        return std::nullopt;
    }

    DynamicArray<int> dist(graph.GetVertexCount());

    for (int i = 0; i < dist.GetLength(); ++i) {
        dist[i] = std::numeric_limits<int>::max();
    }

    dist[start] = 0;

    DynamicArray<int> visited(graph.GetVertexCount());

    for (int i = 0; i < visited.GetLength(); ++i) {
        visited[i] = false;
    }

    for (int vertex = 0; vertex < graph.GetVertexCount(); ++vertex) {
        const DynamicArray<Edge>& neighbors = graph.GetNeighbors(vertex)->get();
        for (int j = 0; j < neighbors.GetLength(); ++j) {
            if (neighbors[j].weight < 0) {
                return std::nullopt;
            }
        }
    }

    for (int i = 0; i < graph.GetVertexCount(); ++i) {
        int vertex = -1;
        for (int j = 0; j < graph.GetVertexCount(); ++j) {
            if (!visited[j] && (vertex == -1 || dist[j] < dist[vertex])) {
                vertex = j;
            }
        }
        if (vertex == -1 || dist[vertex] == std::numeric_limits<int>::max()) {
            break;
        }

        visited[vertex] = true;
        const DynamicArray<Edge>& neighbors = graph.GetNeighbors(vertex)->get();
        for (int j = 0; j < neighbors.GetLength(); ++j) {
            const Edge& edge = neighbors[j];
            if (edge.weight <= std::numeric_limits<int>::max() - dist[vertex] && dist[vertex] + edge.weight < dist[edge.to]) {
                dist[edge.to] = dist[vertex] + edge.weight;
            }
        }
    }

    return dist;
}

std::optional<Graph> Kruskal(const Graph& graph) {
    if (graph.IsDirected()) {
        return std::nullopt;
    }

    int vertexCount = graph.GetVertexCount();
    DynamicArray<int> fromVertices;
    DynamicArray<Edge> edges;

    for (int from = 0; from < vertexCount; ++from) {
        const DynamicArray<Edge>& neighbors = graph.GetNeighbors(from)->get();
        for (int i = 0; i < neighbors.GetLength(); ++i) {
            const Edge& edge = neighbors[i];
            if (from < edge.to) {
                fromVertices.Append(from);
                edges.Append(edge);
            }
        }
    }

    for (int i = 0; i < edges.GetLength(); ++i) {
        int minIndex = i;
        for (int j = i + 1; j < edges.GetLength(); ++j) {
            if (edges[j].weight < edges[minIndex].weight) {
                minIndex = j;
            }
        }

        Edge tempEdge = edges[i];
        edges[i] = edges[minIndex];
        edges[minIndex] = tempEdge;

        int tempFrom = fromVertices[i];
        fromVertices[i] = fromVertices[minIndex];
        fromVertices[minIndex] = tempFrom;
    }

    DynamicArray<int> components(vertexCount);
    for (int i = 0; i < vertexCount; ++i) {
        components[i] = i;
    }

    auto result = Graph::Create(vertexCount, graph.IsWeighted(), false);
    for (int i = 0; i < edges.GetLength(); ++i) {
        int from = fromVertices[i];
        int to = edges[i].to;
        int componentFrom = components[from];
        int componentTo = components[to];

        if (componentFrom == componentTo) {
            continue;
        }

        result->AddEdge(from, to, edges[i].weight);
        for (int vertex = 0; vertex < vertexCount; ++vertex) {
            if (components[vertex] == componentTo) {
                components[vertex] = componentFrom;
            }
        }
    }

    return result;
}

#endif //LAB3_ALGORITHMS_H
