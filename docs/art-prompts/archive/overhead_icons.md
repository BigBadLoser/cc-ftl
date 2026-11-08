# Prompt: overhead crew icons (social cues and break status) for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/overhead-icons`, based on `main`.

**Task:** design and build ONE SHEET of small icons that float over a crew member's head: the social cues from relationships, and a status symbol for each mental break. The look is open: I'll direct it in previews.

**Context:**
- Design: `docs/DESIGN.md`, the relationships and mental breaks sections (grep for "Relationships" and "breaks"). Relationships merged in #330 and breaks in #328.
- Today these are drawn in code as placeholders in `src/render/crewMarks.ts` (see `bubble()`). The break states have no overhead symbol yet. Your sheet replaces the placeholders, and that file's social and status parts get deleted when it's wired.
- The ids come from the sim: social cues from `Interaction.icon` (`src/sim/crew/interactionTypes.ts`), and breaks from `BreakKind` (`src/sim/crew/breakTypes.ts`).
- They must read at a glance at game zoom over a busy ship interior, next to crew sprites that are about 1 tile tall. Silhouette and colour carry the meaning; no text.

**Icons:**
- Social cues (relationships):
  - `chat`: a friendly chat. A speech bubble, light, with three dots. Pulses or bobs gently.
  - `chatBad`: a chat going badly. The same bubble with a jagged or scribbled mark. A colder tone, not alarming.
  - `shout`: a shouting match. A red burst or jagged bubble with an exclamation. Two crew show it at once, facing each other, so it must work mirrored.
- Breaks (`BreakKind`), one symbol each:
  - `panic`: fleeing in fear (e.g. sweat drops or a startled burst).
  - `freeze`: frozen in place (e.g. an ice shard or a stopped clock).
  - `hide`: hiding (e.g. eyes peeking or a closed box).
  - `tantrum`: lashing out (e.g. a storm cloud with lightning or a steam puff).
  - `despair`: lying in bed in despair (e.g. a rain cloud or a drooping tear).
  - `refusal`: refusing work (e.g. a crossed-out wrench or a raised hand).
  - `isolation`: withdrawing from everyone (e.g. a lone figure in a ring).
- Severity: breaks come in three tiers, `mild`, `moderate` and `severe`. Show the tier with a frame or plate behind the symbol: neutral for mild, amber for moderate and red for severe. Use the game's colour roles from DESIGN.md UI soft rule 7, where red is `#ff5a5a` and amber is the existing `--amber`. Don't draw three versions of each symbol.
- Optional, if they fit the family: `downed` (a red cross) and `surrendered` (a white flag). They're code-drawn today in the same file.

**Sprites:**
- Size: about 16–20 px tall at 1x, on a transparent background.
- 2–4 frames of idle motion each (a bob, a pulse, a flicker). Must loop cleanly.
- A dark 1 px outline, so they hold up over both light floors and dark space.
- Flat, readable shapes. These can be modelled as simple flat or extruded shapes in Blender and quantised like the rest of the art, or drawn as 2D pixel art if that is clearly better at this size; tell me which and why before the full build.
- Sheet ids like `crew.mark.<id>` (e.g. `crew.mark.chat`, `crew.mark.break.panic`, `crew.mark.tier.severe`), listed in the manifest. Agree the ids with me before wiring.

**First preview:**
- Shoot it in the render lab, not the game (`npm run lab -- --panel <id>`, see `docs/RENDER_LAB.md`). Add a panel for these icons:
  - every icon at 1x and 3x, labelled;
  - the set floating over a crew sprite on a lit floor and on a dark floor, at game zoom;
  - one break symbol on all three tier plates.
- Only shoot the real game once the icons are wired, to judge them in a scene.

Render it quickly, then wait for feedback.
