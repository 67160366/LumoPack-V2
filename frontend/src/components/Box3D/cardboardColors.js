/**
 * Cardboard color schemes for 3D box rendering.
 *
 * kraft     = natural brown corrugated
 * white     = white coated cardboard
 * heart_red = warm red gift-box tone (heart box)
 */

export const COLOR_SCHEMES = {
  kraft: {
    base: '#c4a882',
    wall: '#b89970',
    accent: '#b8976a',
    lidCap: '#d4b892',
    lidWall: '#c9a57a',
  },
  white: {
    base: '#f0ede8',
    wall: '#e8e4df',
    accent: '#e0dcd6',
    lidCap: '#f5f2ed',
    lidWall: '#ece8e3',
  },
  /** Warm red kraft — heart gift box */
  heart_red: {
    base: '#c75c5c',
    wall: '#b84a4a',
    accent: '#a83d3d',
    lidCap: '#d67878',
    lidWall: '#c86868',
  },
  /** Eco: Recycled — grayish brown */
  recycled: {
    base: '#a89a8a',
    wall: '#9b8d7d',
    accent: '#8e8070',
    lidCap: '#b5a797',
    lidWall: '#a99b8b',
  },
  /** Eco: FSC Certified — warm natural */
  fsc: {
    base: '#c9b896',
    wall: '#bda986',
    accent: '#b09a78',
    lidCap: '#d6c5a3',
    lidWall: '#cab693',
  },
  /** Eco: Bagasse / Sugarcane — light warm beige */
  bagasse: {
    base: '#d8ccb0',
    wall: '#cec1a3',
    accent: '#c3b596',
    lidCap: '#e2d7bd',
    lidWall: '#d5c9ac',
  },
};

export function getScheme(name = 'kraft') {
  return COLOR_SCHEMES[name] || COLOR_SCHEMES.kraft;
}

/** Presets for UI pickers (RSC, self-lock, tube-lock, dieline, heart, etc.) */
export const MATERIAL_PRESETS = [
  { id: 'kraft', label: 'Kraft', hint: 'กระดาษคราฟ์' },
  { id: 'white', label: 'White', hint: 'White cardboard' },
  { id: 'heart_red', label: 'Heart red', hint: 'โทนแดง' },
  { id: 'recycled', label: 'Recycled', hint: 'กระดาษรีไซเคิล (Eco)', eco: true },
  { id: 'fsc', label: 'FSC Certified', hint: 'เยื่อไม้ปลูกทดแทน (Eco)', eco: true },
  { id: 'bagasse', label: 'Bagasse', hint: 'กระดาษชานอ้อย (Eco)', eco: true },
];

export const MATERIAL_PRESETS_STANDARD = [
  { id: 'kraft', label: 'Kraft', hint: 'กระดาษคราฟ์' },
  { id: 'white', label: 'White', hint: 'White cardboard' },
  { id: 'recycled', label: 'Recycled', hint: 'กระดาษรีไซเคิล (Eco)', eco: true },
  { id: 'fsc', label: 'FSC Certified', hint: 'เยื่อไม้ปลูกทดแทน (Eco)', eco: true },
  { id: 'bagasse', label: 'Bagasse', hint: 'กระดาษชานอ้อย (Eco)', eco: true },
];
