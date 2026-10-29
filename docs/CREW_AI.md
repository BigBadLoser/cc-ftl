# Crew AI architecture (issue #194)

Status: architecture approved in principle; revision 3 (after revision 2's five design issues and nine decisions, section 12) fixes EVA child holds, console handoff, same-tick path ownership, preemption constants and BoardIndex scope. No blocking conflict found in revision 3. No code. Implementation starts after PR #184 (`combat/inset`) merges, because that branch changes `decide.ts` and `autojobs.ts`; Phase 0 tooling starts now. References are to `main` unless marked **#184**.

**New conflicts from this revision: none blocking, three placement constraints.** (1) Pending claims change what `reservedBy === 0` means as "free" in about six readers (`claimHiddenRescue`, `rescuePending`, `callOperator`, `heldForMend`, `canRelieve`, `pickJob`); all must go through one `isOpen(job)` helper, so pending claims land in Phase 2, not Phase 1. (2) Operator handoff by atomic swap removes today's brief unmanned gap, and same-level emergency preemption is new: both are behaviour changes, so both are Phase 2 (Phase 1 reproduces release-then-repick). (3) Priority 0 now waits for a safe point, so a disabled category can keep a task running for a few seconds (bounded by class, section 5).

**Owned beds (#195).** A persistent `BedOwnerC` (crew to bed, assigned nearest-first) is landing separately as a perf fix. The reservation model here absorbs it: an owned bed is a long-lived claim owned by the crew member, separate from the per-sleep claim.

## 1. Summary

Crew behaviour is one 216-line system (`systems/decide.ts`) plus `work.ts`, with decisions and reservations scattered over about 30 files. This document replaces it with three layers that talk only through components, plus a thin forced-state layer in front:

| Layer | Question | Systems (new) |
| --- | --- | --- |
| 0. Interrupts | Is this crew member out of the normal loop right now? | `interruptSystem`, `abortTask` API |
| 1. Utility AI | What does this crew member *want* (drive)? | `utilitySystem` |
| 2. Scheduler | Who does which job? | `boardIndexSystem` (derived), `scheduleSystem` |
| 3. Executor | How is the task carried out? | `steerSystem`, `workSystem` (HFSM machines) |

Where each of the six refinements is answered:

| # | Refinement | Section |
| --- | --- | --- |
| 1 | No utility/scheduler cycle | 4 |
| 2 | Emergency interrupts, interruption policy | 5 |
| 3 | Lightweight HFSMs, logistics preserved | 6 |
| 4 | Benchmarked scheduling | 7 |
| 5 | Migration tests beyond hashes | 10 |
| 6 | Scheduler independent of utility | 8 |

## 2. Current state (what the code does today)

- **Order** (`pipeline.ts`): `vitals`, `autoJobs`, `operateJobs`, job planners (`haulCleanup`, `craftJobs`, `researchJobs`, `supplyJobs`, `cargoJobs`, `haulJobs`), `needs`, `mood`, `equip`, **`decide`**, `drafted`, `eggSac`, `crewCombat`, `alien`, `movement`, `carry`, vehicles, trade/yard/ferry/logistics, **`work`** (deliberately last: finished jobs change the grid), then combat.
- **`decideSystem`** is utility, scheduler and executor in one loop over crew in id order. Per crew: skip drafted/incapacitated/off-duty; robot mend-hold; robot bay (`wantsBay`); sleep below `SLEEP_BELOW` 20; eat (`wantsToEat`, `goEat`); keep or reroute a held job (`routeToJob`); else `pickJob`; else `stowSuit`, `vacateSite`, station `strollTurn`, `wander`.
- **`pickJob`** is greedy per crew in id order: for each priority level 1..4, for each open job in that level's categories, `jobFits` then `planSiteWalk` (one to three A* runs), score `steps.length - repairUrgency - operateAffinity + EVA_JOB_PENALTY + RELIEF_PENALTY`, minimum wins, ties by job id. Cost is O(free crew x levels x open jobs x A*). `findPath` allocates three `W*H` arrays per call and, for an unreachable job, explores the whole connected region. A 150x126 hub means about 170 KB per search. Not yet measured; Phase 0 records it.
- **Reservations** live in four unrelated places: `Job.reservedBy` (jobs, set in 4 files), `Module.reservedBy` (beds, robot bays, written by `decide`, `jobWork.rescue`, `bay.ts`), derived haul stock claims (`items/stock.ts` `reservations()`, never stored), and ad hoc components (`BedClaimC`, `EatC`, `EquipOrderC`, `EmbarkOrderC`, mining pilot set). `AssignmentC` is written or removed in 16 files, `reservedBy` appears in 31.
- **Abandon logic is duplicated** in `vitals.down`, `death.ts`, `crew.draft`, `fight setMode`, `goEat`, `goToSleep`, `operateJobs` and `man.ts`; `dropCarried` plus `haulCleanup` is the only reliable cleanup for a carried stack.
- **#184 adds**: breach-seal `build` jobs in category `firefighting` (`autojobs`), `repairUrgency` as additive bonuses (100000 / 20000 / 10000) in `pickJob`, `emergencyWaiting` (every 10 ticks, per busy crew, a `jobTakeable` = A* per emergency job) and the `HOLDS` list of kinds an emergency never interrupts. Note a gap: a breach-seal job is `firefighting`, but the hauls that feed it are created as `construction` by `supplyJobs`, so the seal waits at construction priority.

How crew kinds differ today: player crew add hunger, mood, drafting and emergency arming; station crew (`StationCrewC`) get a hunger floor of 25, `strollTurn` and director-posted `patrol` jobs; enemy ship crew run the same `decide` (no hunger or mood; invaders become off-duty and fight); robots have a battery, `goToBay` and `heldForMend` instead of rest and hunger; yard contractors (`YardCrewC`) take `yardOnly` jobs and keep suits on; aliens are not in `decide` at all. ARCHITECTURE already says NPCs share the crew AI; what differs is *policy* (which needs apply), today scattered `if (species...)` checks. That is the seam in section 8.

## 3. Data model

New code lives in `src/sim/ai/`. Components are plain data, entities by id.

| Component | Fields | Written by | Read by | Invariants |
| --- | --- | --- | --- | --- |
| `Intent` (L1) | `policy: string`, `drive: DriveId`, `since: tick`, `scores: number[]` (per-mille ints, policy drive order), `latched?: DriveId`, `nextEval: tick`, `avoid?: {job, until}`, `lastPreempt?: tick` | `utilitySystem`; `avoid` by scheduler API only | scheduler, executor, inspector | `drive` is in the policy's drive list or `'idle'`; all scores integers 0..1000; exists for every crew with a policy |
| `Interrupt` (L0) | `reason: InterruptReason`, `mode: 'abort'\|'hold'`, `owner: 'executor'\|'fight'\|'drafted'\|'none'` (who steers the path while it stands), `since: tick` | `interruptSystem` | utility (skips), scheduler (skips), executor (skips unless `owner` is `executor`) | present iff a forced predicate holds this tick; at most one (highest precedence) |
| `Task` (L3) | `job: number` (the reserved root job, 0 for jobless tasks), `drive: DriveId` (drive served), `machine: MachineId`, `state: string`, `since: tick`, `class: 'any'\|'safe'\|'finish'\|'hold'`, `yield?: {reason}`, `queued?: number`, `queuedAt?: tick`, `stack: Frame[]` (suspended parents, depth at most 2), `holds: Hold[]`, `bb: Blackboard` | scheduler creates job tasks; executor creates need tasks (sleep, eat, charge, escape, stroll) and advances, ends, aborts all | everyone read-only | see section 3 claims |
| `Frame` | `{machine, state, class, bb}` | executor `push`/`pop` | inspector | copies, never aliases; no path stored (always replanned) |
| `Blackboard` | `target?: id`, `aux?: id`, `tile?: {x,y}`, `tile2?: {x,y}`, `n?: number`, `deadline?: tick` | the owning machine | inspector | at most 3 ids, 2 tiles per frame; no arrays, no nesting |
| `Hold` | `{kind: 'job'\|'errand'\|'bed'\|'bay', id}`: claims the holder itself benefits from and owns | `reserve()`/`release()` only | audit | claims section below |
| `Job` (existing, extended) | add `urgency: number` (int, within-level rank, set by the posting system), `pendingFor?: number` (pending claimant), `category` may be inherited by hauls (section 6) | job posters; `pendingFor` by `reservePending` only | scheduler | `reservedBy` only via `reserve()`; open means `reservedBy == 0 && pendingFor == 0` (`isOpen`) |
| `SchedState` (`sim.ai`, saved optional like `sim.yard`) | `wake: boolean`, `lastPass: tick` | board mutation API, interrupts, executor completions set `wake`; scheduler clears it | scheduler | plain data, so save/load keeps timing identical |

`AssignmentC {jobId}` becomes `Task.job`. In Phase 1 it stays as the saved truth and `Task` mirrors it, so legacy hashes survive (section 10).

**Claims: owner, beneficiary, lifetime.** A claim has a *beneficiary* (who it is for, stored on the thing: `Job.reservedBy`, `Module.reservedBy` for beds and bays), an *owner* (who is responsible for releasing it) and a *lifetime*. Stock claims stay *derived* from haul jobs (a cancelled haul frees them by ceasing to exist); that design is untouched.

| Claim | Beneficiary | Owner | Lifetime | Lifeline record |
| --- | --- | --- | --- | --- |
| Job hold | worker | worker's Task | `task` | `Task.job` |
| Own bed or bay (sleep, charge) | sleeper or robot | its Task | `task` | `Task.holds` |
| Rescue bed | **patient** | the rescuer's Task *while carrying*, then the patient | `patient`: ends when the patient gets up, dies or the bed is destroyed | `Downed.bed` on the patient |

The rescue machine reserves via `reserveFor(patient, bed)`, which sets `Downed.bed` and `bed.reservedBy = patient` together. The rescuer's Task refers to the bed in `bb.aux` but does not hold it, so `abortTask` never releases it: an interrupted rescue just drops the reference and the patient keeps the bed (today's behaviour, now stated). Invariants checked by `auditReservations(sim)`:
1. `job.reservedBy = c` iff `c` is alive and `Task.job == job`.
2. `bed|bay.reservedBy = B` iff exactly one lifeline exists: `B.Task.holds` contains it, or `B.Downed.bed` equals it; never both, never neither.
3. At most one **root job hold** (`Task.job`), at most one **errand hold** (only while a child frame is active), one location claim and one pending claim per crew member; each job has at most one active holder and one pending claimant, never the same crew.
4. `Job.pendingFor = c` iff `c.Task.queued == job`; a pending job is not the crew member's active job.
5. Holder alive and on the job's ship (except an in-flight EVA transfer); frames in `Task.stack` at most 2; while the stack is non-empty the errand job's `resume` equals `Task.job`, `errand.errandFor == errand.reservedBy == c`, `Task.holds` has exactly one `errand` entry whose id is the child frame's `bb.aux`, and the errand is not on the board (`isErrand`, never `isOpen`). With an empty stack no `errand` hold exists. A root `eva` task (idle stow-away, player order) has the errand as its *root* job (`Task.job`), with no errand entry and no stack.
6. When a Task ends, every `task`-lifetime claim and any pending claim ends with it; `patient` claims do not. A stuck task ends through `bb.deadline` (no navigation progress for N ticks): abort with reason `stuck`, `Intent.avoid` for that job.

**Pending claims and atomic promotion.** `Job.pendingFor` and `Task.queued` are the two ends of "this job is mine once I reach my safe point". It coexists with the active hold: the crew member keeps its haul job (`reservedBy`) while the fire job is pending (`pendingFor`, `reservedBy` still 0). Only the claimant can reserve a pending job; everyone else sees it as not open, via `isOpen` (constraint 1 above).
- *Create*: `reservePending(crew, job)` by the scheduler when a preemption rule fires (section 7.1); sets `queued` and `yield`.
- *Promote*: `promote(crew)` is one synchronous call from the executor at the Task's safe point (the machine's completion path). In that single call it ends the current Task (releases its holds, finishes or leaves its job as normal), sets `reservedBy = crew`, clears `pendingFor`, and installs the new Task. No system runs in between, so nothing observes both jobs held or neither; the crew member has no idle tick. It revalidates (`jobFits`, ship, still wanted); on failure it cancels and the crew member goes idle normally.
- *Cancel*: `cancelPending` clears both ends. Triggers: the job destroyed (checked every tick and by `sweepOrphans`), the crew member aborted or interrupted (`abortTask` cancels pending first), timeout (`queuedAt + PENDING_TIMEOUT`, 200 ticks), or a forced reservation (`man.ts` for a drafted crew member) which cancels first. The job returns to open and `wake` is set. "Taken by someone else" cannot occur for pending jobs.

