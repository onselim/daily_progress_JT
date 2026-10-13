import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LANGUAGES, type LanguageCode } from '../lib/i18n/languages';
import { TEMPLATES } from '../lib/checklists/foundation';
import { useChecklistBranding } from '../lib/checklists/branding';
import type { ChecklistData, GatesState } from '../lib/checklists/types';
import type { ProjectRow } from '../lib/useProject';
import { ChecklistSheet } from '../components/checklists/ChecklistSheet';
import '../components/checklists/checklist.css';

interface ReviewPayload {
  request: { status: 'pending' | 'approved' | 'commented' | 'superseded' | 'expired'; party: 'consultant' | 'employer'; gate: string; gateLabel: string; email: string; signerName: string | null; comment: string | null; decidedAt: string | null };
  template: { key: string; title: string };
  instance: { id: string; docNo: string | null; rev: string | null; data: ChecklistData; gates: GatesState };
  asset: { code: string };
  project: { id: string; slug: string; name: string; client: string | null; contractor: string | null };
}

const PARTY = { consultant: 'Consultant', employer: 'Employer' } as const;

async function callReview(body: Record<string, unknown>): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('checklist-review', { body });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const b = await ctx.json();
        if (b?.error) msg = String(b.error);
      } catch {
        /* keep generic message */
      }
    }
    return { data: null, error: msg };
  }
  return { data, error: null };
}

/** Page behind the e-mailed link: the recipient reads the checklist and approves it or sends a comment. No login. */
export default function ChecklistReviewPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [remark, setRemark] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [second, setSecond] = useState<LanguageCode | 'en'>('en');
  const [handwriting, setHandwriting] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await callReview({ action: 'get', token });
    if (error) setLoadError(error);
    else {
      setLoadError('');
      setPayload(data as ReviewPayload);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const project = payload ? ({ id: payload.project.id, slug: payload.project.slug, name: payload.project.name, client: payload.project.client, contractor: payload.project.contractor } as ProjectRow) : null;
  const branding = useChecklistBranding(project);

  if (loadError) return <div className="ck-review"><p className="ck-banner ck-banner-warn">{loadError}</p></div>;
  if (!payload || !branding) return <div className="page-loading">…</div>;

  const template = TEMPLATES[payload.template.key];
  const { request, instance, asset } = payload;
  const party = PARTY[request.party];

  async function decide(decision: 'approve' | 'comment') {
    setBusy(true);
    setMessage('');
    const { error } = await callReview({ action: 'decide', token, decision, name, comment: decision === 'approve' ? remark : comment });
    if (error) setMessage(error);
    else {
      await load();
      setMessage(decision === 'approve' ? 'Thank you — your approval has been recorded.' : 'Thank you — your comment has been sent to the site team.');
    }
    setBusy(false);
  }

  return (
    <div className="ck-review">
      <div className="ck-noprint">
        <h1>
          {payload.template.title} checklist — Tower {asset.code}
        </h1>
        <p style={{ margin: '0 0 8px', opacity: 0.8 }}>
          {payload.project.name} · Stage: <b>{request.gateLabel}</b> · You respond as <b>{party}</b> ({request.email})
        </p>

        {request.status === 'approved' && <p className="ck-banner ck-banner-ok">Approved by {request.signerName} on {request.decidedAt ? new Date(request.decidedAt).toLocaleString('en-GB') : ''}.</p>}
        {request.status === 'commented' && <p className="ck-banner ck-banner-warn">You sent a comment: “{request.comment}”. The site team will correct the checklist and send it again.</p>}
        {request.status === 'superseded' && <p className="ck-banner ck-banner-info">This request is closed (answered by someone else of your party, or replaced by a newer request).</p>}
        {request.status === 'expired' && <p className="ck-banner ck-banner-info">This link has expired. Please ask the site team to send it again.</p>}
        {message && <p className="ck-banner ck-banner-ok">{message}</p>}

        {request.status === 'pending' && (
          <div className="ck-decide">
            <div className="ck-decide-row">
              <div style={{ display: 'grid', gap: 8 }}>
                <b>Approve this stage</b>
                <input placeholder="Your full name (required)" value={name} onChange={(e) => setName(e.target.value)} />
                <textarea rows={2} placeholder="Remark (optional)" value={remark} onChange={(e) => setRemark(e.target.value)} />
                <button type="button" className="ck-approve" disabled={busy || name.trim().length < 2} onClick={() => void decide('approve')}>
                  ✔ Approve as {party}
                </button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <b>Send a comment instead</b>
                <textarea rows={4} placeholder="What has to be corrected? The stage goes back to the site team." value={comment} onChange={(e) => setComment(e.target.value)} />
                <button type="button" className="ck-send-comment" disabled={busy || comment.trim().length < 3} onClick={() => void decide('comment')}>
                  ✉ Send comment
                </button>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Your name, the time and your e-mail address are recorded with the approval. A stage is approved when both Consultant and Employer have approved it.</p>
          </div>
        )}

        <div className="ck-actions" style={{ margin: '8px 0' }}>
          <label className="ck-printlang">
            Show English +
            <select value={second} onChange={(e) => setSecond(e.target.value as LanguageCode)}>
              <option value="en">English only</option>
              {LANGUAGES.filter((l) => l.code !== 'en').map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ck-printlang">
            <input type="checkbox" checked={handwriting} onChange={(e) => setHandwriting(e.target.checked)} />
            ✍ Handwritten look
          </label>
          <button type="button" onClick={() => window.print()}>
            🖨 Print
          </button>
        </div>
      </div>

      <div className="ck-sheet-wrap" style={{ display: 'block' }}>
        <ChecklistSheet
          template={template}
          data={instance.data}
          gates={instance.gates}
          second={second === 'en' ? null : second}
          header={{ docNo: instance.docNo ?? '', rev: instance.rev ?? '', towerNo: asset.code }}
          branding={branding}
          handwriting={handwriting}
        />
      </div>
    </div>
  );
}
