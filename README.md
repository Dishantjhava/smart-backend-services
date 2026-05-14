# 12315542

Backend microservices built with Node.js and Express.

---

## Repository Structure

```
12315542/
├── .gitignore
├── notification_system_design.md     ← System design (Stages 1–6)
├── logging_middleware/               ← Reusable Express logging middleware
├── vehicle_maintence_scheduler/      ← Maintenance task optimiser (0/1 Knapsack)
└── notification_app_be/              ← Notification priority inbox (Min-Heap)
```

---

## Prerequisites

- Node.js v18+
- npm v9+

---

## Setup

Each service has its own `package.json`. Set up all three:

```bash
# Logging middleware
cd logging_middleware && npm install

# Vehicle maintenance scheduler
cd ../vehicle_maintence_scheduler && npm install

# Notification backend
cd ../notification_app_be && npm install
```

---

## Environment Variables

The vehicle scheduler and notification app call **protected external APIs** using credentials. Copy `.env.example` to `.env` in each service folder and fill in your values:

```bash
cp vehicle_maintence_scheduler/.env.example vehicle_maintence_scheduler/.env
cp notification_app_be/.env.example notification_app_be/.env
```

**.env format:**
```
ROLL_NO=your_roll_number
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
PORT=3002
```

> ⚠️ Never commit `.env` files. They are excluded by `.gitignore`.

---

## Running the Services

### 1. Logging Middleware Demo (port 3001)

```bash
cd logging_middleware
npm start
```

**Endpoints:**
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/echo` | Echo request details |
| POST | `/api/echo` | Echo request body |
| GET | `/api/slow` | Simulates a 1.5s slow response |
| GET | `/api/not-found` | Returns 404 |
| GET | `/api/error` | Returns 500 |

**Sample log output:**
```
[2024-05-14T10:00:00.000Z] GET /api/health → 200 (3ms)
[2024-05-14T10:00:05.000Z] GET /api/slow → 200 (1503ms)
[2024-05-14T10:00:10.000Z] GET /api/not-found → 404 (1ms)
```

---

### 2. Vehicle Maintenance Scheduler (port 3002)

```bash
cd vehicle_maintence_scheduler
npm start
```

**Algorithm:** 0/1 Knapsack — selects the subset of maintenance tasks (vehicles) that maximises total operational impact score within the depot's mechanic-hour budget.

**Endpoints:**
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/scheduler/depots` | List all depots from external API |
| GET | `/api/scheduler/vehicles` | List all maintenance tasks from external API |
| GET | `/api/scheduler/optimize` | Run knapsack for **all** depots |
| GET | `/api/scheduler/optimize/:depotId` | Run knapsack for one specific depot |

**Sample response — `/api/scheduler/optimize/1`:**
```json
{
  "success": true,
  "depot": { "ID": 1, "MechanicHours": 60 },
  "schedule": {
    "maxImpactScore": 24,
    "totalDurationUsed": 58,
    "unusedHours": 2,
    "taskCount": 12,
    "selectedTasks": [
      { "TaskID": "264e638f-...", "Duration": 1, "Impact": 5 }
    ]
  }
}
```

---

### 3. Notification App — Priority Inbox (port 3003)

```bash
cd notification_app_be
npm start
```

**Algorithm:** Min-Heap of size N — efficiently tracks the top-n highest-priority notifications in O(log N) per insertion.

**Priority:** `Placement (3) > Result (2) > Event (1)`, with recency as tie-breaker.

**Endpoints:**
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/notifications` | All notifications from external API |
| GET | `/api/notifications/priority?n=10` | Top-n priority inbox via Min-Heap |
| POST | `/api/notifications/priority/insert` | Insert a new notification and recalculate |

**Sample response — `/api/notifications/priority?n=10`:**
```json
{
  "success": true,
  "requested": 10,
  "returned": 10,
  "algorithm": "Min-Heap (O(log n) per insertion)",
  "priorityWeights": { "Placement": 3, "Result": 2, "Event": 1 },
  "priorityInbox": [
    {
      "id": "abc123",
      "title": "Campus Placement Drive",
      "type": "Placement",
      "sentAt": "2024-05-14T09:00:00Z",
      "priorityScore": 30001715680800000
    }
  ]
}
```

---

## Logging Middleware

All three services use the same reusable logging middleware. It logs every request **before** any route handler runs:

```
[timestamp]  method  route  →  statusCode  (responseTimeMs)
```

The middleware is registered as the **first** middleware in every Express app — ensuring every request, including failed ones, is captured.

---

## System Design

See [`notification_system_design.md`](./notification_system_design.md) for the full 6-stage system design covering:

- Stage 1: REST API contracts and real-time mechanism
- Stage 2: PostgreSQL schema and scale analysis
- Stage 3: Query optimisation and indexing strategy
- Stage 4: Caching and performance strategies
- Stage 5: Reliable bulk notification redesign
- Stage 6: Priority inbox algorithm and implementation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v18+ |
| Framework | Express v4 |
| HTTP client | Axios |
| Environment | dotenv |
| Algorithm | Custom 0/1 Knapsack, Custom Min-Heap |
