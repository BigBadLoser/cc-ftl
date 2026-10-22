# Reference reconstruction workflow

For assets reconstructed from imagery, treat the reference as a geometric
specification. Do not make a finished asset in one pass.

1. Analyze the main components, proportions, spatial relationships and
   ambiguous or hidden features. Record the assumptions.
2. Build reusable, parametric, low-detail geometry. Prioritize silhouette,
   proportions and topology; omit decorative details and finish.
3. Render using the project's established camera and rendering settings.
4. Generate a side-by-side reference/render image after **every pass**.
   Identify the three largest remaining discrepancies. Use measurable
   image-space landmarks where possible, recording uncertainty and alignment.
5. Correct those discrepancies and render/compare again. Preserve correct
   geometry when changing other components. Save parameters for each pass.
6. Continue primary geometry until acceptably close, then repeat the same
   comparisons for mechanical detailing, followed by materials and finishing.

Never compensate for incorrect geometry with materials or added details.
Report remaining discrepancies rather than claiming an inaccurate match.
Comparison alignment must be explicit; do not warp the render to fit the
reference. Hidden geometry is an assumption, not an observed fact.

For this project, keep quick previews low-sample, with one Blender process at
a time. Respect preview approval before a full build or integration.

The reactor study in `reactor_study.py` records fixed-camera landmarks and uses
only uniform scaling and translation for its comparison boards. Its original
reference, parameter snapshots, renders and measurements are in
`artifacts/reactor-reference/` and `artifacts/reactor-study/`.
