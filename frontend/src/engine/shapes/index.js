/**
 * Shape registry — central lookup for all contour-based shapes
 */
import * as heartShape from './heartShape';
import * as starShape from './starShape';
import * as bearShape from './bearShape';
import * as circleShape from './circleShape';

export const shapes = {
  heart: heartShape,
  star: starShape,
  bear: bearShape,
  circle: circleShape,
};

export { heartShape, starShape, bearShape, circleShape };
