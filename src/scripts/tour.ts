/**
 * Visita virtual 360°. Carga Pannellum (/public/vendor/pannellum) la primera vez
 * que se abre el diálogo; hasta entonces no se descarga nada.
 */
type Link = { to: string; label: string; yaw: number; pitch: number };
type Scene = { id: string; title: string; src: string; preview: string; yaw: number; pitch: number; links: Link[] };

interface Viewer {
  on(event: string, fn: (...args: any[]) => void): Viewer;
  loadScene(id: string, pitch?: number | string, yaw?: number | string, hfov?: number | string): Viewer;
  getScene(): string;
  getHfov(): number;
  setHfov(hfov: number, animated?: number | boolean): Viewer;
  resize(): void;
  startAutoRotate(speed?: number, pitch?: number): Viewer;
  stopAutoRotate(): Viewer;
}
declare global {
  interface Window { pannellum?: { viewer(el: HTMLElement, config: object): Viewer } }
}

const dialog = document.querySelector<HTMLDialogElement>('dialog[data-tour]');
if (dialog) setup(dialog);

function setup(dialog: HTMLDialogElement) {
  const { scenes } = JSON.parse(dialog.dataset.tour!) as { scenes: Scene[] };
  const $ = <T extends HTMLElement>(sel: string) => dialog.querySelector<T>(sel)!;
  const stage = $('[data-tour-stage]');
  const pano = $('[data-tour-pano]');
  const veil = $('[data-tour-veil]');
  const veilText = $('[data-tour-veil-text]');
  const hint = $('[data-tour-hint]');
  const fsBtn = $<HTMLButtonElement>('[data-tour-fs]');
  const chips = [...dialog.querySelectorAll<HTMLButtonElement>('[data-scene]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPIN = reduce ? 0 : -2.2;

  let viewer: Viewer | null = null;
  let lib: Promise<void> | null = null;
  let hinted = false;

  if (!document.fullscreenEnabled) fsBtn.hidden = true;

  const setVeil = (state: 'loading' | 'ready' | 'error') => {
    veil.dataset.state = state;
    if (state !== 'ready') veilText.textContent = state === 'error' ? dialog.dataset.error! : dialog.dataset.loading!;
  };
  const mark = (id: string) => chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.scene === id)));
  const hideHint = () => hint.classList.remove('is-on');

  // El CSS del visor debe estar aplicado antes de crearlo: si no, el lienzo nace con 0 px de alto.
  const fetchInto = (el: HTMLLinkElement | HTMLScriptElement) =>
    new Promise<void>((resolve, reject) => {
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('No se pudo cargar el visor 360'));
      document.head.append(el);
    });
  const loadLib = () =>
    (lib ??= window.pannellum
      ? Promise.resolve()
      : Promise.all([
          fetchInto(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/vendor/pannellum/pannellum.css' })),
          fetchInto(Object.assign(document.createElement('script'), { src: '/vendor/pannellum/pannellum.js', async: true })),
        ]).then(
          () => undefined,
          (err) => { lib = null; throw err; },
        ));

  const go = (id: string) => {
    if (viewer && viewer.getScene() !== id) viewer.loadScene(id);
  };

  // Punto de salto: brasa con etiqueta, accesible con teclado
  const hotspot = (div: HTMLElement, link: Link) => {
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', link.label);
    div.tabIndex = 0;
    const dot = document.createElement('span');
    dot.className = 'hs__dot';
    const label = document.createElement('span');
    label.className = 'hs__label';
    label.textContent = link.label;
    div.append(dot, label);
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(link.to); }
    });
  };

  const build = () => {
    const sceneConfig: Record<string, object> = {};
    for (const s of scenes) {
      sceneConfig[s.id] = {
        title: s.title,
        panorama: s.src,
        preview: s.preview,
        yaw: s.yaw,
        pitch: s.pitch,
        hotSpots: s.links.map((l) => ({
          type: 'scene', sceneId: l.to, yaw: l.yaw, pitch: l.pitch,
          cssClass: 'hs', createTooltipFunc: hotspot, createTooltipArgs: l,
        })),
      };
    }
    viewer = window.pannellum!.viewer(pano, {
      default: {
        firstScene: scenes[0].id,
        sceneFadeDuration: 900,
        autoLoad: true,
        showControls: false,
        compass: false,
        hfov: 105,
        minHfov: 45,
        maxHfov: 120,
        autoRotate: SPIN,
        autoRotateInactivityDelay: 6000,
        friction: 0.12,
      },
      scenes: sceneConfig,
    });
    // Pannellum crea el lienzo al llegar la imagen, a veces con su contenedor aún oculto (0 px de alto).
    // Lo vigilamos desde ese momento: al tomar su tamaño real (o al girar el móvil, pantalla completa…)
    // se recalcula el render.
    let watching = false;
    const watchCanvas = () => {
      const canvas = pano.querySelector('canvas');
      if (watching || !canvas || !('ResizeObserver' in window)) return;
      new ResizeObserver(() => viewer?.resize()).observe(canvas);
      watching = true;
    };
    viewer.on('scenechange', (id: string) => { setVeil('loading'); mark(id); });
    viewer.on('load', () => {
      watchCanvas();
      requestAnimationFrame(() => viewer?.resize());
      setVeil('ready');
      if (!hinted) {
        hinted = true;
        hint.classList.add('is-on');
        setTimeout(hideHint, 4500);
      }
    });
    viewer.on('error', () => setVeil('error'));
    viewer.on('mousedown', hideHint);
    viewer.on('touchstart', hideHint);
  };

  const open = async () => {
    if (!dialog.open) dialog.showModal();
    try {
      await loadLib();
      // Dos fotogramas: el diálogo ya está maquetado y los estilos del visor aplicados.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (!viewer) { setVeil('loading'); build(); }
      else { viewer.resize(); if (SPIN) viewer.startAutoRotate(SPIN); }
    } catch {
      setVeil('error');
    }
  };

  document.addEventListener('click', (e) => {
    const trigger = (e.target as Element).closest?.('[data-tour-open]');
    if (trigger) { e.preventDefault(); open(); }
  });

  // Cerrar: botón, clic fuera y Escape (nativo)
  $('[data-tour-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    viewer?.stopAutoRotate();
    hideHint();
    if (document.fullscreenElement) document.exitFullscreen();
  });

  chips.forEach((c) => c.addEventListener('click', () => go(c.dataset.scene!)));

  dialog.querySelectorAll<HTMLButtonElement>('[data-tour-zoom]').forEach((b) =>
    b.addEventListener('click', () => viewer?.setHfov(viewer.getHfov() + Number(b.dataset.tourZoom), 450)),
  );

  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen?.();
  });
  document.addEventListener('fullscreenchange', () => requestAnimationFrame(() => viewer?.resize()));
}
