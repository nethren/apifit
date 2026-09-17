import React from 'react';
import { ArrowRight, Plus, X, Check } from '@phosphor-icons/react';
import { Notice } from './components.jsx';

export function InlineRequirements({ project, onChange, onSearch, onShortlist, savedCount, busy }) {
  function update(requirements) { onChange({ ...project, requirements, confirmed: false }); }
  return <section className="inline-project" aria-labelledby="requirements-title">
    <div className="inline-project-heading"><div><h2 id="requirements-title">What I understood</h2><p>Check the details. Tell us what matters most.</p></div><span className="inline-project-status">{project.confirmed ? <><Check size={16}/>Confirmed</> : 'Your review needed'}</span></div>
    <fieldset className="requirements" disabled={busy}><legend className="sr-only">Understood project requirements</legend>
      {!project.requirements.length && <Notice>No concrete requirements were found. Add a requirement and search phrases below, or try a more specific project description.</Notice>}
      {project.requirements.map((r, index) => <div className="requirement" key={r.id}>
        <label><span className="sr-only">Project requirement {index + 1}</span><input value={r.text} maxLength={1000} onChange={e => update(project.requirements.map(other => other.id === r.id ? { ...other, text: e.target.value } : other))}/></label>
        <select aria-label={`Project priority ${index + 1}`} value={r.priority} onChange={e => update(project.requirements.map(other => other.id === r.id ? { ...other, priority: e.target.value } : other))}><option value="unsure">Choose priority</option><option value="must">Must have</option><option value="nice">Nice to have</option></select>
        <button type="button" className="icon-button" aria-label={`Remove project requirement ${index + 1}`} onClick={() => update(project.requirements.filter(other => other.id !== r.id))}><X size={18}/></button>
      </div>)}
      <button className="text-button" type="button" disabled={project.requirements.length >= 10} onClick={() => update([...project.requirements, { id: `r${Math.max(0, ...project.requirements.map(r => Number(r.id.slice(1)) || 0)) + 1}`, text: '', priority: 'unsure' }])}><Plus size={17}/>Add requirement</button>
      {project.questions.length > 0 && <details className="inline-questions"><summary>{project.questions.length} {project.questions.length === 1 ? 'detail' : 'details'} worth clarifying</summary><ul>{project.questions.map(q => <li key={q}>{q}</li>)}</ul><p>Add your answers to the requirements above.</p></details>}
      <div className="inline-project-actions"><label className="confirmation"><input type="checkbox" checked={project.confirmed} disabled={!project.requirements.length || project.requirements.some(r => !r.text.trim())} onChange={e => onChange({ ...project, confirmed: e.target.checked })}/><span>I’ve checked the requirements and priorities.</span></label><button className="button primary" type="button" disabled={!savedCount || !project.confirmed} onClick={onShortlist}>Review shortlist{savedCount ? ` (${savedCount})` : ''}<ArrowRight size={17}/></button></div>
    </fieldset>
    <details className="inline-search-terms"><summary>Search phrases & original request</summary><p>AI suggested these phrases. Edit them to widen or narrow the search. Searching these phrases again makes no AI request.</p>
      <form onSubmit={e => { e.preventDefault(); onSearch(); }}><fieldset disabled={busy}><legend className="sr-only">Directory search phrases</legend>{[0, 1, 2].map(index => <label key={index}><span>Phrase {index + 1}</span><input aria-label={`Search phrase ${index + 1}`} maxLength={150} value={project.queries[index] || ''} onChange={e => { const queries = [...project.queries]; queries[index] = e.target.value; onChange({ ...project, queries }); }}/></label>)}<button type="submit" className="button secondary" disabled={!project.queries.some(q => q?.trim())}>Search these phrases <ArrowRight size={17}/></button></fieldset></form>
      <p className="original-request"><strong>Your original request</strong><br/>{project.text}</p><p>AI interpretation, not a confirmed specification. Requirement edits update the assessment criteria; edit the phrases above to change retrieval.</p>
    </details>
    <p className="inline-project-note">Shortlist promising results below. We’ll check the documentation against these requirements—not assign a fit score from directory descriptions.</p>
  </section>;
}
