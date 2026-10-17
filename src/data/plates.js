/**
 * Copy for the four monochrome plates.
 *
 * Kept out of the components so the writing can be edited without touching
 * layout. The register is deliberately flat: state the number, then stop. The
 * typography carries the emphasis, not adjectives.
 *
 * Nothing is rendered above a plate's copy — no numeral, no overline, no rule.
 * Each of those was decoration in front of the words.
 */

export const PLATES = {
  'plate-01': {
    display: 'Confinement.',
    lead: 'Nothing in this machine is allowed to touch anything else.',
    layout: 'centre',
  },

  'plate-02': {
    stats: [
      { value: '28.6', unit: 'm', label: 'Cryostat diameter' },
      { value: '29.3', unit: 'm', label: 'Total height' },
      { value: '23 000', unit: 't', label: 'Machine mass' },
      { value: '18', unit: '', label: 'Toroidal field coils' },
    ],
    lead: 'Every radius in this render is the published one. The figure at the base of the cryostat is a person, one point eight metres tall.',
    layout: 'left',
  },

  'plate-03': {
    stats: [
      { value: '150', unit: 'M °C', label: 'Ion temperature' },
      { value: '11.8', unit: 'T', label: 'Magnetic field' },
      { value: '15', unit: 'MA', label: 'Plasma current' },
      { value: '10', unit: '', label: 'Design fusion gain' },
    ],
    lead: 'JET reached a gain of 0.67. This machine is designed for ten. Fifty megawatts in, five hundred out.',
    layout: 'left',
  },

  'plate-04': {
    display: 'Nothing here is theoretical.',
    lead: 'Six projects. All of them run.',
    layout: 'centre',
  },
}

export const HERO = {
  name: 'evan',
  handle: 'mitige',
  location: 'France',
}

/** The coda is the address and nothing else. */
export const CODA = {
  display: 'github.com/mitige',
  href: 'https://github.com/mitige',
}