import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, BookmarkSimple, ArrowBendDownRight, Flag, PuzzlePiece, ArrowLeft, DownloadSimple, FileText, Lightbulb, ListChecks, Flask, Wrench, ChartLine, CircleNotch, WarningCircle, ArrowUpRight } from '@phosphor-icons/react';
import { safeLink, readableDate } from './api.mjs';
import { Avatar, ConceptIcon, Ladder, Trail, evidenceFrom, evidenceLevel, useConnectors, Cables } from './signal-parts.jsx';

const kindName = kind => kind === 'mcp' ? 'MCP server' : kind === 'api' ? 'API' : 'Integration';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// A modal side sheet built on <dialog> for focus containment, Escape and an
// inert background. It slides in after opening and out before unmounting.
export function Sheet({ label, onClose, children, className = '' }) {
  const ref = useRef(null); const [on, setOn] = useState(false); const closing = useRef(false);
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement;
    dialog.showModal(); const frame = requestAnimationFrame(() => setOn(true));
    return () => { cancelAnimationFrame(frame); dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  const close = () => {
    if (closing.current) return; closing.current = true; setOn(false);
    setTimeout(onClose, reduceMotion() ? 0 : 280);
  };
  return <dialog ref={ref} className={`sheet ${on ? 'on' : ''} ${className}`} aria-label={label} onCancel={e => { e.preventDefault(); close(); }}
    onClick={e => { if (e.target === ref.current) close(); }}>
    <div className="sheet-in">{typeof children === 'function' ? children(close) : children}</div>
  </dialog>;
}

function SourceLink({ href, children }) {
  const safe = safeLink(href);
  return safe ? <a className="btn ghost press" href={safe} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={17} weight="light" aria-hidden="true"/>{children}</a> : null;
}

const shortCheck = text => {
  const words = text.replace(/^(Check whether|Check if|Confirm( that| whether| if)?)\s+/i, '').replace(/\.$/, '').split(/\s+/);
  const short = words.length > 6 ? `${words.slice(0, 6).join(' ')}…` : words.join(' ');
  return short.charAt(0).toUpperCase() + short.slice(1);
};
function Flags({ checks, idPrefix }) {
  const [open, setOpen] = useState(null);
  if (!checks.length) return null;
  return <div><h3 className="sec-label"><Flag size={16} weight="light" aria-hidden="true"/>Check before you rely on it</h3>
    <div className="flags">{checks.map((check, i) => <button key={i} type="button" className="flag press" aria-expanded={open === i} aria-controls={`${idPrefix}-note`} onClick={() => setOpen(open === i ? null : i)}><Flag size={15} weight="light" aria-hidden="true"/>{shortCheck(check)}</button>)}</div>
    <p className="flag-note" id={`${idPrefix}-note`} aria-live="polite">{open !== null ? checks[open] : ''}</p>
  </div>;
}

function Capabilities({ capabilities, query }) {
  const [open, setOpen] = useState(() => new Set([0]));
  const toggle = i => setOpen(current => { const next = new Set(current); if (next.has(i)) next.delete(i); else next.add(i); return next; });
  return <div className="caps">{capabilities.map((c, i) => <div key={i} className={`cap ${open.has(i) ? 'open' : ''}`}>
    <button type="button" className="ct press" aria-expanded={open.has(i)} aria-controls={`cap-${i}`} onClick={() => toggle(i)}><span className="cap-ico" aria-hidden="true"><PuzzlePiece size={20} weight="light"/></span><b>{c.title}</b><Plus className="tag" size={15} aria-hidden="true"/></button>
    <div className="body" id={`cap-${i}`}><div>
      <p>{c.does}</p>
      <p className="for"><ArrowBendDownRight size={17} weight="light" aria-hidden="true"/><span><span className="sr-only">{query ? 'For your idea: ' : 'A possible use: '}</span>{c.helps}</span></p>
      {c.citations?.slice(0, 2).map((q, j) => <blockquote key={j}>{q.quote}</blockquote>)}
    </div></div>
  </div>)}</div>;
}

function emptyReason(summary) {
  if (summary.generation === 'skipped-no-usable-evidence') return 'No readable capability details in the available sources. No AI credit was used.';
  if (summary.sourceFit === 'unclear') return 'The available sources don’t establish what this integration can do.';
  return 'The source doesn’t establish a useful capability for your idea.';
}

export function ExplainSheet({ item, summary, generating, error, saved, onSave, onClose, query, listed }) {
  const evidence = evidenceFrom(summary, listed);
  const explanation = summary?.summary;
  const title = summary?.title || item.name || 'Your documentation';
  const kind = summary?.integrationKind || item.kind;
  const sourceHref = summary?.source?.evidenceLevel === 'server-declared-tool-metadata' ? item.repositoryUrl || item.documentationUrl || summary.source.url : summary?.source?.url || item.repositoryUrl || item.documentationUrl || item.specificationUrl;
  return <Sheet label={`Explanation: ${title}`} onClose={onClose}>{close => <>
    <div className="sheet-head"><Avatar item={{ ...item, kind, name: title }}/><div className="head-copy"><h2>{title}</h2><small>{item.provider ? `${item.provider} · ` : ''}{kindName(kind)}</small></div>
      <button type="button" className="close press" aria-label="Close" onClick={close}><X size={18}/></button></div>
    <div className="sheet-body">
      <Trail evidence={evidence} pending={generating ? 'Docs read' : ''}/>
      {generating && <div className="reading" role="status"><CircleNotch className="spin" size={18} aria-hidden="true"/>{generating}<div className="ghost-caps" aria-hidden="true"><i/><i/><i/></div></div>}
      {error && <p className="alert" role="alert"><WarningCircle size={18} aria-hidden="true"/>{error}</p>}
      {explanation && (explanation.capabilities.length ? <>
        <div><h3 className="sec-label"><PuzzlePiece size={16} weight="light" aria-hidden="true"/>{summary.query ? 'What it could do for your idea' : 'What you could build with it'}</h3><Capabilities capabilities={explanation.capabilities} query={summary.query}/></div>
        <Flags checks={explanation.checks} idPrefix="explain"/>
        <p className="source-line">{summary.source.evidenceLevel === 'server-declared-tool-metadata' ? 'From server tool descriptions. No tools were run.' : 'From documentation. Not tested.'} Read {readableDate(summary.source.fetchedAt)}.{summary.documentationNote ? ` ${summary.documentationNote}` : ''}</p>
      </> : <p className="empty-note">{emptyReason(explanation)}</p>)}
    </div>
    <div className="sheet-foot"><button type="button" className={`btn press ${saved ? 'primary' : ''}`} aria-pressed={saved} onClick={onSave}><BookmarkSimple size={17} weight={saved ? 'fill' : 'light'} aria-hidden="true"/>{saved ? 'Shortlisted' : 'Shortlist'}</button>
      <SourceLink href={sourceHref}>{summary?.summary?.capabilities?.length ? `Source · ${readableDate(summary.source.fetchedAt)}` : 'Open listed source'}</SourceLink></div>
  </>}</Sheet>;
}

// Which concepts the shortlist covers. Coverage comes only from each saved
// result's AI match (validated against the server's concept IDs).
export function ShortlistPanel({ concepts, saved, evidenceOf, onRemove, onExplain, onBrief, canBrief, hint, compact = false }) {
  const covered = concepts.filter(c => saved.some(item => item.match?.covers?.includes(c.id))).length;
  return <div className={`panel ${compact ? 'compact' : ''}`}>
    <h2>{concepts.length ? <>Your shortlist covers <small>{covered} of {concepts.length}</small></> : <>Your shortlist <small>{saved.length} of 5</small></>}</h2>
    {concepts.map(c => {
      const by = saved.filter(item => item.match?.covers?.includes(c.id));
      return <div key={c.id} className={`slot ${by.length ? 'full' : ''}`}><span className="slot-ico" data-tip={c.label}><ConceptIcon icon={c.icon} size={21}/></span>
        <span className="plugs">{by.length ? by.map(item => <span key={item.id} className="mini" data-tip={item.name}><Avatar item={item} className="tiny"/><span className="sr-only">{item.name}</span></span>) : <em>{c.label}</em>}<span className="sr-only">{by.length ? ` covers ${c.label}` : ': nothing shortlisted yet'}</span></span></div>;
    })}
    {saved.length > 0 ? <ul className="picks">{saved.map(item => <li key={item.id}><Avatar item={item} className="tiny"/><button type="button" className="pick-name" onClick={() => onExplain(item)}>{item.name}</button><Ladder level={evidenceLevel(evidenceOf(item))} small/><button type="button" className="x press" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item)}><X size={15}/></button></li>)}</ul>
      : !concepts.length && <p className="panel-empty"><BookmarkSimple size={18} weight="light" aria-hidden="true"/>Bookmark results to keep them here.</p>}
    <button type="button" className="brief-btn press" disabled={!canBrief} onClick={onBrief}><FileText size={18} weight="light" aria-hidden="true"/>Build brief</button>
    {hint && <p className="panel-hint">{hint}</p>}
  </div>;
}

