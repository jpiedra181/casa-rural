// Datos de la casa. Todo lo que el dueño podría querer cambiar está aquí.

export const site = {
  name: 'La Casa del Pinar',
  phone: '670963515',
  whatsapp: '34670963515', // formato internacional, sin "+" ni espacios
  email: 'hola@ejemplo.com',
  address: 'Calle del Pinar, 1 · Sierra de Guadarrama (Segovia)',
  registry: 'CR-40/0000',
  coords: '40°56′ N · 4°03′ O · 1.050 m',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Palazuelos+de+Eresma+Segovia',
  reviewsUrl: 'https://www.google.com/maps',
  hosts: 'Marta y Luis',
  rating: '4,9',
  reviewsCount: 128,
  maxGuests: 10,
  author: { name: 'jpiedra.com', url: 'https://jpiedra.com' },
};

/**
 * Tarifas. Las fechas de temporada van en formato MM-DD.
 * Si una temporada cruza el año (ej. Navidad), `from` > `to` y funciona igual.
 */
export const pricing = {
  minNights: 2,
  baseGuests: 8, // precio por noche incluye hasta 8 personas
  extraGuestPerNight: 15,
  cleaning: 60,
  petFee: 20,
  deposit: 0.3,
  platformFee: 0.15, // comisión estimada de las plataformas, para mostrar el ahorro
  low: { weekday: 240, weekend: 280 }, // weekend = noches de viernes y sábado
  seasons: [
    { id: 'summer', from: '07-01', to: '08-31', night: 320 },
    { id: 'christmas', from: '12-20', to: '01-06', night: 320 },
  ],
};

export type Pricing = typeof pricing;
