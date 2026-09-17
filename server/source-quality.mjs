import { assertNoSecrets } from './ai-client.mjs';

// A conservative, free input gate, NOT a capability/identity verification or a
// language-complete classifier. Ambiguous prose stays unverified, never absent.
export function sourceQuality(analysis) {
  const evidence = analysis.evidence.filter(item => {
    try { assertNoSecrets(item.excerpt); return true; } catch { return false; }
  });
  if (!evidence.length) return { usable: false, reason: 'no-safe-evidence' };
  if (['openapi', 'swagger', 'mcp-tools'].includes(analysis.format)) return { usable: analysis.capabilities.length > 0, reason: 'structured-capabilities' };
  const body = evidence.map(item => item.excerpt).join(' ');
  const software = /\b(?:api|mcp|model context protocol|endpoints?|sdk|graphql|webhooks?)\b/i.test(body);
  const actions = /\b(?:search(?:es|ing)?|find(?:s|ing)?|retriev\w*|return(?:s|ed)?|creat\w*|read(?:s|ing)?|list(?:s|ing)?|send\w*|updat\w*|delet\w*|fetch\w*|query|queries|generat\w*|convert\w*|extract\w*|transcri\w*|upload\w*|download\w*)\b/i.test(body);
  const documentation = /\b(?:tools?|parameters?|arguments?|responses?|requests?|methods?|endpoints?|usage|reference|capabilities|input|output)\b|\b(?:GET|POST|PUT|PATCH|DELETE)\s+\//i.test(body);
  return { usable: software && actions && documentation, reason: 'prose-documentation-signals' };
}

export function unavailableExplanation() {
  return { sourceFit: 'unclear', capabilities: [], checks: [], withheldStatements: 0, omittedForBrevity: 0, generation: 'skipped-no-usable-evidence' };
}
