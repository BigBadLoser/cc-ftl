# Prompt: escape pod for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/escape-pod`, based on `main` (the medical pod merged in #345).

**Task:** design and build the ESCAPE POD vehicle (`vehicle.escape_pod`). Today it borrows the mining pod's sprites (`asset: 'vehicle.mining_pod'` in `src/content/vehicles.ts`). Your sprites replace them; the `asset` field then points at the pod's own id.

**Context:**
- Design: `docs/DESIGN.md`, the "Medical pod" encounter under "Physical encounters". The sim is `src/sim/vehicles/escape.ts`.
- What it is: a small sealed lifeboat with one seat and no pilot. It flies itself, slowly. In the medical pod encounter it drifts in space with one wounded survivor aboard; when the player brings it in, it flies to a free airlock, docks, lets its occupant out and casts off empty.
- Later it is a general craft: ships carry pods in the existing 3x3 pod bays, enemy crews eject in them from a dying ship, and the player can abandon ship. Design it as a standard civilian/industrial lifeboat that any faction's ship could carry, not as one faction's part.
- Family: the pod family (`tools/blender/sprites/pod_family.py`, `mining_pod.py`, `pod_bay.py`). It parks in the same 3x3 pod bay as the mining pod and is a little smaller (content `size` 2.2 against the mining pod's 2.6). The shuttle is a much bigger craft with its own bay; it is no size reference here.
- Shape: the mining pod is already a sphere (two half-domes on a drum band), so "rounder" is no way to tell them apart. The escape pod must read as a different craft at a glance by silhouette, not colour: no mining laser, arms or ore hold. Explore a different body shape, for example a cone or bell (a re-entry capsule, heat shield underneath), a short cylinder lying on its side with a docking collar on the hatch end, or a squat lozenge. Details on top: a viewport, the docking collar, an emergency beacon light, hazard stripes or a bright safety colour band.

**Sprites:** follow the mining pod's set exactly (same ids pattern, sizes, camera and headings), minus the mining frames:
- `vehicle.escape_pod.fly.d0..d7` (flying, 8 headings);
- `vehicle.escape_pod.docked.d0/d2/d4/d6` (docked at an airlock);
- `vehicle.escape_pod.parked.r0..` and the fold frames, as the mining pod has, for when a ship carries one in a pod bay;
- a drifting state with the emergency beacon blinking (2–4 frames on top of `fly`, or a beacon overlay; agree with me which);
- all listed in the manifest. Put the pod's colours in their own palette set (`"set"` in `palette_extra.json`) if it brings new ones.

**First preview:**
- Start with 2–3 silhouette options as a labelled sheet in the render lab (`npm run lab -- --panel <id>`, see `docs/RENDER_LAB.md`): each at d0, d2 and d5 flying, at 1x and 3x, beside the mining pod for scale.
- Send me the sheet and stop. Don't build the full set or wire anything until I've picked one.
- Then the picked shape's beacon frames, docked at an airlock and parked in the pod bay, as a second preview.

**After approval:** point `vehicle.escape_pod`'s `asset` at the new id, run `npm run check:fast`, shoot the medical pod encounter in the game (`?scenario=medpod`) with the pod drifting and docked, and open the PR against `main` with before and after shots.
