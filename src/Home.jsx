import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, MagnifyingGlass, BookmarkSimple, FileText, Lightbulb, BracketsCurly, Plug, Brain } from '@phosphor-icons/react';
import { ConceptIcon, useConnectors, Cables } from './signal-parts.jsx';

// Example prompts only. The icons illustrate each example's own wording; no
// result, capability or integration is implied until a real search runs.
export const examples = [
  { title: 'Storm texts', query: 'Text farmers when a storm is coming', from: 'weather', to: 'sms' },
  { title: 'Pay in any currency', query: 'Accept payments in local currencies', from: 'currency', to: 'payment' },
  { title: 'Appointment nudges', query: 'Remind patients about appointments by email', from: 'calendar', to: 'email' },
  { title: 'Clean-air map', query: 'Show air quality near a running route', from: 'air', to: 'map' },
];

export function StartTiles({ onPick }) {
  return <section className="start" aria-labelledby="try-label">
    <h2 className="tiles-label" id="try-label">Try one</h2>
    <div className="tiles">{examples.map(t => <button key={t.title} type="button" className="tile press" onClick={() => onPick(t.query)}>
      <span className="pair" aria-hidden="true"><ConceptIcon icon={t.from} size={26}/><em/><ConceptIcon icon={t.to} size={26}/></span>
      <b>{t.title}</b><span className="tile-q">{t.query}</span><ArrowUpRight className="arrow" size={18} aria-hidden="true"/>
    </button>)}</div>
    <ol className="flow" aria-label="How it works">
      <li><MagnifyingGlass size={20} weight="light" aria-hidden="true"/>Find</li><li aria-hidden="true" className="sep"/>
      <li><BookmarkSimple size={20} weight="light" aria-hidden="true"/>Shortlist</li><li aria-hidden="true" className="sep"/>
      <li><FileText size={20} weight="light" aria-hidden="true"/>Brief</li>
    </ol>
  </section>;
}

const sourceSockets = { api: [['api', 'APIs.guru', BracketsCurly]], mcp: [['mcp', 'MCP Registry', Plug]], all: [['api', 'APIs.guru', BracketsCurly], ['mcp', 'MCP Registry', Plug]] };

// The search-in-progress view. It shows only what is really happening: the
// user's query, the directories being searched and, with AI on, the ranking
// step. Cables march while the request is open; nothing here predicts results.
export function SearchingBay({ query, source, ai, onCancel }) {
  const ref = useRef(null);
  const [typed, setTyped] = useState('');
  const [seconds, setSeconds] = useState(0);
  const sockets = sourceSockets[source] || sourceSockets.api;
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setTyped(query); return undefined; }
    let i = 0; setTyped('');
    const timer = setInterval(() => { i += 1; setTyped(query.slice(0, i)); if (i >= query.length) clearInterval(timer); }, Math.max(10, Math.min(32, 900 / Math.max(1, query.length))));
    return () => clearInterval(timer);
  }, [query]);
  useEffect(() => { const timer = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(timer); }, []);
  const links = [...sockets.map(([id]) => ['idea', `src-${id}`]), ...(ai ? sockets.map(([id]) => [`src-${id}`, 'rank']) : [])];
  const paths = useConnectors(ref, links, [source, ai]);
  return <section className="bay-wrap" aria-labelledby="bay-status">
    <div className={`bay ${ai ? 'with-ai' : ''}`} ref={ref}>
      <Cables paths={paths}/>
      <div className="idea" data-node="idea"><small><Lightbulb size={14} weight="light" aria-hidden="true"/>Your idea</small><p aria-hidden="true">{typed}<span className="caret"/></p><p className="sr-only">{query}</p></div>
      <div className="col">{sockets.map(([id, label, Icon]) => <div key={id} className="socket live" data-node={`src-${id}`}><span className="ico"><Icon size={22} weight="light" aria-hidden="true"/></span><span className="lbl"><b>{label}</b><small>Searching listings</small></span></div>)}</div>
      {ai && <div className="col"><div className="socket live rank" data-node="rank"><span className="ico"><Brain size={22} weight="light" aria-hidden="true"/></span><span className="lbl"><b>Claude</b><small>Matching to your idea</small></span></div></div>}
    </div>
    <div className="bay-foot"><p id="bay-status" role="status">{ai ? 'Finding and ranking matches' : 'Searching public directories'}<span className="secs" aria-hidden="true">{seconds}s</span></p><button type="button" className="btn ghost press" onClick={onCancel}>Cancel</button></div>
  </section>;
}
