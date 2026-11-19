import { createVercelApp } from '../server/vercel-runtime.mjs';

let application;
export default async function handler(req, res) {
  try {
    application ||= createVercelApp().catch(error => { application = null; throw error; });
    return (await application)(req, res);
  } catch {
    // Never expose environment values, connection URLs or runtime diagnostics.
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'HOST_NOT_READY', message: 'APIFit is being configured. Please try again shortly.' } }));
  }
}
