# smart-backend-services

A collection of backend microservices built with **Node.js + Express**, featuring a reusable logging middleware that ships structured logs to an external test server, a vehicle maintenance optimiser using a custom 0/1 Knapsack algorithm, and a notification priority inbox powered by a custom Min-Heap.

---

## Repository Structure

```
12315542/
├── .gitignore
├── README.md
├── notification_system_design.md        ← System design document (Stages 1–6)
│
├── logging_middleware/                  ← Reusable logging package
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js
│       ├── middleware/
│       │   └── logger.js               ← Log() + requestLogger
│       ├── routes/
│       │   └── demo.routes.js
│       └── controllers/
│           └── demo.controller.js
│
├── vehicle_maintence_scheduler/         ← Maintenance task optimiser
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js
│       ├── middleware/
│       │   ├── logger.js
│       │   └── errorHandler.js
│       ├── routes/
│       │   └── scheduler.routes.js
│       ├── controllers/
│       │   └── scheduler.controller.js
│       └── services/
│           ├── knapsack.service.js      ← 0/1 Knapsack (pure implementation)
│           └── externalApi.service.js
│
└── notification_app_be/                 ← Notification priority inbox
    ├── package.json
    ├── .env.example
    └── src/
        ├── index.js
        ├── middleware/
        │   ├── logger.js
        │   └── errorHandler.js
        ├── routes/
        │   └── notifications.routes.js
        ├── controllers/
        │   └── notifications.controller.js
        └── services/
            ├── priorityQueue.service.js ← Min-Heap (pure implementation)
            └── externalApi.service.js
```

---

## Prerequisites

- **Node.js** v18+
- **npm** v9+

---

## Setup

Each service is an independent Express app. Install dependencies separately:

```bash
cd logging_middleware         && npm install
cd ../vehicle_maintence_scheduler && npm install
cd ../notification_app_be     && npm install
```

---

## Environment Variables

The vehicle scheduler and notification app call **protected external APIs** using credentials obtained from registration.

Copy `.env.example` to `.env` in each folder and fill in your values:

```bash
cp vehicle_maintence_scheduler/.env.example vehicle_maintence_scheduler/.env
cp notification_app_be/.env.example         notification_app_be/.env
cp logging_middleware/.env.example          logging_middleware/.env
```

**Required `.env` fields:**

```env
PORT=3002
ROLL_NO=your_roll_number
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
REG_NAME=your_registered_name
REG_EMAIL=your_registered_email
ACCESS_CODE=your_access_code
```

> ⚠️ `.env` files are excluded by `.gitignore` and must **never** be committed.

---

## 1 · Logging Middleware

**Port:** `3001`

### What it does

Provides two exports used across all services:

#### `Log(stack, level, pkg, message)`

A reusable function that makes an **HTTP POST to the evaluation test server** on every call. Captures the full lifecycle of the application — from incoming requests and successful operations to warnings and errors.

```js
const { Log } = require('./middleware/logger');

Log('backend', 'info',  'controller', 'Fetching depots from API');
Log('backend', 'warn',  'controller', 'Invalid depotId param received');
Log('backend', 'error', 'service',    'External API unreachable');
Log('backend', 'debug', 'service',    'Token cache hit, reusing token');
```

**Valid parameter values:**

| Parameter | Valid values |
|-----------|-------------|
| `stack`   | `backend` · `frontend` |
| `level`   | `info` · `warn` · `error` · `debug` |
| `package` | `middleware` · `controller` · `service` |
| `message` | string, max **48 characters** |

The function is **non-blocking** — if the API call fails, it falls back to `console.error` so logging never crashes the application.

#### `requestLogger` (Express middleware)

Wraps `Log()` to capture every HTTP request automatically:

- `method` — GET, POST, PATCH …
- `route` — `req.originalUrl`
- `statusCode` — actual response status
- `responseTime` — milliseconds from request to `res.finish`
- `timestamp` — ISO 8601

Registered as the **first middleware** in every Express app.

### Running

