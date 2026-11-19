import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookmarkSimple, MagnifyingGlass, LinkSimple, X, PencilSimple, Sparkle, BracketsCurly, Plug, CheckCircle, MinusCircle, PuzzlePiece, CircleNotch, Info, ArrowUpRight, WarningCircle } from '@phosphor-icons/react';
import { api, host } from './api.mjs';
import { aiUnavailable, discoverWithFallback } from './discovery-request.mjs';
import { Mark } from './Artwork.jsx';
import { Dialog, ExternalLink } from './components.jsx';
import { PalettePreview } from './PalettePreview.jsx';
import { AiPopover, AllowanceRing } from './AiControls.jsx';
import { StartTiles, SearchingBay } from './Home.jsx';
import { Avatar, ConceptIcon, Coverage, Ladder, evidenceFrom, evidenceLevel, parseQuery } from './signal-parts.jsx';
import { ExplainSheet, ShortlistPanel, BriefView, Sheet } from './Panels.jsx';
import { mergeOptions, shortlistKey, explanationKey, documentationSelection, hasDocumentation } from './search-state.mjs';
import { exportHandoff } from '../shared/brief-export.mjs';

const scopes = [['api', 'APIs', BracketsCurly], ['mcp', 'MCP', Plug], ['all', 'Both', null]];
const isLink = value => /^https?:\/\//i.test(value.trim());

function ParsedQuery({ query, concepts, keywords }) {
  return <h1 className={`parsed ${concepts.length ? 'with-icons' : ''}`} id="results-title" tabIndex={-1}>{parseQuery(query, concepts, keywords).map((part, i) => part.concept
    ? <span key={i} className="c" title={part.concept.label}>{part.first && <ConceptIcon icon={part.concept.icon} size={20}/>}{part.text}</span>
    : part.keyword ? <span key={i} className="k">{part.text}</span> : <span key={i} className="w">{part.text}</span>)}</h1>;
}

function ResultRow({ item, index, concepts, saved, level, onSave, onExplain }) {
  const [open, setOpen] = useState(false);
  const reason = item.match?.reason; const gap = item.match?.gap;
  return <li className={`row ${open ? 'open' : ''}`}>
    <div className="row-main">
      <span className="rank" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><Avatar item={item}/>
      <button type="button" className="nm" aria-expanded={open} aria-controls={`why-${index}`} onClick={() => setOpen(!open)}><b>{item.name}</b><small>{item.provider} · {item.kind === 'mcp' ? 'MCP' : 'API'}</small></button>
      <Coverage concepts={concepts} covers={item.match?.covers} keywords={concepts.length ? null : item.matchedTerms}/>
      <span className="lad" data-tip={['Listed', 'Docs read', 'Quotes checked'][level - 1]}><Ladder level={level}/></span>
      <span className="acts">
        <button type="button" className={`ib press ${saved ? 'saved' : ''}`} aria-pressed={saved} aria-label={`${saved ? 'Remove' : 'Shortlist'} ${item.name}`} onClick={() => onSave(item)}><BookmarkSimple size={19} weight={saved ? 'fill' : 'light'}/></button>
        <button type="button" className="explain-btn press" aria-label={`Explain ${item.name}`} onClick={() => onExplain(item)}><Sparkle size={17} weight="light" aria-hidden="true"/><span className="t">Explain</span></button>
      </span>
    </div>
    <div className="more" id={`why-${index}`}><div>
      {reason ? <p className="fit"><CheckCircle size={18} weight="light" aria-hidden="true"/>{reason}</p>
        : <p className="fit"><Info size={18} weight="light" aria-hidden="true"/>{item.matchedTerms?.length ? `Keyword match on ${item.matchedTerms.slice(0, 3).join(', ')}. Explain it to see what it can do.` : 'Listed in a public directory. Explain it to see what it can do.'}</p>}
      {gap && <p className="gap"><MinusCircle size={18} weight="light" aria-hidden="true"/>{gap}</p>}
    </div></div>
  </li>;
}

