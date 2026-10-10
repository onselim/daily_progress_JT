import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import type { Branding } from '../../lib/checklists/branding';
import { RTL_LANGUAGES, type LanguageCode } from '../../lib/i18n/languages';
import { bilingual, lab } from '../../lib/checklists/labels';
import { cellKey, derivedValue } from '../../lib/checklists/data';
import { effectiveGateStatus, overallStatus, type Block, type ChecklistData, type ChecklistTemplate, type GatesState } from '../../lib/checklists/types';

export interface SheetHeader {
  docNo: string;
  rev: string;
  towerNo: string;
  lineLabel?: boolean;
}


interface Props {
  template: ChecklistTemplate;
  data: ChecklistData;
  gates: GatesState;
  second: LanguageCode | null; // printed under the English line; null = English only
  header: SheetHeader;
  branding: Branding;
}

/** English line + (optionally) the chosen language underneath, like the paper form -- but the second language is
 * any of the app's 9. Units are appended to the English line only. */
function B({ id, second, unit }: { id: string; second: LanguageCode | null; unit?: string }): ReactElement {
  const { en, other } = bilingual(id, second);
  return (
    <>
      <span className="sh-en">
        {en}
        {unit ? ` (${unit})` : ''}
      </span>
      {other && (
        <span className="sh-2" dir={second && RTL_LANGUAGES.has(second) ? 'rtl' : undefined}>
          {other}
        </span>
      )}
    </>
  );
}

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB');
}

const LOGO_DIR = '/checklist-logos/';

