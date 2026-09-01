// Renders the Jvari-Tskaltubo Daily Progress Report to PDF (via Browserless -- this
// runtime has no headless-browser capability of its own) and emails it (via Resend) to
// the recipients configured on the project's "Report settings" admin page. Invoked on
// a schedule by a pg_cron job (see supabase/schedule_daily_report.sql) at 23:59 Georgia
// time, and can also be test-invoked directly from the Supabase Dashboard's Edge
// Functions page at any time.

const REPORT_URL = 'https://svkdk.com/print/jvari-tskaltubo';
const PROJECT_ID = '68f9083d-a58f-4851-ac08-026766d21eb7'; // jvari-tskaltubo
const FROM = '500kV Jvari-Tskaltubo Daily Report <reports@svkdk.com>';

/** Georgia is fixed UTC+4 year-round (no DST) -- used for both "today" (the date on
 * the subject line) and the pause check below, so a "suspend until" date picked in the
 * admin UI (which the user reads in their own local time) lines up with when the
 * scheduled run actually fires. */
function todayInGeorgia(): Date {
  return new Date(Date.now() + 4 * 60 * 60 * 1000);
}

interface ReportConfig {
  recipients: string[];
  pausedUntil: string | null;
}

/** Reads the recipient list and pause date straight from project_config via the
 * service-role key Supabase auto-injects into every Edge Function -- no secret to set
 * up for this, unlike RESEND_API_KEY/BROWSERLESS_API_KEY. */
async function fetchReportConfig(): Promise<ReportConfig> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (should be auto-provided)');
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/project_config?select=key,value&project_id=eq.${PROJECT_ID}&key=in.(report_recipients,report_paused_until)`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
  );
  if (!res.ok) throw new Error(`project_config fetch failed: ${res.status} ${await res.text()}`);

  const rows: { key: string; value: unknown }[] = await res.json();
  const recipients = (rows.find((r) => r.key === 'report_recipients')?.value as string[] | undefined) ?? [];
  const pausedUntil = (rows.find((r) => r.key === 'report_paused_until')?.value as string | null | undefined) ?? null;
  return { recipients, pausedUntil };
}

/** Converts a large ArrayBuffer to base64 without spreading it into
 * String.fromCharCode all at once (which throws "Maximum call stack size exceeded"
 * on PDFs of more than a few hundred KB). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function georgiaDateParts(d: Date): { iso: string; formatted: string } {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return { iso: `${yyyy}-${mm}-${dd}`, formatted: `${dd}.${mm}.${yyyy}` };
}

Deno.serve(async () => {
  try {
    const config = await fetchReportConfig();
    const today = georgiaDateParts(todayInGeorgia());

    if (config.pausedUntil && config.pausedUntil >= today.iso) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: `Sending paused until ${config.pausedUntil}` }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (config.recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients configured on the Report settings page' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const browserlessKey = Deno.env.get('BROWSERLESS_API_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!browserlessKey || !resendKey) {
      return new Response(
        JSON.stringify({ error: 'Missing BROWSERLESS_API_KEY or RESEND_API_KEY secret' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const pdfRes = await fetch(`https://production-sfo.browserless.io/pdf?token=${browserlessKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: REPORT_URL,
        gotoOptions: { waitUntil: 'networkidle2' },
        // The report is a React app that fetches its data from Supabase and loads a
        // Leaflet/satellite map after the initial page load -- without this, Browserless
        // captures the page mid-"Loading..." with nothing rendered yet.
        waitForTimeout: 4000,
        options: { printBackground: true, format: 'A4', landscape: true, preferCSSPageSize: true },
      }),
    });

    if (!pdfRes.ok) {
      const detail = await pdfRes.text();
      return new Response(JSON.stringify({ error: 'PDF generation failed', detail }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const pdfBase64 = arrayBufferToBase64(await pdfRes.arrayBuffer());
    const dateStr = today.formatted;
    const subject = `DailyProgress Report-500kV Jvari-Tskaltubo - ${dateStr}`;
    const filename = `DailyProgress_Report_500kV_Jvari-Tskaltubo_${dateStr.replace(/\./g, '-')}.pdf`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: config.recipients,
        subject,
        html: '<p>Dear Sirs,</p><p>Daily progress report for abovementioned project is enclosed for your information.</p>',
        attachments: [{ filename, content: pdfBase64, content_type: 'application/pdf' }],
      }),
    });

    const emailResult = await emailRes.json();
    if (!emailRes.ok) {
      return new Response(JSON.stringify({ error: 'Email send failed', detail: emailResult }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, emailId: emailResult.id, subject }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
