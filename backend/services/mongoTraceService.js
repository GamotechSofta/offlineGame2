import mongoose from 'mongoose';
import { isTraceEnabled, noteMongoTrace } from './traceMetricsService.js';

let mongoTraceInstalled = false;

function safeFilterShape(filter) {
  try {
    if (!filter || typeof filter !== 'object') return null;
    const keys = Object.keys(filter).slice(0, 10);
    return keys.reduce((acc, key) => {
      const value = filter[key];
      acc[key] = value && typeof value === 'object' ? Object.keys(value).slice(0, 5) : typeof value;
      return acc;
    }, {});
  } catch {
    return null;
  }
}

export function installMongoTracing() {
  if (mongoTraceInstalled || !isTraceEnabled()) return;
  mongoTraceInstalled = true;

  const originalExec = mongoose.Query.prototype.exec;
  mongoose.Query.prototype.exec = async function execWithTracing(...args) {
    const startedAt = process.hrtime.bigint();
    try {
      return await originalExec.apply(this, args);
    } finally {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      noteMongoTrace({
        model: this.model?.modelName || 'UnknownModel',
        op: this.op || 'query',
        collection: this.mongooseCollection?.name || '',
        durationMs: elapsedMs,
        filterShape: safeFilterShape(this.getQuery?.()),
      });
    }
  };

  const originalAggExec = mongoose.Aggregate.prototype.exec;
  mongoose.Aggregate.prototype.exec = async function aggExecWithTracing(...args) {
    const startedAt = process.hrtime.bigint();
    try {
      return await originalAggExec.apply(this, args);
    } finally {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      noteMongoTrace({
        model: this._model?.modelName || 'Aggregate',
        op: 'aggregate',
        collection: this._model?.collection?.name || '',
        durationMs: elapsedMs,
        filterShape: { pipelineStages: Array.isArray(this._pipeline) ? this._pipeline.length : 0 },
      });
    }
  };

  // eslint-disable-next-line no-console
  console.log('[trace] Mongo tracing enabled');
}