const stepIcons = [ListChecks, Flask, Flag, ChartLine]; const stepLabels = { Confirm: 'Confirm access', Prototype: 'Prototype', Resolve: 'Resolve checks', Test: 'Test the data' };
const nodeName = name => name.length > 30 ? `${name.slice(0, 29).trim()}…` : name;

export function BriefView({ brief, query, concepts, picks, generating, error, onBack, onDownload }) {
  const ref = useRef(null);
  const integrations = brief?.integrations || [];
  const nodes = integrations.map((integration, i) => ({ integration, item: picks[i] || { name: integration.title, kind: integration.integrationKind }, key: `int-${i}` }));
  const links = [];
  if (concepts.length) {
    for (const c of concepts) {
      links.push(['idea', `concept-${c.id}`]);
      const by = nodes.filter(n => n.integration.capabilities.length && n.item.match?.covers?.includes(c.id));
      if (!by.length) links.push([`concept-${c.id}`, null, 'miss c2i']);
      for (const n of by) links.push([`concept-${c.id}`, n.key, 'c2i']);
    }
  } else nodes.forEach(n => links.push(['idea', n.key, n.integration.capabilities.length ? '' : 'miss']));
  const paths = useConnectors(ref, links, [brief, concepts.length]);
  const checks = [...new Set(integrations.flatMap(integration => integration.checks))];
  return <section className="brief" aria-labelledby="brief-title">
    <div className="brief-top"><button type="button" className="edit press" aria-label="Back to results" onClick={onBack}><ArrowLeft size={19} weight="light"/></button><h1 id="brief-title">Build brief</h1>
      {brief && !generating && <button type="button" className="btn primary press" onClick={onDownload}><DownloadSimple size={18} weight="light" aria-hidden="true"/>Download</button>}</div>
    {error && <p className="alert" role="alert"><WarningCircle size={18} aria-hidden="true"/>{error}</p>}
    {generating && <div className="board"><div className="board-core loading" role="status"><CircleNotch className="spin" size={20} aria-hidden="true"/><p>{generating}</p><div className="ghost-map" aria-hidden="true"><i/><i/><i/><i/><i/></div></div></div>}
    {brief && !generating && <>
      <div className="board"><div className="board-core">
        <div className={`map ${concepts.length ? '' : 'two'}`} ref={ref}>
          <Cables paths={paths}/>
          <div className="map-col"><div className="node idea-n" data-node="idea"><Lightbulb size={19} weight="light" aria-hidden="true"/><span>{query}</span></div></div>
          {concepts.length > 0 && <div className="map-col">{concepts.map(c => { const covered = nodes.some(n => n.integration.capabilities.length && n.item.match?.covers?.includes(c.id));
            return <div key={c.id} className={`node ${covered ? '' : 'uncovered'}`} data-node={`concept-${c.id}`}><span className="node-ico"><ConceptIcon icon={c.icon} size={19}/></span>{c.label}<span className="sr-only">{covered ? '' : ': not covered by the shortlist'}</span></div>; })}</div>}
          <div className="map-col">{nodes.map(n => {
            const ok = n.integration.capabilities.length > 0;
            const level = ok ? evidenceLevel({ docsRead: Boolean(n.integration.source?.fetchedAt), quotesChecked: n.integration.capabilities.some(c => c.citations?.length) }) : 1;
            return <div key={n.key} className={`node int ${ok ? '' : 'unverified'}`} data-node={n.key} title={ok ? n.integration.title : `${n.integration.title}: capabilities couldn’t be verified`}><Avatar item={n.item} className="tiny"/><span className="node-name">{nodeName(n.integration.title)}</span>{ok && concepts.length > 0 && <span className="node-cov" aria-hidden="true">{concepts.filter(c => n.item.match?.covers?.includes(c.id)).map(c => <ConceptIcon key={c.id} icon={c.icon} size={15}/>)}</span>}<Ladder level={level} small/></div>;
          })}</div>
        </div>
        <ol className="track">{brief.nextSteps.map((step, i) => { const Icon = stepIcons[i] || Wrench; const first = step.split(' ')[0];
          return <li key={i} className="step" tabIndex={0}><span className="step-ico"><Icon size={24} weight="light" aria-hidden="true"/></span><b>{stepLabels[first] || first}</b><p>{step}</p></li>; })}</ol>
        <div className="brief-checks"><Flags checks={checks} idPrefix="brief"/><span className="honest"><Ladder level={3} small/>Possible uses. Not tested.</span></div>
      </div></div>
      <div className="brief-detail">{integrations.map((integration, i) => <details key={i} className="int-detail">
        <summary><Avatar item={nodes[i].item} className="tiny"/><b>{integration.title}</b><small>{integration.capabilities.length ? integration.capabilities.map(c => c.title).join(' · ') : 'Capabilities couldn’t be verified'}</small><Plus className="tag" size={15} aria-hidden="true"/></summary>
        <div className="int-body">{integration.capabilities.map((c, j) => <div key={j}><b>{c.title}</b><p>{c.does}</p><p className="for"><ArrowBendDownRight size={16} weight="light" aria-hidden="true"/>{c.helps}</p></div>)}
          <SourceLink href={integration.source?.url}>Read documentation</SourceLink></div>
      </details>)}
      {brief.unreadable?.length > 0 && <p className="empty-note">Not in this brief: {brief.unreadable.map(item => item.name || 'Selected integration').join(', ')}. Their capabilities couldn’t be read.</p>}</div>
    </>}
  </section>;
}
