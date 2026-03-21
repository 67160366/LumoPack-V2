-- =============================================
-- Add heart box specific fields to projects
-- =============================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS shape_pct NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS tilt_deg NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS support_config JSONB;

-- support_config example:
-- {
--   "wall_h": 15,
--   "hole_depth": 8,
--   "color": "#e8d5b7",
--   "holes": [
--     {"id": "h1", "x": 30, "y": 20, "w": 3, "l": 4, "shape": "capsule"}
--   ]
-- }

COMMENT ON COLUMN public.projects.shape_pct IS 'Heart shape percentage (35-75), heart box only';
COMMENT ON COLUMN public.projects.tilt_deg IS 'Heart tilt degree (25-65), heart box only';
COMMENT ON COLUMN public.projects.support_config IS 'Support insert config: wall_h, hole_depth, holes[]';
