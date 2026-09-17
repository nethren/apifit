import { fail } from './errors.mjs';

const fold = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const invalid = () => fail('AI_INVALID_RESULT', 'The search intent could not be checked against your request.', 502);
export function validateSearchPlan(value, query) {
  if (!exact(value, ['queries', 'constraints']) || !Array.isArray(value.queries) || value.queries.length > 3 || value.queries.some(q => typeof q !== 'string' || !q.trim() || q.length > 150) || !Array.isArray(value.constraints) || value.constraints.length > 5) invalid();
  for (const c of value.constraints) {
    if (!exact(c, ['name', 'scope', 'mode']) || !['publisher', 'product'].includes(c.scope) || !['include', 'exclude'].includes(c.mode)
      || typeof c.name !== 'string' || c.name.length > 80 || fold(c.name).length < 2 || !query.includes(c.name)) invalid();
  }
  // The server supplies the original wording. Do not depend on a model copying
  // punctuation/quotes correctly in a second redundant text field.
  return { queries: [...new Set(value.queries.map(q => q.trim()))], constraints: value.constraints.map(c => ({ ...c, quote: query })) };
}
export function requestNameChoices(query) {
  const words = [...String(query).matchAll(/[\p{L}\p{N}][\p{L}\p{N}._-]*/gu)];
  for (const word of words) word[0] = word[0].replace(/[._-]+$/, '');
  const choices = new Set();
  for (let length = 1; length <= 4; length++) for (let i = 0; i + length <= words.length; i++) {
    const value = query.slice(words[i].index, words[i + length - 1].index + words[i + length - 1][0].length);
    if (value.length <= 80 && fold(value).length >= 2) choices.add(value);
  }
  // Generic labels are not asserted to be brands. The model still chooses only
  // proper identities; this enum merely makes ungrounded names impossible.
  return [...choices];
}
// Identity aliases, not a provider allowlist. Everything else uses whole domain,
// namespace, product or title tokens. Description mentions never confer identity.
const aliases = { google: ['google', 'googleapis'], amazon: ['amazon', 'amazonaws', 'aws'], aws: ['amazon', 'amazonaws', 'aws'], newyorktimes: ['newyorktimes', 'nytimes'], postmark: ['postmark', 'postmarkapp'] };
function identityTokens(item, scope) {
  const values = [];
  if (scope === 'product') {
    values.push(item.name, item.product?.split(/[/:]/).at(-1));
    // Whole contiguous title phrases allow "Google Sheets", but not "GitHub"
    // merely appearing in a third-party description. Publisher constraints
    // remain separate for "own/official" requests.
    const words = String(item.name || '').split(/[^a-zA-Z0-9]+/).filter(Boolean);
    for (let i = 0; i < words.length; i++) for (let n = 1; n <= 4 && i + n <= words.length; n++) values.push(words.slice(i, i + n).join(' '));
    const publisherTokens = identityTokens(item, 'publisher');
    const brands = [...publisherTokens, ...Object.entries(aliases).filter(([, tokens]) => tokens.some(t => publisherTokens.includes(t))).map(([brand]) => brand)];
    const productTokens = [...values];
    for (const brand of brands) for (const product of productTokens) values.push(`${brand} ${product}`);
  }
  else {
    const provider = (item.provider || '').replace(/^io\.github\./, '').replace(/^com\./, '');
    values.push(provider, ...provider.split('.'));
    if (item.kind === 'api') values.push(item.product?.split(':')[0], ...String(item.product?.split(':')[0] || '').split('.'));
    // The registry namespace is the publisher identity, not a linked repo owner
    // that any third party could put in its listing.
  }
  return values.filter(Boolean).flatMap(v => [fold(v), ...v.split(/[^a-zA-Z0-9]+/).map(fold)]).filter(Boolean);
}
export function matchesIdentity(item, constraint) {
  const name = fold(constraint.name); const targets = aliases[name] || [name];
  // APIs.guru lists this product brand under its parent publisher. Constrain
  // BOTH the parent namespace and product, never every API of that parent.
  if (constraint.scope === 'publisher' && name === 'youtube' && item.kind === 'api') return item.provider === 'googleapis.com' && item.product === 'googleapis.com:youtube';
  const tokens = identityTokens(item, constraint.scope);
  return targets.some(target => tokens.includes(target));
}
export function filterIntent(items, constraints = []) {
  return items.filter(item => constraints.every(c => c.mode === 'exclude' ? !matchesIdentity(item, c) : matchesIdentity(item, c)));
}
