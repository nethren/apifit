import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, ArrowUpRight, BookmarkSimple, MagnifyingGlass, LinkSimple, X, Command, Check, DownloadSimple, Info, CircleNotch, FileText } from '@phosphor-icons/react';
import { api, host, readableDate } from './api.mjs';
import { Mark } from './Artwork.jsx';
import { ConnectorScene, DiscoveryStudio } from './DiscoveryStudio.jsx';
import { Dialog, ExternalLink, Loading, Notice, Avatar } from './components.jsx';
import { PalettePreview } from './PalettePreview.jsx';
import { AiControls } from './AiControls.jsx';
import { mergeOptions, shortlistKey, explanationKey, documentationSelection, hasDocumentation } from './search-state.mjs';
import { exportHandoff } from '../shared/brief-export.mjs';

const sourceNames = { api: 'APIs', mcp: 'MCP servers', all: 'All sources' };

function SourceQuotes({ statements }) {
  const quotes = [...new Map(statements.flatMap(s => s.citations || []).map(c => [c.evidenceId, c])).values()];
  return quotes.length > 0 && <details className="simple-evidence"><summary>See source evidence</summary>{quotes.map((quote, i) => <blockquote key={i}>{quote.quote}</blockquote>)}</details>;
}

function GoalExplanation({ explanation, query, kind }) {
  return <div className="goal-explanation">
    {!explanation.capabilities.length ? <p className="explanation-empty">{explanation.generation === 'skipped-no-usable-evidence' ? 'We couldn’t find readable capability details in the available sources. No AI credits were used.' : explanation.sourceFit === 'unclear' ? 'The available sources don’t establish what this integration can do.' : 'The source doesn’t establish a useful capability for your request.'}</p>
      : <div className="capability-stories">{explanation.capabilities.map((capability, i) => <div className="capability-story" key={i}><h4>{capability.title}</h4><p>{capability.does}</p><p className="capability-application"><ArrowRight size={17} aria-hidden="true"/><span><span className="application-label">{query ? 'For your idea' : 'A possible use'}</span>{capability.helps}</span></p></div>)}</div>}
    {explanation.capabilities.length > 0 && explanation.checks.length > 0 && <div className="project-checks"><h4>Before you rely on it</h4><ul>{explanation.checks.map((check, i) => <li key={i}>{check}</li>)}</ul></div>}
  </div>;
}

function ExplanationSource({ source, explanation, note }) {
  if (!explanation.capabilities.length) return null;
  return <div className="explanation-source"><p className="summary-source">{source.evidenceLevel === 'server-declared-tool-metadata' ? 'Based on server tool descriptions · No tools were run' : 'Based on documentation · Not live-tested'} · {readableDate(source.fetchedAt)}</p>{note && <p className="source-note">{note}</p>}
    <SourceQuotes statements={explanation.capabilities}/>
  </div>;
}

function UnverifiedSelections({ items }) {
  return items?.length > 0 && <div className="project-checks"><h4>Not included in this build plan</h4><ul>{items.map((item, i) => <li key={i}><strong>{item.name || 'Selected integration'}</strong>: capabilities couldn’t be verified.</li>)}</ul></div>;
}

