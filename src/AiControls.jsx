import React, { useEffect, useRef } from 'react';
import { PaperPlaneTilt, Timer, Prohibit, Info } from '@phosphor-icons/react';
import { Dialog, Notice, ExternalLink } from './components.jsx';

// The allowance ring is an SVG arc set through attributes (the CSP forbids
// inline style attributes). Values come from /ai/status, never a placeholder.
export function AllowanceRing({ budget, size = 18, label = false }) {
  const limit = budget?.limitUsd || 0; const remaining = Math.max(0, budget?.remainingUsd || 0);
  const share = limit > 0 ? Math.min(1, remaining / limit) : 0;
  return <svg className={`ring ${label ? 'big' : ''}`} viewBox="0 0 36 36" width={size} height={size} aria-hidden="true">
    <circle className="ring-track" cx="18" cy="18" r="15.5" pathLength="100"/>
    <circle className="ring-fill" cx="18" cy="18" r="15.5" pathLength="100" strokeDasharray={`${(share * 100).toFixed(1)} 100`} transform="rotate(-90 18 18)"/>
  </svg>;
}

export function AiPopover({ status, enabled, onEnabled, onClose, context = '', onContinue, anchor }) {
  const ref = useRef(null);
  const ready = Boolean(status?.ready); const on = enabled && ready;
  const budget = status?.budget;
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('button:not(:disabled), summary')?.focus({ preventScroll: true });
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const outside = e => { if (!ref.current?.contains(e.target) && !anchor?.current?.contains(e.target)) onClose(); };
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [onClose, anchor]);
  return <div className="pop" ref={ref} role="dialog" aria-modal="false" aria-labelledby="ai-pop-title">
    {context && <p className="pop-context">{context}</p>}
    <div className="gauge">
      <div className="big-ring"><AllowanceRing budget={budget} size={72} label/><span>{budget ? `$${budget.remainingUsd.toFixed(2)}` : '–'}</span></div>
      <div><b id="ai-pop-title">AI matching</b><small>{budget && !budget.available ? 'Allowance paused on this server' : budget?.limitUsd ? `left of a $${budget.limitUsd.toFixed(0)} shared allowance` : ready ? 'Shared allowance' : 'Unavailable right now'}</small></div>
      <button type="button" className="switch" role="switch" aria-checked={on} aria-label="Use AI" disabled={!ready} onClick={() => onEnabled(!on)}/>
    </div>
    {(status?.issue || !ready) && <p className="pop-issue">{status?.issue || 'AI is off on this server. Keyword search still works.'}</p>}
    <ul className="facts">
      <li data-tip="Your words and public docs go to Anthropic"><PaperPlaneTilt size={22} weight="light" aria-hidden="true"/>Sent to Claude</li>
      <li data-tip="APIFit’s records expire after 15 minutes"><Timer size={22} weight="light" aria-hidden="true"/>Gone in 15 min</li>
      <li className="no" data-tip="No keys collected. No API or tool is run."><Prohibit size={22} weight="light" aria-hidden="true"/>No keys or runs</li>
    </ul>
    <details className="more-info"><summary><Info size={15} weight="light" aria-hidden="true"/>Details</summary>
      <p>Claude Haiku ranks a batch of directory listings for your idea and splits it into the parts shown as icons. Explanations and build briefs are made only when you ask. Shortlisting makes no AI call. Turn AI off for free keyword search.</p>
      <p>AI requests send your request and relevant public documentation to Anthropic. Keep credentials, sensitive personal data and confidential material out. APIFit’s backend records expire after 15 minutes; this tab keeps its view until reloaded. Anthropic’s standard API retention is generally up to 30 days, with exceptions. Source quotes are checked, but relevance is not tested feasibility or provider reliability. No API or MCP tool is executed. Usage is covered by the site owner; pending charges stay reserved.</p>
      <ExternalLink href="https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data">Anthropic retention policy</ExternalLink>
    </details>
    {context && <div className="pop-foot"><button type="button" className="btn ghost press" onClick={onClose}>Not now</button><button type="button" className="btn primary press" disabled={!on} onClick={onContinue}>Continue</button></div>}
  </div>;
}