export default function SearchApp() {
  const [input, setInput] = useState('');
  const [scope, setScope] = useState('api');
  const [view, setView] = useState('home');
  const [result, setResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchNotice, setSearchNotice] = useState('');
  const [saved, setSaved] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailReturn, setDetailReturn] = useState(null);
  const [summary, setSummary] = useState(null);
  const [evidence, setEvidence] = useState({});
  const [generating, setGenerating] = useState('');
  const [actionError, setActionError] = useState('');
  const [brief, setBrief] = useState(null);
  const [toast, setToast] = useState(null);
  const [backend, setBackend] = useState('checking');
  const [aiStatus, setAiStatus] = useState(null);
  const [aiIssue, setAiIssue] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiContext, setAiContext] = useState('');
  const [popOpen, setPopOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const inputRef = useRef(null); const resultsRef = useRef(null); const aiChip = useRef(null); const searchAbort = useRef(null); const actionAbort = useRef(null);
  const pendingAi = useRef(null); const summaries = useRef(new Map()); const toastTimer = useRef(null);
  const aiOptions = aiEnabled && aiStatus?.ready ? { ai: true, aiConsent: aiStatus.consentVersion } : {};
  const concepts = result?.concepts || [];
  const link = isLink(input);

  async function refreshAi() { try { setAiStatus(await api('/ai/status')); } catch { setAiStatus(null); } }
  useEffect(() => {
    const controller = new AbortController();
    api('/health', undefined, { signal: controller.signal }).then(() => setBackend('online')).catch(error => { if (error.name !== 'AbortError') setBackend('offline'); });
    refreshAi();
    const keyboard = e => {
      document.documentElement.dataset.input = 'keyboard';
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' || e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.target.isContentEditable) && !document.querySelector('dialog[open]')) {
        e.preventDefault(); setView('home'); requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
      }
    };
    const pointer = () => { document.documentElement.dataset.input = 'pointer'; };
    document.addEventListener('keydown', keyboard); document.addEventListener('pointerdown', pointer);
    return () => { controller.abort(); searchAbort.current?.abort(); actionAbort.current?.abort(); clearTimeout(toastTimer.current); document.removeEventListener('keydown', keyboard); document.removeEventListener('pointerdown', pointer); };
  }, []);
  function notify(text, item = null) { setToast({ text, item }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2200); }
  // Coverage IDs belong to the search they came from; never reuse them for another query's concepts.
  const withCoverage = item => ({ ...item, match: item.match && { ...item.match, covers: item.savedFor === result?.query ? item.match.covers || [] : [] } });
  function save(item) {
    if (saved.some(other => other.id === item.id)) { setSaved(current => current.filter(other => other.id !== item.id)); notify('Removed', item); }
    else if (saved.length >= 5) return notify('Your shortlist holds five. Remove one first.');
    else { setSaved(current => [...current, { ...item, savedFor: item.savedFor ?? result?.query }]); notify('Shortlisted', item); }
    setBrief(null);
  }
  function closeAction() { actionAbort.current?.abort(); setGenerating(''); setActionError(''); setSheet(sheet === 'explain' ? detailReturn : null); }
  function withAi(context, action) {
    if (aiOptions.ai) return action(aiOptions);
    pendingAi.current = action; setAiContext(context); refreshAi(); setPopOpen(true);
  }
  function finishAi() { const action = pendingAi.current; pendingAi.current = null; setPopOpen(false); setAiContext(''); if (aiOptions.ai && action) action(aiOptions); }
  function closePop() { pendingAi.current = null; setAiContext(''); setPopOpen(false); }
  function pauseUnavailableAi() {
    setAiEnabled(false);
    setAiIssue('AI is temporarily unavailable. Keyword search and your shortlist still work. Turn AI back on to retry.');
  }

  async function search(query, source = scope, more = false, options = aiOptions) {
    searchAbort.current?.abort(); const controller = new AbortController(); searchAbort.current = controller;
    setSearching(true); setSearchError(''); setSearchNotice(''); setView('results');
    if (!more) { setBrief(null); setResult(null); }
    try {
      const { data, fallback } = await discoverWithFallback(api, more ? `/discover/${result.id}/more` : '/discover', more ? options : { query, source, ...options }, { signal: controller.signal });
      if (controller.signal.aborted || searchAbort.current !== controller) return;
      if (fallback) { pauseUnavailableAi(); setSearchNotice('AI matching is unavailable right now. Showing keyword matches.'); }
      setResult(current => more ? { ...data, items: mergeOptions(current.items, data.items) } : data);
      if (!more) { setScope(source); requestAnimationFrame(() => resultsRef.current?.querySelector('#results-title')?.focus({ preventScroll: true })); }
    } catch (error) { if (error.name !== 'AbortError' && !controller.signal.aborted && searchAbort.current === controller) setSearchError(error.message); }
    finally { if (searchAbort.current === controller) setSearching(false); refreshAi(); }
  }
  function cancelSearch() { searchAbort.current?.abort(); setSearching(false); if (!result) setView('home'); }
  async function explain(item, returnTo = null) {
    setDetail(item); setDetailReturn(returnTo); setActionError('');
    const query = result?.query || '';
    const key = explanationKey(query, item);
    const listed = !String(item.id).startsWith('document:');
    if (summaries.current.has(key)) { setSummary(summaries.current.get(key)); setSheet('explain'); return; }
    if (!hasDocumentation(item)) { setSummary(null); setSheet('explain'); setActionError('This listing has no documentation link to explain.'); return; }
    withAi(`Explaining ${item.name || 'this link'} reads its public docs, then makes one paid AI request if they describe usable capabilities.`, async options => {
      actionAbort.current?.abort(); const controller = new AbortController(); actionAbort.current = controller;
      setSummary(null); setSheet('explain'); setGenerating(query ? 'Reading the docs for parts of your idea…' : 'Reading the docs for useful capabilities…');
      try {
        const data = await api('/summaries', { query, integration: documentationSelection(item), ...options }, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (summaries.current.size >= 30) summaries.current.delete(summaries.current.keys().next().value);
        summaries.current.set(key, data); setSummary(data); setEvidence(current => ({ ...current, [item.id]: evidenceFrom(data, listed) }));
      } catch (error) { if (error.name !== 'AbortError') { if (aiUnavailable(error)) { pauseUnavailableAi(); setActionError('AI explanations are unavailable right now. You can still open the source and keep your shortlist.'); } else setActionError(error.message); } }
      finally { if (actionAbort.current === controller) setGenerating(''); refreshAi(); }
    });
  }
  function generateBrief() {
    const picks = saved.filter(hasDocumentation).map(withCoverage);
    const integrations = picks.map(documentationSelection);
    const query = result?.query || input.trim() || 'Build a product using the selected integrations.';
    const key = shortlistKey(query, saved);
    setSheet(null);
    if (brief?.key === key) { setView('brief'); return; }
    withAi('A build brief reads the docs for your shortlist, then makes one paid AI request.', async options => {
      actionAbort.current?.abort(); const controller = new AbortController(); actionAbort.current = controller;
      setBrief(null); setView('brief'); setGenerating(`Reading the docs for ${picks.length} ${picks.length === 1 ? 'integration' : 'integrations'} and drafting your brief…`); setActionError('');
      try {
        const data = await api('/build-briefs', { query, integrations, unlinked: saved.filter(item => !hasDocumentation(item)).map(item => item.name), ...options }, { signal: controller.signal });
        if (!controller.signal.aborted) setBrief({ ...data, key, picks, concepts: result?.query === query ? concepts : [] });
      } catch (error) { if (error.name !== 'AbortError') { if (aiUnavailable(error)) { pauseUnavailableAi(); setActionError('Build briefs need AI, which is unavailable right now. Your shortlist is still here.'); } else setActionError(error.message); } }
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
    e.preventDefault(); const value = input.trim(); if (!value) return inputRef.current?.focus();
    if (isLink(value)) {
      if (!/^https:\/\//i.test(value)) return setSearchError('Use a public HTTPS documentation link. Never paste API keys.');
      setSearchError(''); explain({ id: `document:${value}`, name: '', provider: host(value), kind: 'unknown', specificationUrl: value });
    } else search(value);
  }
  function startExample(query) { setInput(query); search(query, scope); }
  function reset() { searchAbort.current?.abort(); setSearching(false); setResult(null); setSearchError(''); setSearchNotice(''); setInput(''); setView('home'); requestAnimationFrame(() => inputRef.current?.focus()); }
  function editSearch() { setView('home'); requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); }); }

  const listed = detail ? !String(detail.id).startsWith('document:') : true;
  const evidenceOf = item => evidence[item.id];
  const docsSaved = saved.some(hasDocumentation);
  const panel = compact => <ShortlistPanel compact={compact} concepts={concepts} saved={saved.map(withCoverage)} evidenceOf={evidenceOf} onRemove={save} onExplain={item => explain(item, compact ? 'shortlist' : null)} onBrief={generateBrief}
    canBrief={docsSaved && !generating} hint={!saved.length ? '' : docsSaved ? (aiOptions.ai ? 'One AI request. Shortlisting is free.' : 'Needs AI. Turn it on from the AI chip.') : 'Needs a result with a docs link.'}/>;
  const keywords = result && !concepts.length ? [...new Set(result.items.flatMap(item => item.matchedTerms || []))] : [];
  const issues = result?.sources?.filter(source => source.status === 'unavailable' || source.partial) || [];

  return <div className={`app view-${view}`}>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="top"><div className="wrap">
      <button type="button" className="brand press" onClick={reset} aria-label="APIFit, start a new search"><Mark/><span>api<b>fit</b><i>.</i></span></button>
      <nav aria-label="Workspace">
        <PalettePreview/>
        <button type="button" ref={aiChip} className="chip press" aria-haspopup="dialog" aria-expanded={popOpen} onClick={() => { if (popOpen) closePop(); else { refreshAi(); setPopOpen(true); } }}><AllowanceRing budget={aiStatus?.budget}/><span className="t">AI {aiOptions.ai ? 'on' : 'off'}</span><span className="sr-only">: open AI settings</span></button>
        <button type="button" className="chip press" aria-label={`Shortlist, ${saved.length} saved`} onClick={() => setSheet('shortlist')}><BookmarkSimple size={18} weight={saved.length ? 'fill' : 'light'} aria-hidden="true"/><span className="t">Shortlist</span><span className={`count ${saved.length ? '' : 'zero'}`} key={saved.length}>{saved.length}</span></button>
      </nav>
    </div></header>

    <main id="main" className="wrap">
      {view === 'home' && <section className="screen home" aria-labelledby="home-title">
        <div className="hero">
          <h1 id="home-title">Describe it.<br/><span>See what plugs in.</span></h1>
          <form className="search" onSubmit={submit} role="search">
            <div className="search-core">
              {link ? <LinkSimple size={24} weight="light" aria-hidden="true"/> : <MagnifyingGlass size={24} weight="light" aria-hidden="true"/>}
              <label className="sr-only" htmlFor="q">What are you building? Or paste a public docs link</label>
              <input ref={inputRef} id="q" value={input} onChange={e => setInput(e.target.value)} placeholder="What are you building?" maxLength={link ? 4096 : 1000} autoComplete="off" spellCheck={false} aria-describedby="search-privacy"/>
              {input && <button type="button" className="clear press" aria-label="Clear" onClick={() => { setInput(''); inputRef.current?.focus(); }}><X size={17}/></button>}
              {searching ? <button type="button" className="go press" onClick={cancelSearch}><span className="t">Cancel</span><span><CircleNotch className="spin" size={18}/></span></button>
                : <button type="submit" className="go press"><span className="t">{link ? 'Explain' : 'Find'}</span><span><ArrowRight size={18} weight="bold" aria-hidden="true"/></span></button>}
            </div>
            <div className="search-foot">
              {!link ? <div className="seg" role="group" aria-label="Search in">{scopes.map(([key, label, Icon]) => <button key={key} type="button" aria-pressed={scope === key} onClick={() => setScope(key)}>{Icon && <Icon size={16} weight="light" aria-hidden="true"/>}{label}</button>)}</div>
                : <span className="hint on"><LinkSimple size={15} weight="light" aria-hidden="true"/>Docs link: we’ll explain what it can do</span>}
              <span className="hint" id="search-privacy">{link ? '' : <><LinkSimple size={15} weight="light" aria-hidden="true"/>or paste a docs link</>}<span className="sr-only">{aiOptions.ai ? ' With AI on, your words go to Anthropic. Keep private details out.' : ''}</span></span>
            </div>
          </form>
          {searchError && view === 'home' && <p className="alert" role="alert"><WarningCircle size={18} aria-hidden="true"/>{searchError}</p>}
          {backend === 'offline' && <p className="alert" role="alert"><WarningCircle size={18} aria-hidden="true"/>Can’t reach APIFit. Check your connection, then reload.</p>}
        </div>
        <StartTiles onPick={startExample}/>
      </section>}

      {view === 'results' && <section className="screen results" aria-labelledby="results-title" ref={resultsRef}>
        <div className="qbar"><ParsedQuery query={result?.query || input} concepts={concepts} keywords={keywords}/><button type="button" className="edit press" aria-label="Edit search" onClick={editSearch}><PencilSimple size={19} weight="light"/></button></div>
        {searchNotice && <p className="note" role="status"><Info size={18} aria-hidden="true"/>{searchNotice}</p>}
        {searchError && <p className="alert" role="alert"><WarningCircle size={18} aria-hidden="true"/>{searchError}{aiOptions.ai && <button type="button" className="link" onClick={() => search(input.trim(), scope, false, {})}>Try keyword search</button>}</p>}
        {searching && !result && <SearchingBay query={input.trim()} source={scope} ai={Boolean(aiOptions.ai)} onCancel={cancelSearch}/>}
        {result && <div className="res">
          <div className="list-col">
            <div className="listhead"><span>{result.items.length ? `${result.items.length} ${result.items.length === 1 ? 'match' : 'matches'}, ${result.ranking.mode === 'ai-ranked-directory-leads' ? 'closest first' : 'keyword order'}` : 'No matches'}</span>
              <span className="legend">{concepts.length > 0 && <span data-tip="Which parts of your idea it matches"><PuzzlePiece size={16} weight="light" aria-hidden="true"/>Fit</span>}<span data-tip="Listed · Docs read · Quotes checked · You test"><Ladder level={1} small/>Evidence</span></span></div>
            {issues.map(source => <p key={source.kind} className="note"><Info size={18} aria-hidden="true"/>{source.kind === 'mcp' ? 'MCP Registry' : 'API directory'}: {source.error?.message || source.warning}</p>)}
            {!result.items.length && <div className="empty"><MagnifyingGlass size={30} weight="light" aria-hidden="true"/><h2>No convincing match in these listings.</h2><p>{result.uncovered?.[0] || 'Try a broader capability, another source, or paste a docs link.'}</p><button type="button" className="btn press" onClick={editSearch}><PencilSimple size={17} weight="light" aria-hidden="true"/>Edit search</button></div>}
            <ol className={`list ${searching ? 'refreshing' : ''}`} aria-busy={searching}>{result.items.map((item, index) => <ResultRow key={item.id} item={item} index={index} concepts={concepts} saved={saved.some(other => other.id === item.id)} level={evidenceLevel(evidenceOf(item))} onSave={save} onExplain={explain}/>)}</ol>
            {result.items.length > 0 && result.uncovered?.[0] && <p className="note quiet"><Info size={18} aria-hidden="true"/>{result.uncovered[0]}</p>}
            <div className="list-foot"><button type="button" className="link" onClick={() => setHelp('coverage')}>Sources & ranking<Info size={15} aria-hidden="true"/></button>{result.nextRequest && <button type="button" className="btn press" disabled={searching} onClick={() => search(result.query, scope, true)}>{searching ? <CircleNotch className="spin" size={17} aria-hidden="true"/> : null}Find more<ArrowRight size={17} aria-hidden="true"/></button>}</div>
          </div>
          <aside className="rail" aria-label="Shortlist coverage">{panel(false)}</aside>
        </div>}
      </section>}

      {view === 'brief' && <BriefView brief={brief} query={result?.query || input.trim()} concepts={brief?.concepts || []} picks={brief?.picks || []} generating={generating} error={actionError}
        onBack={() => { actionAbort.current?.abort(); setGenerating(''); setActionError(''); setView(result ? 'results' : 'home'); }} onDownload={downloadBrief}/>}
    </main>

    <footer className="foot wrap"><span><span className={`dot ${backend}`} aria-hidden="true"/>{backend === 'offline' ? 'Offline' : 'Find → Shortlist → Brief'}</span><button type="button" className="link" onClick={() => setHelp('about')}>About APIFit<ArrowUpRight size={14} aria-hidden="true"/></button></footer>

    {toast && <div className="toast" role="status">{toast.item && <Avatar item={toast.item} className="tiny"/>}{toast.text}</div>}
    {popOpen && <AiPopover anchor={aiChip} context={aiContext} status={aiStatus ? { ...aiStatus, issue: aiIssue } : null} enabled={aiEnabled} onEnabled={value => { setAiEnabled(value); if (value) setAiIssue(''); }} onClose={closePop} onContinue={finishAi}/>}
    {sheet === 'shortlist' && <Sheet label="Your shortlist" onClose={() => setSheet(null)} className="narrow">{close => <><div className="sheet-head"><h2>Shortlist</h2><button type="button" className="close press" aria-label="Close" onClick={close}><X size={18}/></button></div><div className="sheet-body">{panel(true)}</div></>}</Sheet>}
    {sheet === 'explain' && detail && <ExplainSheet item={detail} summary={summary} generating={generating} error={actionError} query={result?.query || ''} listed={listed}
      saved={saved.some(item => item.id === detail.id)} onSave={() => save({ ...detail, name: detail.name || summary?.title || 'Documentation' })} onClose={closeAction}/>}
    {help && <Dialog title={help === 'coverage' ? 'Sources & ranking' : 'About APIFit'} onClose={() => setHelp(false)}>
      <div className="simple-help">
        <p>Finding an API is easy. Working out whether it helps your idea takes longer. APIFit turns that research into a shortlist and a brief you can take into a technical discussion.</p>
        <h3>How evidence is shown</h3><p>Every result starts as <b>Listed</b>. Explaining it reads the docs (<b>Docs read</b>) and ties each capability to a source quote (<b>Quotes checked</b>). The last step, <b>You test</b>, is always yours: APIFit never runs an API or MCP tool, so a high ranking never means something was tested.</p>
        <h3>Concept icons</h3><p>With AI on, Claude splits your idea into a few parts and marks which parts each listing’s own text supports. That is an AI reading of public metadata, not a test. Keyword search has no concept icons; it shows the words it matched instead.</p>
        <details open={help === 'coverage'}><summary>Sources, ranking and privacy</summary><p>AI reviews up to 24 candidate listings per batch and returns at most 12. “Find more” reviews another batch. Coverage comes from APIs.guru and the MCP Registry, not an exhaustive web search; availability, pricing and account access still need checking.</p>{result?.sources?.map(source => <p key={source.kind}>{source.kind === 'api' ? 'APIs.guru' : 'MCP Registry'}: {source.loadedRecords || 0} listings loaded{source.kind === 'mcp' ? ` across ${source.pagesLoaded || 0} pages` : ''}.</p>)}<p>Your view stays in this tab; backend session records expire after 15 minutes. AI actions send your request and selected source text to Anthropic. No integration keys are collected and no API or MCP tool is executed. Only appearance preferences are saved in browser storage.</p></details>
        <div className="dialog-links"><ExternalLink href="https://github.com/nethren/apifit">View code on GitHub</ExternalLink><ExternalLink href="https://nethren.com/">Back to my portfolio</ExternalLink></div>
      </div>
    </Dialog>}
  </div>;
}
