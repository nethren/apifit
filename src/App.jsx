import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, ArrowUpRight, BookmarkSimple, MagnifyingGlass, LinkSimple, X, Command, Plus, Trash, Check, DownloadSimple, Info, CircleNotch, ArrowCounterClockwise, GlobeHemisphereWest, FileText, Plug } from '@phosphor-icons/react';
import { api, host } from './api.mjs';
import { Mark, EmptyArt } from './Artwork.jsx';
import { ConnectorScene, DiscoveryStudio } from './DiscoveryStudio.jsx';
import { Dialog, ExternalLink, Loading, Notice, Reader, ResultRow, Avatar } from './components.jsx';
import { PalettePreview } from './PalettePreview.jsx';
import { AiControls, ComparisonResults } from './AiControls.jsx';
import { InlineRequirements } from './InlineRequirements.jsx';
import { discoveryRequest, comparisonCriteria } from './discovery.mjs';

const sourceNames = { api: 'APIs', mcp: 'MCP servers', all: 'All sources' };

function Comparison({ saved, onRemove, onClose, notify, initialQuery, draft, aiOptions, refreshAi }) {
  const [requirements, setRequirements] = useState(draft.current?.requirements || [{ id: 'r1', text: initialQuery || '', priority: 'unsure' }]);
  const [confirmed, setConfirmed] = useState(draft.current?.confirmed || false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [prepared, setPrepared] = useState(draft.current?.candidateIds === saved.map(item => item.id).join('|') ? draft.current?.prepared || null : null);
  const [assessment, setAssessment] = useState(draft.current?.candidateIds === saved.map(item => item.id).join('|') ? draft.current?.assessment || null : null);
  const controller = useRef(null);
  const resultRef = useRef(null);
  const nextId = useRef(Math.max(1, ...requirements.map(r => Number(r.id.slice(1)) || 0)) + 1);
  useEffect(() => { draft.current = { requirements, confirmed, assessment, prepared, candidateIds: saved.map(item => item.id).join('|') }; }, [requirements, confirmed, assessment, prepared, saved, draft]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (assessment) resultRef.current?.focus(); }, [assessment]);
  function update(id, field, value) { setRequirements(current => current.map(r => r.id === id ? { ...r, [field]: value } : r)); setConfirmed(false); }
  async function compare(e, continuePrepared = false) {
    e.preventDefault(); setError('');
    if (!saved.length) return setError('Shortlist at least one API before preparing a comparison.');
    controller.current?.abort(); const current = new AbortController(); controller.current = current;
    try {
      const ids = continuePrepared ? prepared.ids : []; const failures = [];
      if (!continuePrepared) setPrepared(null);
      if (!continuePrepared) for (let i = 0; i < saved.length; i++) {
        const item = saved[i]; const url = item.specificationUrl || item.documentationUrl;
        setBusy(`Reading ${i + 1} of ${saved.length}: ${item.name}`);
        try {
          if (!url) throw new Error('No public documentation link is listed.');
          const analysis = await api('/analyses', { url, limit: 20 }, { signal: current.signal }); ids.push(analysis.id);
        } catch (err) { if (err.name === 'AbortError') throw err; failures.push({ id: item.id, name: item.name, message: err.message }); }
      }
      if (failures.length) { setPrepared({ ids, failures, candidateIds: saved.map(item => item.id).join('|') }); return; }
      setBusy(aiOptions.ai ? 'Checking each requirement against the evidence…' : 'Preparing the evidence brief…');
      const result = await api('/assessments', { analysisIds: ids, requirements, confirmed, ...aiOptions }, { signal: current.signal });
      setAssessment(result);
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { if (controller.current === current) setBusy(''); refreshAi(); }
  }
  async function organise() {
    controller.current?.abort(); const current = new AbortController(); controller.current = current;
    setBusy('Organising your requirements…'); setError('');
    try {
      const result = await api('/requirements/draft', { text: requirements.map(r => r.text).join('\n'), ...aiOptions }, { signal: current.signal });
      if (!result.requirements.length) throw new Error('Add a concrete API use case before asking AI to organise it.');
      setRequirements(result.requirements); nextId.current = result.requirements.length + 1; setConfirmed(false); setQuestions(result.questions || []);
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { if (controller.current === current) setBusy(''); refreshAi(); }
  }
  async function download() {
    setError('');
    try {
      const response = await fetch(`/api/assessments/${assessment.id}/brief`);
      if (!response.ok) throw new Error('This brief is no longer available. Prepare the comparison again to refresh it.');
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = 'apifit-decision-brief.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Decision brief downloaded.');
    } catch (err) { setError(err.message); }
  }
  return <Dialog title={assessment ? 'Your decision workspace' : 'Your shortlist'} onClose={onClose} wide>
    {assessment ? <><p ref={resultRef} tabIndex={-1} className="dialog-intro">The evidence is gathered. The decision is still yours.</p><ComparisonResults assessment={assessment}/>{prepared?.failures.length > 0 && <Notice>Excluded because their documentation could not be read: {prepared.failures.map(f => f.name).join(', ')}. The brief covers only the readable options above.</Notice>}<div className="dialog-footer"><button className="button secondary" onClick={() => setAssessment(null)}><ArrowLeft size={17}/>Edit requirements</button><button className="button primary" onClick={download}><DownloadSimple size={18}/>Download brief</button></div><p className="fineprint">Includes source evidence and a manual pre-build checklist. No executable test collection is included.</p></>
      : <><p className="dialog-intro">A few promising options. One place to think them through.</p>{saved.length ? <div className="shortlist-items">{saved.map(item => <div className="shortlist-item" key={item.id}><Avatar item={item}/><div><strong>{item.name}</strong><small>{item.kind === 'mcp' ? 'MCP server' : 'API'} · {item.provider || host(item.specificationUrl)}</small></div><button className="icon-button" disabled={Boolean(busy)} aria-label={`Remove ${item.name} from comparison`} onClick={() => onRemove(item)}><X size={18}/></button></div>)}</div> : <div className="empty-shortlist"><EmptyArt/><h3>A good option is worth keeping.</h3><p>Use the bookmark beside a result to bring it here.</p><button className="button primary" onClick={onClose}>Keep exploring <ArrowRight size={17}/></button></div>}
      {saved.length > 0 && <form onSubmit={compare}><div className="requirements-heading"><h3>What does your project need?</h3><span>{aiOptions.ai ? '1–10 requirements with AI' : '1–30 requirements'}</span></div><p className="muted">Be specific about the data, action or coverage that matters.</p>{aiOptions.ai && <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={organise}>Organise with AI</button>}{questions.map((q, i) => <Notice key={i}>{q}</Notice>)}<fieldset disabled={Boolean(busy)} className="requirements"><legend className="sr-only">Project requirements</legend>{requirements.map((r, index) => <div className="requirement" key={r.id}><label><span className="sr-only">Requirement {index + 1}</span>{r.sourceQuote && <span className="fineprint">From your request: “{r.sourceQuote}”</span>}<input required maxLength={1000} value={r.text} onChange={e => update(r.id, 'text', e.target.value)} placeholder="e.g. Hourly forecasts for Singapore" /></label><select aria-label={`Priority for requirement ${index + 1}`} value={r.priority} onChange={e => update(r.id, 'priority', e.target.value)}><option value="unsure">Not sure yet</option><option value="must">Must have</option><option value="nice">Nice to have</option></select><button type="button" className="icon-button" disabled={requirements.length === 1} aria-label={`Remove requirement ${index + 1}`} onClick={() => { setRequirements(current => current.filter(other => other.id !== r.id)); setConfirmed(false); }}><X size={17}/></button></div>)}<button type="button" className="text-button" disabled={requirements.length >= (aiOptions.ai ? 10 : 30)} onClick={() => { setRequirements(current => [...current, { id: `r${nextId.current++}`, text: '', priority: 'unsure' }]); setConfirmed(false); }}><Plus size={16}/>Add a requirement</button><label className="confirmation"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/><span>I’ve checked these requirements and priorities.</span></label></fieldset><Notice>{aiOptions.ai ? 'AI will check your requirements against selected excerpts from the first 20 operations per API. This makes paid requests and can take a few minutes for a full shortlist. No live test or account check is performed.' : 'This prepares evidence without AI judgments. Only the first 20 documented operations per API are included; coverage gaps stay visible.'}</Notice>{busy ? <div className="busy-row"><Loading text={busy}/><button type="button" className="text-button" onClick={() => controller.current?.abort()}>Cancel</button></div> : <div className="dialog-footer"><span className="fineprint">No API keys needed.</span><button className="button primary" type="submit">{aiOptions.ai ? 'Assess with AI' : 'Prepare comparison'} <ArrowRight size={17}/></button></div>}</form>}</>}
    {!assessment && prepared && prepared.candidateIds === saved.map(item => item.id).join('|') && <div className="partial-assessment"><Notice error>Some documentation could not be read. These options have not been assessed.</Notice><ul>{prepared.failures.map(f => <li key={f.id}><strong>{f.name}</strong>: {f.message}</li>)}</ul>{prepared.ids.length > 0 ? <button className="button secondary" disabled={Boolean(busy) || !confirmed} onClick={e => compare(e, true)}>Assess only the {prepared.ids.length} readable {prepared.ids.length === 1 ? 'option' : 'options'}</button> : <p>No readable options remain. Try another documentation link or change your shortlist.</p>}</div>}
    {error && <Notice error>{error}</Notice>}
  </Dialog>;
}

export default function App() {
  const [mode, setMode] = useState('find');
  const [inputs, setInputs] = useState({ find: '', understand: '' });
  const [scope, setScope] = useState('api');
  const [results, setResults] = useState(null);
  const [project, setProject] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [history, setHistory] = useState([]);
  const [pageRequest, setPageRequest] = useState(null);
  const [selected, setSelected] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState('');
  const [saved, setSaved] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState('');
  const [backend, setBackend] = useState('checking');
  const [aiStatus, setAiStatus] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const aiOptions = aiEnabled && aiStatus?.ready ? { ai: true, aiConsent: aiStatus.consentVersion } : {};
  async function refreshAi() { try { const status = await api('/ai/status'); setAiStatus(status); if (!status.ready) setAiEnabled(false); } catch { setAiStatus(null); setAiEnabled(false); } }
  function openAi() { refreshAi(); setDialog('ai'); }
  const inputRef = useRef(null); const headingRef = useRef(null); const resultRef = useRef(null); const lastTrigger = useRef(null);
  const searchAbort = useRef(null); const readerAbort = useRef(null); const toastTimer = useRef(null);
  const comparisonDraft = useRef(null);
  function updateProject(next) { setProject(next); comparisonDraft.current = comparisonCriteria(next); }
  function closeComparison() { if (project && comparisonDraft.current) setProject(current => ({ ...current, requirements: comparisonDraft.current.requirements, confirmed: comparisonDraft.current.confirmed })); setDialog(null); }
  const active = Boolean(results || selected || searching || project);
  useEffect(() => {
    const controller = new AbortController();
    api('/health', undefined, { signal: controller.signal }).then(() => setBackend('online')).catch(err => { if (err.name !== 'AbortError') setBackend('offline'); });
    api('/ai/status', undefined, { signal: controller.signal }).then(setAiStatus).catch(() => {});
    const keyboard = e => {
      document.documentElement.dataset.input = 'keyboard';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' || e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.target.isContentEditable) {
        if (document.querySelector('dialog[open]')) return;
        e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select();
      }
    };
    const pointer = () => { document.documentElement.dataset.input = 'pointer'; };
    document.addEventListener('keydown', keyboard); document.addEventListener('pointerdown', pointer);
    return () => { controller.abort(); searchAbort.current?.abort(); readerAbort.current?.abort(); clearTimeout(toastTimer.current); document.removeEventListener('keydown', keyboard); document.removeEventListener('pointerdown', pointer); };
  }, []);
  useEffect(() => {
    if (selected) {
      headingRef.current?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 860px)').matches) headingRef.current?.closest('aside')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, [selected]);
  function notify(text) { setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 5000); }
  function select(item, trigger) { readerAbort.current?.abort(); setSelected(item); setAnalysis(null); setReadError(''); setReading(false); lastTrigger.current = trigger || inputRef.current; }
  function closeReader() {
    readerAbort.current?.abort(); setSelected(null); setAnalysis(null); setReading(false);
    requestAnimationFrame(() => {
      lastTrigger.current?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 860px)').matches && lastTrigger.current?.isConnected) lastTrigger.current.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }
  function save(item) {
    if (saved.some(other => other.id === item.id)) { setSaved(current => current.filter(other => other.id !== item.id)); notify('Removed from your shortlist.'); }
    else if (saved.length === 5) notify('Your shortlist holds five options. Remove one to make space.');
    else { setSaved(current => [...current, item]); notify(`${item.name} added to your shortlist.`); }
  }
  function changeMode(next) { setMode(next); setSearchError(''); inputRef.current?.focus(); }
  async function search(request, navigation = 'new') {
    searchAbort.current?.abort(); const controller = new AbortController(); searchAbort.current = controller;
    setSearching(true); setSearchError('');
    try {
      if (request.aiDraft) {
        setResults(null); setProject(null); comparisonDraft.current = null; closeReader();
        const draft = await api('/requirements/draft', { text: request.query, ...aiOptions }, { signal: controller.signal });
        if (searchAbort.current !== controller || controller.signal.aborted) return;
        const next = { text: request.query, requirements: draft.requirements, queries: draft.queries || [], questions: draft.questions || [], confirmed: false };
        updateProject(next); request = discoveryRequest(next, request.source);
        if (!next.queries.length) { setSearchError('Add search phrases below or describe a concrete API use case. No directory search was made.'); return; }
      } else if (navigation === 'new' && !request.queries) { setProject(null); comparisonDraft.current = null; }
      const data = await api('/search', { ...request, limit: 12 }, { signal: controller.signal });
      if (searchAbort.current !== controller) return;
      if (navigation === 'next') setHistory(current => [...current, pageRequest]);
      else if (navigation === 'back') setHistory(current => current.slice(0, -1));
      else setHistory([]);
      setPageRequest(request); setResults(data); setScope(request.source); closeReader();
      requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: true }));
    } catch (err) { if (err.name !== 'AbortError') setSearchError(err.message); }
    finally { if (searchAbort.current === controller) setSearching(false); refreshAi(); }
  }
  async function read(item, offset = 0) {
    readerAbort.current?.abort(); const controller = new AbortController(); readerAbort.current = controller;
    setReading(true); setReadError('');
    try {
      const data = await api('/analyses', { url: item.specificationUrl || item.documentationUrl, offset, limit: 20, ...aiOptions }, { signal: controller.signal });
      if (readerAbort.current === controller) { setAnalysis(data); setSelected(current => ({ ...current, name: data.title })); }
    } catch (err) { if (err.name !== 'AbortError') setReadError(err.message); }
    finally { if (readerAbort.current === controller) setReading(false); refreshAi(); }
  }
  function submit(e) {
    e.preventDefault(); const value = inputs[mode].trim();
    if (!value) { inputRef.current?.focus(); return; }
    if (mode === 'understand' || /^https?:\/\//i.test(value)) {
      if (!/^https:\/\//i.test(value)) { setSearchError('Use a complete public HTTPS documentation URL. No keys or signed links.'); return; }
      setMode('understand'); setInputs(current => ({ ...current, understand: value }));
      const item = { id: `document:${value}`, name: 'Your documentation', provider: host(value), kind: 'api', specificationUrl: value, description: 'Reading the public document you supplied.' };
      searchAbort.current?.abort(); setSearching(false); setSearchError(''); select(item); read(item);
    } else search({ query: value, source: scope, offset: 0, ...(aiOptions.ai ? { aiDraft: true } : {}) });
  }
  function startExample(query) { setMode('find'); setScope('api'); setInputs(current => ({ ...current, find: query })); search({ query, source: 'api', offset: 0, ...(aiOptions.ai ? { aiDraft: true } : {}) }); }
  function resetView() { searchAbort.current?.abort(); readerAbort.current?.abort(); setSearching(false); setReading(false); setResults(null); setProject(null); comparisonDraft.current = null; setSelected(null); setAnalysis(null); setSearchError(''); setHistory([]); setMode('find'); setInputs({ find: '', understand: '' }); inputRef.current?.focus(); }
  async function clearSession() {
    if (!window.confirm('Clear your shortlist, comparisons and analysed documents? This cannot be undone.')) return;
    try { await api('/session', undefined, { method: 'DELETE' }); comparisonDraft.current = null; setAiEnabled(false); setSaved([]); resetView(); setDialog(null); notify('Local session cleared.'); } catch (err) { notify(err.message); }
  }
  const unavailable = results?.sources.filter(source => source.status === 'unavailable') || [];
  return <div className={`app ${active ? 'has-results' : 'welcome'}`}>
    <a className="skip-link" href="#main">Skip to search</a>
    <header className="topbar"><button className="brand" onClick={resetView} aria-label="APIFit, start a new search"><Mark/><span>api<span className="brand-fit">fit</span><span className="brand-dot">.</span></span></button><PalettePreview/><nav aria-label="Workspace"><button className="nav-link ai-toggle" onClick={openAi}>AI {aiEnabled ? 'on' : 'off'}</button><button className="nav-link" onClick={() => setDialog('help')}>How it works</button><button className="shortlist-nav" aria-label={`Shortlist ${saved.length}`} onClick={() => setDialog('shortlist')}><BookmarkSimple size={18} weight={saved.length ? 'fill' : 'regular'}/><span className="shortlist-label">Shortlist</span><span className="count">{saved.length}</span></button></nav></header>
    <main id="main"><section className="search-stage" aria-labelledby="search-title">
      {!active && <div className="welcome-heading"><div className="welcome-copy"><h1 id="search-title">Find your API.<br/><span>Build your idea.</span></h1><p>Explore APIs and MCP servers.<br/>Understand what they can do.</p></div><ConnectorScene source={scope} mode={mode}/></div>}
      {active && <h1 id="search-title" className="sr-only">Search and understand APIs</h1>}
      <div className="search-workspace"><div className="entry-modes" aria-label="Choose what to do"><button type="button" aria-pressed={mode === 'find'} onClick={() => changeMode('find')}><MagnifyingGlass size={17}/>Find an API</button><button type="button" aria-pressed={mode === 'understand'} onClick={() => changeMode('understand')}><LinkSimple size={17}/>Understand an API</button></div>
        <form className="search-box" onSubmit={submit}><div className="query-line">{mode === 'find' ? <MagnifyingGlass className="query-icon" size={23}/> : <LinkSimple className="query-icon" size={23}/>}<label className="sr-only" htmlFor="api-query">{mode === 'find' ? 'What do you want to build?' : 'Public documentation URL'}</label><input ref={inputRef} id="api-query" value={inputs[mode]} onChange={e => setInputs(current => ({ ...current, [mode]: e.target.value }))} placeholder={mode === 'find' ? 'What will you build?' : 'Paste a public documentation link'} maxLength={mode === 'find' ? 1000 : 4096} autoComplete="off" spellCheck={false} aria-describedby="search-guidance"/>{inputs[mode] && <button type="button" className="icon-button clear-query" aria-label="Clear search input" onClick={() => { setInputs(current => ({ ...current, [mode]: '' })); inputRef.current?.focus(); }}><X size={18}/></button>}<kbd className="shortcut"><Command size={12}/>K</kbd></div>
        <div className="search-bottom">{mode === 'find' ? <div className="scope-control" aria-label="Search source">{Object.entries(sourceNames).map(([key, label]) => <button key={key} type="button" aria-pressed={scope === key} onClick={() => { setScope(key); if (project) search(discoveryRequest(project, key)); else if (results) search({ query: inputs.find.trim() || results.query, source: key, offset: 0 }); }}>{label}</button>)}</div> : <span className="url-note"><FileText size={15}/>OpenAPI, Swagger or a docs page</span>}{searching ? <button className="button search-submit secondary" type="button" onClick={() => { searchAbort.current?.abort(); setSearching(false); }}><CircleNotch className="spinner" size={17}/>Cancel search</button> : <button className="button primary search-submit" type="submit">{mode === 'find' ? aiOptions.ai ? 'Find with AI' : 'Find APIs' : 'Read docs'}<ArrowRight size={18}/></button>}</div></form>
        <div id="search-guidance" className="search-guidance">{mode === 'find' ? <><span>{aiOptions.ai ? 'Describe your project. AI will suggest requirements and search phrases.' : 'Search by name or keywords.'}</span><button type="button" className="search-explainer" onClick={() => setDialog('help')}><Info size={16}/>{aiOptions.ai ? 'Uses your AI budget' : 'Keyword search, not AI matching'}</button></> : <><span>Public HTTPS only. Never paste API keys.</span><span>Documentation, not account permissions.</span></>}</div>
      </div>
      {searchError && <Notice error>{searchError}</Notice>}
      {backend === 'offline' && <Notice error>The local backend is unavailable. Start APIFit to search live sources.</Notice>}
    </section>
    {project && <InlineRequirements project={project} onChange={updateProject} onSearch={() => search(discoveryRequest(project, scope))} onShortlist={() => setDialog('shortlist')} savedCount={saved.length} busy={searching}/>}
    {!active && <DiscoveryStudio onSearch={startExample} onUnderstand={() => changeMode('understand')}/>}
    {active && <div className={`results-layout ${!results && selected ? 'direct-reader' : ''}`}>
      <section className="results-column" aria-labelledby="results-heading"><div className="results-heading"><div><p className="eyebrow">{results ? 'DISCOVERY' : 'YOUR SEARCH'}</p><h2 id="results-heading" ref={resultRef} tabIndex={-1}>{results ? project ? (pageRequest?.source === 'mcp' ? 'MCP servers to explore' : pageRequest?.source === 'all' ? 'Integrations to explore' : 'APIs to explore') : `Possibilities for “${results.query}”` : selected ? 'Start with what you know.' : searching ? 'Finding your building blocks…' : 'Refine your search phrases'}</h2></div>{results && <span className="result-count">{results.pagination.matchesInLoadedMetadata} matches</span>}</div>
      {searching && <Loading text={aiOptions.ai && !project ? "Understanding your request, then searching directories…" : "Searching public directories…"}/>}
      {results && <><div className="results-context"><span><GlobeHemisphereWest size={14}/>{sourceNames[pageRequest.source]}</span><span>Relevance, not a fit score</span></div>{unavailable.map(source => <Notice key={source.kind} error>{source.kind === 'api' ? 'API directory' : 'MCP Registry'} unavailable: {source.error.message}</Notice>)}{results.sources.filter(source => source.partial).map(source => <Notice key={source.kind}>{source.warning} Loaded results are shown; coverage is incomplete.</Notice>)}{results.items.length ? <div className={searching ? 'results-list is-refreshing' : 'results-list'} aria-busy={searching}>{results.items.map(item => <ResultRow key={item.id} item={item} selected={selected?.id === item.id} saved={saved.some(other => other.id === item.id)} onSelect={select} onSave={save}/>)}</div> : <div className="no-results"><EmptyArt/><h3>No matches in this source view.</h3><p>Try a shorter phrase, another source, or a public documentation link. No match doesn’t mean the API doesn’t exist.</p><button className="button secondary" onClick={() => changeMode('understand')}><LinkSimple size={17}/>Try a documentation link</button></div>}
      <div className="pagination"><button className="button secondary" disabled={!history.length || searching} onClick={() => search(history.at(-1), 'back')}><ArrowLeft size={16}/>Previous</button><span>{results.items.length ? `${results.pagination.offset + 1}–${results.pagination.offset + results.items.length}` : '0'} of {results.pagination.matchesInLoadedMetadata} in this view</span>{results.pagination.nextOffset !== null ? <button className="button secondary" disabled={searching} onClick={() => search({ ...pageRequest, offset: results.pagination.nextOffset }, 'next')}>Next <ArrowRight size={16}/></button> : results.pagination.nextMcpCursor ? <button className="button secondary" disabled={searching} onClick={() => search({ ...pageRequest, source: 'mcp', mcpCursor: results.pagination.nextMcpCursor, offset: 0 }, 'next')}>Next registry batch <ArrowRight size={16}/></button> : <span className="pagination-end">End of this view</span>}</div>
      <details className="source-details"><summary><Info size={15}/>What did we search?</summary><div>{results.sources.map(source => <p key={source.kind}><strong>{source.kind === 'api' ? 'APIs.guru' : 'MCP Registry'}</strong> — {source.status === 'available' ? `${source.loadedRecords.toLocaleString()} records loaded` : 'Unavailable'}{source.kind === 'mcp' && ` across ${source.pagesLoaded || 0} registry pages. Only this batch was searched; use the next registry batch when available.`}</p>)}{results.ignoredModifiers?.length > 0 && <p>To keep results on-topic, these broad words were excluded from retrieval: {results.ignoredModifiers.join(', ')}. They remain in your requirements for assessment.</p>}<p>API results use preferred versions in the loaded directory. This is not an exhaustive web search. Directory matching happens locally; with AI enabled, your project request is sent to Anthropic to suggest requirements and search phrases.</p></div></details></>}
      {!results && selected && <div className="direct-context"><EmptyArt/><h3>One link. A clearer picture.</h3><p>We’ll separate documented capabilities from the questions that still need an answer.</p><button className="text-button" onClick={resetView}><ArrowLeft size={16}/>Back to discovery</button></div>}
      </section><Reader item={selected} analysis={analysis} loading={reading} error={readError} onRead={read} onClose={closeReader} onSave={save} saved={saved.some(item => item.id === selected?.id)} headingRef={headingRef}/>
    </div>}
    </main>
    <footer className="footer"><span><span className={`connection-dot ${backend}`} />{backend === 'online' ? 'Local workspace' : backend === 'checking' ? 'Connecting to your workspace' : 'Backend unavailable'}</span><span>Explore → Understand → Shortlist</span><button className="text-button" onClick={() => setDialog('help')}>Coverage & privacy <ArrowUpRight size={15}/></button></footer>
    {toast && <div className="toast" role="status"><Info size={17}/><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15}/></button></div>}
    {dialog === 'shortlist' && <Comparison saved={saved} onRemove={item => setSaved(current => current.filter(other => other.id !== item.id))} onClose={closeComparison} notify={notify} initialQuery={results?.query} draft={comparisonDraft} aiOptions={aiOptions} refreshAi={refreshAi}/>}
    {dialog === 'ai' && <AiControls status={aiStatus} enabled={aiEnabled} onEnabled={setAiEnabled} onRefresh={refreshAi} onClose={() => setDialog(null)}/>}
    {dialog === 'help' && <Dialog title="A clearer path from idea to API." onClose={() => setDialog(null)}><div className="how-steps"><div><span>01</span><section><h3>Follow the idea</h3><p>Search by keyword, or turn on AI to describe your project. Review the requirements inline and refine the suggested search phrases. The results are leads, not verified recommendations.</p></section></div><div><span>02</span><section><h3>Look under the hood</h3><p>Read a public specification to explore operations, inputs and outputs. Ordinary docs currently provide text excerpts.</p></section></div><div><span>03</span><section><h3>Keep the promising ones</h3><p>Shortlist up to five options, confirm what matters to your project, then take an evidence brief into your next discussion.</p></section></div></div><Notice>Optional AI assistance interprets your search request, explains documentation and assesses confirmed requirements. Turn it on using the AI control. Without it, fit stays unknown. Executable integrations are outside APIFit’s scope.</Notice><h3 className="help-subtitle">Your workspace, your control.</h3><p className="muted">Search phrases are matched locally against public directory metadata. Opening documentation contacts that public host. Private backend records expire after 15 minutes; shortlist selections stay in this browser tab until you reload or clear them. No integration-provider API keys are collected. With AI on, project requirements and selected documentation are sent to Anthropic; see the AI control for consent, retention and budget details. Only your colour palette and light/dark preference are saved in browser storage.</p><p className="muted">MCP search covers one page per keyword search, or up to three per expanded search. Continue through additional batches for more coverage. A listing does not certify safety, capabilities or your account permissions.</p><div className="help-sources"><ExternalLink href="https://apis.guru/api-doc">APIs.guru</ExternalLink><ExternalLink href="https://modelcontextprotocol.io/registry/about">MCP Registry</ExternalLink></div><button className="text-button clear-session" onClick={clearSession}><Trash size={16}/>Clear this local session</button></Dialog>}
  </div>;
}
