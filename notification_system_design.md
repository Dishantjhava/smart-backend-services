# Notification System Design

Campus notification platform — real-time updates for Placements, Events, and Results.

---

## Stage 1

### REST API Design — Endpoints, Contracts, and Real-Time Mechanism

#### Core Actions the Platform Must Support

| Action | Description |
|--------|-------------|
| User management | Register/authenticate students and admins |
| Create notification | Admin sends a notification to one or many students |
| Fetch notifications | Student retrieves their notifications (paginated) |
| Mark as read | Student marks a single notification or all as read |
| Real-time delivery | Student receives notifications instantly without polling |
| Filter/sort | Filter by type (Placement/Event/Result), read status, date |

---

#### REST API Endpoints

##### Authentication

**POST /api/auth/register**
```
Headers: Content-Type: application/json
Body:
{
  "name": "string",
  "email": "string",
  "rollNumber": "string",
  "password": "string"
}

Response 201:
{
  "success": true,
  "user": { "id": 1, "name": "string", "email": "string", "rollNumber": "string" },
  "token": "jwt_token"
}
```

**POST /api/auth/login**
```
Headers: Content-Type: application/json
Body: { "email": "string", "password": "string" }

Response 200:
{
  "success": true,
  "token": "jwt_token",
  "user": { "id": 1, "name": "string", "role": "student | admin" }
}
```

---

##### Notifications

**GET /api/notifications**
```
Headers: Authorization: Bearer <token>
Query:   ?page=1&limit=20&type=Placement&isRead=false&sort=createdAt_desc

Response 200:
{
  "success": true,
  "total": 150,
  "page": 1,
  "limit": 20,
  "notifications": [
    {
      "id": 1,
      "title": "Campus Placement Drive",
      "message": "TCS is visiting on 20th May...",
      "type": "Placement",
      "isRead": false,
      "createdAt": "2024-05-14T10:00:00Z"
    }
  ]
}
```

**GET /api/notifications/:id**
```
Headers: Authorization: Bearer <token>

Response 200:
{
  "id": 1,
  "title": "string",
  "message": "string",
  "type": "Placement | Event | Result",
  "isRead": false,
  "createdAt": "ISO timestamp",
  "readAt": null
}
```

**POST /api/notifications** _(Admin only)_
```
Headers: Authorization: Bearer <token>, Content-Type: application/json
Body:
{
  "title": "string",
  "message": "string",
  "type": "Placement | Event | Result",
  "targetStudents": "all | [1, 2, 3]"
}

Response 201:
{
  "success": true,
  "notificationId": 42,
  "sentTo": 320
}
```

**PATCH /api/notifications/:id/read**
```
Headers: Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "id": 1,
  "isRead": true,
  "readAt": "2024-05-14T11:00:00Z"
}
```

**PATCH /api/notifications/read-all**
```
Headers: Authorization: Bearer <token>

Response 200:
{ "success": true, "updatedCount": 15 }
```

**DELETE /api/notifications/:id** _(Admin only)_
```
Response 200: { "success": true, "message": "Notification deleted" }
```

**GET /api/users/:id/notifications**
```
Headers: Authorization: Bearer <token>
Query:   ?page=1&limit=20

Response 200:
{
  "userId": 1,
  "total": 80,
  "unreadCount": 12,
  "notifications": [...]
}
```

---

#### Real-Time Notification Mechanism — WebSockets (Socket.IO)

**Why WebSockets over polling:**
- Polling creates N × students requests per interval, crushing the DB.
- WebSockets maintain a persistent TCP connection; the server pushes updates instantly.
- Socket.IO adds automatic reconnection, room-based delivery, and fallback support.

**Flow:**
1. Student logs in → frontend connects to Socket.IO server.
2. Server places the student in a room named after their `userId` (e.g., `room_1042`).
3. Admin calls `POST /api/notifications` → server emits to specific rooms or `broadcast`.
4. Student receives the notification instantly without any polling.

**Socket Events:**
```
Client → Server:
  join_room  { userId: 1042 }

Server → Client:
  new_notification  { id, title, message, type, createdAt }
  notification_read { id, readAt }
```

---

## Stage 2

### Database Design — Storage Choice, Schema, and Scale

#### Database Choice: PostgreSQL

**Reasoning:**

