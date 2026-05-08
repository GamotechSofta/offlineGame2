import { monitorEventLoopDelay } from 'perf_hooks';

const MB = 1024 * 1024;
let runtimeMonitorInterval = null;
let requestSamplerInterval = null;
let eventLoopMonitor = null;
let activeRequests = 0;
let completedRequests = 0;
let requestsInWindow = 0;
let latestHealthSnapshot = null;
let latestRpmSnapshot = null;

export function createRuntimeRequestTracker() {
  return (req, res, next) => {
    activeRequests += 1;
    requestsInWindow += 1;
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      activeRequests = Math.max(0, activeRequests - 1);
      completedRequests += 1;
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      if (elapsedMs >= 2000) {
        console.warn('[runtime][slow-request]', {
          method: req.method,
          path: req.originalUrl || req.url,
          statusCode: res.statusCode,
          durationMs: Math.round(elapsedMs * 100) / 100,
          activeRequests,
        });
      }
    });

    next();
  };
}

export function startRuntimeMonitoring() {
  if (runtimeMonitorInterval || requestSamplerInterval) return;

  eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
  eventLoopMonitor.enable();

  runtimeMonitorInterval = setInterval(() => {
    const mem = process.memoryUsage();
    const eventLoopLagMs = eventLoopMonitor ? Number(eventLoopMonitor.mean) / 1e6 : 0;
    latestHealthSnapshot = {
      rssMb: Math.round((mem.rss / MB) * 100) / 100,
      heapUsedMb: Math.round((mem.heapUsed / MB) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / MB) * 100) / 100,
      externalMb: Math.round((mem.external / MB) * 100) / 100,
      eventLoopLagMs: Math.round(eventLoopLagMs * 100) / 100,
      activeRequests,
      completedRequests,
      sampledAt: new Date().toISOString(),
    };
    console.log('[runtime][health]', latestHealthSnapshot);
    if (eventLoopMonitor) eventLoopMonitor.reset();
  }, 60_000);

  requestSamplerInterval = setInterval(() => {
    latestRpmSnapshot = {
      requestsPerMinute: requestsInWindow,
      activeRequests,
      sampledAt: new Date().toISOString(),
    };
    console.log('[runtime][rpm]', latestRpmSnapshot);
    requestsInWindow = 0;
  }, 60_000);
}

export function stopRuntimeMonitoring() {
  if (runtimeMonitorInterval) {
    clearInterval(runtimeMonitorInterval);
    runtimeMonitorInterval = null;
  }
  if (requestSamplerInterval) {
    clearInterval(requestSamplerInterval);
    requestSamplerInterval = null;
  }
  if (eventLoopMonitor) {
    eventLoopMonitor.disable();
    eventLoopMonitor = null;
  }
}

export function getRuntimeMetrics() {
  return {
    activeRequests,
    completedRequests,
    requestsInCurrentWindow: requestsInWindow,
    health: latestHealthSnapshot,
    rpm: latestRpmSnapshot,
  };
}