**Ownership of every decision and component:**

| System | Owns (writes) | Reads | Replaces |
| --- | --- | --- | --- |
| `vitals`, `needs`, `mood` | Health, Downed, Needs, Mood | env grids | unchanged |
| job posters (`autojobs`, `operateJobs`, `craftJobs`, `researchJobs`, `supplyJobs`, `haulJobs`, `cargoJobs`, `stationDirector`) | JobC lifecycle, `urgency`, `category` | world | unchanged, plus `urgency` |
| `interruptSystem` | `Interrupt` | Drafted, Downed, Carried, Inert/Stun, Fighter, Equip/Stow orders, Surrendered, EvaFloat, Embark, env hazards | `isOffDuty`/`isIncapacitated` as a single precedence list |
| `boardIndexSystem` | derived `BoardIndex` (not saved) | JobC, ModuleC beds, stock | new |
| `utilitySystem` | `Intent` | Needs, Mood, `BoardIndex`, Task presence | the needs part of `decide` |
| `scheduleSystem` | Job holds, `Task` creation, `yield`/`queued` | Intent, JobC, priorities, nav | `pickJob`, `emergencyWaiting`, `callOperator`, `yieldToOperator` |
| `steerSystem` (at `decide`'s slot) | Task state, `PathC.steps` for task crew | Task, Interrupt, Position | rest of `decide`, `goEat`, `goToSleep`, `goToBay`, `vacateSite`, `stowSuit` |
| `workSystem` (at its current slot, last) | Task state, `performJob`, job completion | Task | `work.ts` |
| `abortTask(sim, crew, reason)` | the only teardown | Task | all hand-rolled releases |
| fight (`crewCombat`, `equip`) | FighterC, equip orders, paths of off-duty crew | Interrupt | unchanged, but never touches Task |

**Path ownership.** `PathC.steps` has one *effective* writer per crew per tick, decided by `Interrupt.owner` (`none` when there is no Interrupt: the executor owns it). Same-tick transitions, in tick order:
1. *Taking over*: code that takes a crew member's path (`orderEquip`, emergency arming, `crew.draft`, `man.ts`, `setMode` into a fight) calls `abortTask` **first** (which clears the path), then writes its own path. `interruptSystem` runs after `equipSystem`, so it sees this tick's orders and sets `owner`; it only aborts as a safety net, and a late abort of a crew member that still had a Task is counted (`interrupt.lateAbort`, must be 0 in tests) because it would clear the path the origin just wrote.
2. *Equip order starts*: `equipSystem` (aborts, writes path) then `interruptSystem` (Interrupt `fight`, owner `fight`) then `steerSystem` skips the crew member. *Ends*: the order is removed in `equipSystem`; the Interrupt lapses at the next `interruptSystem` (same tick, later in order), so `utility`, `schedule` and `steer` may take over in that same tick.
3. *Fight starts*: `crewCombat` runs after `steer`. If `steerSystem` already wrote a path this tick, `setMode(idle to engage)` calls `abortTask` (clears it) then `walkTo` writes the chase path: one effective writer. The Interrupt appears at the next tick's `interruptSystem` with owner `fight`. *Ends*: `setMode(to idle)` clears the chase path; the executor takes over after next tick's `interruptSystem` (one idle tick, no double write).
4. *Hazard*: `interruptSystem` sets `Interrupt{hazard, owner: executor}` and `steerSystem` does advance crew whose owner is `executor`: the `escape` Task is created and stepped under its own Interrupt, so the interrupt never freezes its own escape. Utility and scheduler still skip the crew member. The Interrupt lapses when the tile is safe; the `escape` Task then completes.
A test wrapper records `PathC.steps` writes per crew per tick and fails on two effective writers.

## 4. Tick order and data flow (refinement 1)

```
vitals
autoJobs, operateJobs, haulCleanup, craftJobs, researchJobs, supplyJobs, cargoJobs, haulJobs   (unchanged)
needs, mood
boardIndexSystem       derived: open-job counts, spatial buckets, food/bed availability
equipSystem            (unchanged; creates equip/stow/arming orders)
interruptSystem        L0  after equip, so this tick's orders are seen; writes Interrupt; safety-net abortTask
utilitySystem          L1  Intent (reads BoardIndex counts only)
scheduleSystem         L2  assign / yield / queue
steerSystem            L3  navigate, start needs tasks (was decide)
draftedSystem, eggSac, crewCombat, alien, movement, carry, vehicles, trade, yard, ferry, logistics
workSystem             L3  Work/Complete (was work.ts, same last slot)
```

Data flow is one-directional inside a tick: posters write jobs, the index summarises them, utility reads the summary and writes `Intent`, the scheduler reads `Intent` and does exact search, the executor reads `Task`.

**Utility never schedules.** Its "work opportunity" input is a cheap estimate from `BoardIndex`, computed once per tick per ship:
- `open[ship][category][tag]`: count of jobs that satisfy `isOpen` (so pending jobs are excluded) and the *crew-independent* part of `jobFits` only: same ship, no missing materials, not an errand. Restrictions that depend on the crew member are **not** applied in the index; a job carrying one goes in a separate `tag` bucket (`none`, `yardOnly`, `mend`) and the read site adds the buckets that crew member may use (`yardOnly` only for `YardCrewC`, `mend` only with repair skill and same faction). Priorities and "not own target" are applied per crew at the read site too; the latter is ignored in the estimate (off by at most one). The dynamic reachability part stays the scheduler's.
- `bucketNear[ship][category]`: nearest non-empty cell of an 8x8 tile bucket grid, giving an integer lower-bound distance with no pathfinding.
- Crew-side: `workOpen(crew) = sum open[category][allowed tags] where priority > 0`, `workNear(crew)` = lower bound to the nearest of those. Both are integers.

**The back-edge is observable, not written.** If the estimate says work exists but the scheduler finds nothing reachable, the crew stays `drive: work` with no `Task`. Utility sees "work drive, no task for more than `IDLE_GRACE` ticks" (derived from `Intent.since` and Task absence) and damps the work score to 0 until the next evaluation window, so leisure or idle wins. No same-tick cycle, no hidden feedback state.

Utility evaluates each crew every `EVAL_TICKS` (10), staggered by `(tick + id) % 10`, and immediately when an `Interrupt` ends or a Task completes (`nextEval = tick`).

### Drive transitions: work to sleep, eat or recharge

- **Decides**: `utilitySystem`, which writes only `Intent.drive` (Schmitt latch and min dwell apply; an operator uses the exhaustion thresholds `OPERATOR_EXHAUSTED_BELOW`, `HUNGER_EAT_URGENT`).
- **Interrupts the current task**: `steerSystem`'s *reconcile* step, the only place that compares `Intent.drive` with `Task.drive`. The scheduler merely skips crew whose drive is not `work`.
- **Creates the replacement**: the same reconcile call (`startNeedTask`), so there is no tick where the crew member has neither.
- **By class**: `any`: plan the need task, then `abortTask('drive')` and start it in the same call. `safe`: set `Task.yield`; the machine's safe-point completion runs reconcile before the crew member counts as free. `finish`: ignored until the task ends, then reconcile (a carrier never drops a patient to sleep, as `isCarrying` guarantees today). `hold`: only the exhaustion override (section 5).
- **Plan before abort**: `startNeedTask` first plans (bed and path, food spot, bay); if it fails (no food, no reachable bay) the old Task is untouched and utility damps that drive until the next evaluation. No bed reachable falls back to sleeping where standing, as today.

Sequence, a tired worker mid-repair (tick t):
1. `needs` drops rest below 20. `utilitySystem` (evaluation due) writes `Intent{drive: sleep, latched: sleep}`.
2. `scheduleSystem`: not eligible (drive is not work); the repair Task (generic, `Work`, class `any`) is untouched.
3. `steerSystem` reconcile: drives differ, class `any`. It plans (`findFreeBed`, path). Found: `abortTask('drive')` (path cleared, repair job released with its progress kept on the job, Task removed), then `reserve(bed, self)`, new Task `{machine: sleep, drive: sleep, state: Walk, holds: [bed]}` with the path set. `movement` walks it the same tick.
4. Arrival: `Walk` to `Sleep`, activity `sleeping`. `needs` raises rest; at 100 the machine completes, releases the bed, sets `nextEval = tick`. Utility returns to work and the scheduler picks the best job, usually the repair job again.

## 5. Forced states and the interruption policy (refinement 2)

**Forced states bypass utility.** `interruptSystem` computes one `Interrupt` per crew from this precedence list; crew with an `Interrupt` get no new `Intent` evaluation and no scheduling:

| Prec | Reason | Source today | Mode |
| --- | --- | --- | --- |
| 1 | `dead` | `DeadC` | sweep (entity may be gone) |
| 2 | `downed`, `carried`, `inert`, `stunned` | `DownedC`, `CarriedC`, `InertC`, `StunC` | abort |
| 3 | `floating` | `EvaFloatC` | hold (task frozen; shuttle EVA transfer) |
| 4 | `drafted` | `DraftedC` | abort, except a drafted `operate` hold (kept, as `man.ts` does today) |
| 5 | `heldForMend` | `robots/jobs.heldForMend` | abort (robot stands still) |
| 6 | `fight` | `FighterC.mode != idle`, `EquipOrderC`, `StowOrderC`, `SurrenderedC`, `isInvader` (`isOffDuty`) | abort, except `finish`-class tasks (below) |
| 7 | `hazard` (new, Phase 3) | own tile: fire, thin air or CO2 without suit, extreme temp | abort unless the task declares tolerance (`extinguish`, breach seal, suited work) |

**Interruption class per task state** (`ai/interrupt.ts` table keyed machine, state; the class is copied to `Task.class`):

| Class | Meaning | Examples |
| --- | --- | --- |
| `any` | abandon this tick | generic Navigate/Work for build, repair, craft, research, mend, salvage, patrol, forceDoor, assemble; haul `ToSource`/`Take`; rescue `ToPatient`; eat `Walk`; sleep `Walk`; stroll |
| `safe` | continue to the next safe point, then yield | haul `ToDest` (safe point: after deposit, bounded by `PREEMPT_RANGE` tiles of remaining path), eat `Consume` (ration already taken), any task while the crew member stands suited on an exterior tile (safe point: an interior tile), airlock cycle (never leave the chamber mid-cycle) |
| `finish` | complete unless the carrier itself is out | rescue `ToBed`/`Lay` (matches `carryingPatient` today: finish rather than flee or fight) |
| `hold` | persistent: no end of its own; leaves only by handoff, exhaustion or a hard reason | `operate` held by an operator by choice (a relief's class is `any`) |

Hard reasons (`downed`, `dead`, `drafted`, `inert`, `hazard`) override every class. Soft requests (new better-level job, utility drive change, priority change) respect the class: `any` aborts now; `safe` sets `Task.yield` and the machine ends at its safe point; `finish` ignores the request; `hold` follows the persistent-job rules below. Disabling a category (priority 0) is a soft request: the task ends at its class's safe point, not earlier.

**What abandoning does** (`abortTask`, fixed order; steps 2 and 3 matter):
1. `clearPath`: stop walking (the step in progress finishes, so position stays valid).
2. Machine `onAbort(reason)` disposes what the crew member holds:
   - haul carrying: `dropCarried` / `spillItems` at the nearest free floor tile; the `deliver` haul job has no carrier, so `haulCleanup` destroys it and `haulJobs` re-plans (destination room was only derived from that job, so it frees itself);
   - rescue carrying: remove `CarriedC`, patient stays on the carrier's tile with `activity 'downed'`; the bed claim has patient lifetime (section 3): it stays on `Downed.bed` and the rescuer only drops its reference (cleared only if the bed is destroyed); `autoJobs` reposts the rescue job;
   - eat: remove `EatC` (ration already consumed is lost, as `needs.ts` does today for a drafted eater);
   - sleep: `releaseBedClaim`, activity `idle`;
   - EVA: a non-drafted suited crew member is not left exterior: `abort` converts to an `escape` Task to the nearest airlock interior; a drafted one keeps the suit and the player owns the rest;
   - robot charge: release bay hold only if leaving for good.
3. Cancel any pending claim, then release `task`-lifetime holds in reverse order of acquisition (job, then bed or bay); `patient` claims are untouched: `release()` zeroes `reservedBy` only when it still equals this crew member. Set `job.freeSince` for `operate`.
4. Unwind `Task.stack` last-in first-out (child `onAbort`, then the parent's), destroying any child errand job and its resume link (today's `sweepErrands`).
5. Remove `Task`; set `SchedState.wake`; emit `crew.taskAborted {reason}` (output only).
6. The caller then applies its own state (`Drafted`, `Downed`, ...).

Entities that vanish (death, ship removal) are covered by a once-per-tick `sweepOrphans` that runs `abort` for holds whose holder is gone; in tests its finding count must be 0, which makes it a leak detector rather than a crutch.

**Persistent jobs (`operate`).** An operate job never completes. Its console state is the job's own: `reservedBy` is the holder or 0, and an empty console keeps `freeSince`. A drafted crew member ordered to man it ends only on hard reasons, as `man.ts` does.
- *Handoff to a reliever or better operator*: the scheduler gives the newcomer B a pending claim on the console job while the holder A keeps the active hold, and B a Task in `Approach` (Navigate to a tile beside the access tile). B stops on that tile (`Wait`, settled), because an operator must stand ON the access tile (`operatorOf` needs the holder settled there). Then, in one executor call, `swapHolder(job, A, B)` moves `reservedBy` A to B, ends A's Task as `relieved` with a one-step `StepOff` to a free adjacent tile other than B's, and starts B's step onto the access tile; B's step starts on the first tick A's `origin` is no longer that tile, so no two crew ever share the tile on purpose (movement has no crew collision rule, but the design does not rely on overlap). **A brief unmanned gap is accepted**: from A's first step until B settles on the tile, at most `HANDOFF_GAP_MAX` (60 ticks, 3 s; normally one tile of walking, about 1 s). Meanwhile the console is reserved to B, `operatorOf` is 0, so it behaves as any unmanned console (base strength; weapons do not fire; relief timers are not restarted). If B cannot step on within the bound, B aborts as `stuck` and the console becomes an ordinary open job with `freeSince = now`. Cancel earlier (B aborted, path fails, job dropped) clears the pending claim and A is unaffected. Today's gap, release, `decide` re-pick, then a walk from anywhere, is longer; the swap is a Phase 2 change.
- *Exhaustion*: a `hold` operator may leave when rest is below `OPERATOR_EXHAUSTED_BELOW` or hunger below `HUNGER_EAT_URGENT` (today's operator thresholds). The sleep or eat drive then overrides the class to `any` in reconcile and the post is vacated through `abortTask`: `reservedBy = 0`, `freeSince = now`, the job stays on the board at its urgency. While empty it is an ordinary open job: `callOperator` can pull an operator by choice, and reliefs may take it after `RELIEF_AFTER_SEC`. Without exhaustion the operator ignores drive changes and level-based preemption.
- *Combat relief mapping*: `canRelieve` becomes a scheduler admission filter for crew whose operating level is above `OPERATE_MAX_LEVEL` (unchanged conditions: in combat, unmanned for `RELIEF_AFTER_SEC`, role `relievesStations`, not the shield console, no free operator), with `RELIEF_PENALTY` in the cost. `yieldToOperator` becomes two rules on a relief holder: leave when a strictly better level waits (normal preemption, class `any`), or hand off by swap when a free operator by choice exists. `callOperator` is ordinary preemption of a busy operator by choice, followed by the pending claim. Priority 0 for operating: the holder leaves at the next pass (a console holds nothing, so any tick is a safe point).

**Sequence: a fire breaks out while hauling** (carrying 20 metal, deliver phase, 6 tiles from destination):
1. `fire` writes the fire field. `autoJobs` posts `extinguish` (category firefighting) the same tick. The hauler has firefighting at level 1, hauling at 2.
2. `scheduleSystem` sees a strictly better level for this crew, the Task is `safe` class and remaining path (6 tiles) is within `PREEMPT_RANGE` (12 tiles): it makes the fire job a pending claim for them (`pendingFor`, `Task.queued`, `Task.yield`) while they keep the haul job. If the path were longer it would not preempt and would offer the job to the next-best free crew.
3. `steerSystem`/`workSystem`: the haul completes its deposit (item delivered, nothing to drop). `promote()` ends the haul and installs the fire Task in one call: never both held, never neither, no idle gap, no stray stack.
4. If instead the fire ignites *their tile* (`hazard`, hard): `interruptSystem` finds `Interrupt hazard`, calls `abortTask`: path cleared, 20 metal spilled to a nearby tile, haul job left carrier-less (destroyed by `haulCleanup` within `PLAN_INTERVAL`), hold released, then an `escape` Task (jobless) walks them off the tile. The fire job is then taken through the normal scheduler.

## 6. Executor: HFSMs (refinement 3)

One generic machine covers simple jobs. Specialised machines exist only where a job has more than one phase with something held.

```
generic:  Navigate ──arrived──> Work ──performJob 'done'──> Complete
              ^                     │ 'wait' (e.g. tile occupied): stay in Work
              └── repath when path empty and not at job (routeToJob)
```

`Navigate` calls `planSiteWalk` (thin-air and suit rules unchanged: a thin plan sends the crew to the `eva` machine first). `Work` calls the existing `performJob` unchanged. `Complete` emits `crew.jobDone`, destroys the job, ends the Task. `performJob` stays the single place per-kind work logic lives.

Every current job kind and activity:

| Job kind / activity | Machine | Notes |
| --- | --- | --- |
| `build`, `deconstruct`, `module`, `moduleDecon`, `forceDoor` | generic | `jobFits` excludes jobs with `needsMaterials`; **builders never fetch** (see below) |
| `extinguish`, `repair`, `craft`, `research`, `mend`, `salvage`, `assemble`, `patrol` | generic | `patrol` = Work for N ticks then Complete; `assemble` waits on materials like `build` |
| `operate` | generic, `Hold` variant | Work never completes; class `hold` (relief: `any`); handoff, exhaustion and relief rules in section 5 |
| `hack` | generic | only ordered (player), never scheduled; drafted holder |
| `haul` | **haul** | `ToSource`, `Take`, `ToDest`, `Deposit`, then `NextStop` (the `h.then` chain) or `Done`; blackboard: `target` = source, `aux` = destination, `n` = count |
| `rescue` | **rescue** | `ToPatient`, `Lift`, `ToBed`, `Lay`; holds job and bed; blackboard: `target` = patient, `aux` = bed |
| `suitUp`, `suitOff` (errands), idle `stowSuit` | **eva** | `ToAirlock`, `Don` or `Doff`. A child of a job task (suit up before a thin-air job), a root task for idle stow-away or a player order. Exterior work is the parent's Navigate/Work with `suited` rules. Errand job entities are **kept** (decision 7), driven by this machine |
| sleep (`goToSleep`, `fallAsleep`) | **sleep** | `ClaimBed`, `Walk`, `Sleep`, `Wake`; hold: bed |
| eat (`goEat`) | **eat** | `PickSpot`, `Walk`, `Consume`, `Finish` |
| robot bay (`goToBay`, `wantsBay`) | **charge** | `ClaimBay`, `Walk`, `Charge` |
| `vacateSite`, `wander`, `strollTurn` | generic, jobless | `Navigate` then `Dwell`; leisure or idle drive |
| `equip`/`stow`, emergency arming, `fight`, flee, drafted walk, `EmbarkOrder`, mining/ferry pilot, `EvaFloat` | **outside the executor** | fight and boarding stay in `fight/` and `vehicles/` (forced layer); pilots, `EmbarkOrder` and `seatHelms` stay forced states for now (decision 5) |

**Nested execution (EVA).** A job that needs a suit runs as parent and child inside one `Task`; the root job hold (`Task.job`, `holds`) never changes during the nest, only the active machine, state and blackboard.
- *Push*: Navigate finds a thin plan, so `push(task, eva, ToAirlock)` copies `{machine, state: Navigate, class, bb}` onto `Task.stack`, installs the child with a fresh blackboard (`tile` = suit tile, `aux` = the errand job entity). The errand keeps `resume = Task.job` and `errandFor = crew`.
- *Two kinds of hold*: `startErrand` today reserves the parent job (`reservedBy = crew`) and a personal errand job (`reservedBy = crew`, `errandFor = crew`). The design names them: the **root job hold** is `Task.job` (the one counted by invariant 1) and never changes during the nest; the **errand hold** is a `Task.holds` entry `{errand, id}` created by `push` and mirrored in the child frame's `bb.aux`. They are different kinds of claim, so invariant 3 holds. Saved as plain data: the errand is an ordinary saved job entity carrying `resume` and `errandFor`.
- *Pop on success*: the child finishes `Don`, in one call the errand entity is destroyed and its `errand` hold removed, the parent frame is copied back and its state set to `Navigate` (the path is never stored, so it is always replanned, now suited). Replaces `resumeAfter`.
- *Child failure* (last suit taken meanwhile, airlock unusable, `Doff` blocked past its deadline): the whole Task aborts, not a half-restored parent. `abortTask` unwinds last-in first-out (child `onAbort` destroys the errand and drops the `errand` hold, then the parent's `onAbort`, then the root job hold), sets `Intent.avoid` on the job and reason `noSuit`. External aborts take the same path; a child that already donned the suit while the crew member is exterior converts to `escape`.
- *Class*: the Task's class is the child's while it is active.
- *Save/load*: `stack` and frames are plain data in `Task` (blackboards only, no paths or derived values), so nothing is rebuilt on load; a test covers every (parent state x child state) pair. In Phase 1 the stack is derived on load from `AssignmentC` plus the errand's `resume`, because legacy components stay the saved truth.

**Logistics boundary (preserved).** `supplyJobsSystem` creates haul jobs to feed a build or craft job's `needs`; the builder is only eligible once `needs` are delivered (`jobFits` calls `needsMaterials`). The executor never gives a generic Task a `CarryingC`; haul and rescue are the only machines that do. The derived reservation model, the `chain`/`then` multi-stop routes and `haulCleanup` are untouched. One deliberate fix in Phase 2: hauls take the category (and `urgency`) of the job they feed, so a breach-seal job at `firefighting` is not blocked behind `construction`-level hauls. Test: no Task on a build/module job ever co-occurs with `CarryingC`.

## 7. Scheduling (refinement 4)

### 7.1 Semantics

- **Eligibility**: `Intent.drive == 'work'`, no `Interrupt`, and either no Task or a Task that may be preempted. Admission is `jobFits` (static) then reachability (dynamic).
- **Order** (integer tuple, lexicographic, replaces additive bonuses): `(level 1..4 of the job's category for this crew, -urgency, cost, jobId)`. `cost` is path cost in the pathfinder's x10 units (diagonal 14, exterior x4) plus `EVA_JOB_PENALTY x10` for a thin route, minus `operateAffinity x10`, plus the relief penalty. `urgency` carries manual priority repair (`repairFirst`), combat triage tiers and breach seals, set by the posting system rather than inferred in `decide`. A deliberate unit change from `steps.length` to path cost, and a small airlock transit cost, apply in Phase 2.
- **Matching**: per level, globally across free crew of a ship: repeatedly take the lowest tuple pair (crew, job), assign, remove both, until no pairs remain; then the next level. Within a level this gives the nearest crew the job, instead of today's "lowest crew id picks first". Crew-side tie-break is crew id. Strictness is per crew (a crew member is taken at the best level where they have any reachable job), because level 1 is processed globally before level 2.
- **When it runs**: a pass runs on any tick where `SchedState.wake` is set (job created or freed, crew became free, interrupt ended, priority command, `wake` set by executor completion) **and** every `SCHED_CADENCE` (20) ticks regardless, for time-varying cost terms (thin air appearing, suits, combat flag). Passes are never skipped on a cache guess; only the pure per-pair work is cached. `wake` is saved state, so a save/load run is identical to a continuous one.
- **Per-crew backoff**: `Intent.avoid` (one job, until tick) after a `stuck` abort. A pass with free crew and no reachable job is cheap by the component prefilter below.
- **Preemption** (always a pending claim, promoted at the safe point). Busy crew are candidates only for: (a) a strictly better level, when the class permits (section 5); (b) **selective same-level emergency preemption** (decision 1): the new job's urgency tier is at least `URGENT_TIER` (manual priority repair, fight-critical repair, breach seal, rescue, extinguish) and at least one tier above the current job's, with hysteresis: the current Task is older than `MIN_HOLD` (3 s), `Intent.lastPreempt` is older than `PREEMPT_COOLDOWN` (10 s), the job left behind gets `Intent.avoid` for that cooldown, the class is `any` or `safe`, and the current job is not within 20% of finishing; (c) the operate rules of section 5. Disabling a category (priority 0) sets `yield` and ends the task at its safe point (decision 2).
- **Combat triage** is urgency order within the repair level; it needs no code in the scheduler beyond the tuple.
- **Fairness**: global nearest-crew matching removes crew-id bias; reserved jobs are never stolen at equal level (no thrash); `avoid` stops ping-pong on a failed pair. Starvation of a far job by endless near jobs inside a level is accepted (RimWorld behaviour); there is no aging until starvation is demonstrated (decision 6), which the Phase 0 `oldest open job age` metric will show.
- **Determinism**: crew iterate in id order, jobs in id order, ties by id, all scores integer, no `Math.random`, no float comparisons, no `Map` iteration over insertion-dependent keys without a sort.

### 7.2 Navigation requirements every candidate must meet

- **Modes** (the existing `planWalk` semantics): `dry` (avoid thin air), `any`, `suited` (exterior tiles walkable at x4). A crew member's mode order is `dry` then, only if the job is unreachable dry, `any` flagged `thin` (suit required) then `suited` (`planSiteWalk`). Suited-with-air and airless bodies use `any` directly.
- **Airlocks and doors**: `DoorJam.Shut` blocks; airlock gates cost an extra transit constant (crew wait for a cycle); `walkInfo` solid module tiles apply.
- **Restrictions** stay in the static admission predicate (`yardOnly`, robot skill and faction, `job.target != crew`, drafted/off-duty).
- **Multiple ships**: boards and fields are per ship region. A crew member is eligible only for the board of `shipIdOf(pos)` (as `jobFits` enforces now). There is no portal graph today: docked shuttles are vehicle state, crew cross by `vehicle.*` commands and `EvaFloat`, never by walking. The nav provider takes `(shipId, mode)` so a later portal graph is a new provider, not a scheduler change. Ship removal or a node jump aborts Tasks and destroys that ship's jobs (tested).

### 7.3 Candidates

- **A. Lower-bound pre-rank + A\* on top k.** Rank jobs by an integer octile lower bound (admissible), run A\* in order, stop when the next bound exceeds the best exact cost. Exact if uncapped. Cheap when bounds separate; worst case is walled-off jobs exploring a whole region.
- **B. Per-site Dijkstra field.** One cached distance field per job site and mode, cost by lookup, path by descent. Exact. Wins when crew far outnumber sites (hauling to one storage); memory grows with sites (hub: about 76 KB per field).
- **C. Per-crew multi-goal Dijkstra with early exit.** One search per free crew until the level's goals settle. Exact. Wins when jobs far outnumber crew (hullplan, hauls); risk is many free crew at once (44 idle on a hub). Modes (`dry`, `any`, `suited`) are separate runs merged by the `dry`-first rule.
- **D. Cached paths and pair costs with invalidation.** Memoise (crew tile, site, mode) and the last path, revalidate steps, drop on a navigation revision (struct, door, jam, airlock state). Only saves repeats; a stale entry would be a nondeterminism bug.

All four share a **component prefilter**: a connected-component labelling per (ship, mode) rebuilt on a navigation revision (struct, door, jam, module solids; thin-air status for `dry`). An unreachable job costs a label compare, not a search. This removes the worst current cost regardless of the choice.

Working hypothesis, to be confirmed or killed by the benchmark: **C** with the prefilter as the default, **A** inside it as the cheap path for single-job boards, **D** as an orthogonal cache for executor repaths (`routeToJob`), **B** only if the benchmark shows many crew sharing few sites (hauling to one storage).

### 7.4 Benchmark plan

Tooling (Phase 0, no sim change): add `--scenario` to `npm run profile:sim` (today it only supports `--empty`), reuse `docs/PROFILING.md` probes and `window.__perf`, and write a **board recorder**: serialise (nav layers, jobs, crew positions, priorities, suit stock) at a tick so each candidate is replayed offline on identical input, side by side with the reference.

Scenarios (existing from `src/main.ts`, plus synthetic via debug commands): colony baseline; `hullplan` (hundreds of build jobs, EVA hull ring, thin-air routes); `log` (fire plus raider: emergency preemption); `fight` and `damage` (arrive with #184: triage, breach seals, operate relief); station hub via `debug.spawnStation` (44 crew, large grid, patrols); unreachable storm (100 jobs behind a shut door, jam or sealed airlock); hauling flood (500 stacks, few storages); multi-ship (player ship, docked station, prize with salvage, yard crew). Doors, airlocks and jams are in every candidate's step cost; the nav provider is per ship.

Metrics (counts first, wall time second, so CI is not flaky): nodes expanded per pass, searches per pass, cache hit rate, `sim/schedule` self ms mean/p95/max, scheduler share of `sim/tick`, time-to-assign p95 after a job appears, regret versus the exhaustive reference (must be 0 for exact candidates), decisions identical across cache-on and cache-cold.

Decision rule: choose the candidate with the lowest p95 scheduler self time that is exact (regret 0) on every recorded board; budgets, set after the baseline: p95 pass at most 5% of the 50 ms tick on the hub scene and at most 0.5 ms average on the colony baseline. Record the baseline `sim/decide` figure first; the speed win must be shown, not assumed. The candidate selection and benchmark runs are the Opus agent's task in Phase 2 (decision 9). Retain the winning approach's counters as slow-tier regression tests (counts, not times).

#### Baseline (Phase 0, `main` with #196 bed owners, no sim change)

Produced by `npm run profile:baseline -- --seeds 1,2,3` (scenarios in `tools/profile/scenarios.ts`, described in `docs/PROFILING.md`). Ticks are 20 per second; the scenario's own tick count is used (5000, `storm` 1500, `haul` 2500), after a 10% warm-up (max 200 ticks) that the `decide` columns exclude and the metrics include. **`decide` columns are `sim/decide` self ms per tick: mean, p95, max.** The rest are the Phase 0 metrics in ticks (oldest open job age max and p95 over ticks; time from creation to assignment p50 and p95; jobs never assigned by the end; idle-with-work crew-ticks, sampled every 25 ticks; jobs completed per 1000 ticks).

| scenario | seed | ticks | decide mean ms | p95 | max | oldest open max | p95 | assign p50 | p95 | never assigned | idle-with-work crew-ticks | completed /1000 ticks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| colony | 1 | 5000 | 0.131 | 0.170 | 11.0 | 2028 | 1768 | 1 | 270 | 0 | 0 | 7.5 |
| colony | 2 | 5000 | 0.086 | 0.178 | 1.8 | 324 | 64 | 1 | 1 | 0 | 0 | 11.15 |
| colony | 3 | 5000 | 0.125 | 0.245 | 24.2 | 573 | 313 | 1 | 1 | 0 | 0 | 38.85 |
| hullplan | 1 | 5000 | 14.025 | 49.203 | 90.9 | 5199 | 4939 | 226 | 2613 | 53 | 350 | 60 |
| hullplan | 2 | 5000 | 0.399 | 0.656 | 10.8 | 5199 | 4939 | 1 | 784 | 20 | 0 | 16.54 |
| hullplan | 3 | 5000 | 4.310 | 27.692 | 113.2 | 5199 | 4939 | 1 | 2384 | 59 | 175 | 81.73 |
| log | 1 | 5000 | 0.197 | 0.312 | 14.3 | 2462 | 2202 | 1 | 966 | 4 | 25 | 8.46 |
| log | 2 | 5000 | 0.207 | 0.378 | 7.9 | 2497 | 2237 | 1 | 146 | 1 | 0 | 12.5 |
| log | 3 | 5000 | 0.178 | 0.325 | 8.1 | 4103 | 3946 | 1 | 84 | 2 | 0 | 30.77 |
| hub | 1 | 5000 | 0.271 | 0.816 | 15.1 | 1920 | 1781 | 1 | 1 | 1 | 0 | 18.08 |
| hub | 2 | 5000 | 0.238 | 0.436 | 14.1 | 1816 | 1702 | 1 | 1 | 0 | 0 | 14.04 |
| hub | 3 | 5000 | 0.248 | 0.469 | 27.4 | 2186 | 1969 | 1 | 1 | 0 | 0 | 15.77 |
| storm | 1 | 1500 | 60.319 | 74.101 | 185.0 | 1649 | 1567 | 0 | 0 | 177 | 0 | 0 |
| storm | 2 | 1500 | 60.168 | 77.563 | 115.9 | 1649 | 1567 | 0 | 0 | 177 | 0 | 0 |
| storm | 3 | 1500 | 57.452 | 77.375 | 141.0 | 1649 | 1567 | 0 | 0 | 177 | 0 | 0 |
| haul | 1 | 2500 | 4.498 | 3.315 | 207.5 | 2691 | 2556 | 460 | 1481 | 111 | 275 | 160.74 |
| haul | 2 | 2500 | 3.818 | 3.836 | 152.9 | 2691 | 2556 | 402 | 1520 | 112 | 400 | 160.37 |
| haul | 3 | 2500 | 4.510 | 3.894 | 187.1 | 2691 | 2556 | 472 | 1487 | 112 | 325 | 160.74 |
| multiship | 1 | 5000 | 1.403 | 2.907 | 8.3 | 5199 | 4939 | 1 | 190 | 133 | 0 | 7.5 |
| multiship | 2 | 5000 | 1.314 | 2.528 | 14.4 | 5199 | 4939 | 1 | 1 | 133 | 0 | 6.73 |
| multiship | 3 | 5000 | 1.377 | 2.741 | 11.3 | 5199 | 4939 | 1 | 1 | 133 | 0 | 7.31 |

Reading it:

- **Wall-clock figures vary; the counts do not.** The `decide` times were taken on a shared machine (load average 3 to 7 during the run), so means and p95 are indicative and the max column holds scheduler and GC outliers. The metrics columns are deterministic: the first seed of every scenario was run twice and the full metrics JSON was identical in all seven.
- **Bed owners (#196) removed the first-tick spikes.** Before it, `hub`, `hullplan` and `haul` had 0.9 to 1.1 s maxima while every crew member searched every bed; now the worst `decide` frames are 8 to 30 ms in `colony`, `log`, `hub` and `multiship`, 11 to 115 ms in `hullplan` and 150 to 210 ms in `haul`.
- `storm` is the headline: **about 60 ms per tick (p95 75 to 82 ms) from `decide` alone, more than the whole 50 ms tick**, for four crew and 177 unreachable jobs on a 30x20 ship. Nothing is ever assigned or completed, which is correct, so the cost is pure wasted search (section 7's component prefilter targets exactly this).
- `haul` (500 stacks, 48 crew over a ship and a hub) costs 4 to 5 ms per tick mean with a heavy start; a job waits a median of 400 to 470 ticks (20 s) and 111 to 112 are still open after 2500 ticks. `hullplan` seeds 1 and 3 average 4 to 14 ms per tick (p95 28 to 49 ms) while the yard and interior jobs are open; seed 2 stays at 0.4 ms (its yard order was cheaper), so the cost depends on the board, not just the scenario.
- `colony`, `log` and `hub` are cheap (0.1 to 0.3 ms mean). The `decide` budget of 0.5 ms average on the colony baseline is already met; the hub budget (5% of 50 ms = 2.5 ms p95) is met today at 0.4 to 0.8 ms.
- Oldest open job age is dominated by jobs that are not takeable at all (patrol posts, jobs on a derelict, hull jobs behind a thin-air route with no suit); only `haul`, `hullplan` seeds 1 and 3, and `log` seed 1 show idle-with-work crew-ticks above zero, and those are small (25 to 400 crew-ticks of several thousand idle). Per decision 6 (no aging until starvation is shown), the metric to watch for starvation is the p95 of oldest open age on a board where every job is takeable; none of these boards is that, so this baseline does not yet show starvation.
- Not covered yet: `fight` and `damage` (arrive with #184), and prize or yard-crew runs in `multiship`.

## 8. Policy interface (refinement 6)

The scheduler needs only three facts about a crew member, none from utility: eligibility (`Intent.drive == 'work'` and no `Interrupt`), per-category levels (`PrioritiesC`), and static admission. It never reads drive scores. Anything that can set `Intent.drive` to `work`, including a trivial policy, gets full scheduling.

Policies are **content data**, interpreted by one engine in `sim/ai/utility.ts`, so `content` imports only types:

```ts
interface PolicyDef {            // content/policies.ts, `satisfies PolicyDef`
  id: string;                    // 'policy.colonist'
  drives: DriveDef[];            // order = Intent.scores order
  evalTicks?: number;
}
interface DriveDef {
  id: DriveId;                   // 'work' | 'sleep' | 'eat' | 'recharge' | 'leisure' | 'idle'
  input: DriveInput;             // registered reader: 'rest' | 'hunger' | 'charge' | 'mood' | 'workOpen' | 'foodAvailable' | ...
  curve: [number, number][];     // integer piecewise-linear, input in tenths -> score 0..1000
  enter?: number; exit?: number; // Schmitt-trigger latch (sleep enters at rest 20, exits at 100: today's behaviour)
  margin?: number;               // hysteresis: a challenger must beat the current drive by this
  minDwell?: number;             // ticks
  requires?: DriveInput[];       // e.g. eat requires foodAvailable
  task: MachineId | 'job';       // machine started, or 'job' = hand to the scheduler
}
```

| Crew kind | Policy | Drives |
| --- | --- | --- |
| Player colonist | `policy.colonist` | work, sleep, eat, leisure (idle wander), mood later |
| Station crew | `policy.station` | work (patrol is a job category), sleep, eat (hunger floor 25 stays in `needs`), leisure = stroll to court |
| Enemy ship crew | `policy.npc` | work, sleep (rest decays for all non-battery species today); no hunger or mood |
| Robot | `policy.robot` | work, recharge (`wantsBay`); no sleep or eat |
| Yard contractor, others | `policy.none` | work only; Intent is constant |

The director layer (`stationDirector`) is unchanged: it is a *policy over the scheduler's inputs* (it posts jobs, may draft), not a utility. NPC crew therefore share the scheduler, interrupt layer and executor exactly, and differ only in policy data. Phase 1 uses a hard-coded `policy.legacy` that reproduces `decide`'s thresholds so the layer split lands without behaviour change; Phase 3 swaps it for the data-driven engine.

**Drives.** `cover` is deferred (decision 4). Engaged fight and flee stay forced and in `fight/` (`stepFighter`, `hiddenFrom`, `claimHiddenRescue`); the `hazard` interrupt (section 5) is new and in scope.

## 9. Determinism and saves

- Scores are integers: path cost x10, urgency, affinity x10, penalties, drive scores per mille. Float inputs (`needs.rest`) are quantised once, at the reader, with `Math.floor(x * 10)`. Curves are integer piecewise-linear with integer division by truncation. A test asserts `Number.isInteger` on every score written.
- All iteration is over `world.query` (ascending id) or explicitly sorted arrays; ties end in ids.
- No hidden state. Saved: `Intent`, `Interrupt` (re-derived anyway), `Task` including `bb`, `stack`, `holds`, `queued`, `yield`, `Job.pendingFor`, and `SchedState`. Not saved and result-neutral: `BoardIndex`, nav components, path caches, pair costs, per-tick memos. A "cache-cold" test clears them every tick and compares hashes, in the style of `envSkip.test.ts`.
- `SAVE_VERSION` is bumped when a phase changes saved shape (Phase 2 for `Task`, `Intent` as saved truth, `SchedState`; no migrations, per project rules). Phase 1 keeps `AssignmentC` as the saved truth.
- `abortTask` and the scheduler use no RNG. The only RNG users (`wander`, `strollTurn`) keep their draw order, which matters for hashes.

## 10. Tests, acceptance and phased migration (refinement 5)

Test kinds, applied per phase (a global `afterEach` runs `auditReservations` on every scenario test):

| Test | What it asserts |
| --- | --- |
| **Save/load mid-state** | For each (machine, state) in the machine tables (enumerated, so a new state without a scenario fails the build): run to that state, serialize, load, run 200 ticks; per-tick hash equals the uninterrupted run |
| **Reservation cleanup** | Cross product of states x {draft, down, kill, destroy job, cancel job, destroy holder ship, jump away, remove module}: after one tick no orphan `Task`, no dangling `reservedBy`, no stray `CarryingC`, bed/bay free, haul destinations released, `auditReservations` clean, `sweepOrphans` found 0 |
| **Interruption correctness** | per class: `safe` finishes its deposit then yields; `finish` rescue lays the patient (carrier downed: patient left in place, job reposted); airlock chamber is never left mid-cycle; an aborted EVA never leaves an unsuited crew member outside; items are conserved (stock + carried + delivered constant across abort storms) |
| **Deterministic replay** | same seed and command script, 3 runs: identical event stream and tick hashes; replay with random save/load points equals continuous; replay with caches cleared equals normal |
| **Behavioural equivalence** | from Phase 2: over seeds 1..5 and the benchmark scenes, jobs completed per category within a tolerance set from the baseline's seed variance (default max(5%, 2 sigma)); no crew with `drive: work`, no Task, no `Interrupt` and a reachable open job for more than `SCHED_CADENCE` ticks (idle-with-work counter, total under 1% of crew-ticks); time-to-first-assign p95; fires and breach seals taken within a bound |
| **Priority property** | on seeded random boards, a job at level L is never assigned while an open reachable job at a better level exists for that crew; preemption never ends a `finish` task, and ends a `hold` task only by the section 5 rules; same-level preemption respects `MIN_HOLD` and `PREEMPT_COOLDOWN` |
| **Scheduler oracle** | a tests-only brute force (A* on every pair, same tuple) gives identical assignments on 1000 random boards for an exact candidate; bounded regret for an approximate one |
| **Logistics invariants** | no build/module Task with `CarryingC`; hauls conserve items; supply shortfalls still emit `job.missingMaterials` |
| **Pending claims** | a pending job is invisible to every other picker; promotion leaves exactly one of old and new held at every system boundary (audit between all systems); cancel on job destroyed, crew aborted, timeout, forced `man`; `isOpen` used by all `reservedBy === 0` readers (lint) |
| **Persistent jobs** | swap handoff leaves the console unmanned for a bounded gap only (see Console handoff); cancel mid-approach leaves the holder; exhaustion vacates and sets `freeSince`; combat relief rules reproduce `canRelieve` conditions; drafted operator only ends on hard reasons |
| **Claim lifetimes** | rescuer interrupted at every rescue state: patient keeps the bed, `Downed.bed` and `bed.reservedBy` agree, a new rescuer reuses it |
| **Nested EVA** | save/load at each (parent state x child state); child failure aborts the whole Task with no leaked errand, hold or suit; abort mid-child unwinds last-in first-out |
| **Drive transitions** | per class, work to sleep/eat/recharge in the order of section 4 with no idle tick; failed plan leaves the old Task; no flip-flop inside `minDwell` |
| **Errand holds** | the root job hold and errand hold coexist without breaking invariant 3; `auditReservations` checks `errandFor`, `resume`, exactly one `errand` entry iff the stack is non-empty; success pop, child failure and root abort (LIFO) each leave no errand entity or hold; save/load at each child state restores them identically |
| **Console handoff** | A to B leaves at most `HANDOFF_GAP_MAX` ticks unmanned, never two crew choosing the tile, a blocked B ends as `stuck` with the console open and `freeSince` set; weapons do not fire during the gap |
| **Path ownership** | a recording wrapper sees one effective writer per crew per tick on the tick an equip order starts and ends, a fight starts (after `steer` wrote) and ends, a draft lands; `interrupt.lateAbort` is 0 |
| **Hazard escape** | with `Interrupt hazard` active the `escape` Task keeps advancing each tick and finishes; utility and scheduler stay skipped; a higher reason (downed) aborts it |
| **BoardIndex scope** | a pending job is absent from every count; two crew with different skills, priorities or `YardCrewC` read different totals from the same index; the index content does not depend on which crew exist |
| **Multi-ship** | no cross-ship reservation; a destroyed or departed ship leaves no Task, job or hold |

### Phase 0: tooling (can start now, no sim change)

Starts now, independent of #184. Scope: `profile:sim --scenario`, board recorder, `oldest open job age` metric, decision-diff tool (records `(tick, crew, job)` assignments of two runs and prints the first divergence), idle-with-work and completion metrics harness, baseline numbers recorded in the doc. Files: `tools/profile/*`, `docs/PROFILING.md`. Acceptance: baseline `sim/decide` per scene recorded; metrics harness reproduces the same numbers twice. Risk: scenarios not in `profile:sim`; mitigated by building them from `newGame` plus debug commands.

### Phase 1: executor, no behaviour change

Scope: `Intent` written by `policy.legacy` (decide's thresholds, verbatim); `pickJob` moved unchanged into `ai/legacyPick.ts` and called by a `scheduleSystem` stub in `decide`'s slot; executor machines (generic, haul, rescue, eva, eat, sleep, charge) replace the inline `decide`, `goEat`, `goToSleep`, `goToBay`, `stowSuit`, `vacateSite` and `work.ts` bodies; `abortTask` and `reserve/release` replace every hand-rolled release; `interruptSystem` as a read-only detector that logs mismatches against `isOffDuty`/`isIncapacitated`; first inspector cut (Task state path, holds).

Files touched: new `src/sim/ai/*`; `systems/{decide,work,operateJobs,autojobs,vitals}.ts`, `crew/{helpers,components,jobFit,eating,beds,vacate,death,handlers}.ts`, `eva/{errands,handlers}.ts`, `fight/{man,rescue,fighter,emergency}.ts`, `robots/{jobs,bay,handlers}.ts`, `ftl/order.ts`, `stations/life.ts`, `pipeline.ts`.

Acceptance: `sectorEquiv`, `tickEquiv`, `envSkip` hashes **identical** (the legacy-shape hash strips `task`, `intent`, `interrupt`, as past refactors did for new fields); the full existing suite green; save/load mid-state, reservation cleanup, interruption and replay tests above pass; per-tick profile of `sim/decide` + `sim/work` no worse than baseline. Not in this phase: pending claims, swap handoff, same-level preemption, stack persistence. Risks: AssignmentC written in 16 files (a missed write path leaves a Task mirror stale; mitigate with a grep-based lint rule forbidding direct `AssignmentC` writes outside `ai/`); rebasing on #184's changes to `decide.ts` (so this phase starts after the merge).

### Phase 2: scheduler, with a deliberate behaviour change

Scope: `BoardIndex`, nav prefilter and the benchmark-selected candidate; global per-level matching; the `urgency` field (moves `repairUrgency` and `repairFirst` into the posting systems); pending claims with atomic promotion and `isOpen`; claim lifetimes in the audit; selective same-level preemption with hysteresis; operate swap handoff and exhaustion; safe-point handling of priority 0; saved `Task.stack`; haul category inheritance; priority-zero revalidation; cost in path-cost units with airlock cost; `SchedState`; `SAVE_VERSION` bump; inspector gains per-job candidate lists.

Behaviour changes (accepted, decision 2), each listed in the PR: nearest crew gets the job instead of lowest id; cost unit; breach-seal hauls at firefighting; disabling a category ends the task at its safe point; airlock transit cost; same-level emergency preemption; console handoff without an empty gap. The scheduler benchmark and candidate choice are the Opus agent's.

Acceptance: hashes are **not** the criterion; no silent repin (project rule). Instead the decision-diff for each scene is reviewed, listed and explained; the behavioural-equivalence, priority-property, oracle, cache-cold and multi-ship tests pass; the benchmark shows the chosen candidate beating baseline on the hub and hullplan scenes; idle-with-work under 1%. Risks: global matching changes who does what (visible to the player); hash repin pressure; preemption thrash (guard: strictly-better level plus `avoid`).

### Phase 3: utility AI

Scope: data-driven engine and `policies` content; drives (sleep, eat, recharge, leisure, work), Schmitt latches and min dwell; mood hooks; the `hazard` interrupt (new behaviour) with tolerance flags; fold `EatC`/`BedClaimC` into Task (`SAVE_VERSION` bump); delete `decide.ts`; inspector shows drive scores.

Acceptance: with `policy.legacy`-equivalent data the decisions match Phase 2 on the replay scenes; thresholds and hysteresis covered by unit tests (no flip-flop within `minDwell`, latch exit only at `exit`); new drives covered by scenario tests; leisure never starves work: an idle-with-work counter under 1%. Risks: tuning surface grows; hazard response thrash in breach repair (tolerance flags and `avoid`).

## 11. AI debug inspector

Part of the plan, grown per phase. It reads the sim and never mutates it.
- **Core** (`src/sim/ai/explain.ts`, pure): `explainCrew(sim, id)` returns `{policy, drive, scores[], latched, interrupt, task: {machine, state path, class, bb, holds}, job: {id, kind, tuple breakdown (level, urgency, cost, affinity, EVA, relief)}}`. `explainJob(sim, id)` returns `{holder, candidates: [{crew, tuple}|{crew, rejected}]}` where `rejected` is one of `wrongShip`, `yardOnly`, `selfTarget`, `needsMaterials`, `errand`, `robotSkill`, `priorityOff`, `operateLevel`, `unreachable`, `noSuit`, `reserved`, `avoid`, `drive`, `interrupt`, `outranked(by crew, tuple)`. It recomputes with the scheduler's own pure scoring functions: no trace state, no cost while closed.
- **Optional trace sink**: `sim.aiTrace` (not saved, like the profiler `Probe`): when set by the app, the scheduler reports each pair outcome at decision time so "why was X chosen at tick t" is available, not just "what would be chosen now". It never influences the sim.
- **Panel**: `app/aiSnapshot.ts` (like `crewSnapshot.ts`) and `ui/AiInspector.svelte` as a debug tab only (decision 8): per crew, drive bars, chosen drive, state path (`haul / ToDest`), reservation and score breakdown. Per job: candidate table.
- **Agent-readable**: `window.__ai` with `crew(id)`, `job(id)`, `dump()` (all crew plus open jobs, plus `auditReservations` result), installed with `?perf` or `?ai`, mirroring `window.__perf`; and `npm run ai:dump -- --scenario <s> --ticks <n>` for headless runs.

## 12. Decisions from review

All nine former open questions are closed; nothing is open.

| # | Decision |
| --- | --- |
| 1 | Selective same-level emergency preemption with hysteresis (section 7.1) |
| 2 | Phase 2 behaviour changes accepted; priority 0 ends a task only at a safe point |
| 3 | After Phase 1, judge by decision-diff review and behavioural tolerances; no silent hash repinning |
| 4 | `hazard` interrupt added (Phase 3); `cover` drive deferred; fleeing stays in combat code |
| 5 | Pilots, `EmbarkOrder`, `seatHelms` stay forced states initially |
| 6 | No job aging until starvation is demonstrated |
| 7 | Suit-errand job entities kept during the migration |
| 8 | Debug inspector only; no crew-inspector card |
| 9 | Phase 0 starts now; the Opus agent runs the Phase 2 scheduler benchmarking |
