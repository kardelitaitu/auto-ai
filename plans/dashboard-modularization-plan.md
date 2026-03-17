# Dashboard Server Modularization Plan

## Overview
Split the monolithic `dashboard.js` (1035 lines) into focused, maintainable modules.

## Target Structure

```
api/ui/electron-dashboard/
├── server/
│   ├── index.js              # Main DashboardServer class (orchestrator)
│   ├── routes/
│   │   ├── health.js         # GET /health
│   │   ├── status.js         # GET /api/status, /api/sessions, /api/queue, /api/metrics
│   │   ├── tasks.js          # GET /api/tasks/recent, /api/tasks/breakdown
│   │   ├── dashboard.js      # GET /api/dashboard/data (protected)
│   │   └── export.js         # GET /api/export/json, /api/export/csv (protected)
│   ├── socket/
│   │   ├── handlers.js       # Socket event handlers (connection, disconnect, events)
│   │   ├── broadcast.js      # Broadcast management (start, stop, resume, collectMetrics)
│   │   └── validation.js     # Payload validation functions
│   ├── middleware/
│   │   ├── rateLimit.js      # Rate limiting middleware
│   │   ├── cors.js           # CORS configuration
│   │   └── auth.js           # Authentication middleware
│   └── utils/
│       ├── metrics.js        # System metrics collection
│       ├── sanitization.js   # Data sanitization functions
│       └── hashing.js        # Quick hash for change detection
├── lib/
│   ├── history-manager.js    # (existing)
│   └── logger.js             # (existing)
└── dashboard.js              # (deprecated - re-exports from server/)
```

## Implementation Steps

### Step 1: Create Utility Modules
1. Create `server/utils/hashing.js` - Extract `quickHash()`
2. Create `server/utils/sanitization.js` - Extract `sanitizeLogString()`, `sanitizeObject()`
3. Create `server/utils/metrics.js` - Extract `getSystemMetrics()`, `calculateCpuUsage()`

### Step 2: Create Validation Module
1. Create `server/socket/validation.js` - Extract `validateTask()`, `validateSession()`, `validateMetrics()`, `validatePayload()`

### Step 3: Create Middleware Modules
1. Create `server/middleware/auth.js` - Extract `isAuthenticated()`, `withAuth()`, `requireAuth()`
2. Create `server/middleware/rateLimit.js` - Extract rate limiting logic
3. Create `server/middleware/cors.js` - CORS configuration

### Step 4: Create Route Modules
1. Create `server/routes/health.js` - Health endpoint
2. Create `server/routes/status.js` - Status and metrics endpoints
3. Create `server/routes/tasks.js` - Task-related endpoints
4. Create `server/routes/dashboard.js` - Protected dashboard data endpoint
5. Create `server/routes/export.js` - Export endpoints

### Step 5: Create Socket Modules
1. Create `server/socket/handlers.js` - Socket event handlers
2. Create `server/socket/broadcast.js` - Broadcast management

### Step 6: Create Main Server Class
1. Create `server/index.js` - Main DashboardServer class that orchestrates all modules

### Step 7: Update Entry Points
1. Update `dashboard.js` to re-export from `server/index.js` (backward compatibility)
2. Update `start-server.js` to use new structure
3. Update `main.js` imports if needed

### Step 8: Update Tests
1. Update test imports to use new module paths
2. Ensure all 103 tests still pass

## Module Dependencies

```
server/index.js
├── server/routes/*
├── server/socket/*
├── server/middleware/*
├── server/utils/*
├── lib/history-manager.js
└── lib/logger.js
```

## Backward Compatibility
- Keep `dashboard.js` as a re-export file for existing imports
- Maintain all exported functions at their original paths
- Update internal imports only

## Testing Strategy
- Run tests after each module extraction
- Verify no functionality is broken
- Add new tests for module boundaries if needed

## Estimated Effort
- **Total**: 4-6 hours
- **Risk**: Low (comprehensive test coverage)
