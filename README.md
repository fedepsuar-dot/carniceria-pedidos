# App de pedidos — La Carnicería

Catálogo de cortes con carrito, envío del pedido por WhatsApp, y panel de
administración para editar precios/cortes en vivo (sin tocar código).

## Qué incluye

- `public/index.html` — catálogo + carrito (lo que ve el cliente).
- `public/admin.html` — panel de administración (usuario + clave).
- `netlify/functions/products.js` — guarda el catálogo en **Netlify Blobs**
  (almacenamiento gratis de Netlify, ya incluido, no hay que contratar nada).
- `netlify/functions/login.js` — valida usuario/clave del admin.

## 1. Subir el proyecto a Netlify

La forma más simple, sin usar la terminal:

1. Subí esta carpeta a un repositorio de GitHub (podés arrastrar los archivos
   directamente en github.com > "Add file" > "Upload files").
2. En Netlify: **Add new site → Import an existing project** → elegí el
   repositorio.
3. Netlify va a detectar automáticamente `netlify.toml` (carpeta publicada
   `public`, funciones en `netlify/functions`). Dejá todo por defecto y
   dale a **Deploy**.

(Si preferís la terminal: `npm install -g netlify-cli`, después
`netlify deploy --prod` parado en esta carpeta.)

## 2. Configurar el usuario y clave del admin

Por defecto, mientras no configures nada, el acceso es:

- Usuario: `admin`
- Clave: `carne2026`

**Importante:** cambialo apenas subas el sitio. En Netlify:
**Site configuration → Environment variables** y agregá:

| Variable       | Valor                                  |
|----------------|-----------------------------------------|
| `ADMIN_USER`   | el usuario que quieras                  |
| `ADMIN_PASS`   | la clave que quieras                    |
| `ADMIN_SECRET` | cualquier texto largo al azar (es una clave interna, no la escribís en ningún lado, solo la genera el sistema) |

Después de agregarlas, hacé un **redeploy** del sitio (Deploys → Trigger
deploy) para que tomen efecto.

## 3. Tu número de WhatsApp

Ya está cargado: **54 9 11 6831-0327**. Si en algún momento lo tenés que
cambiar, se edita en `public/js/app.js`, la línea:

```js
const WHATSAPP_NUMBER = "5491168310327";
```

## 4. Cómo administrar los cortes

Entrá a `tusitio.netlify.app/admin`, iniciá sesión, y ahí podés:

- Cambiar precio, nombre, categoría, foto (pegando una URL) o si se vende
  por kg o por unidad, de cualquier corte ya cargado.
- Ocultar un corte del catálogo sin borrarlo (destildando "Visible").
- Marcarlo como "Oferta" (aparece con el sello de oferta).
- Agregar cortes nuevos.
- Borrarlos.

Los cambios se guardan al toque y los ven todos los clientes que entren al
catálogo, sin que vos tengas que hacer nada más.

## 5. Fotos

Arranca con fotos de relleno (placeholder) con el nombre de cada corte. Para
poner tus fotos reales: subilas a cualquier servicio (Google Drive con enlace
público, Imgur, Postimages, etc.), copiá el link directo a la imagen, y
pegalo en el campo "URL de la foto" del panel admin.

## 6. Cómo funciona el pedido

1. El cliente elige cantidad (de a 500g en los cortes por kg, de a 1 unidad
   en chorizos/morcillas) y toca "Agregar".
2. Abre el carrito, pone su nombre y toca "Enviar pedido por WhatsApp".
3. Se abre WhatsApp con el mensaje ya armado (cortes, cantidades y total
   estimado) listo para mandar a tu número.
4. Vos confirmás el total final y la hora de retiro por el chat.
