/**
 * Fix Posture — Waitlist backend (Google Apps Script)
 *
 * Qué hace:
 *  1. Recibe POST con { email, source, lang, hp, dwell } desde la landing.
 *  2. Valida el email y filtra bots (honeypot + dwell time).
 *  3. Añade una fila a la hoja "Waitlist" (crea encabezado si no existe).
 *  4. Calcula la posición del inscrito:
 *       - Posiciones 1–500 → tier "early" → email con 50% de descuento asegurado.
 *       - Posiciones 501+  → tier "late"  → email honesto: dentro, pero llegas
 *                                            tarde para el descuento; aviso al
 *                                            lanzamiento.
 *  5. Envía email de confirmación en ES o EN según `lang`.
 *  6. Evita reenviar si el email ya existía (idempotente).
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
 * Cuando actualices este archivo:
 *  - Deploy → Gestionar implementaciones → editar (✏) → Nueva versión → Implementar.
 *  - La URL /exec se mantiene.
 *
 * Límites:
 *  - Gmail personal: 100 emails/día (suficiente para llegar a los 500 sin problema).
 *  - Si algún día lo superas, migra a Loops/Resend.
 */

const SHEET_NAME       = 'Waitlist';
const FROM_NAME        = 'Iván — Fix Posture';
const REPLY_TO         = 'ivann19bj@gmail.com';
const ALLOWED_SOURCES  = ['landing-v1', 'landing-validation', 'preview', 'manual'];
const MIN_DWELL_MS     = 1000;   // Rechazar submits más rápidos que 1 s.
const EARLY_BIRD_LIMIT = 500;    // Primeros N reciben el 50% de descuento.

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: 'no_body' });
    }
    const body = JSON.parse(e.postData.contents);
    const email    = (body.email  || '').toString().trim().toLowerCase();
    const rawSrc   = (body.source || 'landing-v1').toString();
    const source   = ALLOWED_SOURCES.indexOf(rawSrc) >= 0 ? rawSrc : 'landing-v1';
    const lang     = ((body.lang  || 'es').toString().toLowerCase() === 'en') ? 'en' : 'es';
    const honeypot = (body.hp || '').toString();
    const dwell    = Number(body.dwell) || 0;

    // Anti-bot server-side: honeypot lleno o dwell demasiado corto → fake success.
    // Nunca guardamos ni respondemos con error para no dar señal al atacante.
    if (honeypot.length > 0 || (dwell > 0 && dwell < MIN_DWELL_MS)) {
      return jsonOut({ ok: true });
    }

    if (!isValidEmail(email)) {
      return jsonOut({ ok: false, error: 'invalid_email' });
    }

    const sheet = getOrCreateSheet_();

    // Duplicate check
    if (isDuplicate_(sheet, email)) {
      return jsonOut({ ok: true, duplicate: true });
    }

    // Posición = número de inscritos válidos + 1 (excluye header).
    const currentCount = Math.max(sheet.getLastRow() - 1, 0);
    const position     = currentCount + 1;
    const tier         = position <= EARLY_BIRD_LIMIT ? 'early' : 'late';

    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, 7).setValues([[
      new Date(), email, source, lang, false, position, tier
    ]]);

    const { subject, textBody, htmlBody } = buildEmail_(lang, tier);
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: textBody,
      htmlBody: htmlBody,
      name: FROM_NAME,
      replyTo: REPLY_TO,
    });

    sheet.getRange(row, 5).setValue(true);
    return jsonOut({ ok: true, tier: tier, position: position });
  } catch (err) {
    // Nunca devolvemos el detalle al cliente: podría filtrar implementación.
    console.error(err);
    return jsonOut({ ok: false, error: 'server_error' });
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
    sh.getRange(1, 1, 1, 7).setValues([[
      'Timestamp', 'Email', 'Source', 'Lang', 'Confirmed', 'Position', 'Tier'
    ]]);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 180);
    sh.setColumnWidth(2, 280);
    sh.setColumnWidth(3, 140);
    sh.setColumnWidth(4, 70);
    sh.setColumnWidth(5, 100);
    sh.setColumnWidth(6, 90);
    sh.setColumnWidth(7, 80);
  } else if (sh.getLastColumn() < 7) {
    // Migración de esquema v1 (5 columnas) → v2 (7 columnas).
    // Añade los headers de Position + Tier sin tocar los datos existentes.
    sh.getRange(1, 6, 1, 2).setValues([['Position', 'Tier']]);
    // Rellena las filas ya existentes con posición inferida por orden de aparición
    // y tier según el límite. Es una aproximación buena para historial pre-migración.
    const last = sh.getLastRow();
    if (last >= 2) {
      const backfill = [];
      for (let i = 0; i < last - 1; i++) {
        const pos = i + 1;
        backfill.push([pos, pos <= EARLY_BIRD_LIMIT ? 'early' : 'late']);
      }
      sh.getRange(2, 6, backfill.length, 2).setValues(backfill);
    }
    sh.setColumnWidth(6, 90);
    sh.setColumnWidth(7, 80);
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

function buildEmail_(lang, tier) {
  const isLate = (tier === 'late');

  if (lang === 'en') {
    if (isLate) {
      const subject = "You're in — Fix Posture waitlist (heads up on the 50%)";
      const textBody = [
        "Hey,",
        "",
        "You're on the Fix Posture waitlist. Genuinely thanks.",
        "",
        "Small heads up so we start with honesty: the 50% off for life was capped at the first 500 signups and those spots are already taken. You're on the list all the same and I'll email you the day we launch. If we open a second discount round later, you'll be first to hear.",
        "",
        "What happens next:",
        "  • 1 short email a few weeks before launch (estimated late 2026).",
        "  • 1 email the day it goes live with the regular launch price.",
        "  • Nothing else. Zero spam. Promised.",
        "",
        "One favor: hit reply and tell me in one line what posture issue bugs you the most right now. Real answers will shape what we ship first.",
        "",
        "Thanks for the trust,",
        "Iván",
        "Fix Posture",
        "",
        "P.S. To unsubscribe just reply with \"remove\" and I'll take you off the list myself."
      ].join('\n');

      const htmlBody = htmlWrap_(`
        <p>Hey,</p>
        <p>You're on the <strong>Fix Posture</strong> waitlist. Genuinely thanks.</p>
        <p>Small heads up so we start with honesty: the 50% off for life was capped at the first 500 signups and those spots are already taken. You're on the list all the same and I'll email you the day we launch. If we open a second discount round later, you'll be first to hear.</p>
        <p><strong>What happens next:</strong></p>
        <ul>
          <li>1 short email a few weeks before launch (estimated late 2026).</li>
          <li>1 email the day it goes live with the regular launch price.</li>
          <li>Nothing else. Zero spam. Promised.</li>
        </ul>
        <p>One favor: hit reply and tell me in one line what posture issue bugs you the most right now. Real answers will shape what we ship first.</p>
        <p>Thanks for the trust,<br/>Iván<br/><span style="color:#605b5b">Fix Posture</span></p>
        <p style="color:#8a8a8a;font-size:13px">P.S. To unsubscribe just reply with "remove" and I'll take you off the list myself.</p>
      `);
      return { subject, textBody, htmlBody };
    }

    // EN + early
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
  if (isLate) {
    const subject = "Estás en la waitlist de Fix Posture — aviso sobre el 50%";
    const textBody = [
      "¡Hola!",
      "",
      "Estás dentro de la waitlist de Fix Posture. Gracias de verdad.",
      "",
      "Antes de nada, un aviso honesto: el 50% de descuento de por vida estaba limitado a los primeros 500 inscritos y esas plazas ya están cubiertas. Sigues en la lista igualmente y te avisaré el día que abramos. Si más adelante hacemos una segunda ronda de descuento, serás de los primeros en saberlo.",
      "",
      "Qué esperar a partir de ahora:",
      "  • 1 email breve unas semanas antes del lanzamiento (previsto finales de 2026).",
      "  • 1 email el día que abramos con el precio de lanzamiento normal.",
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
      <p>Estás dentro de la waitlist de <strong>Fix Posture</strong>. Gracias de verdad.</p>
      <p>Antes de nada, un aviso honesto: el <strong>50% de descuento de por vida</strong> estaba limitado a los primeros 500 inscritos y esas plazas ya están cubiertas. Sigues en la lista igualmente y te avisaré el día que abramos. Si más adelante hacemos una segunda ronda de descuento, serás de los primeros en saberlo.</p>
      <p><strong>Qué esperar a partir de ahora:</strong></p>
      <ul>
        <li>1 email breve unas semanas antes del lanzamiento (previsto finales de 2026).</li>
        <li>1 email el día que abramos con el precio de lanzamiento normal.</li>
        <li>Nada más. Cero spam. Prometido.</li>
      </ul>
      <p>Un favor: respóndeme a este email en una sola línea diciendo cuál es el problema postural que más te preocupa ahora mismo (hombros desnivelados, cabeza adelantada, tensión lumbar… lo que sea). Con tus respuestas priorizamos qué construir primero.</p>
      <p>Gracias por la confianza,<br/>Iván<br/><span style="color:#605b5b">Fix Posture</span></p>
      <p style="color:#8a8a8a;font-size:13px">P.D. Para darte de baja, responde este email con "baja" y te saco de la lista yo mismo.</p>
    `);
    return { subject, textBody, htmlBody };
  }

  // ES + early
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
 * Test rápido: envía a ti mismo la variante "early" para verificar el flujo.
 */
function TEST_sendMeConfirmationEarly() {
  const testEmail = Session.getActiveUser().getEmail() || REPLY_TO;
  const { subject, textBody, htmlBody } = buildEmail_('es', 'early');
  MailApp.sendEmail({
    to: testEmail,
    subject: '[TEST early] ' + subject,
    body: textBody,
    htmlBody: htmlBody,
    name: FROM_NAME,
    replyTo: REPLY_TO,
  });
  console.log('Enviado [early] a', testEmail);
}

/**
 * Test rápido: envía a ti mismo la variante "late" para revisar el copy honesto.
 */
function TEST_sendMeConfirmationLate() {
  const testEmail = Session.getActiveUser().getEmail() || REPLY_TO;
  const { subject, textBody, htmlBody } = buildEmail_('es', 'late');
  MailApp.sendEmail({
    to: testEmail,
    subject: '[TEST late] ' + subject,
    body: textBody,
    htmlBody: htmlBody,
    name: FROM_NAME,
    replyTo: REPLY_TO,
  });
  console.log('Enviado [late] a', testEmail);
}
