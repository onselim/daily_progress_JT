// Invites a new user (or re-adds/re-roles an existing one) onto a project's team. Called
// directly from the browser (the admin "Team" page), unlike send-daily-report which is
// cron/dashboard-only -- so, unlike that function, this one needs CORS handling.
//
// Auth model: the caller's own session JWT (forwarded automatically by
// `supabase.functions.invoke()`) is used only to resolve *who* is calling and check
// they're an admin on the target project; all actual writes go through the
// service-role key (auto-injected, same as every other Edge Function here), since
// creating an auth.users row requires the Admin API.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

type Role = 'admin' | 'field_engineer';

interface InviteRequest {
  projectId: string;
  email: string;
  role: Role;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY (should be auto-provided)' }, 500);
  }

  try {
    const { projectId, email, role } = (await req.json()) as Partial<InviteRequest>;
    if (!projectId || !email || (role !== 'admin' && role !== 'field_engineer')) {
      return jsonResponse({ error: 'Expected { projectId, email, role: "admin" | "field_engineer" }' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    const callerJwt = authHeader?.replace(/^Bearer\s+/i, '');
    if (!callerJwt) return jsonResponse({ error: 'Missing Authorization bearer token' }, 401);

    // Who's calling?
    const callerRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${callerJwt}` },
    });
    if (!callerRes.ok) return jsonResponse({ error: 'Invalid session' }, 401);
    const caller = await callerRes.json();

    // Are they an admin on this project?
    const roleCheckRes = await fetch(
      `${supabaseUrl}/rest/v1/user_project_roles?select=role&project_id=eq.${projectId}&user_id=eq.${caller.id}&role=eq.admin`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
    );
    const roleCheck = await roleCheckRes.json();
    if (!roleCheckRes.ok || !Array.isArray(roleCheck) || roleCheck.length === 0) {
      return jsonResponse({ error: 'Only an admin of this project can invite/assign members' }, 403);
    }

    // Does a user with this email already exist? (profiles mirrors auth.users)
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id&email=eq.${encodeURIComponent(email)}`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
    );
    const profileRows = await profileRes.json();
    let userId: string | undefined = Array.isArray(profileRows) ? profileRows[0]?.id : undefined;
    let created = false;

    if (!userId) {
      const inviteRes = await fetch(
        `${supabaseUrl}/auth/v1/invite?redirect_to=${encodeURIComponent('https://svkdk.com/accept-invite')}`,
        {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        },
      );
      const inviteResult = await inviteRes.json();
      if (!inviteRes.ok) {
        return jsonResponse({ error: 'Invite failed', detail: inviteResult }, 502);
      }
      userId = inviteResult.id;
      created = true;
    }

    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/user_project_roles?on_conflict=user_id,project_id`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([{ user_id: userId, project_id: projectId, role }]),
    });
    if (!upsertRes.ok) {
      return jsonResponse({ error: 'Role assignment failed', detail: await upsertRes.text() }, 502);
    }

    return jsonResponse({ ok: true, created });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
