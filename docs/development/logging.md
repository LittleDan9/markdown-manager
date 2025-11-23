# Logging Configuration

This guide covers the comprehensive logging system implemented across all services in the Markdown Manager application.

## 🎯 Logging Architecture

The application implements a multi-tier logging system designed for both development and production environments:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Logging Architecture                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   Frontend      │  │   Backend API   │  │      Microservices          │  │
│  │                 │  │                 │  │                             │  │
│  │ • LoggerProvider│  │ • Structured    │  │ • Request/Response Logging  │  │
│  │ • Log Levels    │  │ • Request IDs   │  │ • Performance Monitoring    │  │
│  │ • Service Tags  │  │ • Client IP     │  │ • Memory Tracking           │  │
│  │ • Development   │  │ • Timing        │  │ • Error Handling            │  │
│  │   Detection     │  │ • Error Stack   │  │                             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🐍 Backend Logging (Python/FastAPI)

### Enhanced Logging Middleware

The backend implements sophisticated request/response logging with structured data:

```python
# Key Features:
- Unique request IDs for distributed tracing
- Client IP extraction (proxy-aware)
- Request/response timing
- Structured logging with JSON-compatible fields
- Error handling with stack traces
- Configurable path filtering
```

### Request ID Generation

Each request gets a unique identifier for tracing across services:

```python
request_id = str(uuid.uuid4())
request.state.request_id = request_id
response.headers["X-Request-ID"] = request_id
```

### Structured Logging Format

```python
logger.info(
    "Incoming request",
    extra={
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "query_params": str(request.query_params),
        "client_ip": client_ip,
        "user_agent": user_agent,
        "content_length": request.headers.get("content-length"),
    },
)
```

### Client IP Detection

Smart client IP extraction supporting reverse proxy deployments:

```python
def _get_client_ip(self, request: Request) -> str:
    # Priority order:
    # 1. X-Forwarded-For header (from reverse proxy)
    # 2. X-Real-IP header
    # 3. Direct client IP
    # 4. "unknown" fallback
```

### Path Filtering

Configurable path filtering to reduce noise from health checks and documentation:

```python
skip_paths = [
    "/docs",
    "/openapi.json",
    "/redoc",
    "/health",
    "/_health",
]
```

### Error Logging

Comprehensive error logging with timing and context:

```python
logger.error(
    "Request failed",
    extra={
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "error_type": type(exc).__name__,
        "error_message": str(exc),
        "process_time_ms": round(process_time * 1000, 2),
    },
    exc_info=True,  # Include full stack trace
)
```

## ⚛️ Frontend Logging (React)

### LoggerProvider Context

React Context-based logging system with environment detection:

```javascript
// Automatic environment detection
const isDevelopment = (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.port === "3000" ||
  process.env.NODE_ENV === "development"
);
```

### Log Levels

Hierarchical log levels with filtering:
- **ERROR (0)**: Critical errors only
- **WARN (1)**: Warnings and errors
- **INFO (2)**: General information, warnings, and errors
- **DEBUG (3)**: All logging (development default)

### Service-Specific Loggers

Create namespaced loggers for different services:

```javascript
const editorLogger = useLogger('EditorService');
const apiLogger = useLogger('APIClient');

editorLogger.debug('Component mounted', { props });
apiLogger.info('API request started', { url, method });
```

### Console Interception

Smart console method interception with timestamp formatting:

```javascript
console.log = (...args) => this.log(LogLevel.INFO, ...args);
// Outputs: [2024-11-22T10:30:45.123Z] [INFO] Your message here
```

### Production Debugging

Override log levels in production for debugging:

```javascript
// In browser console:
localStorage.setItem('debug-log-level', '3'); // Enable debug logging
logger.setLogLevel(LogLevel.DEBUG);
```

### Logger Cleanup

Automatic cleanup to prevent memory leaks:

```javascript
useEffect(() => {
  return () => {
    globalLogger.restore(); // Restore original console methods
  };
}, []);
```

## 🟢 Node.js Services Logging

### Request/Response Middleware

Comprehensive request tracking for Express services:

```javascript
function requestLogger(req, res, next) {
  const start = Date.now();

  // Log incoming request
  console.log(`[${timestamp}] ${req.method} ${req.path} - Request received`);

  // Track response completion
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
}
```

### Performance Monitoring

