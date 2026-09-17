import { terms } from './text.mjs';

// These identify the protocol, not the job a server performs. Preserve them
// when a user deliberately makes a generic-only search. "Registry" is NOT a
// stop word: discovering/publishing MCP servers is itself a legitimate job.
const boilerplate = new Set(['mcp', 'server', 'servers', 'official']);
export function mcpQueryPhrases(phrases) {
  const cleaned = phrases.map(phrase => terms(phrase.replace(/\bmodel[\s-]+context[\s-]+protocol\b/gi, ' ')).filter(word => !boilerplate.has(word)).join(' '));
  return cleaned.some(Boolean) ? cleaned : phrases;
}

export function mcpLexicalFields(item) {
  const [namespace = '', ...parts] = String(item.product || '').split('/');
  const slug = parts.join(' ');
  // io.github identifies a namespace host. It is not evidence that every
  // hosted package belongs to GitHub. Keep the actual publisher after it.
  const publisher = /^io\.github\./i.test(namespace) ? namespace.replace(/^io\.github\./i, '') : namespace.replace(/^[^.]+\./, '');
  const name = item.name === item.product ? slug : item.name;
  return { title: name || slug, category: `${publisher} ${slug}`, description: item.description || '' };
}

export function mcpQueryWeights(entries, phrases, expanded) {
  const counts = new Map(phrases.flatMap(phrase => terms(phrase)).map(word => [word, 0]));
  if (expanded) for (const entry of entries) {
    const fields = mcpLexicalFields(entry);
    const vocabulary = new Set(terms(`${fields.title} ${fields.category} ${fields.description}`, { limit: 1000, maxChars: 4000 }));
    for (const word of counts.keys()) if (vocabulary.has(word)) counts.set(word, counts.get(word) + 1);
  }
  return new Map([...counts].map(([word, count]) => [word, expanded ? 1 + Math.log((entries.length + 1) / (count + 1)) : 1]));
}