/** Compact strip at the top of every printed page: Employer, Contractor, Consultant with logos and names. */
function PartyStrip({ branding, second }: { branding: Branding; second: LanguageCode | null }) {
  const cells = [
    { id: 'employer', p: branding.employer },
    { id: 'contractor', p: branding.contractor },
    { id: 'consultant', p: branding.consultant },
  ] as const;
  return (
    <table className="sh-table sh-strip">
      <tbody>
        <tr>
          {cells.map(({ id, p }) => (
            <td key={id}>
              <div className="sh-strip-logos">
                {p.logos.map((f) => (
                  <img key={f} src={LOGO_DIR + f} alt="" />
                ))}
              </div>
              <div className="sh-strip-name">
                <b>{lab(id, 'en')}</b>
                {second && second !== 'en' ? ` / ${lab(id, second)}` : ''}
                {p.name ? ` — ${p.name}` : ''}
              </div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export function ChecklistSheet({ template, data, gates, second, header, branding }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const parties = { contractor: branding.contractor.name, consultant: branding.consultant.name, employer: branding.employer.name };

  // When printing, shrink any page that would spill past one A4 sheet (longer translations, fallback fonts)
  // so every sheet stays on exactly one page. The on-screen preview keeps its natural size.
  useEffect(() => {
    const MAX_MM = 279;
    function before() {
      const px = (MAX_MM * 96) / 25.4;
      rootRef.current?.querySelectorAll<HTMLElement>('.sh-page').forEach((el) => {
        el.style.zoom = '';
        const h = el.getBoundingClientRect().height;
        if (h > px) el.style.zoom = String(Math.max(0.7, px / h));
      });
    }
    function after() {
      rootRef.current?.querySelectorAll<HTMLElement>('.sh-page').forEach((el) => (el.style.zoom = ''));
    }
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  const pageSections: typeof template.sections[] = [];
  for (const s of template.sections) {
    if (s.pageBreakBefore || pageSections.length === 0) pageSections.push([s]);
    else pageSections[pageSections.length - 1].push(s);
  }
  const total = pageSections.length;
  const overall = overallStatus(template, gates);

  function head(page: number): ReactElement {
    return (
      <table className="sh-table sh-head">
        <tbody>
          <tr>
            <td rowSpan={2} className="sh-c">
              <B id="line" second={second} />
              <span className="sh-en">
                <b>{lab('lineName', 'en')}</b>
              </span>
              {second && second !== 'en' && <span className="sh-2" dir={RTL_LANGUAGES.has(second) ? 'rtl' : undefined}>{lab('lineName', second)}</span>}
            </td>
            <td rowSpan={2} className="sh-c sh-title">
              <B id={template.title} second={second} />
            </td>
            <td>
              <B id="docNo" second={second} /> <b>{header.docNo}</b>
              {header.rev ? <span className="sh-en">{lab('rev', 'en')} <b>{header.rev}</b></span> : null}
            </td>
            <td>
              {lab('page', 'en')} {page} {lab('of', 'en')} {total}
            </td>
          </tr>
          <tr>
            <td>
              <B id="towerNo" second={second} /> <b>{header.towerNo}</b>
            </td>
            <td>
              <B id="date" second={second} />
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  function signoff(gateKey: string): ReactNode {
    const gate = template.gates.find((g) => g.key === gateKey)!;
    const state = gates[gateKey];
    const status = effectiveGateStatus(state);
    const cols: { id: 'contractor' | 'consultant' | 'employer'; who: string; name: string; at: string; sig: string }[] = [
      {
        id: 'contractor',
        who: parties.contractor,
        name: state?.submitted_by ?? '',
        at: fmtDate(state?.submitted_at),
        sig: state?.status && state.status !== 'draft' ? 'submitted' : '',
      },
      ...(['consultant', 'employer'] as const).map((p) => {
        const a = state?.approvals?.[p];
        return { id: p, who: parties[p], name: a?.name ?? '', at: fmtDate(a?.at), sig: a?.status === 'approved' ? 'approved' : '' };
      }),
    ];
    return (
      <>
        <table className="sh-table">
          <tbody>
            <tr className={status === 'approved' ? 'sh-accepted' : undefined}>
              <td colSpan={3} className="sh-c">
                <B id={gate.label} second={second} />
                {status === 'approved' && <b className="sh-stamp"> — APPROVED</b>}
              </td>
            </tr>
          </tbody>
        </table>
        <table className="sh-table sh-sign">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.id}>
                  <B id={c.id} second={second} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['name', 'date', 'signature'] as const).map((row) => (
              <tr key={row}>
                {cols.map((c) => (
                  <td key={c.id}>
                    <span className="sh-signlbl">
                      <B id={row === 'date' ? 'dateShort' : row} second={second} />
                    </span>
                    <span className="sh-signval">
                      {row === 'name' ? c.name : row === 'date' ? c.at : c.sig === 'approved' ? '✔ approved online' : c.sig === 'submitted' ? '✔ submitted' : ''}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              {cols.map((c) => (
                <td key={c.id} className="sh-c sh-who">
                  {c.who}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </>
    );
  }

  function block(b: Block, key: number): ReactNode {
    if (b.kind === 'fields') {
      const rows: (typeof b.fields)[] = [];
      for (let i = 0; i < b.fields.length; i += b.cols) rows.push(b.fields.slice(i, i + b.cols));
      return (
        <table className="sh-table" key={key}>
          <tbody>
            {rows.flatMap((r, ri) => [
              <tr key={`l${ri}`}>
                {r.map((f) => (
                  <th key={f.key} className="sh-c">
                    <B id={f.label} second={second} unit={f.unit} />
                  </th>
                ))}
              </tr>,
              <tr key={`v${ri}`}>
                {r.map((f) => (
                  <td key={f.key} className="sh-c sh-val">
                    {data[f.key] ?? ''}
                  </td>
                ))}
              </tr>,
            ])}
          </tbody>
        </table>
      );
    }
    if (b.kind === 'text') {
      return (
        <table className="sh-table" key={key}>
          <tbody>
            <tr>
              <td className="sh-comment">
                <B id={b.label} second={second} />
                <span className="sh-val">{data[b.key] ?? ''}</span>
              </td>
            </tr>
          </tbody>
        </table>
      );
    }
    if (b.kind === 'gate') return <div key={key}>{signoff(b.gate)}</div>;
    // matrix
    const groups: { id: string; span: number }[] = [];
    for (const c of b.cols) {
      if (!c.group) continue;
      const last = groups[groups.length - 1];
      if (last && last.id === c.group) last.span += 1;
      else groups.push({ id: c.group, span: 1 });
    }
    const hasGroups = groups.length > 0;
    const colHead = (c: (typeof b.cols)[number]) => (
      <>
        {c.label ? <B id={c.label} second={second} unit={c.unit} /> : <span className="sh-en">{c.text}</span>}
        {c.suffix ? <span className="sh-en">{c.suffix.trim()}</span> : null}
      </>
    );
    return (
      <table className="sh-table" key={key}>
        <thead>
          {hasGroups && (
            <tr>
              <th rowSpan={2} className={b.rowHeaderWide ? 'sh-rowhead' : undefined}>
                {b.corner ? <B id={b.corner} second={second} /> : null}
              </th>
              {(() => {
                const cells: ReactElement[] = [];
                let i = 0;
                while (i < b.cols.length) {
                  const c = b.cols[i];
                  if (c.group) {
                    const g = groups.find((x) => x.id === c.group)!;
                    cells.push(
                      <th key={`g${i}`} colSpan={g.span} className="sh-c">
                        <B id={c.group} second={second} />
                      </th>,
                    );
                    i += g.span;
                  } else {
                    cells.push(
                      <th key={`g${i}`} rowSpan={2} className="sh-c">
                        {colHead(c)}
                      </th>,
                    );
                    i += 1;
                  }
                }
                return cells;
              })()}
            </tr>
          )}
          <tr>
            {!hasGroups && (
              <th className={b.rowHeaderWide ? 'sh-rowhead' : undefined}>{b.corner ? <B id={b.corner} second={second} /> : null}</th>
            )}
            {b.cols.filter((c) => !hasGroups || c.group).map((c) => (
              <th key={c.key} className="sh-c">
                {colHead(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r) => (
            <tr key={r.key}>
              <th className={b.rowHeaderWide ? 'sh-rowhead' : 'sh-c'}>{r.label ? <B id={r.label} second={second} unit={r.unit} /> : <span className="sh-en">{r.text}{r.suffix}</span>}</th>
              {b.cols.map((c) => (
                <td key={c.key} className="sh-c sh-val">
                  {r.derive ? derivedValue(data, b.id, r, c) : data[cellKey(b.id, r.key, c.key)] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="sh-root" dir="ltr" ref={rootRef}>
      {pageSections.map((secs, pi) => (
        <div className="sh-page" key={pi}>
          <PartyStrip branding={branding} second={second} />
          {head(pi + 1)}
          {overall === 'approved' && pi === 0 && <div className="sh-approved">{second && second !== 'en' ? `${lab('ui.status.approved', 'en').toUpperCase()} · ${lab('ui.status.approved', second)}` : lab('ui.status.approved', 'en').toUpperCase()}</div>}
          {secs.map((s) => (
            <div key={s.id} className="sh-section">
              <div className="sh-sectitle">
                <B id={s.title} second={second} />
              </div>
              {s.blocks.map((b, i) => block(b, i))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
