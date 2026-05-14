'use strict';

/**
 * 0/1 Knapsack — Vehicle Maintenance Scheduler
 *
 * Problem: Given a depot with a fixed mechanic-hour budget (capacity)
 * and a list of maintenance tasks (vehicles), each with a Duration and
 * an Impact score, select the subset of tasks that maximises total
 * Impact without exceeding the budget.
 *
 * This is the classic 0/1 Knapsack problem solved with bottom-up DP.
 * Time complexity  : O(n × W)   where n = tasks, W = budget (MechanicHours)
 * Space complexity : O(n × W)
 *
 * No external algorithm libraries are used — pure implementation.
 */

/**
 * @param {number} capacity  - MechanicHours available for the depot
 * @param {Array}  vehicles  - Array of { TaskID, Duration, Impact }
 * @returns {{ maxImpact: number, selectedTasks: Array, totalDuration: number }}
 */
function knapsack(capacity, vehicles) {
  const n = vehicles.length;

  if (n === 0 || capacity <= 0) {
    return { maxImpact: 0, selectedTasks: [], totalDuration: 0 };
  }

  // Build DP table: dp[i][w] = max impact using first i tasks with capacity w
  // Use 1D rolling array to save memory (optimised space: O(W))
  const dp = new Array(capacity + 1).fill(0);

  // Keep a 2D table only for backtracking (which tasks were selected)
  const selected = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(false)
  );

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = vehicles[i - 1];
    // Traverse capacity backwards to prevent using same item twice (0/1)
    for (let w = capacity; w >= Duration; w--) {
      const withItem = dp[w - Duration] + Impact;
      if (withItem > dp[w]) {
        dp[w] = withItem;
        selected[i][w] = true; // item i is included at capacity w
      }
    }
  }

  const maxImpact = dp[capacity];

  // Backtrack to find which vehicles were selected
  const chosenTasks = [];
  let remainingCapacity = capacity;

  // Rebuild full DP table for accurate backtracking
  const fullDp = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0)
  );

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = vehicles[i - 1];
    for (let w = 0; w <= capacity; w++) {
      fullDp[i][w] = fullDp[i - 1][w];
      if (Duration <= w) {
        fullDp[i][w] = Math.max(
          fullDp[i][w],
          fullDp[i - 1][w - Duration] + Impact
        );
      }
    }
  }

  for (let i = n; i >= 1; i--) {
    if (fullDp[i][remainingCapacity] !== fullDp[i - 1][remainingCapacity]) {
      chosenTasks.push(vehicles[i - 1]);
      remainingCapacity -= vehicles[i - 1].Duration;
    }
  }

  const totalDuration = chosenTasks.reduce((sum, t) => sum + t.Duration, 0);

  return {
    maxImpact,
    selectedTasks: chosenTasks,
    totalDuration,
    unusedHours: capacity - totalDuration,
  };
}

module.exports = { knapsack };
