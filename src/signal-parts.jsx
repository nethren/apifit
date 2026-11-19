import React, { useLayoutEffect, useState } from 'react';
import {
  CloudLightning, BellRinging, ChatCircleText, EnvelopeSimple, ChatsCircle, Phone, CreditCard, CurrencyCircleDollar, Receipt, ShoppingCart,
  Barcode, Truck, MapTrifold, MapPin, AirplaneTilt, CalendarCheck, Clock, Wind, Heartbeat, Users, IdentificationCard, LockKey, FileText,
  Image, VideoCamera, MusicNotes, Microphone, Translate, MagnifyingGlass, Database, Table, ChartLine, TrendUp, Newspaper, ForkKnife,
  GraduationCap, Code, ArrowsClockwise, Brain, ShareNetwork, SoccerBall, HouseLine, Car, Lightning, Plant, BookOpen, GameController,
  Scales, QrCode, Cube, Plug, ListBullets, Quotes, Flask,
} from '@phosphor-icons/react';

// Keys come from shared/concept-icons.mjs; the server rejects anything else.
const conceptIcons = {
  weather: CloudLightning, alert: BellRinging, sms: ChatCircleText, email: EnvelopeSimple, chat: ChatsCircle, phone: Phone,
  payment: CreditCard, currency: CurrencyCircleDollar, invoice: Receipt, shopping: ShoppingCart, barcode: Barcode, shipping: Truck,
  map: MapTrifold, location: MapPin, travel: AirplaneTilt, calendar: CalendarCheck, time: Clock, air: Wind, health: Heartbeat,
  people: Users, identity: IdentificationCard, lock: LockKey, file: FileText, image: Image, video: VideoCamera, audio: MusicNotes,
  speech: Microphone, translate: Translate, search: MagnifyingGlass, database: Database, spreadsheet: Table, chart: ChartLine,
  finance: TrendUp, news: Newspaper, food: ForkKnife, education: GraduationCap, code: Code, automation: ArrowsClockwise, ai: Brain,
  social: ShareNetwork, sports: SoccerBall, home: HouseLine, car: Car, energy: Lightning, plant: Plant, book: BookOpen,
  game: GameController, legal: Scales, qr: QrCode, generic: Cube,
};
export function ConceptIcon({ icon, size = 18, weight = 'light', ...rest }) {
  const Icon = conceptIcons[icon] || Cube;
  return <Icon size={size} weight={weight} aria-hidden="true" {...rest}/>;
}

export function Avatar({ item, className = '' }) {
  return <span className={`av ${item.kind === 'mcp' ? 'mcp' : ''} ${className}`} aria-hidden="true">{item.kind === 'mcp' ? <Plug size={20} weight="light"/> : (item.name?.match(/[A-Za-z0-9]/)?.[0] || 'A').toUpperCase()}</span>;
}

// Evidence steps: Listed, Docs read, Quotes checked, You test.
// APIFit can reach step 3 at most. Step 4 is always dashed: nothing is tested here.
export const evidenceSteps = [
  { label: 'Listed', icon: ListBullets, tip: 'Found in a public directory' },
  { label: 'Docs read', icon: FileText, tip: 'APIFit fetched its documentation' },
  { label: 'Quotes checked', icon: Quotes, tip: 'Each capability is tied to a source quote' },
  { label: 'You test', icon: Flask, tip: 'Not done by APIFit. Test it yourself.' },
];
export function evidenceLevel(evidence) {
  if (!evidence) return 1;
  return evidence.quotesChecked ? 3 : evidence.docsRead ? 2 : 1;
}
export function evidenceFrom(summary, listed = true) {
  const docsRead = Boolean(summary?.source?.fetchedAt) && summary?.documentationStatus?.state !== 'unavailable' && summary?.summary?.generation !== 'skipped-no-usable-evidence';
  const quotesChecked = docsRead && Boolean(summary?.summary?.capabilities?.some(c => c.citations?.length));
  return { listed, docsRead, quotesChecked };
}
const levelNames = ['Listed', 'Docs read', 'Quotes checked'];
export function Ladder({ level, small = false }) {
  return <span className={`ladder ${small ? 'small' : ''}`} role="img" aria-label={`Evidence: ${levelNames[level - 1]}. Not tested.`}>
    {[1, 2, 3, 4].map(n => <i key={n} className={n === 4 ? 'you' : n <= level ? 'on' : ''}/>)}
  </span>;
}
export function Trail({ evidence, pending = '' }) {
  const state = [evidence.listed, evidence.docsRead, evidence.quotesChecked, false];
  return <ol className="trail" aria-label="Evidence">
    {evidenceSteps.map((step, i) => <li key={step.label} className={i === 3 ? 'you' : state[i] ? 'on' : pending === step.label ? 'pending' : ''} title={step.tip}>
      <span><step.icon size={15} weight="light" aria-hidden="true"/>{step.label}</span><span className="sr-only">{i === 3 ? ': not done by APIFit' : state[i] ? ': done' : ': not yet'}</span>
    </li>)}
  </ol>;
}

