#ifndef LAB3_POWER_SUPPLY_H
#define LAB3_POWER_SUPPLY_H

#include <chrono>
#include "Algorithms.h"

struct PowerSupplyPlan {
    Graph cables;
    long long totalCost = 0;
    DynamicArray<int> unreachable{};
    double elapsedMs = 0;
};

inline std::optional<PowerSupplyPlan> PlanPowerSupply(const Graph& district) {
    if (!district.IsWeighted() || district.IsDirected() || district.GetVertexCount() == 0) {
        return std::nullopt;
    }
    for (int from = 0; from < district.GetVertexCount(); ++from) {
        const auto& neighbors = district.GetNeighbors(from)->get();
        for (int i = 0; i < neighbors.GetLength(); ++i) {
            if (neighbors[i].to == from || neighbors[i].weight < 0) {
                return std::nullopt;
            }
        }
    }

    const auto start = std::chrono::steady_clock::now();
    auto cables = Kruskal(district);
    const auto finish = std::chrono::steady_clock::now();
    if (!cables) return std::nullopt;

    PowerSupplyPlan plan{*cables};
    plan.elapsedMs = std::chrono::duration<double, std::milli>(finish - start).count();

    const auto distances = BFS(plan.cables, 0);
    if (!distances) return std::nullopt;
    for (int from = 0; from < plan.cables.GetVertexCount(); ++from) {
        if ((*distances)[from] == -1) {
            plan.unreachable.Append(from);
        }

        const DynamicArray<Edge>& neighbors = plan.cables.GetNeighbors(from)->get();
        for (int i = 0; i < neighbors.GetLength(); ++i) {
            const Edge& edge = neighbors[i];
            if (from < edge.to) {
                plan.totalCost += edge.weight;
            }
        }
    }

    return plan;
}

#endif //LAB3_POWER_SUPPLY_H
