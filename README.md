# Fix Posture

Landing de validación para **Fix Posture** — herramienta de bienestar postural con IA para uso doméstico.

**Lo que hay aquí:**

- [`landing/`](landing/) — landing estática (HTML + CSS + JS en un solo archivo). Sin build, sin dependencias.
- [`landing/apps-script/waitlist.gs`](landing/apps-script/waitlist.gs) — backend gratuito en Google Apps Script que captura emails a un Google Sheet y envía el correo de bienvenida.
- [`logo/`](logo/) — isotipo y logotipo en SVG.
- [`imagenes/`](imagenes/) — assets sueltos de referencia.

**Cómo probar localmente:** abre `landing/index.html` en el navegador.

**Cómo desplegar:** conectado a Vercel (`vercel.json` en la raíz declara `outputDirectory: "landing"`, así que Vercel sirve `landing/` como site root sin depender del ajuste de Root Directory del panel). Cada push a `main` redepliega automáticamente.

**URL pública actual:** [fixposture-kappa.vercel.app](https://fixposture-kappa.vercel.app)

**Visibilidad del repo:** público (necesario para Vercel Hobby con deploys automáticos).

**Endpoint de waitlist:** Google Apps Script Web App vinculado a la Sheet privada "Fix Posture — Waitlist". Guarda `[timestamp, email, source, lang, confirmed]` y responde con el correo de bienvenida bilingüe (ES/EN).
