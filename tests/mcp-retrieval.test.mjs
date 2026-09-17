import test from 'node:test';
import assert from 'node:assert/strict';
import { Catalog } from '../server/catalog.mjs';
import { mcpLexicalFields, mcpQueryPhrases } from '../server/mcp-retrieval.mjs';

const server = (name, title, description = '') => ({ server: { name, title, description, version: '1' } });
function fixture(rows) {
  return new Catalog({ fetcher: async () => ({ text: JSON.stringify({ servers: rows, metadata: {} }), fetchedAt: '2026-09-16' }) });
}

test('MCP lexical fields separate a namespace host from its actual publisher', () => {
  assert.deepEqual(mcpLexicalFields({ product: 'io.github.alice/weather', name: 'io.github.alice/weather' }), { title: 'weather', category: 'alice weather', description: '' });
  assert.deepEqual(mcpLexicalFields({ product: 'io.github.github/github-mcp-server', name: 'GitHub' }), { title: 'GitHub', category: 'github github-mcp-server', description: '' });
  assert.equal(mcpLexicalFields({ product: 'com.figma.mcp/mcp', name: 'Figma MCP Server' }).category, 'figma.mcp mcp');
  assert.equal(mcpLexicalFields({ product: 'org.example/search', name: 'org.example/search' }).title, 'search');
});

test('MCP boilerplate is ignored only when other meaningful query words remain', () => {
  assert.deepEqual(mcpQueryPhrases(['official GitHub MCP server', 'Model Context Protocol registry']), ['github', 'registry']);
  assert.deepEqual(mcpQueryPhrases(['MCP servers', 'official model-context-protocol']), ['MCP servers', 'official model-context-protocol']);
  assert.deepEqual(mcpQueryPhrases(['language model evaluation', 'context window analysis']), ['language model evaluation', 'context window analysis']);
  assert.deepEqual(mcpQueryPhrases(['MCP server', 'registry publishing']), ['', 'registry publishing']);
});

test('GitHub-hosted namespace alone is not a product match, while the publisher remains searchable', async () => {
  const catalog = fixture([server('io.github.alice/weather', 'io.github.alice/weather', 'Weather reports'), server('io.github.github/github-mcp-server', 'GitHub', 'Manage repos and issues')]);
  try {
    const result = await catalog.search({ query: 'GitHub', source: 'mcp' });
    assert.deepEqual(result.items.map(i => i.product), ['io.github.github/github-mcp-server']);
    assert.equal((await catalog.search({ query: 'alice', source: 'mcp' })).items[0].product, 'io.github.alice/weather');
    assert.equal((await catalog.search({ query: 'weather', source: 'mcp' })).items[0].name, 'io.github.alice/weather');
  } finally { catalog.close(); }
});

test('boilerplate and hosted identifiers cannot crowd out a requested MCP product', async () => {
  const noise = Array.from({ length: 35 }, (_, i) => server(`io.github.person${i}/mcp-server-model-context-protocol-${i}`, `io.github.person${i}/mcp-server-model-context-protocol-${i}`, 'An official MCP server implementing Model Context Protocol'));
  const catalog = fixture([...noise, server('io.github.github/github-mcp-server', 'GitHub', 'Connect assistants to repositories')]);
  try {
    const result = await catalog.search({ query: "Find GitHub's MCP", queries: ['GitHub MCP server', 'official Model Context Protocol'], source: 'mcp', limit: 24 });
    assert.equal(result.items[0].product, 'io.github.github/github-mcp-server');
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].source.evidenceLevel, 'registry-metadata');
    assert.match(result.items[0].warning, /not a safety review/);
  } finally { catalog.close(); }
});

test('actual registry and generic server discovery still work without a provider allowlist', async () => {
  const catalog = fixture([server('ai.example/registry', 'MCP Registry', 'Publish and discover servers'), server('org.example/weather', 'Weather MCP Server', 'Weather reports')]);
  try {
    assert.equal((await catalog.search({ queries: ['MCP registry', 'model context protocol registry'], source: 'mcp' })).items[0].product, 'ai.example/registry');
    assert.equal((await catalog.search({ query: 'MCP server', source: 'mcp' })).items.length, 2);
  } finally { catalog.close(); }
});

test('MCP lexical matching preserves stable pagination and does not manufacture ownership', async () => {
  const catalog = fixture([server('org.beta/widget', 'Widget server'), server('org.alpha/widget', 'Widget server')]);
  try {
    const request = { query: 'Widget', source: 'mcp', limit: 1 };
    const first = await catalog.search(request); const second = await catalog.search({ ...request, offset: 1 });
    assert.equal(first.items[0].product, 'org.alpha/widget'); assert.equal(second.items[0].product, 'org.beta/widget');
    assert.equal(first.pagination.nextOffset, 1); assert.equal(second.pagination.nextOffset, null);
    assert.match(first.items[0].relevance.meaning, /not a fit score/);
    assert.equal(first.items[0].verified, undefined);
  } finally { catalog.close(); }
});