Real-time performance and memory tracking:

```javascript
function performanceLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1000000;
    const memUsage = process.memoryUsage();

    console.log(`[Performance] ${req.method} ${req.path} - ${durationMs.toFixed(2)}ms, Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);

    // Memory usage alerts
    if (memUsage.heapUsed > 500 * 1024 * 1024) {
      console.warn(`High memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }
  });
}
```

### Enhanced Development Logging

Configurable enhanced logging for development:

```javascript
function enhancedLogger(options = {}) {
  const { logBody = false, logHeaders = false, maxBodyLength = 1000 } = options;

  return (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      // Log query parameters, headers, body based on configuration
    }
    next();
  };
}
```

### Slow Request Detection

Automatic detection and logging of slow requests:

```javascript
if (duration > 5000) {  // 5 seconds
  console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
}
```

## 📊 Log Levels and Environment Detection

### Development Environment
- **Frontend**: DEBUG level (all logging)
- **Backend**: DEBUG level with detailed request info
- **Services**: Enhanced logging with body/header details
- **Database**: Query logging enabled

### Production Environment
- **Frontend**: WARN level (errors and warnings only)
- **Backend**: INFO level with structured logging
- **Services**: Performance monitoring only
- **Database**: Error logging only

## 🔧 Configuration

### Backend Logging Configuration

```python
# In logging middleware initialization
LoggingMiddleware(
    app,
    skip_paths=["/health", "/docs", "/openapi.json"]
)
```

### Frontend Logging Configuration

```javascript
// Environment-based configuration
const logger = new Logger();
logger.setLogLevel(isDevelopment ? LogLevel.DEBUG : LogLevel.WARN);

// Service-specific configuration
const serviceLogger = logger.createServiceLogger('EditorService');
```

### Node.js Services Configuration

```javascript
// Environment-based middleware setup
if (process.env.NODE_ENV === 'development') {
  app.use(enhancedLogger({ logBody: true, logHeaders: true }));
}
app.use(requestLogger);
app.use(performanceLogger);
```

## 🚨 Error Handling and Alerting

### Backend Error Handling

```python
# Automatic error logging with context
try:
    response = await call_next(request)
except Exception as exc:
    logger.error(
        "Request failed",
        extra={
            "request_id": request_id,
            "error_type": type(exc).__name__,
            "error_message": str(exc),
        },
        exc_info=True
    )
    raise
```

### Frontend Error Boundaries

```javascript
// Service-specific error logging
try {
  await apiCall();
} catch (error) {
  logger.error('API call failed', {
    service: 'EditorService',
    error: error.message,
    stack: error.stack
  });
}
```

### Service Health Monitoring

```javascript
// Automatic health check logging
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  };

  console.log('[Health Check]', health);
  res.json(health);
});
```

## 📈 Monitoring and Debugging

### Request Tracing

Follow requests across services using request IDs:

```bash
# Search logs for specific request
grep "550e8400-e29b-41d4-a716-446655440000" *.log

# Follow request through all services
docker compose logs | grep "550e8400-e29b-41d4-a716-446655440000"
```

### Performance Analysis

```bash
# Find slow requests
grep "Slow request" logs/*.log

# Memory usage analysis
grep "Memory:" logs/*.log | awk '{print $NF}' | sort -n
```

### Error Analysis

```bash
# Error frequency by service
grep "ERROR" logs/*.log | cut -d: -f1 | sort | uniq -c

# Error patterns
grep "Request failed" logs/backend.log | jq '.error_type' | sort | uniq -c
```

## 🛠️ Development Tools

### Log Viewing

```bash
# Real-time log following
docker compose logs -f

# Service-specific logs
docker compose logs -f backend | jq '.'

# Filter by log level
docker compose logs backend | grep "ERROR"
```

### Log Analysis

```bash
# Request timing analysis
grep "process_time_ms" logs/backend.log | jq '.process_time_ms' | sort -n

# Client IP analysis
grep "client_ip" logs/backend.log | jq '.client_ip' | sort | uniq -c
```

### Production Log Management

```bash
# Log rotation (for production)
logrotate /etc/logrotate.d/markdown-manager

# Log aggregation (example with ELK stack)
filebeat -e -c /etc/filebeat/filebeat.yml
```

This logging system provides comprehensive observability across all services while maintaining performance and providing the right level of detail for both development and production environments.