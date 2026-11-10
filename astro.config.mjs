// @ts-check
import { defineConfig } from 'astro/config';

// Cambia `site` por el dominio definitivo cuando la publiques.
export default defineConfig({
  site: 'https://casarural.jpiedra.com',
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
