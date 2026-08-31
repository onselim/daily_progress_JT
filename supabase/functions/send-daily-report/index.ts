// Renders the Jvari-Tskaltubo Daily Progress Report to PDF (via Browserless -- this
// runtime has no headless-browser capability of its own) and emails it (via Resend) to
// the project's daily report recipient. Invoked on a schedule by a pg_cron job (see
// supabase/schedule_daily_report.sql) at 23:59 Georgia time, and can also be
// test-invoked directly from the Supabase Dashboard's Edge Functions page at any time.

const REPORT_URL = 'https://svkdk.com/print/jvari-tskaltubo';
const RECIPIENT = 'son@bozlaryapi.com';
const FROM = '500kV Jvari-Tskaltubo Daily Report <reports@svkdk.com>';

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

/** Georgia is fixed UTC+4 year-round (no DST), so "today" for the report has to be
 * computed from that offset rather than the function runtime's own (UTC) clock --
 * matters for both the 23:59 scheduled run and any manual test invocation. */
function georgiaDateString(): string {
  const georgia = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const dd = String(georgia.getUTCDate()).padStart(2, '0');
  const mm = String(georgia.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = georgia.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

Deno.serve(async () => {
  try {
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
    const dateStr = georgiaDateString();
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
        to: [RECIPIENT],
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
