import type { ReactElement } from 'react';
import type { LanguageCode } from '../../lib/i18n/languages';
import { lab } from '../../lib/checklists/labels';
import { cellKey, cellTypeOf, derivedValue } from '../../lib/checklists/data';
import { effectiveGateStatus, type Block, type CellType, type ChecklistData, type ChecklistTemplate, type GatesState } from '../../lib/checklists/types';
import { GateStatusPill } from './GateStatusPill';

interface Props {
  template: ChecklistTemplate;
  data: ChecklistData;
  gates: GatesState;
  lang: LanguageCode; // app language (screen labels)
  editable: boolean;
  onChange: (key: string, value: string) => void;
  onSubmitGate: (gateKey: string) => void;
  submitting: string | null;
  /** Keys filled from the tower record and not yet edited by the user (shown tinted). */
  prefilled?: ReadonlySet<string>;
}

function CellInput({ type, value, disabled, onChange, tint }: { type: CellType; value: string; disabled: boolean; onChange: (v: string) => void; tint?: boolean }) {
  if (type === 'yn' || type === 'ynna' || type === 'yesno') {
    const opts = type === 'yn' ? ['Y', 'N'] : type === 'ynna' ? ['Y', 'N', 'NA'] : ['Yes', 'No'];
    return (
      <select className={tint ? 'ck-input ck-prefilled' : 'ck-input'} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="" />
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className={tint ? 'ck-input ck-prefilled' : 'ck-input'}
      type={type === 'date' ? 'date' : 'text'}
      inputMode={type === 'number' ? 'decimal' : undefined}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function ChecklistForm({ template, data, gates, lang, editable, onChange, onSubmitGate, submitting, prefilled }: Props) {
  const lockedSections = new Set<string>();
  for (const g of template.gates) if (effectiveGateStatus(gates[g.key]) !== 'draft') g.sectionIds.forEach((id) => lockedSections.add(id));

  function renderBlock(sectionId: string, block: Block, idx: number) {
    const disabled = !editable || lockedSections.has(sectionId);
    if (block.kind === 'fields') {
      return (
        <div className="ck-fields" key={idx} style={{ ['--ck-cols' as string]: block.cols }}>
          {block.fields.map((f) => (
            <label className="ck-field" key={f.key}>
              <span>
                {lab(f.label, lang)}
                {f.unit ? <em> ({f.unit})</em> : null}
              </span>
              <CellInput type={f.type ?? 'text'} value={data[f.key] ?? ''} disabled={disabled} tint={prefilled?.has(f.key)} onChange={(v) => onChange(f.key, v)} />
            </label>
          ))}
        </div>
      );
    }
    if (block.kind === 'text') {
      return (
        <label className="ck-field ck-wide" key={idx}>
          <span>{lab(block.label, lang)}</span>
          <textarea className="ck-input" rows={2} value={data[block.key] ?? ''} disabled={disabled} onChange={(e) => onChange(block.key, e.target.value)} />
        </label>
      );
    }
    if (block.kind === 'gate') {
      const gate = template.gates.find((g) => g.key === block.gate)!;
      const state = gates[gate.key];
      const status = effectiveGateStatus(state);
      return (
        <div className="ck-gate" key={idx}>
          <div className="ck-gate-head">
            <strong>{lab(gate.label, lang)}</strong>
            <GateStatusPill status={status} state={state} lang={lang} />
          </div>
          {status === 'draft' && editable && (
            <button type="button" className="ck-submit" disabled={submitting === gate.key} onClick={() => onSubmitGate(gate.key)}>
              {submitting === gate.key ? lab('ui.saving', lang) : lab('ui.submitGate', lang)}
            </button>
          )}
          {status !== 'draft' && <p className="ck-locked">{lab('ui.locked', lang)}</p>}
        </div>
      );
    }
    // matrix
    const groups: { id: string; span: number }[] = [];
    for (const c of block.cols) {
      if (!c.group) continue;
      const last = groups[groups.length - 1];
      if (last && last.id === c.group) last.span += 1;
      else groups.push({ id: c.group, span: 1 });
    }
    const hasGroups = groups.length > 0;
    return (
      <div className="ck-matrix-wrap" key={idx}>
        <table className="ck-matrix">
          <thead>
            {hasGroups && (
              <tr>
                <th rowSpan={2}>{block.corner ? lab(block.corner, lang) : ''}</th>
                {(() => {
                  const cells: ReactElement[] = [];
                  let i = 0;
                  while (i < block.cols.length) {
                    const c = block.cols[i];
                    if (c.group) {
                      const g = groups.find((x) => x.id === c.group)!;
                      cells.push(
                        <th key={`g${i}`} colSpan={g.span}>
                          {lab(c.group, lang)}
                        </th>,
                      );
                      i += g.span;
                    } else {
                      cells.push(<th key={`g${i}`} rowSpan={2}>{c.label ? lab(c.label, lang) : c.text}{c.suffix}</th>);
                      i += 1;
                    }
                  }
                  return cells;
                })()}
              </tr>
            )}
            <tr>
              {!hasGroups && <th>{block.corner ? lab(block.corner, lang) : ''}</th>}
              {block.cols.filter((c) => !hasGroups || c.group).map((c) => (
                <th key={c.key}>
                  {c.label ? lab(c.label, lang) : c.text}
                  {c.suffix}
                  {c.unit ? <em> ({c.unit})</em> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className={block.rowHeaderWide ? 'ck-rowhead-wide' : undefined}>
                  {r.label ? lab(r.label, lang) : r.text}
                  {r.suffix}
                  {r.unit ? <em> ({r.unit})</em> : null}
                </th>
                {block.cols.map((c) => {
                  const key = cellKey(block.id, r.key, c.key);
                  if (r.derive) return <td key={c.key} className="ck-derived">{derivedValue(data, block.id, r, c)}</td>;
                  return (
                    <td key={c.key}>
                      <CellInput type={cellTypeOf(block, r, c)} value={data[key] ?? ''} disabled={disabled} tint={prefilled?.has(key)} onChange={(v) => onChange(key, v)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="ck-form">
      {template.sections.map((s) => (
        <section className="ck-section" key={s.id}>
          <h3>{lab(s.title, lang)}</h3>
          {s.blocks.map((b, i) => renderBlock(s.id, b, i))}
        </section>
      ))}
    </div>
  );
}
