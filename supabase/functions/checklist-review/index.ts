// Public endpoint behind the e-mailed "Review & Approve" link (https://svkdk.com/review/<token>). No login:
// the secret token in the link identifies one recipient for one approval stage of one checklist.
//   { action: 'get', token }                                -> checklist content + state of this request
//   { action: 'decide', token, decision, name?, comment? }  -> decision = 'approve' | 'comment'
// Approve: records the approval for the recipient's party (Consultant / Employer). The stage is approved when BOTH
// parties have approved. Comment: the stage returns to the site team (unlocked) with the comment.
//
// Deploy: Supabase Dashboard -> Edge Functions -> new function "checklist-review" -> paste this file, and switch
// "Verify JWT" OFF (callers are not signed in; the token is the credential).
// Secrets used: RESEND_API_KEY (already set); the Supabase ones are injected automatically.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SITE = 'https://svkdk.com';
const FROM = 'Site Checklists <checklists@svkdk.com>';
const PARTIES = ['consultant', 'employer'] as const;
type Party = (typeof PARTIES)[number];
const PARTY_LABEL: Record<Party, string> = { consultant: 'Consultant', employer: 'Employer' };

/** Stages per template (must match app/src/lib/checklists/foundation.ts and checklist-notify). */
const TEMPLATES: Record<string, { title: string; gates: Record<string, string> }> = {
  foundation: {
    title: 'Foundation Works',
    gates: {
      class: 'Acceptance of foundation class (sections A–C)',
      concreting: 'Acceptance for concreting (sections D–E)',
      backfill: 'Acceptance for backfilling (sections F–L)',
    },
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br/>');
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing Supabase environment variables' }, 500);

  async function rest(path: string, init: RequestInit = {}) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(`${path}: ${res.status} ${text}`);
    return data;
  }

  async function mail(to: string, subject: string, html: string) {
    if (!resendKey || !to) return;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    }).catch(() => undefined);
  }

  try {
    const body = (await req.json()) as { action?: string; token?: string; decision?: string; name?: string; comment?: string };
    const token = (body.token ?? '').trim();
    if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: 'This link is not valid.' }, 404);

    const reqRow = (await rest(`checklist_approval_requests?select=*&token_hash=eq.${await sha256Hex(token)}`))?.[0];
    if (!reqRow) return json({ error: 'This link is not valid.' }, 404);

    const inst = (await rest(`checklist_instances?select=*&id=eq.${reqRow.instance_id}`))?.[0];
    if (!inst) return json({ error: 'Checklist not found.' }, 404);
    const template = TEMPLATES[inst.template_key];
    if (!template) return json({ error: 'Unknown checklist type.' }, 400);
    const project = (await rest(`projects?select=id,slug,name,client,contractor&id=eq.${inst.project_id}`))?.[0];
    const asset = (await rest(`assets?select=asset_code&id=eq.${inst.asset_id}`))?.[0];
    const gates = (inst.gates ?? {}) as Record<string, any>;
    const gateState = gates[reqRow.gate_key];

    const expired = new Date(reqRow.expires_at).getTime() < Date.now();
    // What the page shows about this request: pending / approved / commented / superseded / expired.
    const state = expired && reqRow.status === 'pending' ? 'expired' : reqRow.status;

    if (body.action === 'get') {
      return json({
        request: { status: state, party: reqRow.party, gate: reqRow.gate_key, gateLabel: template.gates[reqRow.gate_key] ?? reqRow.gate_key, email: reqRow.email, signerName: reqRow.signer_name, comment: reqRow.comment, decidedAt: reqRow.decided_at },
        template: { key: inst.template_key, title: template.title },
        instance: { id: inst.id, docNo: inst.doc_no, rev: inst.rev, data: inst.data, gates, updatedAt: inst.updated_at },
        asset: { code: asset?.asset_code ?? '' },
        project,
      });
    }

    if (body.action !== 'decide') return json({ error: 'Unknown action' }, 400);
    if (reqRow.status !== 'pending') return json({ error: 'This request has already been answered or replaced by a newer one.', state }, 409);
    if (expired) return json({ error: 'This link has expired. Ask the site team to send it again.', state: 'expired' }, 410);
    if (!gateState || gateState.status !== 'submitted') return json({ error: 'This stage is no longer waiting for approval.', state: 'superseded' }, 409);

    const party = reqRow.party as Party;
    const gate = reqRow.gate_key as string;
    const name = (body.name ?? '').trim().slice(0, 120);
    const comment = (body.comment ?? '').trim().slice(0, 4000);
    const nowIso = new Date().toISOString();
    const towerLabel = `Tower ${asset?.asset_code ?? ''}`.trim();
    const where = `${template.title} checklist — ${towerLabel} — ${template.gates[gate] ?? gate}`;
    const submitter = String(gateState.submitted_by ?? '');
    const openLink = `${SITE}/field/${project?.slug}/checklists/${inst.template_key}/${encodeURIComponent(asset?.asset_code ?? '')}`;

    if (body.decision === 'approve') {
      if (name.length < 2) return json({ error: 'Please type your name to approve.' }, 400);
      await rest(`checklist_approval_requests?id=eq.${reqRow.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved', signer_name: name, comment: comment || null, decided_at: nowIso }) });
      // Anyone else of the same party no longer needs to answer this stage.
      await rest(`checklist_approval_requests?instance_id=eq.${inst.id}&gate_key=eq.${gate}&party=eq.${party}&status=eq.pending`, { method: 'PATCH', body: JSON.stringify({ status: 'superseded' }) });

      const approvals = { ...(gateState.approvals ?? {}), [party]: { ...(gateState.approvals?.[party] ?? {}), status: 'approved', name, at: nowIso, ...(comment ? { comment } : {}) } };
      const bothApproved = PARTIES.every((p) => approvals[p]?.status === 'approved');
      const newGate = { ...gateState, approvals, ...(bothApproved ? { status: 'approved', approved_at: nowIso } : {}) };
      const newGates = { ...gates, [gate]: newGate };
      await rest(`checklist_instances?id=eq.${inst.id}`, { method: 'PATCH', body: JSON.stringify({ gates: newGates }) });
      await rest('checklist_events', { method: 'POST', body: JSON.stringify({ instance_id: inst.id, action: 'approve', detail: { gate, party, name, email: reqRow.email, bothApproved } }) });

      const allDone = Object.keys(template.gates).every((g) => newGates[g]?.status === 'approved');
      const headline = bothApproved ? (allDone ? 'All stages are approved — the checklist is fully APPROVED.' : 'Both parties have approved this stage.') : `${PARTY_LABEL[party]} has approved; waiting for the other party.`;
      await mail(
        submitter,
        `[${project?.name ?? ''}] ${towerLabel}: ${PARTY_LABEL[party]} approved — ${template.gates[gate] ?? gate}`,
        `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;max-width:560px"><p><b>${esc(where)}</b></p><p>${esc(PARTY_LABEL[party])} approved this stage (${esc(name)}, ${esc(reqRow.email)}).</p>${comment ? `<p>Remark: ${esc(comment)}</p>` : ''}<p>${esc(headline)}</p><p><a href="${openLink}">Open the checklist</a></p></div>`,
      );
      if (bothApproved) {
        // Information (cc) list of the project: the stage (or the whole checklist) is now fully approved.
        const dlRows = (await rest(`project_config?select=key,value&project_id=eq.${inst.project_id}&key=eq.distribution_lists`)) as { value: any }[];
        const dl = dlRows?.[0]?.value as { default?: Record<string, { name?: string; email: string }[]>; byType?: Record<string, Record<string, { name?: string; email: string }[]>> } | undefined;
        const typeKey = `checklist.${inst.template_key}`;
        const own = dl?.byType?.[typeKey]?.info;
        const infoList = own && own.length > 0 ? own : dl?.default?.info ?? [];
        const seen = new Set<string>();
        for (const person of infoList) {
          const email = String(person.email ?? '').trim().toLowerCase();
          if (!email || seen.has(email)) continue;
          seen.add(email);
          await mail(
            email,
            `[${project?.name ?? ''}] ${towerLabel}: ${allDone ? 'checklist fully APPROVED' : 'stage approved'} — ${template.gates[gate] ?? gate}`,
            `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;max-width:560px"><p>Dear ${esc(person.name || 'Sirs')},</p><p>For your information: <b>${esc(where)}</b> has been approved by both the Consultant and the Employer.${allDone ? ' <b>All stages of this checklist are now approved.</b>' : ''}</p></div>`,
          );
        }
      }
      return json({ success: true, result: 'approved', bothApproved, allDone });
    }

    if (body.decision === 'comment') {
      if (comment.length < 3) return json({ error: 'Please write your comment.' }, 400);
      await rest(`checklist_approval_requests?id=eq.${reqRow.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'commented', signer_name: name || null, comment, decided_at: nowIso }) });
      await rest(`checklist_approval_requests?instance_id=eq.${inst.id}&gate_key=eq.${gate}&status=eq.pending`, { method: 'PATCH', body: JSON.stringify({ status: 'superseded' }) });

      // The stage goes back to the site team (unlocked) together with the comment; earlier approvals of the round are void.
      const newGates = { ...gates, [gate]: { status: 'draft', last_comment: { party, name: name || null, email: reqRow.email, text: comment, at: nowIso } } };
      await rest(`checklist_instances?id=eq.${inst.id}`, { method: 'PATCH', body: JSON.stringify({ gates: newGates }) });
      await rest('checklist_events', { method: 'POST', body: JSON.stringify({ instance_id: inst.id, action: 'comment', detail: { gate, party, name, email: reqRow.email, comment } }) });

      await mail(
        submitter,
        `[${project?.name ?? ''}] ${towerLabel}: comment from ${PARTY_LABEL[party]} — ${template.gates[gate] ?? gate}`,
        `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;max-width:560px"><p><b>${esc(where)}</b></p><p><b>${esc(PARTY_LABEL[party])}</b> (${esc(name || reqRow.email)}) sent a comment:</p><blockquote style="margin:8px 0;padding:8px 12px;border-left:3px solid #f59e0b;background:#fffbeb">${esc(comment)}</blockquote><p>The stage is open for editing again. Please correct it and submit it for approval again.</p><p><a href="${openLink}">Open the checklist</a></p></div>`,
      );
      return json({ success: true, result: 'commented' });
    }

    return json({ error: 'decision must be "approve" or "comment"' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
