import { createHash } from 'node:crypto';
import { plain } from '../shared/plain-text.mjs';
export { plain, markdownText } from '../shared/plain-text.mjs';

export const hash = value => createHash('sha256').update(value).digest('hex');
const stop = new Set('a an the i we me my our need want would like for to use using api apis with that this can of in and or is it be have get some project application app please'.split(' '));
export function terms(input, { limit = 40, maxChars = 2000 } = {}) {
  const words = plain(input, maxChars).toLowerCase().replace(/car\s*parks?/g, 'parking').match(/[\p{L}\p{N}]+/gu) || [];
  return [...new Set(words.filter(word => word.length > 1 && !stop.has(word)))].slice(0, limit);
}
export function relatedTerms(query, value) {
  const words = new Set(terms(value, { limit: 1000 }));
  return terms(query).filter(term => words.has(term));
}
