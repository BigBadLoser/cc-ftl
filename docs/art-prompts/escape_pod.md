# Prompt: escape pod for cc-ftl

(Paste `common.md` above this prompt.)

**Branch:** `art/escape-pod`, based on `main` once the medical pod PR (#173 step 6, branch `encounter/medical-pod-173`) has merged. If it hasn't merged yet, base it on that branch and say so.

**Task:** design and build the ESCAPE POD vehicle (`vehicle.escape_pod`). Today it borrows the mining pod's sprites (`asset: 'vehicle.mining_pod'` in `src/content/vehicles.ts`). Your sprites replace them; the `asset` field then points at the pod's own id.

**Context:**
- Design: `docs/DESIGN.md`, the "Medical pod" encounter under "Physical encounters". The sim is `src/sim/vehicles/escape.ts`.
- What it is: a small sealed lifeboat with one seat and no pilot. It flies itself, slowly. In the medical pod encounter it drifts in space with one wounded survivor aboard; when the player brings it in, it flies to a free airlock, docks, lets its occupant out and casts off empty.
- Later it is a general craft: ships carry pods in the existing 3x3 pod bays, enemy crews eject in them from a dying ship, and the player can abandon ship. Design it as a standard civilian/industrial lifeboat that any faction's ship could carry, not as one faction's part.
- Family: the same vehicle family as the shuttle and the mining pod (`tools/blender/sprites/pod_family.py`, `mining_pod.py`, `shuttle.py`), sized for the same 3x3 pod bay. It must read as clearly different from the mining pod at a glance, by silhouette, not only colour: no mining laser or ore hold; a rounder sealed capsule, a viewport, a docking collar, an emergency beacon light, hazard stripes or a bright safety colour band are all fair game.

**Sprites:** follow the mining pod's set exactly (same ids pattern, sizes, camera and headings), minus the mining frames:
- `vehicle.escape_pod.fly.d0..d7` (flying, 8 headings);
- `vehicle.escape_pod.docked.d0/d2/d4/d6` (docked at an airlock);
- `vehicle.escape_pod.parked.r0..` and the fold frames, as the mining pod has, for when a ship carries one in a pod bay;
- a drifting state with the emergency beacon blinking (2–4 frames on top of `fly`, or a beacon overlay; agree with me which);
- all listed in the manifest. Put the pod's colours in their own palette set (`"set"` in `palette_extra.json`) if it brings new ones.

**First preview:**
- Shoot it in the render lab (`npm run lab -- --panel <id>`, see `docs/RENDER_LAB.md`): the pod at d0, d2 and d5 flying and the beacon frames, at 1x and 3x, beside the mining pod and the shuttle for scale, and docked at an airlock.
- Send me the preview and stop. Don't wire anything until I've picked a direction.

**After approval:** point `vehicle.escape_pod`'s `asset` at the new id, run `npm run check:fast`, shoot the medical pod encounter in the game (`?scenario=medpod`) with the pod drifting and docked, and open the PR against `main` with before and after shots.