```bash
cd logging_middleware
npm start
```

### Demo endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/health` | 200 health check |
| GET | `/api/echo` | Echoes request details |
| POST | `/api/echo` | Echoes request body |
| GET | `/api/slow` | Simulates 1.5 s response |
| GET | `/api/not-found` | Returns 404 |
| GET | `/api/error` | Returns 500 |

### Sample console output

```
[2026-05-14T12:40:34.620Z] GET /api/health → 200 (4ms)
[2026-05-14T12:40:35.101Z] GET /api/slow → 200 (1503ms)
[2026-05-14T12:40:36.002Z] GET /api/not-found → 404 (1ms)
[2026-05-14T12:40:36.450Z] GET /api/error → 500 (1ms)
```

---

## 2 · Vehicle Maintenance Scheduler

**Port:** `3002`

### Problem

A logistics depot has a fixed **mechanic-hour budget** each day. Many vehicle maintenance tasks are waiting, each with a `Duration` (hours) and an `Impact` score. Select the optimal subset of tasks to **maximise total impact** without exceeding the budget.

This is the classic **0/1 Knapsack problem**.

### Algorithm

Implemented in `src/services/knapsack.service.js` — **no external algorithm libraries used**.

```
Time complexity  : O(n × W)   n = tasks, W = MechanicHours budget
Space complexity : O(n × W)
```

Uses bottom-up dynamic programming with a full 2D table for backtracking to identify exactly which tasks were selected.

### Data flow

```
GET /api/scheduler/optimize/:depotId
  │
  ├─ fetchDepots()   → GET /evaluation-service/depots   (auth token)
  ├─ fetchVehicles() → GET /evaluation-service/vehicles (auth token)
  │
  └─ knapsack(depot.MechanicHours, vehicles)
       └─ returns { maxImpact, selectedTasks, totalDuration, unusedHours }
```

### Running

```bash
cd vehicle_maintence_scheduler
npm start
```

### API endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/health` | Health check |
| GET | `/api/scheduler/depots` | List all depots from external API |
| GET | `/api/scheduler/vehicles` | List all maintenance tasks |
| GET | `/api/scheduler/optimize` | Run knapsack for **all** depots |
| GET | `/api/scheduler/optimize/:depotId` | Run knapsack for one depot |

### Sample response — `GET /api/scheduler/optimize/1`

```json
{
  "success": true,
  "depot": {
    "ID": 1,
    "MechanicHours": 60
  },
  "schedule": {
    "maxImpactScore": 107,
    "totalDurationUsed": 60,
    "unusedHours": 0,
    "taskCount": 17,
    "selectedTasks": [
      { "TaskID": "264e638f-1c7a-4d67-9f9c-53f3d1766d37", "Duration": 1, "Impact": 5 },
      { "TaskID": "4b6e22ee-b4ed-45a4-a6af-5294b0d69f37", "Duration": 1, "Impact": 3 }
    ]
  }
}
```

### Sample response — `GET /api/scheduler/optimize`

```json
{
  "success": true,
  "summary": {
    "totalDepots": 5,
    "totalVehicles": 30,
    "grandTotalImpactScore": 976
  },
  "schedules": [ ... ]
}
```

---

## 3 · Notification App — Priority Inbox

**Port:** `3003`

### Problem (Stage 6)

Build a **Priority Inbox** that always shows the top `n` most important unread notifications. New notifications keep arriving — the top-n must update efficiently without re-sorting the entire list.

Priority is determined by:
1. **Type weight** — `Placement (3) > Result (2) > Event (1)`
2. **Recency** — newer notifications rank higher within the same type

### Algorithm

Implemented in `src/services/priorityQueue.service.js` — **no external libraries used**.

#### Min-Heap of size N

```
Score formula: typeWeight × 10¹³ + sentAt_timestamp_ms
```

| Why a Min-Heap? | |
|---|---|
| The heap stores the **N best** notifications | Root = least important of the top-N |
| New notification arrives → compare score with root | If better → pop root, push new |
| **O(log N)** per insertion | O(M log N) total for M notifications |
| **O(N)** space | Never stores more than N items |