export function Coverage({ concepts, covers = [], keywords }) {
  if (concepts?.length) return <span className="cov">{concepts.map(c => {
    const on = covers.includes(c.id);
    return <span key={c.id} className={on ? 'on' : ''} data-tip={`${c.label}${on ? '' : ': not shown'}`}><ConceptIcon icon={c.icon} size={17}/><span className="sr-only">{c.label}: {on ? 'covered' : 'not shown'}</span></span>;
  })}</span>;
  if (keywords?.length) return <span className="words" data-tip="Words from your search found in this listing">{keywords.slice(0, 3).map(word => <span key={word}>{word}</span>)}</span>;
  return <span className="cov"/>;
}

// Split the query into plain words and concept words (first match wins).
export function parseQuery(query, concepts = [], keywords = []) {
  const lower = query.toLowerCase(); const marks = [];
  const add = (start, end, concept, first) => { if (!marks.some(m => start < m.end && end > m.start)) marks.push({ start, end, concept, first }); };
  for (const concept of concepts) {
    let first = true;
    for (const word of concept.words) {
      const w = word.toLowerCase(); let at = lower.indexOf(w);
      while (at >= 0) { add(at, at + w.length, concept, first); first = false; at = lower.indexOf(w, at + w.length); }
    }
  }
  if (!concepts.length) for (const word of keywords) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'giu');
    for (const m of query.matchAll(re)) add(m.index, m.index + m[0].length, null, false);
  }
  marks.sort((a, b) => a.start - b.start);
  const parts = []; let cursor = 0;
  for (const m of marks) { if (m.start > cursor) parts.push({ text: query.slice(cursor, m.start) }); parts.push({ text: query.slice(m.start, m.end), concept: m.concept, first: m.first, keyword: !m.concept }); cursor = m.end; }
  if (cursor < query.length) parts.push({ text: query.slice(cursor) });
  return parts;
}

// Draws cables between [data-node] elements. Path geometry goes into SVG `d`
// attributes, never inline styles (the CSP forbids style attributes).
export function useConnectors(ref, links, deps) {
  const [paths, setPaths] = useState([]);
  useLayoutEffect(() => {
    const root = ref.current; if (!root) return;
    const measure = () => {
      const box = root.getBoundingClientRect(); if (!box.width) return;
      const vertical = getComputedStyle(root).getPropertyValue('--flow').trim() === 'vertical';
      const at = name => root.querySelector(`[data-node="${CSS.escape(name)}"]`)?.getBoundingClientRect();
      setPaths(links.flatMap(([from, to, cls = '']) => {
        const a = at(from), b = to && at(to); if (!a) return [];
        if (!b) { // Short dashed stub: nothing plugs in here.
          if (vertical) { const x = a.left - box.left + a.width / 2, y = a.bottom - box.top; return [{ key: `${from}-`, cls, d: `M${x} ${y} L${x} ${y + 18}` }]; }
          const x = a.right - box.left, y = a.top - box.top + a.height / 2; return [{ key: `${from}-`, cls, d: `M${x} ${y} L${x + 28} ${y}` }];
        }
        if (vertical) {
          const x0 = a.left - box.left + a.width / 2, y0 = a.bottom - box.top, x1 = b.left - box.left + b.width / 2, y1 = b.top - box.top, m = (y0 + y1) / 2;
          return [{ key: `${from}-${to}`, cls, d: `M${x0} ${y0} C${x0} ${m} ${x1} ${m} ${x1} ${y1}` }];
        }
        const x0 = a.right - box.left, y0 = a.top - box.top + a.height / 2, x1 = b.left - box.left, y1 = b.top - box.top + b.height / 2, m = (x0 + x1) / 2;
        return [{ key: `${from}-${to}`, cls, d: `M${x0} ${y0} C${m} ${y0} ${m} ${y1} ${x1} ${y1}` }];
      }));
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(root);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return paths;
}
export function Cables({ paths, live = true }) {
  return <svg className="cables" aria-hidden="true">{paths.map(p => <path key={p.key} className={`cable ${p.cls} ${live ? 'live' : ''}`} d={p.d} pathLength="1"/>)}</svg>;
}
