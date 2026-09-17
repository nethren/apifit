import React from 'react';

export function Mark({ large = false }) {
  return <svg className={large ? 'fit-mark large' : 'fit-mark'} viewBox="0 0 64 64" fill="none" aria-hidden="true"><path className="mark-left" d="M26 10H18a8 8 0 0 0-8 8v8h9v12h-9v8a8 8 0 0 0 8 8h8V43h12v11h8a8 8 0 0 0 8-8v-8H43V26h11v-8a8 8 0 0 0-8-8h-8v11H26V10Z" stroke="currentColor" strokeWidth="2.6"/><rect className="mark-piece" x="26" y="26" width="12" height="12" rx="2" fill="currentColor"/></svg>;
}
export function EmptyArt() {
  return <svg className="empty-art" viewBox="0 0 160 120" fill="none" aria-hidden="true"><path d="M18 97h124M31 102V20m98 82V20" stroke="var(--line)" strokeDasharray="3 5"/><rect x="42" y="26" width="65" height="76" rx="5" fill="var(--surface)" stroke="var(--line-strong)" transform="rotate(-8 42 26)"/><rect x="57" y="18" width="65" height="76" rx="5" fill="var(--surface)" stroke="var(--line-strong)"/><path d="M69 35h34M69 44h25M69 68h34M69 77h18" stroke="var(--line-strong)"/><circle cx="114" cy="78" r="17" fill="var(--secondary-soft)" stroke="var(--accent)"/><path d="m127 91 13 13" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"/></svg>;
}
