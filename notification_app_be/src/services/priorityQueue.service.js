'use strict';

/**
 * Min-Heap Priority Queue — Stage 6: Priority Inbox
 *
 * Notification fields from the external API (capitalised):
 *   ID, Type, Message, Timestamp
 *
 * Priority scoring formula:
 *   score = typeWeight × 10^13 + timestamp_ms
 *
 * Type weights:
 *   Placement → 3  (highest)
 *   Result    → 2
 *   Event     → 1  (lowest)
 *
 * Min-Heap of size n keeps the top-n notifications.
 * The heap root is the LEAST important among the top-n.
 * New notification: if score > root.score → pop root, push new.
 * Time: O(M log N) to process M notifications, O(log N) per insertion.
 */

const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 };

function computeScore(notification) {
  // Handle both capitalised (API) and lowercase field names
  const type = notification.Type || notification.type || '';
  const weight = TYPE_WEIGHT[type] || 0;
  const tsRaw = notification.Timestamp || notification.sentAt || notification.createdAt || 0;
  const timestamp = tsRaw ? new Date(tsRaw).getTime() : 0;
  return weight * 1e13 + timestamp;
}

class MinHeap {
  constructor() { this._heap = []; }

  get size() { return this._heap.length; }
  peek() { return this._heap[0] || null; }

  push(item) {
    this._heap.push(item);
    this._bubbleUp(this._heap.length - 1);
  }

  pop() {
    if (!this._heap.length) return null;
    const top = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length) { this._heap[0] = last; this._sinkDown(0); }
    return top;
  }

  toSortedArray() {
    return [...this._heap].sort((a, b) => b.score - a.score);
  }

  _p(i) { return Math.floor((i - 1) / 2); }
  _l(i) { return 2 * i + 1; }
  _r(i) { return 2 * i + 2; }

  _bubbleUp(i) {
    while (i > 0) {
      const p = this._p(i);
      if (this._heap[p].score > this._heap[i].score) {
        [this._heap[p], this._heap[i]] = [this._heap[i], this._heap[p]];
        i = p;
      } else break;
    }
  }

  _sinkDown(i) {
    const n = this._heap.length;
    while (true) {
      let s = i;
      const l = this._l(i), r = this._r(i);
      if (l < n && this._heap[l].score < this._heap[s].score) s = l;
      if (r < n && this._heap[r].score < this._heap[s].score) s = r;
      if (s !== i) { [this._heap[s], this._heap[i]] = [this._heap[i], this._heap[s]]; i = s; }
      else break;
    }
  }
}

function getTopN(notifications, n = 10) {
  const heap = new MinHeap();
  for (const notif of notifications) {
    const scored = { ...notif, score: computeScore(notif) };
    if (heap.size < n) {
      heap.push(scored);
    } else if (heap.peek() && scored.score > heap.peek().score) {
      heap.pop();
      heap.push(scored);
    }
  }
  return heap.toSortedArray();
}

module.exports = { MinHeap, getTopN, computeScore, TYPE_WEIGHT };