export function AiControls({ status, enabled, onEnabled, onRefresh, onClose, onDone = onClose, context = '' }) {
  return <Dialog title="AI assistance" onClose={onClose}>
    <p className="dialog-intro">Clearer explanations. Evidence you can check.</p>
    {context && <Notice>{context}</Notice>}
    <p>Claude Haiku 4.5 finds and ranks API options for your request. Explanations and build briefs are generated only when you ask. Saving or removing an API makes no AI call. Turn AI off for free keyword search.</p>
    <Notice>{status?.issue || (status?.ready ? 'AI is configured on the server. Provider access is only checked when you make an AI request.' : 'AI is unavailable until the operator enables it with a secure server credential and available budget. Never paste a key here.')}</Notice>
    {status?.budget && <p><strong>US${status.budget.remainingUsd.toFixed(3)} remaining</strong> in APIFit’s shared AI allowance. Usage is covered by the site owner. Pending or uncertain charges stay reserved.</p>}
    <label className="confirmation"><input type="checkbox" checked={enabled && Boolean(status?.ready)} disabled={!status?.ready} onChange={e => onEnabled(e.target.checked)}/><span>Use AI for this tab. AI-assisted actions send your request and relevant public documentation to Anthropic. Turn this off for keyword search.</span></label>
    <p className="muted">Keep credentials, sensitive personal data and confidential material out of requests. APIFit’s backend records expire after 15 minutes; this tab keeps its view until cleared or reloaded. Anthropic’s standard API retention is generally up to 30 days, with exceptions. This setting is not saved after a reload.</p>
    <p className="muted">AI search interprets your request, then ranks a batch of directory listings. Finding more options makes another ranking request. Summaries are reused when reopened in this tab. Source quotes are checked, but relevance is not verified feasibility or provider reliability. No API or MCP tool is executed.</p>
    <ExternalLink href="https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data">Anthropic retention policy</ExternalLink>
    <div className="dialog-footer"><button className="button secondary" onClick={onRefresh}>Refresh status</button><button className="button primary" disabled={Boolean(context) && (!enabled || !status?.ready)} onClick={onDone}>{context ? 'Continue' : 'Done'}</button></div>
  </Dialog>;
}

export function AiExplanation({ value, evidence }) {
  if (!value) return null;
  return <section className="document-excerpt"><h3>In plain English</h3><Notice>AI interpretation of {value.coverage.selectedEvidence} of {value.coverage.totalEvidence} evidence excerpts. Not human-reviewed or live-tested.</Notice>
    {value.withheldStatements > 0 && <Notice>{value.withheldStatements} AI {value.withheldStatements === 1 ? 'statement was' : 'statements were'} withheld because the source quotes could not be verified. Only statements that passed quotation checks are shown.</Notice>}
    {Object.entries({ summary: 'Overview', capabilities: 'What you can do', limitations: 'Documented limits' }).map(([key, title]) => value[key].length > 0 && <div key={key}><h4>{title}</h4>{value[key].map((statement, index) => <div key={index}><p>{statement.text}</p><details className="unknowns"><summary>Check source quotes</summary>{statement.citations.map((c, i) => <div key={i}><blockquote className="evidence-quote">{c.quote}</blockquote><p className="fineprint">{evidence.find(e => e.id === c.evidenceId)?.location}</p></div>)}</details></div>)}</div>)}
    {!value.summary.length && !value.capabilities.length && <p>{value.withheldStatements > 0 ? 'No AI explanation passed the quotation checks. The parsed documentation remains available below.' : 'There wasn’t enough evidence here for a useful explanation. Try a more specific documentation page.'}</p>}
  </section>;
}

export function ComparisonResults({ assessment }) {
  const ai = assessment.mode === 'ai-evidence-assessment';
  const verdicts = { 'meets-documented-must-haves': 'Must-haves documented', 'does-not-meet-must-haves': 'Must-have not met', 'conditional-fit': 'Conditions to check', 'insufficient-evidence': 'Needs checking' };
  return <><Notice>{assessment.notice}</Notice><div className="comparison-results">{assessment.candidates.map(candidate => <section key={candidate.analysisId} className="comparison-candidate">
    <div className="comparison-title"><h3>{candidate.title}</h3><span className="status-unknown">{verdicts[candidate.verdict]}</span></div>
    <p className="fineprint">{candidate.coverage.returnedOperations ?? 0} operations read · Not live-tested · Account access unchecked</p>
    {candidate.aiCoverage && <p className="muted">AI received {candidate.aiCoverage.selectedEvidence} of {candidate.aiCoverage.totalEvidence} parsed evidence excerpts. {candidate.aiCoverage.selectedEvidence < candidate.aiCoverage.totalEvidence ? 'This is a partial selection, not a complete document review.' : 'Other operation pages and parser omissions remain outside this assessment.'}</p>}
    {candidate.findings.map(f => <div className="finding" key={f.requirementId}><h4>{assessment.requirements.find(r => r.id === f.requirementId)?.text}</h4>
      {ai ? <><strong>{f.status === 'unknown' ? 'Not established' : f.status === 'supported' ? 'Documented support' : f.status === 'conditional' ? 'Conditional support' : 'Documented conflict'}</strong><p>{f.explanation}</p>{f.conditions.map((c, i) => <p key={i}>Condition: {c}</p>)}{f.citations?.map((c, i) => <details className="unknowns" key={i}><summary>Source evidence</summary><blockquote className="evidence-quote">{c.quote}</blockquote><p className="fineprint">{candidate.evidence.find(e => e.id === c.evidenceId)?.location}</p></details>)}</> : <><span className="muted">{f.relatedEvidence.length ? `${f.relatedEvidence.length} related documentation sections — fit is still unknown` : 'No related wording found. This does not establish a non-fit.'}</span>{[...new Set(f.relatedEvidence.slice(0, 2).flatMap(r => r.evidenceIds.slice(0, 1)))].slice(0, 4).map(id => <p className="evidence-quote" key={id}>{candidate.evidence.find(e => e.id === id)?.excerpt}</p>)}</>}
    </div>)}<ExternalLink href={candidate.source.url}>Review source</ExternalLink>
  </section>)}</div></>;
}
