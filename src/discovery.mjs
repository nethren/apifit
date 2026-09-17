// Pure helpers keep pagination and shortlist criteria independent of paid drafting.
export function discoveryRequest(project, source) {
  return { query: project.text, queries: project.queries.map(q => q?.trim()).filter(Boolean), source, offset: 0, mcpPages: 3 };
}
export function comparisonCriteria(project) {
  return { requirements: project.requirements.map(({ id, text, priority, sourceQuote }) => ({ id, text, priority, ...(sourceQuote ? { sourceQuote } : {}) })), confirmed: project.confirmed, assessment: null };
}
