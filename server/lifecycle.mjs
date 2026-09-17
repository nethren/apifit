// Narrow, source-backed exclusions. Absence here does NOT mean a product is active.
const bingRetired = new Set(['AutoSuggest', 'CustomImageSearch', 'CustomSearch', 'EntitySearch', 'ImageSearch', 'LocalSearch', 'NewsSearch', 'VideoSearch', 'VisualSearch', 'WebSearch'].map(name => `microsoft.com:cognitiveservices-${name}`));
export function knownRetirement(product, now = Date.now()) {
  if (now < Date.parse('2025-08-12T00:00:00Z') || !bingRetired.has(product)) return null;
  return { status: 'retired', retiredOn: '2025-08-11', checkedOn: '2026-09-14', sourceUrl: 'https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement' };
}
