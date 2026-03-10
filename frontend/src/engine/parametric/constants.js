/**
 * FEFCO 0427 Box Constants
 *
 * Fixed structural values extracted from DXF analysis of 500x300x80mm reference.
 * These do NOT change with box size — they are physical properties of the
 * die-cut tooling and paper mechanics.
 *
 * Source: DXF Dieline Analyzer output + manual verification
 */

export const BOX_CONSTANTS = {
  // Ear-lock slot tabs (ร่องเสียบเขี้ยวล็อก)
  slotDepth: 10.5,     // mm — protrusion depth of slot tab (X: 0→10.5)
  slotLength: 60,      // mm — height of slot tab (Y: 53→113 = 60)
  slotOffset: 53,      // mm — distance from base edge to first slot

  // Paper thickness & tolerances
  paperThickness: 3,   // mm — corrugated paper thickness (T)
  foldGap: 6,          // mm — gap at fold lines (2*T)

  // Glue flap geometry
  glueTransition: 9,   // mm — bevel transition width (3*T)
  glueFlapExtra: 1.5,  // mm — glue flap overshoot beyond D
  earBump: 4.5,        // mm — ear bump protrusion depth

  // Back panel / tongue offsets
  backInsetExtra: 1.5, // mm — back panel inset beyond slot tab
  tongueInset: 3,      // mm — tongue inset from face edge (= T)
};
