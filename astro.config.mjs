// @ts-check
import { defineConfig } from 'astro/config';

// Cambia `site` por el dominio definitivo cuando la publiques.
export default defineConfig({
  site: 'https://lacasadelpinar-demo.netlify.app',
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
