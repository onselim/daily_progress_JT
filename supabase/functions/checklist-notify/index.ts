// Submits one approval stage (gate) of a checklist: marks it "submitted", creates a personal approval link for every
// Consultant / Employer contact of the project and e-mails it (via Resend, same account as the daily report).
// Called from the app by a signed-in admin or field engineer (supabase.functions.invoke) -- also used for "Resend".
//
// Deploy: Supabase Dashboard -> Edge Functions -> new function "checklist-notify" -> paste this file.
// Secrets used: RESEND_API_KEY (already set for send-daily-report); the Supabase ones are injected automatically.
// The function checks the caller itself (like invite-project-member), so "Verify JWT" may be switched off.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SITE = 'https://svkdk.com';
const FROM = 'Site Checklists <checklists@svkdk.com>';
const PARTIES = ['consultant', 'employer'] as const;
type Party = (typeof PARTIES)[number];

/** Approval stages per checklist template (must match app/src/lib/checklists/foundation.ts). */
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
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Missing Supabase environment variables' }, 500);
  if (!resendKey) return json({ error: 'Missing RESEND_API_KEY secret' }, 500);

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

  try {
    const { instanceId, gate } = (await req.json()) as { instanceId?: string; gate?: string };
    if (!instanceId || !gate) return json({ error: 'Expected { instanceId, gate }' }, 400);

    // Who is calling, and may they act on this project?
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Not signed in' }, 401);
    const callerRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` } });
    if (!callerRes.ok) return json({ error: 'Invalid session' }, 401);
    const caller = await callerRes.json();

    const instRows = await rest(`checklist_instances?select=*&id=eq.${encodeURIComponent(instanceId)}`);
    const inst = instRows?.[0];
    if (!inst) return json({ error: 'Checklist not found' }, 404);

    const roles = await rest(`user_project_roles?select=role&project_id=eq.${inst.project_id}&user_id=eq.${caller.id}&role=in.(admin,field_engineer)`);
    if (!roles?.length) return json({ error: 'Not allowed on this project' }, 403);

    const template = TEMPLATES[inst.template_key];
    if (!template || !template.gates[gate]) return json({ error: `Unknown stage "${gate}"` }, 400);

    const project = (await rest(`projects?select=id,slug,name&id=eq.${inst.project_id}`))?.[0];
    const asset = (await rest(`assets?select=asset_code&id=eq.${inst.asset_id}`))?.[0];
    const cfg = (await rest(`project_config?select=value&project_id=eq.${inst.project_id}&key=eq.checklist_recipients`))?.[0]?.value as
      | Partial<Record<Party, string[]>>
      | undefined;

    const recipients: { party: Party; email: string }[] = [];
    const missing: Party[] = [];
    for (const party of PARTIES) {
      const list = (cfg?.[party] ?? []).map((e) => String(e).trim().toLowerCase()).filter((e) => EMAIL_RE.test(e));
      if (list.length === 0) missing.push(party);
      for (const email of Array.from(new Set(list))) recipients.push({ party, email });
    }
    if (recipients.length === 0) {
      return json({ error: 'No Consultant / Employer e-mail address is configured for this project (project_config "checklist_recipients").', missing }, 400);
    }

    // Replace any earlier pending links of this stage (a re-send invalidates the old ones).
    await rest(`checklist_approval_requests?instance_id=eq.${inst.id}&gate_key=eq.${gate}&status=eq.pending`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'superseded' }),
    });

    const nowIso = new Date().toISOString();
    const links: { party: Party; email: string; token: string; hash: string }[] = [];
    for (const r of recipients) {
      const token = randomToken();
      links.push({ ...r, token, hash: await sha256Hex(token) });
    }
    await rest('checklist_approval_requests', {
      method: 'POST',
      body: JSON.stringify(links.map((l) => ({ instance_id: inst.id, gate_key: gate, party: l.party, email: l.email, token_hash: l.hash, last_sent_at: nowIso }))),
    });

    const towerLabel = `Tower ${asset?.asset_code ?? ''}`.trim();
    const subject = `[${project?.name ?? 'Project'}] ${template.title} checklist — ${towerLabel} — approval requested`;
    const sent: string[] = [];
    const failed: string[] = [];
    for (const l of links) {
      const url = `${SITE}/review/${l.token}`;
      const html = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;max-width:560px">
  <p>Dear Sirs,</p>
  <p>The <b>${esc(template.title)}</b> checklist of <b>${esc(towerLabel)}</b> (${esc(project?.name ?? '')}) has been submitted for your review.</p>
  <p style="margin:6px 0"><b>Stage:</b> ${esc(template.gates[gate])}<br/>
     <b>You are asked to respond as:</b> ${l.party === 'consultant' ? 'Consultant' : 'Employer'}<br/>
     <b>Submitted by:</b> ${esc(caller.email ?? '')}</p>
  <p style="margin:22px 0"><a href="${url}" style="background:#2563eb;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:bold">Review &amp; Approve</a></p>
  <p>On the page you can read the checklist, approve it, or send a comment back to the site team.<br/>
  If the button does not work, copy this link into your browser:<br/><span style="color:#6b7280;font-size:12px">${url}</span></p>
  <p style="color:#6b7280;font-size:12px">This link is personal to ${esc(l.email)}. Please do not forward it.</p>
</div>`;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [l.email], subject, html }),
      });
      if (res.ok) sent.push(l.email);
      else failed.push(`${l.email}: ${(await res.text()).slice(0, 200)}`);
    }

    if (sent.length === 0) {
      await rest(`checklist_approval_requests?instance_id=eq.${inst.id}&gate_key=eq.${gate}&status=eq.pending`, { method: 'PATCH', body: JSON.stringify({ status: 'superseded' }) });
      return json({ error: 'E-mail could not be sent', failed }, 502);
    }

    // Record the new state: this stage is submitted and waiting for both parties.
    const approvals: Record<string, unknown> = {};
    for (const party of PARTIES) approvals[party] = { status: 'pending', emails: links.filter((l) => l.party === party).map((l) => l.email) };
    const gates = { ...(inst.gates ?? {}), [gate]: { status: 'submitted', submitted_at: nowIso, submitted_by: caller.email ?? '', approvals } };
    await rest(`checklist_instances?id=eq.${inst.id}`, { method: 'PATCH', body: JSON.stringify({ gates }) });
    await rest('checklist_events', {
      method: 'POST',
      body: JSON.stringify({ instance_id: inst.id, user_id: caller.id, action: 'submit_gate', detail: { gate, sent, failed } }),
    });

    return json({ success: true, sent, failed, missing });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