| Criteria | PostgreSQL | MongoDB |
|----------|-----------|---------|
| Data structure | Highly relational (users ↔ notifications) | Document-oriented |
| ACID compliance | ✅ Full | Partial (with transactions) |
| Complex queries | ✅ Joins, aggregations, CTEs | Limited join support |
| Indexing | ✅ Composite, partial, GIN | Basic |
| Schema enforcement | ✅ Strict types, constraints | Flexible (can be a risk) |

Notifications are inherently relational: each notification belongs to a sender, and is linked to many recipients via a join table. PostgreSQL's relational model maps directly to this — no impedance mismatch.

---

#### Database Schema

```sql
-- Students / users of the platform
CREATE TABLE users (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100)        NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  rollNumber   VARCHAR(20)  UNIQUE NOT NULL,
  passwordHash VARCHAR(255)        NOT NULL,
  role         VARCHAR(10)  DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  createdAt    TIMESTAMP    DEFAULT NOW()
);

-- Notification type enum
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

-- Notification content (shared, created once)
CREATE TABLE notifications (
  id        SERIAL            PRIMARY KEY,
  title     VARCHAR(255)      NOT NULL,
  message   TEXT              NOT NULL,
  type      notification_type NOT NULL,
  createdBy INTEGER           REFERENCES users(id) ON DELETE SET NULL,
  createdAt TIMESTAMP         DEFAULT NOW()
);

-- Per-student delivery and read tracking (the large table)
CREATE TABLE user_notifications (
  id             SERIAL    PRIMARY KEY,
  userId         INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notificationId INTEGER   NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  isRead         BOOLEAN   DEFAULT FALSE,
  readAt         TIMESTAMP,
  deliveredAt    TIMESTAMP DEFAULT NOW(),
  UNIQUE (userId, notificationId)
);

-- Performance indexes
CREATE INDEX idx_un_userId    ON user_notifications (userId);
CREATE INDEX idx_un_isRead    ON user_notifications (userId, isRead);
CREATE INDEX idx_un_createdAt ON user_notifications (userId, deliveredAt DESC);
CREATE INDEX idx_notif_type   ON notifications (type);
CREATE INDEX idx_notif_date   ON notifications (createdAt DESC);
```

---

#### Scale Problems and Solutions

| Problem | Root Cause | Solution |
|---------|-----------|----------|
| `user_notifications` grows to billions of rows (50k users × millions of notifs) | No archiving | Partition by `deliveredAt` (monthly range partitions); archive old rows to cold storage |
| Slow reads on unread count | Full scan on `isRead` | Partial index: `CREATE INDEX idx_unread ON user_notifications (userId) WHERE isRead = false` |
| Write bottleneck when sending to 50k students | Single INSERT loop | Bulk INSERT with `INSERT INTO user_notifications ... SELECT` — one statement, not N |
| Hot rows on popular notifications | Everyone reads same notif row | Cache notification content in Redis; only track read state in DB |
| Connection exhaustion | 50k concurrent WebSocket + DB connections | Use PgBouncer connection pooler; separate read replicas for SELECT queries |

---

#### SQL Queries Based on Stage 1 APIs

**Fetch paginated notifications for a user (GET /api/users/:id/notifications):**
```sql
SELECT
  n.id,
  n.title,
  n.message,
  n.type,
  un.isRead,
  un.readAt,
  un.deliveredAt
FROM user_notifications un
JOIN notifications n ON un.notificationId = n.id
WHERE un.userId = $1
ORDER BY un.deliveredAt DESC
LIMIT $2 OFFSET $3;
```

**Get unread count for a user:**
```sql
SELECT COUNT(*) AS unreadCount
FROM user_notifications
WHERE userId = $1 AND isRead = false;
```

**Mark all notifications as read (PATCH /api/notifications/read-all):**
```sql
UPDATE user_notifications
SET isRead = true, readAt = NOW()
WHERE userId = $1 AND isRead = false;
```

**Bulk send notification to all students (POST /api/notifications):**
```sql
-- Step 1: Insert the notification
INSERT INTO notifications (title, message, type, createdBy)
VALUES ($1, $2, $3, $4)
RETURNING id;

-- Step 2: Bulk-insert one row per student in a single query
INSERT INTO user_notifications (userId, notificationId)
SELECT id, $1 FROM users WHERE role = 'student';
```

---

## Stage 3

### Query Analysis and Optimisation