A naive sort-everything approach would be O(M log M) — the Min-Heap is asymptotically superior for streaming data.

### Running

```bash
cd notification_app_be
npm start
```

### API endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/health` | Health check |
| GET | `/api/notifications` | All notifications from external API |
| GET | `/api/notifications/priority?n=10` | Top-n priority inbox via Min-Heap |
| POST | `/api/notifications/priority/insert` | Insert new notification, recalculate top-n |

### Sample response — `GET /api/notifications/priority?n=10`

```json
{
  "success": true,
  "requested": 10,
  "returned": 10,
  "algorithm": "Min-Heap (O(log n) per insertion)",
  "priorityWeights": { "Placement": 3, "Result": 2, "Event": 1 },
  "priorityInbox": [
    {
      "id": "ff80fdf2-ae39-49c2-bd9d-fdf87ad564b3",
      "type": "Placement",
      "message": "campus drive scheduled",
      "timestamp": "2026-05-13 14:00:00",
      "priorityScore": 30001747141200000
    },
    {
      "id": "abc12345-...",
      "type": "Result",
      "message": "semester results published",
      "timestamp": "2026-05-13 13:45:00",
      "priorityScore": 20001747140300000
    }
  ]
}
```

### POST `/api/notifications/priority/insert` — Simulate new arrival

```json
{
  "newNotification": {
    "Type": "Placement",
    "Message": "Google hiring event tomorrow",
    "Timestamp": "2026-05-14T18:00:00Z"
  },
  "n": 10
}
```

---

## Notification System Design

See [`notification_system_design.md`](./notification_system_design.md) for the complete 6-stage design document.

| Stage | Topic |
|-------|-------|
| **Stage 1** | REST API design — endpoints, JSON contracts, real-time (WebSocket) mechanism |
| **Stage 2** | PostgreSQL schema, DB choice rationale, scale problems and solutions |
| **Stage 3** | Slow query diagnosis, composite/partial indexes, optimised queries |
| **Stage 4** | Redis caching, push vs poll, pagination, read replica strategy |
| **Stage 5** | Reliable bulk notifications — message queue redesign, error recovery, pseudocode |
| **Stage 6** | Min-Heap priority inbox — scoring formula, algorithm analysis, O(log N) insertion |

---

## Authentication Flow

All protected external APIs require a JWT. The auth flow is automatic:

```
POST /evaluation-service/auth
  body: { name, email, rollNo, accessCode, clientID, clientSecret }
    │
    └─ returns { access_token, token_type: "Bearer", expires_in }
         │
         └─ Authorization: Bearer <access_token>
              used for: /depots  /vehicles  /notifications  /logs
```

The token is **cached in memory** and auto-refreshed 60 seconds before expiry. All credentials come from environment variables — never hardcoded.

---

## Error Handling

All three services use a global `errorHandler` middleware (registered last in the Express chain) that distinguishes between:

| Error type | Response |
|-----------|----------|
| External API error (axios `err.response`) | Proxies the upstream status + body |
| Network failure (no response received) | `503 Service Unavailable` |
| Validation error | `400 Bad Request` with descriptive message |
| Generic server error | `500 Internal Server Error` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v18+ |
| Framework | Express v4 |
| HTTP client | Axios |
| Environment | dotenv |
| Algorithms | Custom 0/1 Knapsack · Custom Min-Heap |
| External APIs | Evaluation service (JWT-protected) |

---

## Running All Services Together

Open three separate terminals:

```bash
# Terminal 1
cd logging_middleware && npm start

# Terminal 2
cd vehicle_maintence_scheduler && npm start

# Terminal 3
cd notification_app_be && npm start
```

| Service | Port | URL |
|---------|------|-----|
| Logging middleware demo | 3001 | http://localhost:3001 |
| Vehicle maintenance scheduler | 3002 | http://localhost:3002 |
| Notification priority inbox | 3003 | http://localhost:3003 |
