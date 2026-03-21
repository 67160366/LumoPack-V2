/**
 * Cardboard color schemes for 3D box rendering.
 *
 * kraft  = natural brown corrugated
 * white  = white coated cardboard
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
};

export function getScheme(name = 'kraft') {
  return COLOR_SCHEMES[name] || COLOR_SCHEMES.kraft;
}
