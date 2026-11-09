/**
 * Calendario de disponibilidad + precio + formulario de solicitud.
 * - Calendario con patrón "grid" (WAI-ARIA APG): flechas, Inicio/Fin, RePág/AvPág.
 * - Booking es la fuente de verdad: las noches ocupadas llegan de /api/availability (iCal).
 */
import type { Pricing } from '../data/site';

type Strings = Record<string, any>;
interface Config {
  lang: 'es' | 'en';
  pricing: Pricing;
  maxGuests: number;
  whatsapp: string;
  a: Strings; // t.availability
  f: Strings; // t.form
  h: Strings; // t.hero (etiquetas Llegada/Salida/Huéspedes)
}

// ---------- Fechas (siempre en hora local, a mediodía para evitar saltos de horario) ----------
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && key(a) === key(b);
const nightsBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5);
const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

// ---------- Precio ----------
export function nightPrice(d: Date, p: Pricing) {
  const md = key(d).slice(5);
  for (const s of p.seasons) {
    const inSeason = s.from <= s.to ? md >= s.from && md <= s.to : md >= s.from || md <= s.to;
    if (inSeason) return s.night;
  }
  const dow = d.getDay(); // 5 = viernes, 6 = sábado
  return dow === 5 || dow === 6 ? p.low.weekend : p.low.weekday;
}

export function quote(checkin: Date, checkout: Date, guests: number, pet: boolean, p: Pricing) {
  const n = nightsBetween(checkin, checkout);
  const prices = Array.from({ length: n }, (_, i) => nightPrice(addDays(checkin, i), p));
  const nightsTotal = prices.reduce((a, b) => a + b, 0);
  const extra = Math.max(0, guests - p.baseGuests);
  const extraTotal = extra * p.extraGuestPerNight * n;
  const petTotal = pet ? p.petFee : 0;
  const total = nightsTotal + extraTotal + petTotal + p.cleaning;
  const sameRate = prices.every((x) => x === prices[0]);
  return {
    n,
    prices,
    sameRate,
    nightsTotal,
    extra,
    extraTotal,
    petTotal,
    cleaning: p.cleaning,
    total,
    savings: Math.round(total * p.platformFee),
    deposit: Math.round(total * p.deposit),
  };
}

