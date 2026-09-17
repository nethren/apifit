import React, { useState } from 'react';
import { ArrowRight, ArrowUpRight, CloudSun, EnvelopeSimple, CreditCard, FileText, MagnifyingGlass } from '@phosphor-icons/react';

const directions = [
  { id: 'outside', label: 'Weather & places', icon: CloudSun, title: 'Bring the world into your app.', searches: ['Weather forecasts', 'Air quality', 'Places nearby'] },
  { id: 'messages', label: 'Email & messaging', icon: EnvelopeSimple, title: 'Get the right message across.', searches: ['Send email', 'SMS messaging', 'Push notifications'] },
  { id: 'commerce', label: 'Payments & billing', icon: CreditCard, title: 'Make the transaction happen.', searches: ['Accept payments', 'Currency exchange', 'Invoices'] },
];

// Decorative, original artwork: it reflects the selected source, never API evidence.
export function ConnectorScene({ source, mode }) {
  return <div className="connector-scene" data-source={mode === 'understand' ? 'docs' : source} aria-hidden="true">
    <svg viewBox="0 0 480 290" fill="none">
      <path className="scene-track" d="M21 199h64q20 0 20-20V93q0-20 20-20h188q20 0 20 20v109q0 20 20 20h89"/>
      <path className="scene-track secondary-track" d="M72 249h104q20 0 20-20V47h205"/>
      <circle className="scene-terminal" cx="21" cy="199" r="5"/>
      <circle className="scene-terminal" cx="442" cy="222" r="5"/>
      <g className="scene-docs scene-piece">
        <rect className="scene-edge" x="283" y="102" width="123" height="142" rx="19"/>
        <rect className="scene-face" x="279" y="94" width="123" height="142" rx="19"/>
        <path className="scene-ink" d="M302 161h69m-69 13h52m-52 13h59"/>
        <text x="301" y="133" className="scene-label">docs</text>
        <path className="scene-ink" d="m301 215 8-8-8-8m16 16h16"/>
      </g>
      <g className="scene-mcp scene-piece">
        <rect className="scene-edge" x="85" y="41" width="140" height="140" rx="23"/>
        <rect className="scene-face" x="81" y="33" width="140" height="140" rx="23"/>
        <text x="100" y="68" className="scene-label">MCP</text>
        <path className="scene-plug" d="m130 93 13-13a12 12 0 0 1 17 17l-25 25a12 12 0 0 1-17-17l13-13m8 34 16-16a12 12 0 0 1 17 17l-16 16m-17-17 19 19"/>
      </g>
      <g className="scene-api scene-piece">
        <rect className="scene-api-edge" x="183" y="120" width="153" height="140" rx="25"/>
        <rect className="scene-api-face" x="178" y="110" width="153" height="140" rx="25"/>
        <circle className="scene-api-dot" cx="302" cy="138" r="5"/>
        <text x="199" y="148" className="scene-api-label">API</text>
        <path className="scene-api-symbol" d="M221 173h-5q-8 0-8 8v8q0 9-9 9 9 0 9 9v8q0 8 8 8h5m65-50h5q8 0 8 8v8q0 9 9 9-9 0-9 9v8q0 8-8 8h-5"/>
        <circle className="scene-api-dot" cx="246" cy="198" r="4"/>
        <circle className="scene-api-dot" cx="261" cy="198" r="4"/>
      </g>
    </svg>
  </div>;
}

export function DiscoveryStudio({ onSearch, onUnderstand }) {
  const [direction, setDirection] = useState(directions[0]);
  return <section className="discovery-studio" aria-labelledby="explore-title">
    <div className="studio-heading"><h2 id="explore-title">A few ways in.</h2><span>Pick a direction. Make it yours.</span></div>
    <div className="studio-grid">
      <div className="direction-browser">
        <div className="direction-controls" role="group" aria-label="Example search topics">
          {directions.map(item => <button key={item.id} type="button" aria-pressed={direction.id === item.id} aria-controls="direction-examples" onClick={() => setDirection(item)}><item.icon size={23}/><span>{item.label}</span><ArrowRight className="direction-arrow" size={17}/></button>)}
        </div>
        <div className="direction-examples" id="direction-examples">
          <h3 aria-live="polite" aria-atomic="true">{direction.title}</h3>
          <div className="example-queries">{direction.searches.map(query => <button key={query} type="button" onClick={() => onSearch(query)}><MagnifyingGlass size={17}/><span>{query}</span><ArrowUpRight size={18}/></button>)}</div>
        </div>
      </div>
      <button className="docs-entry" type="button" onClick={onUnderstand}>
        <span className="docs-stack" aria-hidden="true"><span/><span/><span><FileText size={37}/></span></span>
        <span className="docs-entry-title">Have an API?</span>
        <span className="docs-entry-copy">Bring the docs.<br/>{' '}See what’s possible.</span>
        <span className="docs-entry-action">Read documentation <ArrowUpRight size={19}/></span>
      </button>
    </div>
  </section>;
}
