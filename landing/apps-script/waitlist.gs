/**
 * Fix Posture — Waitlist backend (Google Apps Script)
 *
 * Qué hace:
 *  1. Recibe POST con { email, source, lang } desde la landing.
 *  2. Valida el email.
 *  3. Añade una fila a la hoja "Waitlist" (crea encabezado si no existe).
 *  4. Envía email de confirmación en ES o EN según `lang`.
 *  5. Evita reenviar si el email ya existía (idempotente).
 *
 * Cómo desplegarlo:
 *  1. Crea un Google Sheet nuevo. Nómbralo "Fix Posture — Waitlist" (o lo que quieras).
 *  2. Menú Extensiones → Apps Script.
 *  3. Pega este archivo en Code.gs.
 *  4. Menú Deploy → New deployment → tipo "Web app".
 *     - "Execute as": Me (tu cuenta)
 *     - "Who has access": Anyone
 *  5. Autoriza los permisos (SpreadsheetApp + MailApp).
 *  6. Copia la Web App URL. Se ve así:
 *     https://script.google.com/macros/s/AKfycb.../exec
 *  7. Pégala en landing/index.html como FORM_ENDPOINT.
 *
 * Límites:
 *  - Gmail personal: 100 emails/día (suficiente para llegar a los 500 sin problema).
 *  - Si algún día lo superas, migra a Loops/Resend.
 */

const SHEET_NAME = 'Waitlist';
const FROM_NAME  = 'Iván — Fix Posture';
const REPLY_TO   = 'ivann19bj@gmail.com';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: 'no_body' });
    }
    const body = JSON.parse(e.postData.contents);
    const email  = (body.email  || '').toString().trim().toLowerCase();
    const source = (body.source || 'landing').toString().slice(0, 60);
    const lang   = ((body.lang  || 'es').toString().toLowerCase() === 'en') ? 'en' : 'es';

    if (!isValidEmail(email)) {
      return jsonOut({ ok: false, error: 'invalid_email' });
    }

    const sheet = getOrCreateSheet_();

    // Duplicate check
    if (isDuplicate_(sheet, email)) {
      return jsonOut({ ok: true, duplicate: true });
    }

    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, 5).setValues([[new Date(), email, source, lang, false]]);

    const { subject, textBody, htmlBody } = buildEmail_(lang);
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: textBody,
      htmlBody: htmlBody,
      name: FROM_NAME,
      replyTo: REPLY_TO,
    });

    sheet.getRange(row, 5).setValue(true);
    return jsonOut({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonOut({ ok: false, error: String(err && err.message || err) });
  }
}

// GET no lo usamos, pero devolvemos algo útil por si alguien visita la URL.
function doGet() {
  return ContentService
    .createTextOutput('Fix Posture waitlist endpoint. POST only.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, 5).setValues([['Timestamp', 'Email', 'Source', 'Lang', 'Confirmed']]);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 180);
    sh.setColumnWidth(2, 280);
    sh.setColumnWidth(3, 140);
    sh.setColumnWidth(4, 70);
    sh.setColumnWidth(5, 100);
  }
  return sh;
}

function isDuplicate_(sheet, email) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const emails = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (let i = 0; i < emails.length; i++) {
    if ((emails[i][0] || '').toString().trim().toLowerCase() === email) return true;
  }
  return false;
}