export default function SearchApp() {
  const [mode, setMode] = useState('find');
  const [inputs, setInputs] = useState({ find: '', understand: '' });
  const [scope, setScope] = useState('api');
  const [result, setResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [saved, setSaved] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailReturn, setDetailReturn] = useState(null);
  const [summary, setSummary] = useState(null);
  const [generating, setGenerating] = useState('');
  const [actionError, setActionError] = useState('');
  const [brief, setBrief] = useState(null);
  const [toast, setToast] = useState('');
  const [backend, setBackend] = useState('checking');
  const [aiStatus, setAiStatus] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiContext, setAiContext] = useState('');
  const inputRef = useRef(null); const resultsRef = useRef(null); const searchAbort = useRef(null); const actionAbort = useRef(null);
  const pendingAi = useRef(null); const summaries = useRef(new Map()); const toastTimer = useRef(null);
  const aiOptions = aiEnabled && aiStatus?.ready ? { ai: true, aiConsent: aiStatus.consentVersion } : {};
  const active = Boolean(result || searching);

  async function refreshAi() { try { const status = await api('/ai/status'); setAiStatus(status); if (!status.ready) setAiEnabled(false); } catch { setAiStatus(null); setAiEnabled(false); } }
  useEffect(() => {
    const controller = new AbortController();
    api('/health', undefined, { signal: controller.signal }).then(() => setBackend('online')).catch(error => { if (error.name !== 'AbortError') setBackend('offline'); });
    refreshAi();
    const keyboard = e => {
      document.documentElement.dataset.input = 'keyboard';
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' || e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.target.isContentEditable) && !document.querySelector('dialog[open]')) {
        e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select();
      }
    };
    const pointer = () => { document.documentElement.dataset.input = 'pointer'; };
    document.addEventListener('keydown', keyboard); document.addEventListener('pointerdown', pointer);
    return () => { controller.abort(); searchAbort.current?.abort(); actionAbort.current?.abort(); clearTimeout(toastTimer.current); document.removeEventListener('keydown', keyboard); document.removeEventListener('pointerdown', pointer); };
  }, []);
  function notify(message) { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 3500); }
  function save(item) {
    if (saved.some(other => other.id === item.id)) { setSaved(current => current.filter(other => other.id !== item.id)); notify('Removed from shortlist.'); }
    else if (saved.length >= 5) return notify('Your shortlist holds five integrations. Remove one to add another.');
    else { setSaved(current => [...current, item]); notify('Added to shortlist.'); }
    setBrief(null);
  }
  function closeAction() { actionAbort.current?.abort(); setGenerating(''); setActionError(''); setDialog(dialog === 'summary' ? detailReturn : null); }
  function withAi(context, action) {
    if (aiOptions.ai) return action(aiOptions);
    pendingAi.current = action; setAiContext(context); refreshAi(); setDialog('ai');
  }
  function finishAi() { const action = pendingAi.current; pendingAi.current = null; setDialog(null); if (aiOptions.ai && action) action(aiOptions); }

  async function search(query, source = scope, more = false, options = aiOptions) {
    searchAbort.current?.abort(); const controller = new AbortController(); searchAbort.current = controller;
    setSearching(true); setSearchError('');
    if (!more) { setBrief(null); setResult(null); }
    try {
      const data = await api(more ? `/discover/${result.id}/more` : '/discover', more ? options : { query, source, ...options }, { signal: controller.signal });
      if (controller.signal.aborted || searchAbort.current !== controller) return;
      setResult(current => more ? { ...data, items: mergeOptions(current.items, data.items) } : data);
      if (!more) setScope(source);
      requestAnimationFrame(() => resultsRef.current?.focus({ preventScroll: true }));
    } catch (error) { if (error.name !== 'AbortError') setSearchError(error.message); }
    finally { if (searchAbort.current === controller) setSearching(false); refreshAi(); }
  }
  async function explain(item, returnTo = null) {
    setDetail(item); setDetailReturn(returnTo); setActionError('');
    const query = result?.query || '';
    const key = explanationKey(query, item);
    if (summaries.current.has(key)) { setSummary(summaries.current.get(key)); setDialog('summary'); return; }
    if (!hasDocumentation(item)) { setSummary(null); setDialog('summary'); setActionError('This listing has no documentation link to explain.'); return; }
    withAi(`Explain how ${item.name || 'this integration'} could help${query ? ' with your idea' : ''}. We read public documentation or MCP tool descriptions first. A paid AI request is made only if we find usable capability details.`, async options => {
      actionAbort.current?.abort(); const controller = new AbortController(); actionAbort.current = controller;
      setSummary(null); setDialog('summary'); setGenerating(query ? 'Reading the docs for the parts that could help your idea…' : 'Reading the docs for useful capabilities…');
      try {
        const data = await api('/summaries', { query, integration: documentationSelection(item), ...options }, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (summaries.current.size >= 30) summaries.current.delete(summaries.current.keys().next().value);
        summaries.current.set(key, data); setSummary(data);
      } catch (error) { if (error.name !== 'AbortError') setActionError(error.message); }
      finally { if (actionAbort.current === controller) setGenerating(''); refreshAi(); }
    });
  }
  function generateBrief() {
    const integrations = saved.filter(hasDocumentation).map(documentationSelection);
    const query = result?.query || inputs.find.trim() || 'Build a product using the selected integrations.';
    const key = shortlistKey(query, saved);
    if (brief?.key === key) { setDialog('brief'); return; }
    withAi('Write a build brief from your search and shortlist. We check the available sources first, then make one paid AI request for integrations with usable capability details.', async options => {
      actionAbort.current?.abort(); const controller = new AbortController(); actionAbort.current = controller;
      setBrief(null); setDialog('brief'); setGenerating('Gathering the docs and preparing your build brief…'); setActionError('');
      try {
        const data = await api('/build-briefs', { query, integrations, unlinked: saved.filter(item => !hasDocumentation(item)).map(item => item.name), ...options }, { signal: controller.signal });
        if (!controller.signal.aborted) setBrief({ ...data, key });
      } catch (error) { if (error.name !== 'AbortError') setActionError(error.message); }
      finally { if (actionAbort.current === controller) setGenerating(''); refreshAi(); }
    });
  }
  async function downloadBrief() {
    try {
      const url = URL.createObjectURL(new Blob([exportHandoff(brief)], { type: 'text/markdown;charset=utf-8' })); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'apifit-build-brief.md'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setActionError(error.message); }
  }
  function submit(e) {
    e.preventDefault(); const value = inputs[mode].trim(); if (!value) return inputRef.current?.focus();
    if (mode === 'understand' || /^https?:\/\//i.test(value)) {
      if (!/^https:\/\//i.test(value)) return setSearchError('Use a public HTTPS documentation link. Never paste API keys.');
      explain({ id: `document:${value}`, name: '', provider: host(value), kind: 'unknown', specificationUrl: value });
    } else search(value);
  }
  function startExample(query) { setMode('find'); setInputs(current => ({ ...current, find: query })); search(query, 'api'); }
  function reset() { searchAbort.current?.abort(); setSearching(false); setResult(null); setSearchError(''); setInputs({ find: '', understand: '' }); setMode('find'); inputRef.current?.focus(); }

  return <div className={`app simple-app ${active ? 'has-results' : 'welcome'}`}>
    <a className="skip-link" href="#main">Skip to search</a>
    <header className="topbar"><button className="brand" onClick={reset} aria-label="APIFit, start a new search"><Mark/><span>api<span className="brand-fit">fit</span><span className="brand-dot">.</span></span></button><PalettePreview/><nav aria-label="Workspace"><button className="nav-link ai-toggle" onClick={() => { pendingAi.current = null; setAiContext(''); refreshAi(); setDialog('ai'); }}>AI {aiEnabled ? 'on' : 'off'}</button><button className="nav-link" onClick={() => setDialog('help')}>How it works</button><button className="shortlist-nav" aria-label={`Shortlist ${saved.length}`} onClick={() => setDialog('shortlist')}><BookmarkSimple size={18} weight={saved.length ? 'fill' : 'regular'}/><span className="shortlist-label">Shortlist</span><span className="count">{saved.length}</span></button></nav></header>
    <main id="main">
      <section className="search-stage" aria-labelledby="search-title">
        {!active ? <div className="welcome-heading"><div className="welcome-copy"><h1 id="search-title">Find your API.<br/><span>Build your idea.</span></h1><p>Tell us what you’re building.<br/>Find the right tools for it.</p></div><ConnectorScene source={scope} mode={mode}/></div> : <h1 id="search-title" className="sr-only">Find APIs for your project</h1>}
        <div className="search-workspace"><div className="entry-modes" aria-label="Choose what to do"><button type="button" aria-pressed={mode === 'find'} onClick={() => { setMode('find'); inputRef.current?.focus(); }}><MagnifyingGlass size={17}/>Find an API</button><button type="button" aria-pressed={mode === 'understand'} onClick={() => { setMode('understand'); inputRef.current?.focus(); }}><LinkSimple size={17}/>Understand an API</button></div>
          <form className="search-box" onSubmit={submit}><div className="query-line"><MagnifyingGlass className="query-icon" size={23}/><label className="sr-only" htmlFor="api-query">{mode === 'find' ? 'What do you want to build?' : 'Public documentation URL'}</label><input ref={inputRef} id="api-query" value={inputs[mode]} onChange={e => setInputs(current => ({ ...current, [mode]: e.target.value }))} placeholder={mode === 'find' ? 'What will you build?' : 'Paste a public documentation link'} maxLength={mode === 'find' ? 1000 : 4096} autoComplete="off" spellCheck={false}/>{inputs[mode] && <button type="button" className="icon-button" aria-label="Clear search input" onClick={() => { setInputs(current => ({ ...current, [mode]: '' })); inputRef.current?.focus(); }}><X size={18}/></button>}<kbd className="shortcut"><Command size={12}/>K</kbd></div>
            <div className="search-bottom">{mode === 'find' ? <div className="scope-control" aria-label="Search source">{Object.entries(sourceNames).map(([key, label]) => <button key={key} type="button" aria-pressed={scope === key} onClick={() => setScope(key)}>{label}</button>)}</div> : <span className="url-note"><FileText size={15}/>A public documentation link</span>}{searching ? <button className="button secondary search-submit" type="button" onClick={() => { searchAbort.current?.abort(); setSearching(false); }}><CircleNotch className="spinner" size={17}/>Cancel</button> : <button className="button primary search-submit" type="submit">{mode === 'find' ? 'Find APIs' : 'Explain simply'}<ArrowRight size={18}/></button>}</div>
          </form>
          <div className="search-guidance"><span>{mode === 'understand' ? 'A short explanation, generated only when you ask.' : aiOptions.ai ? 'Ranked for your request. No forms to fill in.' : 'Keyword search. Turn AI on for smarter matching.'}</span><button className="search-explainer" type="button" onClick={() => setDialog('help')}><Info size={16}/>{aiOptions.ai ? 'How ranking works' : 'How it works'}</button></div>
        </div>
        {searchError && <Notice error>{searchError}{aiOptions.ai && <button className="text-button" onClick={() => search(inputs.find.trim(), scope, false, {})}>Try keyword search without AI</button>}</Notice>}
        {backend === 'offline' && <Notice error>APIFit’s local backend is unavailable.</Notice>}
      </section>
      {!active && <DiscoveryStudio onSearch={startExample} onUnderstand={() => { setMode('understand'); inputRef.current?.focus(); }}/>}
      {active && <section className="ranked-results" aria-labelledby="results-heading">
        <div className="ranked-heading"><div><h2 ref={resultsRef} tabIndex={-1} id="results-heading">{result ? 'Your API options' : 'Finding your API options…'}</h2>{result && <p>{result.ranking.mode === 'ai-ranked-directory-leads' ? 'Closest matches first' : 'Keyword matches'} · {result.items.length} {result.items.length === 1 ? 'option' : 'options'}</p>}</div>{saved.length > 0 && <button className="button secondary" onClick={() => setDialog('shortlist')}>View shortlist ({saved.length})<ArrowRight size={17}/></button>}</div>
        {searching && <Loading text={aiOptions.ai ? 'Finding and sorting the most relevant options…' : 'Searching public directories…'}/>}
        {result && <>
          {!result.items.length && result.uncovered?.length > 0 && <p className="search-gap"><Info size={17}/><span>{result.uncovered[0]}</span></p>}
          {result.sources.filter(source => source.status === 'unavailable' || source.partial).map(source => <Notice key={source.kind} error>{source.kind === 'mcp' ? 'MCP Registry' : 'API directory'}: {source.error?.message || source.warning}</Notice>)}
          <div className={searching ? 'ranked-list is-refreshing' : 'ranked-list'} aria-busy={searching}>{result.items.map((item, index) => {
            const isSaved = saved.some(other => other.id === item.id);
            return <article className="ranked-option" key={item.id}><span className="option-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><Avatar item={item}/><div className="option-copy">
              <h3>{item.documentationUrl || item.specificationUrl ? <ExternalLink href={item.documentationUrl || item.specificationUrl}>{item.name}</ExternalLink> : item.name}</h3>
              <p className="option-provider">{item.provider} · {item.kind === 'mcp' ? 'MCP server' : 'API'}</p><p className="option-reason">{item.match?.reason || (item.matchedTerms?.length ? `Related to ${item.matchedTerms.slice(0, 3).join(', ')}.` : 'Explore this API for your project.')}</p>{item.match?.gap && <p className="option-gap">{item.match.gap}</p>}</div><div className="option-actions"><button className={`button ${isSaved ? 'secondary saved' : 'secondary'}`} aria-pressed={isSaved} aria-label={`${isSaved ? 'Remove' : 'Add'} ${item.name} ${isSaved ? 'from' : 'to'} shortlist`} onClick={() => save(item)}>{isSaved ? <Check size={17}/> : <BookmarkSimple size={17}/>} {isSaved ? 'Saved' : 'Shortlist'}</button><button className="text-button" onClick={() => explain(item)} aria-label={`Explain ${item.name} simply`}>Explain simply<ArrowUpRight size={16}/></button></div></article>;
          })}</div>
          {!result.items.length && !searching && <div className="simple-empty"><MagnifyingGlass size={30}/><h3>No convincing match in these listings.</h3><p>Try a broader capability, search more entries, or bring a documentation link.</p></div>}
          <div className="ranked-footer"><button className="text-button" onClick={() => setDialog('coverage')}>Sources & ranking <Info size={16}/></button>{result.nextRequest && <button className="button secondary" disabled={searching} onClick={() => search(result.query, scope, true)}>Find more options<ArrowRight size={17}/></button>}</div>
        </>}
      </section>}
    </main>
    <footer className="footer"><span><span className={`connection-dot ${backend}`}/>Workspace</span><span>Find → Shortlist → Build</span><button className="text-button" onClick={() => setDialog('help')}>About APIFit<ArrowUpRight size={15}/></button></footer>
    {toast && <div className="toast" role="status"><Check size={17}/><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15}/></button></div>}
    {dialog === 'ai' && <AiControls context={aiContext} status={aiStatus} enabled={aiEnabled} onEnabled={setAiEnabled} onRefresh={refreshAi} onDone={finishAi} onClose={() => { pendingAi.current = null; setDialog(null); }}/>}
    {dialog === 'shortlist' && <Dialog title="Your shortlist" onClose={() => setDialog(null)}>
      {saved.length ? <><p className="dialog-intro">Your picks. Ready when you are.</p><div className="simple-shortlist">{saved.map(item => <div key={item.id}><Avatar item={item}/><div><h3>{item.name}</h3><button className="text-button" onClick={() => explain(item, 'shortlist')}>Explain simply<ArrowUpRight size={15}/></button></div><button className="icon-button" aria-label={`Remove ${item.name}`} onClick={() => save(item)}><X size={19}/></button></div>)}</div><div className="brief-invitation"><h3>Ready to build?</h3><p>See how your shortlisted APIs and MCP servers could help build your idea, and what still needs checking.</p><button className="button primary" onClick={generateBrief} disabled={!saved.some(hasDocumentation)}>{brief ? 'View build brief' : 'Generate build brief'}<ArrowRight size={17}/></button><span>{saved.some(hasDocumentation) ? 'Optional AI request. Shortlisting is free.' : 'A public documentation link is needed to generate a brief.'}</span></div></> : <div className="simple-empty"><BookmarkSimple size={32}/><h3>Keep the APIs you like.</h3><p>Use “Shortlist” on any result. No extra checks or setup.</p><button className="button primary" onClick={() => setDialog(null)}>Back to results<ArrowRight size={17}/></button></div>}
    </Dialog>}
    {dialog === 'summary' && detail && <Dialog title={summary?.title || detail.name || 'Your documentation'} onClose={closeAction}>
      {generating && <Loading text={generating}/>}{actionError && <Notice error>{actionError}</Notice>}
      {summary && <div className="plain-summary"><div className="explanation-heading"><span className="integration-type">{summary.integrationKind === 'mcp' ? 'MCP server' : summary.integrationKind === 'api' ? 'API' : 'Integration'}</span><h3>{!summary.summary.capabilities.length ? 'Capabilities couldn’t be verified' : summary.query ? 'How it could help your idea' : 'What you could build with it'}</h3></div>{summary.query && summary.summary.capabilities.length > 0 && <details className="request-context"><summary>Your request</summary><p>{summary.query}</p></details>}<GoalExplanation explanation={summary.summary} query={summary.query} kind={summary.integrationKind}/><ExplanationSource source={summary.source} explanation={summary.summary} note={summary.documentationNote}/></div>}
      <div className="dialog-footer"><button className="button secondary" onClick={() => save({ ...detail, name: detail.name || summary?.title || 'Documentation' })}>{saved.some(item => item.id === detail.id) ? <Check size={17}/> : <BookmarkSimple size={17}/>} {saved.some(item => item.id === detail.id) ? 'Saved' : 'Shortlist'}</button><ExternalLink href={summary?.source.evidenceLevel === 'server-declared-tool-metadata' ? detail.repositoryUrl || detail.documentationUrl || summary.source.url : summary?.source.url || detail.repositoryUrl || detail.documentationUrl || detail.specificationUrl}>{summary?.summary.capabilities.length ? 'View source' : 'Open listed source'}</ExternalLink></div>
    </Dialog>}
    {dialog === 'brief' && <Dialog title="Your build brief" onClose={closeAction} wide>
      {generating && <Loading text={generating}/>}{actionError && <Notice error>{actionError}</Notice>}
      {brief && !generating && <div className="build-brief"><div className="brief-goal"><h3>Your idea</h3><p className="brief-project">{brief.query}</p></div>{brief.integrations.map((item, i) => <section key={i}><span className="integration-type">{item.integrationKind === 'mcp' ? 'MCP server' : item.integrationKind === 'api' ? 'API' : 'Integration'}</span><h3>{item.title}</h3><GoalExplanation explanation={item} query={brief.query} kind={item.integrationKind}/><ExplanationSource source={item.source} explanation={item} note={item.documentationNote}/><ExternalLink href={item.source.url}>Read documentation</ExternalLink></section>)}<UnverifiedSelections items={brief.unreadable}/><details className="brief-next-steps"><summary>Before development starts</summary><ol>{brief.nextSteps.map((step, i) => <li key={i}>{step}</li>)}</ol></details><p className="summary-source">Possible uses, not a tested build plan. Check access, pricing and reliability before building.</p><div className="dialog-footer"><button className="button secondary" onClick={() => setDialog('shortlist')}><ArrowLeft size={17}/>Your shortlist</button><button className="button primary" onClick={downloadBrief}><DownloadSimple size={18}/>Download brief</button></div></div>}
    </Dialog>}
    {(dialog === 'help' || dialog === 'coverage') && <Dialog title={dialog === 'coverage' ? 'Sources & ranking' : 'From idea to API'} onClose={() => setDialog(null)}>
      <div className="simple-help"><h3>Search. Save. Build.</h3><p>Describe your idea. With AI on, APIFit sorts directory entries for relevance and highlights important gaps. Save the options you like—no requirement form or assessment step.</p><p>“Explain simply” reads an API’s or MCP server’s documentation to show what it could do for your idea. It only generates when requested. Your shortlist can become a build brief whenever you need one.</p><h3>What ranking can tell you</h3><p>Matching core capabilities comes first; linked specifications and documentation help order similar leads. We haven’t measured uptime or verified provider reliability. A high position is not proof that every requirement is met.</p>{result?.sources.map(source => <p key={source.kind}>{source.kind === 'api' ? 'APIs.guru' : 'MCP Registry'}: {source.loadedRecords || 0} listings loaded{source.kind === 'mcp' ? ` across ${source.pagesLoaded || 0} pages` : ''}.</p>)}<p>AI reviews up to 24 candidate listings per batch and returns at most 12 useful options. “Find more options” reviews another batch and uses AI credits when AI is on. This isn’t an exhaustive web search.</p><h3>Your data</h3><p>Searches, summaries and shortlist stay in this tab. Server records expire after 15 minutes. With AI on, your request and selected source text go to Anthropic. No API keys are collected and no API or MCP tool is run. Only appearance preferences are saved in browser storage.</p></div>
    </Dialog>}
  </div>;
}
