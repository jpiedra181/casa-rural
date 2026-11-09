/**
 * Microinteracciones de toda la página:
 * - Botones: foco de luz que sigue al cursor y ligero efecto "imán".
 * - [data-reveal]: aparece al entrar en pantalla.
 * - [data-count]: cifras que cuentan hasta su valor.
 * Todo respeta "reducir movimiento" y, sin JS, la página se ve completa.
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- Botones ---------- */
const MAGNET = 0.2;
const MAX_PULL = 6;
const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
const btnFrom = (t: EventTarget | null) =>
  t instanceof Element ? t.closest<HTMLElement>('.btn:not(:disabled):not([aria-disabled="true"])') : null;

function aim(btn: HTMLElement, e: PointerEvent, pull: boolean) {
  const r = btn.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  btn.style.setProperty('--x', `${x}px`);
  btn.style.setProperty('--y', `${y}px`);
  if (pull) {
    btn.style.setProperty('--tx', `${clamp((x - r.width / 2) * MAGNET, MAX_PULL)}px`);
    btn.style.setProperty('--ty', `${clamp((y - r.height / 2) * MAGNET, MAX_PULL / 2)}px`);
  }
}

if (finePointer) {
  const pull = !reduce;
  document.addEventListener('pointerover', (e) => { const b = btnFrom(e.target); if (b) aim(b, e, pull); }, { passive: true });
  document.addEventListener('pointermove', (e) => { const b = btnFrom(e.target); if (b) aim(b, e, pull); }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const b = btnFrom(e.target);
    if (!b || b.contains(e.relatedTarget as Node | null)) return;
    aim(b, e, false); // la luz se recoge hacia donde sale el cursor
    b.style.setProperty('--tx', '0px');
    b.style.setProperty('--ty', '0px');
  }, { passive: true });
}

/* ---------- Aparición al hacer scroll ---------- */
const revealables = document.querySelectorAll<HTMLElement>('[data-reveal]');
if (reduce || !('IntersectionObserver' in window)) {
  revealables.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  revealables.forEach((el) => io.observe(el));
}

/* ---------- Cifras que cuentan ---------- */
const counters = document.querySelectorAll<HTMLElement>('[data-count]');
if (!reduce && counters.length && 'IntersectionObserver' in window) {
  const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const paint = (el: HTMLElement, v: number) => {
    const dec = Number(el.dataset.dec || 0);
    el.textContent = v.toFixed(dec).replace('.', el.dataset.sep || '.');
  };
  const run = (el: HTMLElement) => {
    const from = Number(el.dataset.from);
    const to = Number(el.dataset.to);
    const dur = 1800;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      paint(el, from + (to - from) * ease(p));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        run(entry.target as HTMLElement);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.6 },
  );
  counters.forEach((el) => {
    paint(el, Number(el.dataset.from));
    io.observe(el);
  });
}
