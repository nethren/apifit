import { parentPort, workerData } from 'node:worker_threads';
import { parseSource } from './parser.mjs';
import { publicError } from './errors.mjs';

try { parentPort.postMessage({ value: parseSource(workerData.source, workerData.options) }); }
catch (error) { parentPort.postMessage({ error: publicError(error) }); }