function buildEmail_(lang) {
  if (lang === 'en') {
    const subject = "You're in — Fix Posture waitlist (50% off locked in)";
    const textBody = [
      "Hey,",
      "",
      "You're on the Fix Posture waitlist. Your 50% off for life is locked in — as long as you're one of the first 500 (you are).",
      "",
      "What happens next:",
      "  • 1 short email a few weeks before launch (estimated late 2026) with a heads-up + your discount link.",
      "  • 1 email the day it goes live.",
      "  • Nothing else. Zero spam. Promised.",
      "",
      "One favor: hit reply and tell me in one line what posture issue bugs you the most right now (uneven shoulders, forward head, low back tension… whatever). Real answers will shape what we ship first.",
      "",
      "Thanks for the trust,",
      "Iván",
      "Fix Posture",
      "",
      "P.S. To unsubscribe just reply with \"remove\" and I'll take you off the list myself."
    ].join('\n');

    const htmlBody = htmlWrap_(`
      <p>Hey,</p>
      <p>You're on the <strong>Fix Posture</strong> waitlist. Your <strong>50% off for life</strong> is locked in — as long as you're one of the first 500 (you are).</p>
      <p><strong>What happens next:</strong></p>
      <ul>
        <li>1 short email a few weeks before launch (estimated late 2026) with a heads-up + your discount link.</li>
        <li>1 email the day it goes live.</li>
        <li>Nothing else. Zero spam. Promised.</li>
      </ul>
      <p>One favor: hit reply and tell me in one line what posture issue bugs you the most right now (uneven shoulders, forward head, low back tension… whatever). Real answers will shape what we ship first.</p>
      <p>Thanks for the trust,<br/>Iván<br/><span style="color:#605b5b">Fix Posture</span></p>
      <p style="color:#8a8a8a;font-size:13px">P.S. To unsubscribe just reply with "remove" and I'll take you off the list myself.</p>
    `);
    return { subject, textBody, htmlBody };
  }

  // ES (default)
  const subject = "Estás dentro — waitlist Fix Posture (50% asegurado)";
  const textBody = [
    "¡Hola!",
    "",
    "Estás dentro de la waitlist de Fix Posture. Tu 50% de descuento de por vida queda reservado — mientras seas de los primeros 500 (lo eres).",
    "",
    "Qué esperar a partir de ahora:",
    "  • 1 email breve unas semanas antes del lanzamiento (previsto finales de 2026) con aviso + tu enlace con descuento.",
    "  • 1 email el día que abramos.",
    "  • Nada más. Cero spam. Prometido.",
    "",
    "Un favor: respóndeme a este email en una sola línea diciendo cuál es el problema postural que más te preocupa ahora mismo (hombros desnivelados, cabeza adelantada, tensión lumbar… lo que sea). Con tus respuestas priorizamos qué construir primero.",
    "",
    "Gracias por la confianza,",
    "Iván",
    "Fix Posture",
    "",
    "P.D. Para darte de baja, responde este email con \"baja\" y te saco de la lista yo mismo."
  ].join('\n');

  const htmlBody = htmlWrap_(`
    <p>¡Hola!</p>
    <p>Estás dentro de la waitlist de <strong>Fix Posture</strong>. Tu <strong>50% de descuento de por vida</strong> queda reservado — mientras seas de los primeros 500 (lo eres).</p>
    <p><strong>Qué esperar a partir de ahora:</strong></p>
    <ul>
      <li>1 email breve unas semanas antes del lanzamiento (previsto finales de 2026) con aviso + tu enlace con descuento.</li>
      <li>1 email el día que abramos.</li>
      <li>Nada más. Cero spam. Prometido.</li>
    </ul>
    <p>Un favor: respóndeme a este email en una sola línea diciendo cuál es el problema postural que más te preocupa ahora mismo (hombros desnivelados, cabeza adelantada, tensión lumbar… lo que sea). Con tus respuestas priorizamos qué construir primero.</p>
    <p>Gracias por la confianza,<br/>Iván<br/><span style="color:#605b5b">Fix Posture</span></p>
    <p style="color:#8a8a8a;font-size:13px">P.D. Para darte de baja, responde este email con "baja" y te saco de la lista yo mismo.</p>
  `);
  return { subject, textBody, htmlBody };
}

function htmlWrap_(inner) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
               style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px;
                      font-family:-apple-system,Segoe UI,Inter,Helvetica,Arial,sans-serif;
                      color:#080808;font-size:16px;line-height:1.55;letter-spacing:-0.01em;">
          <tr><td>${inner}</td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

/**
 * Test rápido: pincha "Run" con esta función seleccionada para enviarte a ti mismo
 * el email de bienvenida y comprobar que MailApp y la Sheet están bien enlazados.
 */
function TEST_sendMeConfirmation() {
  const testEmail = Session.getActiveUser().getEmail() || REPLY_TO;
  const { subject, textBody, htmlBody } = buildEmail_('es');
  MailApp.sendEmail({
    to: testEmail,
    subject: '[TEST] ' + subject,
    body: textBody,
    htmlBody: htmlBody,
    name: FROM_NAME,
    replyTo: REPLY_TO,
  });
  console.log('Enviado a', testEmail);
}
