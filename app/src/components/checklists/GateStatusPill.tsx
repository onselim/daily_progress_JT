import type { LanguageCode } from '../../lib/i18n/languages';
import { lab } from '../../lib/checklists/labels';
import { PARTIES, type GateState, type GateStatus } from '../../lib/checklists/types';

const COLORS: Record<GateStatus, { bg: string; fg: string }> = {
  draft: { bg: '#e5e7eb', fg: '#374151' },
  submitted: { bg: '#fef3c7', fg: '#92400e' },
  approved: { bg: '#d1fae5', fg: '#065f46' },
};

/** Stage badge: Draft / Submitted - awaiting approval / Approved, plus one chip per approving party (Consultant, Employer). */
export function GateStatusPill({ status, state, lang }: { status: GateStatus; state: GateState | undefined; lang: LanguageCode }) {
  const c = COLORS[status];
  return (
    <span className="ck-pill-row">
      <span className="ck-pill" style={{ background: c.bg, color: c.fg }}>
        {lab(`ui.status.${status}`, lang)}
      </span>
      {status !== 'draft' &&
        PARTIES.map((p) => {
          const a = state?.approvals?.[p];
          const approved = a?.status === 'approved';
          return (
            <span key={p} className="ck-chip" style={{ background: approved ? '#d1fae5' : '#f3f4f6', color: approved ? '#065f46' : '#6b7280' }}>
              {approved ? '✓ ' : '… '}
              {lab(p, lang)}
              {approved ? '' : ` (${lab('ui.status.pending', lang)})`}
            </span>
          );
        })}
    </span>
  );
}
