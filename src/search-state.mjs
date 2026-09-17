export function mergeOptions(previous, next) {
  const merged = [...new Map([...previous, ...next].map(item => [item.id, item])).values()];
  if (merged.some(item => item.rankingOrder === 'relevance-first-v3')) return merged;
  return merged.sort((a, b) => Number(b.match?.tier === 'close') - Number(a.match?.tier === 'close') || (b.signals?.strength || 0) - (a.signals?.strength || 0));
}
export function shortlistKey(query, items) { return JSON.stringify([query, items.map(item => item.id)]); }
export function documentationSelection(item) {
  return { kind: item.kind || 'unknown', name: item.name, product: item.product, version: item.version,
    specificationUrl: item.specificationUrl, documentationUrl: item.documentationUrl, repositoryUrl: item.repositoryUrl, remoteEndpoints: item.remoteEndpoints };
}
export function hasDocumentation(item) { return Boolean(item.specificationUrl || item.documentationUrl || item.repositoryUrl || item.remoteEndpoints?.length); }
export function explanationKey(query, item) { return JSON.stringify(['goal-explanation-v2', query, documentationSelection(item)]); }
