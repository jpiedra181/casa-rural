# La Casa del Pinar · Web demo

Web de demostración de una casa rural ficticia en la Sierra de Guadarrama (Segovia).
Diseño: Figma › "C2 · Junto al fuego". Desarrollo: Astro (estático) + Netlify.

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # genera /dist
npm run preview
```

> En local, `/api/availability` no existe: el calendario usa automáticamente
> `public/data/availability-demo.json`. Para probar la función real usa `netlify dev`.

## Imágenes

Las fotos van en `src/assets/images/` con estos nombres (jpg):

| Archivo | Dónde sale |
|---|---|
| `hero.jpg` | Portada |
| `salon.jpg` | La casa (arco) |
| `dormitorio.jpg`, `cocina.jpg`, `bano.jpg`, `jardin.jpg` | Galería (arcos) |
| `porche.jpg` | Galería (foto ancha) |
| `segovia.jpg`, `la-granja.jpg`, `valsain.jpg`, `navacerrada.jpg` | El entorno |

Astro las convierte a AVIF/WebP con varios tamaños. Si falta alguna, se muestra un marcador
y el build no falla. En Figma hay un frame **"⬇ Exportar → src/assets/images"** con todas
preparadas: selecciónalo y pulsa *Export* (ya tienen JPG configurado y el nombre correcto).

Para la vista previa al compartir en redes, añade también `public/og.jpg` (1200×630).

## Responsive

Probada de 320 px a 4K (3840×2160), en vertical y en horizontal.

- **Todo va en `rem`** (salvo bordes finos y puntos de corte). Hasta ~1680 px, 1rem = 16px; a partir
  de ahí `html { font-size }` crece de forma fluida hasta ×1,75 en 4K, así que la página escala en
  proporción en monitores grandes. Al añadir estilos nuevos, usa `rem`, no `px`.
- **Puntos de corte:** 374 (móviles muy estrechos), 600 (tablet), 640 (La casa a dos columnas),
  860 (galería/entorno/tour), 980 (hero y reservas apilados), 1080 (menú desplegable), 1180/1240
  (portátiles pequeños). Móviles en horizontal: `(max-height: 520–560px) and (orientation: landscape)`.
- **Fotos:** `Photo.astro` añade siempre el original como versión mayor del `srcset` y, para anchos
  fijos, una regla de `sizes` para pantallas grandes. Para que se vean nítidas en 4K y en móviles
  de alta densidad conviene exportar: hero ≥ 2560 px de ancho (ideal 3840), arcos ≥ 1200×1600 y
  porche ≥ 2400 px.

## Visita virtual 360°

El botón "Recorrer la casa en 360°" y la foto del porche abren un popup con un tour
(`src/components/Tour.astro` + `src/scripts/tour.ts`). El visor es
[Pannellum](https://pannellum.org) (MIT), alojado en `public/vendor/pannellum/`; ni el visor ni las
panorámicas se descargan hasta que alguien abre el tour.

- Panorámicas en `public/tour/`: equirectangulares 2:1 a 4096×2048 (`salon.jpg`, `dormitorio.jpg`,
  `pinar.jpg`) y una versión de 1024×512 `-preview.jpg` que se ve mientras carga.
- Las de ejemplo son de [Poly Haven](https://polyhaven.com) (CC0). Para un cliente real se
  sustituyen por las de su casa con los mismos nombres.
- Estancias, vista inicial y puntos de salto (`yaw`/`pitch` en grados) se definen al principio
  de `Tour.astro`. Textos y bloque "Servicio extra" en `src/i18n/ui.ts` → `tour`.

## Qué cambiar para un cliente real

Todo está centralizado:

- `src/data/site.ts` → nombre, teléfono/WhatsApp, email, dirección, registro turístico, **tarifas y temporadas**.
- `src/i18n/ui.ts` → todos los textos en español e inglés.
- `src/styles/global.css` → colores y tipografías (mismos tokens que la colección "Tema" de Figma).

## Calendario sincronizado con Booking

1. En la extranet de Booking: *Tarifas y disponibilidad › Sincronizar calendarios › Exportar* → copia la URL `.ics`.
2. En Netlify: *Site configuration › Environment variables* → `ICAL_URL = <esa URL>`.
3. La función `netlify/functions/availability.mjs` lee el iCal (caché de 1 h) y el calendario
   marca esas noches como ocupadas. Sin `ICAL_URL` devuelve datos de ejemplo.

Booking sigue siendo la única fuente de verdad: cuando el dueño confirma una reserva directa,
la bloquea en Booking como ya hace con las de teléfono.

## Solicitudes de reserva

- Formulario con **Netlify Forms** (`name="reserva"`). Las solicitudes llegan al panel de Netlify
  y se pueden reenviar por email (*Forms › Form notifications*).
- Botón de WhatsApp con el mensaje ya escrito (fechas y personas).
- Sin pago online: el dueño confirma y pide la señal (Bizum/transferencia).

## Accesibilidad (WCAG 2.2 AA)

- Calendario con patrón *grid* de WAI-ARIA: flechas, Inicio/Fin, RePág/AvPág, estado anunciado.
- Formulario con etiquetas, errores vinculados (`aria-describedby`) y resumen de errores enfocable.
- Contrastes AA en toda la paleta, foco visible, enlace "Saltar al contenido", `lang` por idioma.
- Animaciones (chispas, parpadeo del fuego) desactivadas con `prefers-reduced-motion`.
- Mapa de Google cargado solo al pulsar (sin cookies de terceros por defecto).
- Revisión automática con axe-core: 0 incidencias.

## Pendiente antes de usarla con un cliente

- Sustituir fotos de IA por fotos reales (sobre todo las del entorno: son lugares reales).
- Páginas de aviso legal, privacidad y declaración de accesibilidad.
- Quitar la franja "Web de demostración" y el `noindex` de `src/layouts/Base.astro`.
- Visita virtual 360° (el botón está preparado y desactivado).
