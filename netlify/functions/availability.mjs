/**
 * GET /api/availability
 * Lee el calendario iCal que exporta Booking (variable de entorno ICAL_URL)
 * y devuelve las estancias ocupadas como [[entrada, salida], ...] (salida no incluida).
 * Sin ICAL_URL devuelve datos de ejemplo relativos a hoy, para la demo.
 */
const json = (body, maxAge = 3600) =>
  new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=300, s-maxage=${maxAge}, stale-while-revalidate=86400`,
    },
  });

const toISO = (v) => {
  const m = String(v).match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

export function parseICal(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const events = unfolded.split('BEGIN:VEVENT').slice(1);
  const booked = [];
  for (const ev of events) {
    const start = ev.match(/^DTSTART[^:\n]*:(.+)$/m)?.[1];
    const end = ev.match(/^DTEND[^:\n]*:(.+)$/m)?.[1];
    const s = start && toISO(start);
    const e = end && toISO(end);
    if (s && e && e > s) booked.push([s, e]);
  }
  return booked.sort((a, b) => a[0].localeCompare(b[0]));
}

function demo() {
  // Fines de semana ocupados de forma intermitente durante los próximos 5 meses.
  const out = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const iso = (x) => x.toISOString().slice(0, 10);
  for (let i = 0, week = 0; i < 150; i++) {
    const day = new Date(d.getTime() + i * 864e5);
    if (day.getDay() === 5) {
      week++;
      if (week % 3 !== 0) {
        const out1 = new Date(day.getTime() + 2 * 864e5);
        out.push([iso(day), iso(out1)]);
      }
    }
  }
  return out;
}

export default async () => {
  const url = process.env.ICAL_URL;
  if (!url) return json({ source: 'demo', booked: demo() }, 600);
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'casa-del-pinar-availability/1.0' } });
    if (!res.ok) throw new Error(`iCal ${res.status}`);
    return json({ source: 'ical', updated: new Date().toISOString(), booked: parseICal(await res.text()) });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'No se pudo leer el calendario' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
};
