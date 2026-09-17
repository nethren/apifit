import { fetchMcpMetadata, publicUrl } from './safe-fetch.mjs';
import { fail } from './errors.mjs';
import { hash, plain, relatedTerms } from './text.mjs';

// A metadata reader, not an MCP execution client. No sampling, roots,
// elicitation, prompts, resources, tools/call, credentials or subprocesses.
export async function inspectMcp(endpoint, query = '', { fetcher = fetchMcpMetadata, signal: external } = {}) {
  const url = publicUrl(endpoint.url).href;
  if (endpoint.type !== 'streamable-http') fail('MCP_TRANSPORT', 'This connection needs a setup APIFit does not run. Public documentation can still be used.', 422);
  const signal = external ? AbortSignal.any([external, AbortSignal.timeout(16000)]) : AbortSignal.timeout(16000);
  let sessionId; let protocolVersion; let id = 0;
  const send = async (method, params) => {
    signal.throwIfAborted();
    const rpc = { jsonrpc: '2.0', ...(method !== 'notifications/initialized' ? { id: ++id } : {}), method, ...(params ? { params } : {}) };
    const response = await fetcher(url, { rpc, ...(sessionId ? { sessionId } : {}), ...(protocolVersion ? { protocolVersion } : {}) }, { signal });
    signal.throwIfAborted();
    if (rpc.id === undefined) return;
    let message;
    try { message = JSON.parse(response.text); } catch { fail('MCP_FORMAT', 'This connection did not return readable capability descriptions.', 422); }
    if (message.jsonrpc !== '2.0' || message.id !== rpc.id || message.method || !message.result || message.error) fail('MCP_FORMAT', 'This connection did not return readable capability descriptions.', 422);
    if (method === 'initialize') {
      sessionId = response.sessionId;
      if (sessionId !== undefined && (typeof sessionId !== 'string' || !/^[\x21-\x7e]{1,1024}$/.test(sessionId))) fail('MCP_FORMAT', 'Invalid MCP session response.', 422);
    }
    return message.result;
  };
  const initialized = await send('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'APIFit', version: '0.2.0' } });
  protocolVersion = initialized.protocolVersion;
  if (!['2025-11-25', '2025-06-18', '2025-03-26'].includes(protocolVersion)) fail('MCP_VERSION', 'This MCP connection version is not supported.', 422);
  if (!initialized.capabilities?.tools) fail('MCP_NO_TOOLS', 'This connection did not advertise tools APIFit can describe.', 422);
  await send('notifications/initialized');
  const tools = []; const cursors = new Set(); let cursor; let incomplete = false;
  for (let page = 0; page < 3; page++) {
    const result = await send('tools/list', cursor ? { cursor } : {});
    if (!Array.isArray(result.tools) || result.tools.length > 1000) fail('MCP_FORMAT', 'The capability list could not be read safely.', 422);
    tools.push(...result.tools.slice(0, 200 - tools.length));
    incomplete = Boolean(result.nextCursor) || result.tools.length > 200;
    if (!result.nextCursor || tools.length >= 200) break;
    if (typeof result.nextCursor !== 'string' || !result.nextCursor || result.nextCursor.length > 2048 || cursors.has(result.nextCursor)) fail('MCP_FORMAT', 'The capability list returned an invalid next page.', 422);
    cursor = result.nextCursor; cursors.add(cursor);
  }
  const usable = tools.filter(tool => typeof tool?.name === 'string' && tool.name.length <= 200 && typeof tool.description === 'string' && tool.description.trim() && tool.description.length <= 12000 && tool.inputSchema?.type === 'object');
  if (!usable.length) fail('MCP_NO_DESCRIPTIONS', 'This connection did not provide usable tool descriptions.', 422);
  const fields = schema => Object.entries(schema?.properties || {}).slice(0, 20).map(([name, field]) => ({ name: plain(name, 100), type: plain(field?.type, 60), description: plain(field?.description, 350) }));
  const descriptions = usable.map(tool => ({ name: tool.name, description: tool.description, inputs: fields(tool.inputSchema), outputs: fields(tool.outputSchema) }));
  const revision = hash(JSON.stringify(descriptions));
  const source = { url, fetchedAt: new Date().toISOString(), contentHash: revision, evidenceLevel: 'server-declared-tool-metadata', providerOwnershipVerified: false };
  const selected = descriptions.sort((a, b) => relatedTerms(query, JSON.stringify(b)).length - relatedTerms(query, JSON.stringify(a)).length).slice(0, 40);
  const evidence = selected.flatMap(tool => {
    const description = JSON.stringify(tool).slice(0, 15000);
    return Array.from({ length: Math.ceil(description.length / 1400) }, (_, index) => ({ id: `ev_${hash(`${revision}:${tool.name}:${index}`).slice(0, 20)}`, location: `tools/list:${tool.name}:${index}`, excerpt: plain(description.slice(index * 1400, index * 1400 + 1400), 1500), source }));
  });
  return { kind: 'analysis', format: 'mcp-tools', title: plain(initialized.serverInfo?.title || initialized.serverInfo?.name, 200) || 'MCP server', revision, source, evidence,
    capabilities: selected.map(tool => ({ title: plain(tool.name, 200), description: plain(tool.description), executable: false })), liveTested: false, accountAccess: 'not-checked',
    coverage: { status: incomplete || selected.length < tools.length ? 'partial' : 'tool-descriptions-read', returnedTools: selected.length, loadedTools: tools.length, truncated: incomplete },
    unknowns: ['Tool descriptions are server claims, not observed behavior. No tool has been called. Provider identity, account access and data quality remain unverified.'] };
}
