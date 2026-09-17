import { Worker } from 'node:worker_threads';
import { AppError } from './errors.mjs';

export function parseInWorker(source, options = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./parse-worker.mjs', import.meta.url), { workerData: { source, options }, resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 } });
    const timer = setTimeout(() => finish(new AppError('PARSE_TIMEOUT', 'The document exceeded the parsing time limit.', 422)), 5000);
    let done = false;
    function finish(error, value) {
      if (done) return; done = true; clearTimeout(timer); void worker.terminate();
      if (error) reject(error); else resolve(value);
    }
    worker.once('message', result => result.error ? finish(new AppError(result.error.code, result.error.message, result.error.status)) : finish(null, result.value));
    worker.once('error', () => finish(new AppError('PARSE_FAILED', 'The document could not be parsed within the safety limits.', 422)));
    worker.once('exit', () => { if (!done) finish(new AppError('PARSE_FAILED', 'Document parsing stopped before completion.', 422)); });
  });
}