// ---------- Componente ----------
export function initBooking(root: HTMLElement) {
  const cfg: Config = JSON.parse(root.dataset.config!);
  const { a, f, h, pricing } = cfg;
  const locale = cfg.lang === 'es' ? 'es-ES' : 'en-GB';
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmtLong = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtShort = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtMonth = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const grid = $<HTMLTableSectionElement>('[data-grid]');
  const title = $<HTMLElement>('#calendar-heading');
  const prevBtn = $<HTMLButtonElement>('[data-prev]');
  const nextBtn = $<HTMLButtonElement>('[data-next]');
  const status = $<HTMLElement>('[data-status]');
  const demo = $<HTMLElement>('[data-demo]');
  const summary = $<HTMLElement>('[data-summary]');
  const form = $<HTMLFormElement>('form[name="reserva"]');
  const guestsSel = form.querySelector<HTMLSelectElement>('#f-guests')!;
  const petBox = form.querySelector<HTMLInputElement>('#f-pet')!;
  const waLinks = document.querySelectorAll<HTMLAnchorElement>('[data-wa]');

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12);

  const state = {
    booked: new Set<string>(),
    checkin: null as Date | null,
    checkout: null as Date | null,
    view: new Date(firstMonth),
    focus: new Date(today),
    loaded: false,
  };

  const isPast = (d: Date) => d < today && !sameDay(d, today);
  const isBooked = (d: Date) => state.booked.has(key(d));
  const rangeFree = (from: Date, to: Date) => {
    for (let d = new Date(from); d < to; d = addDays(d, 1)) if (isBooked(d)) return false;
    return true;
  };
  // ¿Se puede pulsar este día ahora mismo?
  const selectable = (d: Date) => {
    if (isPast(d)) return false;
    if (state.checkin && !state.checkout && d > state.checkin) return rangeFree(state.checkin, d);
    return !isBooked(d);
  };

  // ---------- Render del calendario ----------
  function render() {
    const y = state.view.getFullYear();
    const m = state.view.getMonth();
    title.textContent = cap(fmtMonth.format(state.view));
    prevBtn.disabled = state.view <= firstMonth;

    const first = new Date(y, m, 1, 12);
    const offset = (first.getDay() + 6) % 7; // lunes = 0
    const days = new Date(y, m + 1, 0).getDate();
    // Mantener el foco dentro del mes visible
    if (state.focus.getMonth() !== m || state.focus.getFullYear() !== y) {
      state.focus = new Date(y, m, sameMonth(today, state.view) ? today.getDate() : 1, 12);
    }

    const rows: string[] = [];
    let cells: string[] = [];
    for (let i = 0; i < offset; i++) cells.push('<td role="gridcell" class="cal__empty"></td>');
    for (let day = 1; day <= days; day++) {
      const d = new Date(y, m, day, 12);
      const k = key(d);
      const past = isPast(d);
      const booked = isBooked(d);
      const can = selectable(d);
      const isIn = sameDay(d, state.checkin);
      const isOut = sameDay(d, state.checkout);
      const inRange = !!(state.checkin && state.checkout && d > state.checkin && d < state.checkout);
      const stateTxt = past ? a.past : booked && !can ? a.booked : a.free;
      const roleTxt = isIn ? `, ${a.selectedIn}` : isOut ? `, ${a.selectedOut}` : '';
      const cls = ['cal__day', booked && 'is-booked', past && 'is-past', isIn && 'is-in', isOut && 'is-out', inRange && 'is-range']
        .filter(Boolean)
        .join(' ');
      cells.push(
        `<td role="gridcell" aria-selected="${isIn || isOut || inRange}">` +
          `<button type="button" class="${cls}" data-date="${k}" tabindex="${sameDay(d, state.focus) ? 0 : -1}" ` +
          `aria-label="${cap(fmtLong.format(d))}, ${stateTxt}${roleTxt}"${can ? '' : ' aria-disabled="true"'}>` +
          `<span aria-hidden="true">${day}</span></button></td>`,
      );
      if (cells.length === 7) {
        rows.push(`<tr>${cells.join('')}</tr>`);
        cells = [];
      }
    }
    if (cells.length) {
      while (cells.length < 7) cells.push('<td role="gridcell" class="cal__empty"></td>');
      rows.push(`<tr>${cells.join('')}</tr>`);
    }
    grid.innerHTML = rows.join('');
  }
  const sameMonth = (x: Date, y: Date) => x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth();

  function focusDay(d: Date) {
    const target = new Date(d);
    if (target < firstMonth) return;
    state.focus = target;
    if (!sameMonth(target, state.view)) state.view = new Date(target.getFullYear(), target.getMonth(), 1, 12);
    render();
    grid.querySelector<HTMLButtonElement>(`[data-date="${key(target)}"]`)?.focus();
  }

  function announce(msg: string) {
    status.textContent = '';
    window.setTimeout(() => (status.textContent = msg), 50);
  }

  // ---------- Selección ----------
  function choose(d: Date) {
    if (!selectable(d)) return;
    const { checkin, checkout } = state;
    if (!checkin || checkout || d <= checkin) {
      state.checkin = d;
      state.checkout = null;
      announce(`${cap(fmtLong.format(d))}. ${a.pickCheckout}`);
    } else {
      const n = nightsBetween(checkin, d);
      if (n < pricing.minNights) return announce(fill(a.minNights, { n: pricing.minNights }));
      if (!rangeFree(checkin, d)) return announce(a.rangeBlocked);
      state.checkout = d;
      announce(fill(a.selectedRange, { in: fmtLong.format(checkin), out: fmtLong.format(d), n }));
    }
    state.focus = d;
    render();
    grid.querySelector<HTMLButtonElement>(`[data-date="${key(d)}"]`)?.focus();
    update();
  }

  grid.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-date]');
    if (btn) choose(parse(btn.dataset.date!));
  });

  grid.addEventListener('keydown', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-date]');
    if (!btn) return;
    const d = parse(btn.dataset.date!);
    const moves: Record<string, () => Date> = {
      ArrowRight: () => addDays(d, 1),
      ArrowLeft: () => addDays(d, -1),
      ArrowDown: () => addDays(d, 7),
      ArrowUp: () => addDays(d, -7),
      Home: () => addDays(d, -((d.getDay() + 6) % 7)),
      End: () => addDays(d, 6 - ((d.getDay() + 6) % 7)),
      PageDown: () => new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), 28), 12),
      PageUp: () => new Date(d.getFullYear(), d.getMonth() - 1, Math.min(d.getDate(), 28), 12),
    };
    if (moves[e.key]) {
      e.preventDefault();
      focusDay(moves[e.key]());
    }
  });

  prevBtn.addEventListener('click', () => {
    state.view = new Date(state.view.getFullYear(), state.view.getMonth() - 1, 1, 12);
    render();
  });
  nextBtn.addEventListener('click', () => {
    state.view = new Date(state.view.getFullYear(), state.view.getMonth() + 1, 1, 12);
    render();
  });

  // ---------- Resumen de precio ----------
  function row(label: string, value: string, cls = '') {
    return `<div class="sum__row ${cls}"><dt>${label}</dt><dd>${value}</dd></div>`;
  }
  function update() {
    const guests = Number(guestsSel.value);
    const { checkin, checkout } = state;
    form.querySelector<HTMLInputElement>('[name="checkin"]')!.value = checkin ? key(checkin) : '';
    form.querySelector<HTMLInputElement>('[name="checkout"]')!.value = checkout ? key(checkout) : '';

    if (!checkin || !checkout) {
      summary.innerHTML = `<p class="sum__empty">${checkin ? a.pickCheckout : a.empty}</p>`;
      form.querySelector<HTMLInputElement>('[name="total"]')!.value = '';
      setWhatsApp(null);
      return;
    }
    const q = quote(checkin, checkout, guests, petBox.checked, pricing);
    const nightsLabel = q.sameRate
      ? `${fill(a.nightsLine, { n: q.n })} × ${money.format(q.prices[0])}`
      : fill(a.nightsLine, { n: q.n });
    summary.innerHTML =
      `<dl class="sum__list">` +
      row(h.checkin, cap(fmtShort.format(checkin))) +
      row(h.checkout, cap(fmtShort.format(checkout))) +
      row(h.guests, `${guests} ${h.people}`) +
      `<div class="sum__sep" role="presentation"></div>` +
      row(nightsLabel, money.format(q.nightsTotal), 'is-muted') +
      (q.extra ? row(fill(a.extraGuests, { n: q.extra }), money.format(q.extraTotal), 'is-muted') : '') +
      (q.petTotal ? row(a.pet, money.format(q.petTotal), 'is-muted') : '') +
      row(a.cleaning, money.format(q.cleaning), 'is-muted') +
      `<div class="sum__sep" role="presentation"></div>` +
      row(a.total, `<span class="sum__total">${money.format(q.total)}</span>`, 'is-total') +
      `</dl>` +
      `<p class="sum__save">${fill(a.savings, { amount: money.format(q.savings) })}</p>`;
    form.querySelector<HTMLInputElement>('[name="total"]')!.value = String(q.total);
    setWhatsApp({ checkin, checkout, guests });
  }

  function setWhatsApp(sel: { checkin: Date; checkout: Date; guests: number } | null) {
    const text = sel
      ? fill(f.waText, { in: fmtShort.format(sel.checkin), out: fmtShort.format(sel.checkout), g: sel.guests })
      : f.waTextNoDates;
    const href = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`;
    waLinks.forEach((l) => (l.href = href));
  }

  guestsSel.addEventListener('change', update);
  petBox.addEventListener('change', update);

  // Desde el buscador de la portada
  window.addEventListener('booking:set', (e: Event) => {
    const { checkin, checkout, guests } = (e as CustomEvent).detail ?? {};
    if (guests) guestsSel.value = String(Math.min(guests, cfg.maxGuests));
    if (checkin) {
      const ci = parse(checkin);
      state.checkin = null;
      state.checkout = null;
      state.view = new Date(ci.getFullYear(), ci.getMonth(), 1, 12);
      state.focus = ci;
      render();
      if (selectable(ci)) {
        choose(ci);
        if (checkout) choose(parse(checkout));
      } else announce(a.rangeBlocked);
    }
    update();
  });

  // ---------- Formulario ----------
  const errorBox = form.querySelector<HTMLElement>('[data-errors]')!;
  const result = root.querySelector<HTMLElement>('[data-result]')!;

  function setError(id: string, msg: string | null) {
    const field = form.querySelector<HTMLInputElement>(`#${id}`);
    const err = form.querySelector<HTMLElement>(`#${id}-error`);
    if (!field || !err) return;
    field.setAttribute('aria-invalid', String(!!msg));
    err.textContent = msg ?? '';
    err.hidden = !msg;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errs: [string, string][] = [];
    const name = form.querySelector<HTMLInputElement>('#f-name')!;
    const phone = form.querySelector<HTMLInputElement>('#f-phone')!;
    const email = form.querySelector<HTMLInputElement>('#f-email')!;
    const privacy = form.querySelector<HTMLInputElement>('#f-privacy')!;
    ['f-name', 'f-phone', 'f-email', 'f-privacy'].forEach((id) => setError(id, null));

    if (!state.checkin || !state.checkout) errs.push(['calendar-heading', f.errors.dates]);
    if (!name.value.trim()) errs.push(['f-name', f.errors.name]);
    if (!phone.value.trim() && !email.value.trim()) errs.push(['f-phone', f.errors.contact]);
    if (email.value.trim() && !email.checkValidity()) errs.push(['f-email', f.errors.email]);
    if (!privacy.checked) errs.push(['f-privacy', f.errors.privacy]);

    if (errs.length) {
      errs.forEach(([id, msg]) => setError(id, msg));
      errorBox.innerHTML =
        `<p><strong>${f.errorSummary}</strong></p><ul>` +
        errs.map(([id, msg]) => `<li><a href="#${id}">${msg}</a></li>`).join('') +
        `</ul>`;
      errorBox.hidden = false;
      errorBox.focus();
      return;
    }
    errorBox.hidden = true;

    const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
    const label = submit.textContent;
    submit.disabled = true;
    submit.textContent = f.sending;
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form) as any).toString(),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.hidden = true;
      result.innerHTML = `<p class="form__ok">${f.success}</p>`;
    } catch {
      result.innerHTML = `<p class="form__ko">${f.failure}</p>`;
      submit.disabled = false;
      submit.textContent = label;
    }
    result.hidden = false;
    result.focus();
  });

  // ---------- Carga de disponibilidad ----------
  async function load() {
    let data: { source?: string; booked: [string, string][] } | null = null;
    try {
      const r = await fetch('/api/availability', { headers: { accept: 'application/json' } });
      if (r.ok && r.headers.get('content-type')?.includes('json')) data = await r.json();
    } catch {}
    if (!data) {
      try {
        data = await (await fetch('/data/availability-demo.json')).json();
        data!.source = 'demo';
      } catch {
        data = { source: 'demo', booked: [] };
      }
    }
    for (const [from, to] of data!.booked) {
      for (let d = parse(from); d < parse(to); d = addDays(d, 1)) state.booked.add(key(d));
    }
    demo.hidden = data!.source !== 'demo';
    state.loaded = true;
    root.querySelector('[data-loading]')?.remove();
    render();
    update();
  }

  render();
  update();
  load();
}