#### The Slow Query

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

#### Is This Query Accurate?

**No — it has a schema mismatch.** Based on the schema designed in Stage 2:
- `notifications` does not have a `studentID` or `isRead` column.
- Those fields live in `user_notifications` (the join table).
- The correct query must join both tables.

#### Why Is It Slow?

Even ignoring the schema issue, this query would be slow because:

1. **`SELECT *`** — fetches all columns including large `TEXT` fields unnecessarily.
2. **Full table scan** — with 5,000,000 rows and no compound index on `(studentID, isRead, createdAt)`, PostgreSQL must scan the entire table.
3. **No LIMIT** — returns potentially thousands of rows to the application layer.
4. **`ORDER BY` without index** — forces an in-memory sort of all matched rows.

At 50,000 students × 5,000,000 notifications the `user_notifications` table has tens of millions of rows. A full scan + sort is O(N log N) — unacceptable.

#### Estimated Computation Cost (Before Fix)

- Table rows scanned: ~5,000,000 (full scan)
- Sort cost: O(N log N) on matched rows
- Response time: seconds to tens of seconds under load

#### Corrected and Optimised Query

```sql
-- Step 1: Add a targeted partial index (run once at DB level)
CREATE INDEX idx_user_notifications_unread
  ON user_notifications (userId, deliveredAt DESC)
  WHERE isRead = false;

-- Step 2: The optimised query
SELECT
  n.id,
  n.title,
  n.message,
  n.type,
  un.deliveredAt AS createdAt
FROM user_notifications un
JOIN notifications n ON un.notificationId = n.id
WHERE un.userId = 1042
  AND un.isRead = false
ORDER BY un.deliveredAt DESC
LIMIT 20;
```

**What changed and why:**

| Change | Reason |
|--------|--------|
| `SELECT *` → named columns | Avoids fetching unused data; reduces network payload |
| Added `LIMIT 20` | Never return unbounded results; paginates the response |
| Partial index (`WHERE isRead = false`) | Index only covers unread rows — smaller, faster |
| Composite index `(userId, deliveredAt DESC)` | Covers the `WHERE userId = ?` and `ORDER BY deliveredAt` in one index scan |
| Joined with `notifications` table | Correct schema — student-notification relationship lives in `user_notifications` |

**After fix:** Index seek instead of full scan → O(log N + K) where K = result rows. Response time drops from seconds to milliseconds.

---

#### Should You Index Every Column?

**No — this is harmful advice.**

Reasons:
- **Write overhead**: Every INSERT/UPDATE/DELETE must also update all indexes. With bulk notifications to 50k students, this multiplies write cost by the number of indexes.
- **Storage cost**: Each index is a separate B-tree structure occupying disk space.
- **Planner confusion**: Too many indexes can cause the query planner to choose a suboptimal index.
- **Diminishing returns**: Columns with low cardinality (e.g., `isRead` which is just true/false) are poor standalone index candidates.

**Rule of thumb**: Index columns that appear in `WHERE`, `JOIN ON`, and `ORDER BY` clauses of your most frequent, performance-critical queries — nothing more.

---

#### Query: All Students Who Got a Placement Notification in the Last 7 Days

```sql
SELECT DISTINCT
  u.id,
  u.name,
  u.email,
  u.rollNumber
FROM users u
JOIN user_notifications un ON u.id = un.userId
JOIN notifications n ON un.notificationId = n.id
WHERE n.type = 'Placement'
  AND n.createdAt >= NOW() - INTERVAL '7 days';
```

**Supporting index:**
```sql
CREATE INDEX idx_notifications_type_date ON notifications (type, createdAt DESC);
```

---

## Stage 4

### Performance Optimisation — Solving the Page-Load DB Overload

#### The Problem

Fetching notifications from the DB on every page load for 50,000 students means:
- 50,000 SELECT queries per page-load cycle
- Each query hits `user_notifications` (potentially millions of rows)
- DB connections saturate → timeouts → bad UX

---

#### Strategy 1: Redis Caching (Recommended Primary Solution)

Cache the notification list per user in Redis with a short TTL.

```
Key:   notifications:user:{userId}
Value: JSON array of top-20 notifications
TTL:   60 seconds
```

**Flow:**
1. Request arrives → check Redis for `notifications:user:1042`
2. Cache HIT → return cached data immediately (< 1ms)
3. Cache MISS → query PostgreSQL → store result in Redis → return

