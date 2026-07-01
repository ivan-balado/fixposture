# Fix Posture — Landing de validación

Landing HTML/CSS estática. Un solo archivo (`index.html`) con estilos y JS embebidos, sin build ni dependencias salvo dos fuentes de Google (Inter + Instrument Sans).

## Cómo probar localmente

Abre `index.html` en el navegador. Ya está.

## Cómo desplegar (2 minutos)

1. Ve a [vercel.com/new](https://vercel.com/new) o [netlify.com/drop](https://app.netlify.com/drop).
2. Arrastra la carpeta `landing/` completa.
3. Copia la URL pública. Ya tienes waitlist en vivo.

Cuando tengas dominio propio, conéctalo desde el panel del hosting.

## Qué tienes que reemplazar antes de lanzar

### 1. Endpoint del formulario (crítico)

Sin esto, los emails NO se guardan. Mientras el `FORM_ENDPOINT` siga con `YOUR_DEPLOY_ID`, el formulario simula éxito pero no manda nada — verás un warning en la consola.

**Guía completa con Google Sheet + Apps Script (gratis, sin límites de emails guardados, 100 emails/día enviados).**

#### 1.1 Crear la Google Sheet
1. Ve a [sheets.new](https://sheets.new) y crea una hoja.
2. Renómbrala a "Fix Posture — Waitlist".

#### 1.2 Pegar el Apps Script
1. En la Sheet: **Extensiones → Apps Script**.
2. Borra el `function myFunction() {}` que viene por defecto.
3. Copia el contenido íntegro de [`apps-script/waitlist.gs`](apps-script/waitlist.gs) y pégalo en `Code.gs`.
4. Guarda (Ctrl+S). Nombra el proyecto "Fix Posture Waitlist".

#### 1.3 (Opcional pero recomendado) Probar el envío
1. En el editor, selecciona la función `TEST_sendMeConfirmation` en el desplegable superior.
2. Pulsa **Ejecutar** (▶).
3. Apps Script te pedirá permisos → autoriza con tu cuenta de Gmail. La primera vez sale una pantalla de "no verificado" → **Avanzado → Ir al proyecto (no seguro) → Permitir**. Es tu propio código, no pasa nada.
4. Revisa tu bandeja: llega el email de bienvenida con el prefijo `[TEST]`.

#### 1.4 Desplegar como Web App
1. Botón **Deploy** (esquina superior derecha) → **Nueva implementación**.
2. Icono del engranaje ⚙ → **Aplicación web**.
3. Rellena:
   - **Descripción:** `waitlist v1`
   - **Ejecutar como:** *Yo* (`ivann19bj@gmail.com`)
   - **Quién tiene acceso:** *Cualquier persona* (imprescindible: si pones "cualquier persona con cuenta de Google" bloquea a los visitantes anónimos de la landing).
4. **Implementar** → autoriza si hace falta → copia la **URL de la aplicación web** (formato `https://script.google.com/macros/s/AKfycb…/exec`).

#### 1.5 Pegar la URL en el landing
En [`index.html`](index.html) busca:
```js
const FORM_ENDPOINT = 'https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec';
```
Sustituye por tu URL real. Guarda. Ya está.

#### 1.6 Probar en el navegador
1. Abre `index.html`.
2. Escribe un email tuyo (no el mismo con el que ejecutas Apps Script, o valida con uno alternativo para ver la duplicación).
3. Revisa: (a) la Sheet tiene una fila nueva, (b) llega el email de confirmación.

#### Cuando actualices el `.gs`
Cada cambio en el Apps Script hay que **desplegarlo de nuevo** con **Deploy → Gestionar implementaciones → editar (✏) → Versión: Nueva versión → Implementar**. La URL de "/exec" se mantiene.

**Importante:** el `waitlist.gs` incluye anti-bot (honeypot + comprobación de dwell time). Si actualizas el archivo local, acuérdate de:
1. Pegar el nuevo contenido en el editor de Apps Script.
2. Guardar (Ctrl+S).
3. **Deploy → Gestionar implementaciones → editar (✏) → Nueva versión → Implementar.**

Sin este paso, el endpoint sigue ejecutando la versión anterior.

#### Cuándo migrar (post-validación)
- Superas los 100 emails/día de envío (Gmail personal) → **Google Workspace** te da 1.500/día por 6€/mes, o migra a **Resend** (3000/mes gratis) / **Loops** (1000 contactos gratis).
- Quieres una secuencia drip real → **Loops** es lo más rápido de montar.
- Los datos de la Sheet se exportan como CSV cuando quieras cambiar de sistema.

### 2. Assets del Figma (ya descargados)

Los assets ya están descargados vía el Figma MCP y guardados en `landing/assets/`:

| Archivo | Origen | Uso |
|---|---|---|
| `assets/hero-bg.png` | Nodo `1:634` — imagen Gemini AI del torso/espalda | Fondo del hero, con gradient overlay hacia blanco. |
| `assets/silhouette-raw-a.png` | Imagen fuente de las 3 vistas del cuerpo | Utilizada en las 3 "tarot cards" del paso 1. |
| `assets/step1-card.svg` .. `step3-card.svg` | Exports SVG por si quieres sustituir los mock CSS. | Opcional. Actualmente reconstruimos el paso 2 (sparkles) y el paso 3 (report) con SVG/CSS inline. |

Si vuelves a exportar desde Figma para actualizar: clic derecho en Figma → panel derecho → "Export" → PNG 2x o SVG → botón "Export".

### 3. Analytics (recomendado)

Para medir conversión visita → email, añade al `<head>` del `index.html`:

**Plausible** (privacy-friendly, ~10€/mes):
```html
<script defer data-domain="tudominio.com" src="https://plausible.io/js/script.js"></script>
```

**Vercel Analytics** (gratis si despliegas en Vercel): actívalo en el panel de Vercel.

## Estructura de archivos

```
landing/
├── index.html          ← todo el HTML+CSS+JS en un archivo
├── README.md           ← este archivo
└── assets/             ← crea esta carpeta y mete aquí los exports del Figma
    ├── hero-bg.png     ← imagen del torso (opcional pero recomendado)
    ├── logo.svg        ← isotipo (opcional)
    └── footer-img.png  ← banner grande del footer (opcional)
```

## Idiomas

Toggle ES/EN funcional en el header. La preferencia se guarda en localStorage. La primera visita detecta idioma del navegador.

Para añadir textos: edita el objeto `dict` en la sección `<script>` al final del `index.html`. Añade la clave al elemento HTML con `data-i18n="tu.clave"`.

## Buenas prácticas para medir la validación

Umbrales sugeridos (después de dirigir ~500 visitas cualificadas):

- **Conversión visita → email < 3%** → mensaje o positioning necesita cambio.
- **Conversión 3-6%** → señal tibia, seguir iterando copy.
- **Conversión > 6%** → señal buena, entrar a construir MVP.

Ejemplo de test A/B: dos versiones del hero con distintas frases, misma inversión de tráfico, mismo periodo (mínimo 2 semanas). Ganadora se queda.
