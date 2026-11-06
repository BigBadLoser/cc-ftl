# Prompt: station hologram art for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/station-holograms`, based on `main`.

**Task:** build a HOLOGRAM SPRITE for each station type, to show on the station panel's sensor screen. This is step 3 of issue #332. The look is open: I'll direct it in previews.

**Context:**
- Design: `docs/DESIGN.md`, "Trade window and station panel (user decisions, 2026-11-05)". The approved mock is `docs/refs/mocks/station-panel-w2.png`; see the right-hand column.
- The station panel is an open comms channel. Its right column is a SENSORS screen: the station's hologram sits in the middle, the player's ship, shuttles and other ships are drawn around it as small starmap silhouettes, and callouts point at parts of it (DOCKS, DEFENCE).
- For now, the panel (`src/ui/StationSensors.svelte`, merged in #335) scales up the 48 px starmap icon (`starmap.struct.station_<type>`) and tints it cyan with a CSS filter plus scanlines. Your sprites replace that.
- The tint stays in code. Render the hologram in neutral tones (grey or lightly coloured, with clear value bands), not pre-tinted cyan. The code turns it into a hologram with a filter or shader. Check one preview through the panel's current filter (`i.holo` in `StationSensors.svelte`).

**Station types** (from `structure.station_*` in `src/content/galaxy.ts`, plus the den):
- **Trade** (`station_trade`): a busy commercial ring, with cargo pods and several docking arms.
- **Military** (`station_military`), the navy depots: armoured and angular, with visible gun mounts and a hangar.
- **Research** (`station_research`): sensor dishes, antenna masts and lab modules.
- **Pirate den** (`den`): a scrappy cluster built from welded hulks, with mismatched parts.

Each must read as its type at a glance, and as the same station as its starmap icon: keep the silhouette family, so a player connects the two.

**Sprites, each type:**
- One still. Optionally 2–4 frames of slow motion, such as a ring turning or a beacon blinking, if it stays readable. The panel can loop them.
- Size: about 128×96 px at 1x. It shows at roughly 110–140 CSS px wide in a column about 340 px wide, so details must survive at that size (the 2 px rule applies).
- Viewpoint: the same three-quarter view as the starmap icons, not the iso grid view.
- Transparent background. No glow baked into the alpha; the code adds the glow.
- **Anchors:** export named points in the sheet JSON, such as `dock0..n`, `gun0..n` and `core`. The sensor screen can then point the DOCKS callout at a real dock and put the gun dots on real mounts, instead of guessing. Agree the JSON shape with me before you build.

**Sheet:** one sheet, `starmap.holo.<type>` (or agree another id with me), listed in the manifest like the other starmap sprites.

**First preview:**
- Shoot it in the render lab, not the game (`npm run lab -- --panel <id>`, see `docs/RENDER_LAB.md`). Add a panel for the holograms:
  - all four at 1x and 3x, neutral, side by side;
  - the same four through the panel's cyan filter and scanlines on the dark sensor background (#05080b-ish), each beside its 48 px starmap icon, to compare.
- Only shoot the real station panel once the sprites are wired, to judge them in place.

Render it quickly, then wait for feedback.
