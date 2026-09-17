import { markdownText } from './plain-text.mjs';

// The same reviewed, deterministic export is used for server records and the
// already-generated brief held in a browser tab. Export never calls AI.
export function exportHandoff(brief) {
  const lines = ['# APIFit build brief', '', '## Project', '', markdownText(brief.query), '', '## Selected integrations', ''];
  for (const item of brief.integrations) {
    lines.push(`### ${markdownText(item.title)}`, '', item.integrationKind === 'mcp' ? 'MCP server' : item.integrationKind === 'api' ? 'API' : 'Integration', '');
    for (const capability of item.capabilities) lines.push(`#### ${markdownText(capability.title)}`, '', markdownText(capability.does), '', `How you could use it: ${markdownText(capability.helps)}`, '');
    if (!item.capabilities.length) lines.push('These excerpts do not establish a useful software capability for this project. This is a source limitation, not proof the integration lacks the feature.', '');
    if (item.checks.length) lines.push('Before you rely on it:', '', ...item.checks.map(check => `- ${markdownText(check)}`), '');
    if (item.documentationNote) lines.push(markdownText(item.documentationNote), '');
    lines.push(`Source: ${markdownText(item.source.url)}`, `${item.sourceFit === 'unclear' ? 'Capabilities not established; source checked' : item.source.evidenceLevel === 'server-declared-tool-metadata' ? 'Server tool descriptions read (not executed)' : 'Documentation read'}: ${markdownText(item.source.fetchedAt)}. Evidence: ${item.coverage.selected}/${item.coverage.total} excerpts.`, '', '<details><summary>Source evidence</summary>', '');
    for (const capability of item.capabilities) for (const citation of capability.citations) lines.push(`> ${markdownText(citation.quote)}`, '');
    lines.push('</details>', '');
  }
  if (brief.unreadable?.length) lines.push('## Documentation unavailable', '', ...brief.unreadable.map(item => `- ${markdownText(item.name || item.url)}: ${markdownText(item.message)}`), '');
  lines.push('## Suggested build steps', '', ...brief.nextSteps.map((step, i) => `${i + 1}. ${markdownText(step)}`), '', 'AI-assisted handover, not a verified implementation. Check current docs, permissions, pricing and reliability before building. No API/MCP operation was executed.');
  return lines.join('\n');
}