**Cache invalidation:**
- When a new notification is delivered to user → `DEL notifications:user:{userId}`
- When user marks a notification as read → `DEL notifications:user:{userId}`

**Trade-offs:**

| Pro | Con |
|-----|-----|
| Sub-millisecond reads for cached users | Stale data within TTL window (acceptable for notifications) |
| Massive DB offload (95%+ cache hit rate) | Additional infrastructure (Redis cluster) |
| Atomic increment for unread count (`INCR unread:user:{userId}`) | Cache invalidation complexity |

---

#### Strategy 2: Push Instead of Pull (WebSockets — from Stage 1)

Replace page-load fetching with server-push via Socket.IO.

- On login, client connects via WebSocket (persistent connection).
- New notifications are pushed by the server in real-time.
- Client maintains local state; no DB hit on page load.

**Trade-offs:**

| Pro | Con |
|-----|-----|
| Zero DB queries on page load | Persistent connections consume server memory |
| Instant delivery | Requires Socket.IO infrastructure |
| Works with Redis Pub/Sub for horizontal scaling | More complex client-side state management |

---

#### Strategy 3: Always Paginate + Cursor-Based Navigation

Never return all notifications. Always use:
```sql
WHERE userId = $1 AND deliveredAt < $cursor ORDER BY deliveredAt DESC LIMIT 20
```

**Trade-offs:**

| Pro | Con |
|-----|-----|
| Reduces query cost to O(1) per page | Requires cursor management on client |
| Scales linearly with page size, not total rows | Cannot jump to arbitrary pages |

---

#### Strategy 4: Separate Read Replica

Route all SELECT queries to a PostgreSQL read replica; writes go to the primary.

**Trade-offs:**

| Pro | Con |
|-----|-----|
| Primary DB protected from read traffic | Replication lag (milliseconds) — minor stale reads |
| Horizontal scaling for reads | Additional infrastructure cost |

---

#### Recommended Combined Approach

```
Request → Redis Cache → (MISS) → Read Replica → Cache Result → Return
New notification → WebSocket push + cache invalidation
Unread count → Redis INCR/DECR (never query DB for count)
```

---

## Stage 5

### Reliable Bulk Notification — Redesigning `notify_all`

#### The Original Pseudocode

```python
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)   # calls Email API
        save_to_db(student_id, message)   # DB insert
        push_to_app(student_id, message)  # real-time push
```

#### Observed Shortcomings

| Problem | Impact |
|---------|--------|
| **Synchronous sequential loop** | 50,000 students × ~200ms per email = ~2.7 hours |
| **No error handling** | One failure silently kills the rest of the loop |
| **Tightly coupled operations** | Email API failure prevents DB save and push |
| **No retry logic** | Transient failures are permanent failures |
| **No progress tracking** | Cannot resume if the process crashes at student 200 |
| **DB inserts inside loop** | N separate round-trips instead of one bulk INSERT |

#### What Happened: Email Failed at Student 200

- Students 1–199 got emails AND DB records.
- Students 200–50,000 got neither.
- No way to know which students succeeded without manual investigation.
- Resending to all = duplicates for 1–199.

---

#### Redesigned Implementation — Message Queue with Bull (Redis-backed)

**Core principle:**
1. **Save to DB first** (source of truth — idempotent with `UNIQUE` constraint).
2. **Email and push are best-effort** — they go through a queue with automatic retries.
3. DB save and email delivery are **decoupled** — a failed email does not corrupt DB state.

**Should DB save and email happen together?**
> **No.** They have different reliability characteristics. DB writes are synchronous and transactional. Email delivery is asynchronous, network-dependent, and often rate-limited by third-party APIs. Coupling them means a flaky email provider takes down your entire notification pipeline.

---

#### Revised Pseudocode

```javascript
// ── Step 1: Producer — called when admin clicks "Notify All"
async function notify_all(student_ids, message) {
  // Bulk-insert all DB records in ONE query (idempotent via ON CONFLICT DO NOTHING)
  await save_all_to_db(student_ids, message);

  // Enqueue one job per student — non-blocking, returns immediately
  const jobs = student_ids.map((student_id) => ({
    data: { student_id, message },
    opts: {
      attempts: 5,          // retry up to 5 times on failure
      backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s...
      removeOnComplete: true,
      removeOnFail: false,  // keep failed jobs for inspection
    },
  }));

  await notificationQueue.addBulk(jobs);
  console.log(`Queued ${student_ids.length} jobs`);
}

// ── Step 2: Consumer — runs in separate worker processes (scalable)
notificationQueue.process(CONCURRENCY = 200, async (job) => {
  const { student_id, message } = job.data;

  // Email and push are independent — failure of one doesn't block the other
  const results = await Promise.allSettled([
    send_email(student_id, message),
    push_to_app(student_id, message),
  ]);

  const emailFailed = results[0].status === 'rejected';
  const pushFailed  = results[1].status === 'rejected';

  // Update DB delivery status
  await update_delivery_status(student_id, {
    emailSent: !emailFailed,
    pushSent:  !pushFailed,
  });

  // If email failed, throw so Bull retries this job
  if (emailFailed) throw new Error(`Email failed: ${results[0].reason}`);
});

// ── Step 3: DB save is a single bulk INSERT (not N individual inserts)
async function save_all_to_db(student_ids, message) {
  // One round-trip to DB, idempotent
  await db.query(`
    INSERT INTO user_notifications (userId, notificationId)
    SELECT id, $1 FROM users WHERE id = ANY($2::int[])
    ON CONFLICT (userId, notificationId) DO NOTHING
  `, [notificationId, student_ids]);
}
```

#### What Happens If Email Fails at Student 200?

- DB records exist for all 50,000 students (bulk-inserted before queue).
- Students 1–199 are processed successfully and removed from queue.
- Job for student 200 fails → Bull retries with exponential backoff.
- Students 201–50,000 continue processing in parallel (not blocked).
- After 5 retries, failed jobs go to a **dead-letter queue** for manual inspection and replay.
- No duplicates because DB uses `ON CONFLICT DO NOTHING`.

---

## Stage 6

### Priority Inbox — Top-N Notifications by Importance

#### Problem Statement

Display the top `n` most important unread notifications where:
- **Priority type weights**: Placement (3) > Result (2) > Event (1)
- **Tie-breaking**: More recent notifications rank higher
- New notifications keep arriving — the top-n must update efficiently

---

#### Algorithm: Min-Heap of Size N

**Why a Min-Heap?**

A naive approach sorts all notifications every time — O(M log M) for M total notifications.

A Min-Heap of size N is optimal:
- The heap stores the N *best* notifications.
- The root is the *least important* among the top-N (min of the top-N).
- For each new notification: if its score > heap root's score → swap (pop min, push new).
- Time: **O(M log N)** to process M notifications.
- Space: **O(N)** — only stores N items regardless of total count.

For a stream of notifications (new ones keep arriving), each insertion is **O(log N)** — far better than re-sorting.

---

#### Priority Score Formula

```
score = typeWeight × 10¹³ + sentAt_timestamp_ms
```

| Type | Weight | Score Example (sent at 1715688000000ms) |
|------|--------|------------------------------------------|
| Placement | 3 | 3 × 10¹³ + 1715688000000 = 30001715688000000 |
| Result | 2 | 2 × 10¹³ + 1715688000000 = 20001715688000000 |
| Event | 1 | 1 × 10¹³ + 1715688000000 = 10001715688000000 |

Type weight dominates; timestamp breaks ties within the same type.

---

#### Maintaining Top-N with New Arrivals

```
On new notification arrives (notif):
  scored = { ...notif, score: computeScore(notif) }

  if heap.size < N:
    heap.push(scored)                       // O(log N)
  else if scored.score > heap.peek().score:
    heap.pop()                              // remove least important
    heap.push(scored)                       // O(log N)
  // else: new notification doesn't make top-N, discard
```

This guarantees the heap always holds exactly the top-N notifications without ever sorting the full list.

---

#### Implementation

See `notification_app_be/src/services/priorityQueue.service.js` for the full Min-Heap implementation in JavaScript.

**API endpoints:**
- `GET /api/notifications/priority?n=10` — fetch from external API, return top-n via heap
- `POST /api/notifications/priority/insert` — simulate inserting a new notification and recalculating top-n

**External API used:**
`GET http://4.224.186.213/evaluation-service/notifications`
(Protected route — credentials sent as `rollno`, `clientid`, `clientsecret` headers)
