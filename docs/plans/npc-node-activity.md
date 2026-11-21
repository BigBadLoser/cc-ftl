# Plan: NPC ships go about their business in the player's node (#603)

Planning note, 2026-11-21. User decisions on the issue (2026-11-21): (1) fights in the player's node come only from the fleet simulation, when
fleets that would meet on the map (`wouldFight`) meet in the player's node, and they play out as real ships instead of the stats mini-sim;
(2) joining a fight on a side earns standing with that side's faction, and NPC ships of factions that like the player enough come to the
player's aid when the player is attacked in their node. Also in scope: traders dock and leave, miners work fields, patrols inspect NPCs.

Constraint: #602 (branch `feat/starmap-fleets-602`) is editing `galaxy/graph.ts`, `fleets.ts`, `tuning.ts` and `render/starmap/level1.ts`.
Nothing below edits those files except one marked line in `fleets.ts`, which lands after #602 merges. New numbers go in `tuningWar.ts` or a new
`galaxy/tuningLife.ts`, not `tuning.ts`.

## 1. How it works today

**Materialised fleet ships sit still.** `materialiseFleet` (`galaxy/fleetShips.ts:45`) makes up to `FLEET_NODE_SHIPS` (3, `tuning.ts:163`;
the count is every non-player ship in play, stations included: `shipsInPlay`, `fleetShips.ts:33`) real ships through `spawnContact`
(`arrivals.ts:166`). Each one is placed on rings 70 to 160 tiles around the player's ship (`freeSpot`, `arrivals.ts:145`) and given a grid side,
player-relative: its owner's `combatFaction` if the player's standing with the payer is hostile, else `'neutral'` (`arrivals.ts:180`). After that
nothing drives it. Crew run the shared crew AI aboard, a trader answers hails, and a hostile one fights the player. Ships never move in a node
(DESIGN "Combat": no movement, no manoeuvring). `tendFleets` (`fleetShips.ts:163`, once a second from `systems/galaxy.ts:21`) reaps fates
(`reap`, `:58`: wrecked or taken means forgotten and `owe`d, fled means it runs home with `retreat`). `stepFleets` (`fleets.ts:56`) lifts a
fleet that leaves and materialises one that arrives. A fight or a live deal holds the fleets of the player's node in place (`holdsFleets`,
`fleets.ts:46`). A patrol inspection holds its own fleet (`heldFleets`, `:49`).

**Meetings skip the player's node.** `findMeetings` (`meetings.ts:40`) drops fleets with `f.node === cur || f.from === cur`, then pairs lane
crossers and same-node fleets with `wouldFight` (`clash.ts:28`: `atWar` from the relations table, and an `ARMED` role, `tuningWar.ts:29`).
`clash()` (`clash.ts:62`, pure hashes) settles each pair and `apply` (`meetings.ts:104`) writes the consequences: lost ships `owe`d plus
`leaveWreck`, `retreat`, `strand`, `loot` plus `headHome`, `chase`, and news. `resolveMeetings` is called from `stepFleets` and `syncFleets`.

**NPC-vs-NPC combat in the grid does not exist, apart from the rogue AI and aliens.** Grid hostility is `factionsHostile(a, b)` on the
player-relative side (`combat/factions.ts:9`): different sides are at war, except that `neutral` fights nobody, while rogue and alien fight
everybody. A navy patrol (`neutral`) and a pirate (`hostile`) are not foes. Neither are two factions that are both hostile to the player,
since they share the same side. On top of that:
- the doctrine runs only for `isAiFaction` sides (hostile, rogue) and only while `sector.inCombat` (`systems/enemyAi.ts:28`). `inCombat`
  means a player ship and a ship hostile to the player are both in play (`systems/combatState.ts:12`);
- target choice is `threat` (last ship to fire on it), then `prey` (set only by scenes, `scene/open.ts:90`, the raiders-on-freighter event),
  then `firstFoe` (player first). `threatOf` and `firstFoe` both filter with `factionsHostile` (`enemyAi.ts:86,107`);
- firing commits only while `inCombat` (`combat/commit.ts:43`). Consoles are manned only while `inCombat` or battle stations are on
  (`systems/operateJobs.ts:49,68,81`). Point defence asks `atWarWith`, which is false for any neutral (`combat/intercept.ts:29`). Heat AI
  and vehicle defence key on `isAiFaction` (`heatAi.ts:25`, `vehicleDefence.ts:23`).
So the scene raiders can shoot a freighter (`prey`), but the freighter never shoots back or flees, and a neutral patrol never fires.

**Provocation** is the single entry point for player aggression: `hostileAct` (`combat/provoke.ts:31`), called by a player shot
(`firing.ts:102`) and by boarding (`provocation.ts:18`). It turns a non-hostile ship and its group to its owner's combat side. Standing is
lowered through `standingHit` (`galaxy/standing.ts:12`). Tiers come from `tierOf` (`standing.ts:47`; friendly from `FRIENDLY_AT` = 3).

**Inspections** are aimed at the player only. `startInspection(sim, station, …)` (`inspect/start.ts:43`) always targets `homeShip(sim)`, at
most one runs at a time (`liveInspection`), and the settle phase is player UI (alert, fine, bribe, refuse). **Shuttles:** a station can fly
its own shuttle unmanned (`trade/courier.ts:42` `freeShuttle`). Freighters and liners have none. **Mining pods** run on `mining.order`
(`mining/handlers.ts:17`, no player check; the pilot is crew of the pod's own side). Only stations and outposts get pod bays (`t.pods`,
`shipgen/assembly/program.ts:120`), so NPC mining hulls have none.

## 2. Proposed design

### 2.1 One answer for "are these two ships foes" and "is this ship fighting"

Two new owners in `combat/engage.ts`, built from the player-relative rule plus a per-node record of NPC fights (2.2):
- `shipsHostile(sim, a, b)`: `factionsHostile(sideA, sideB)` with the existing rogue-ally exception, **or** the two ships are on opposite
  sides of one live engagement. It is ship-level because NPC-vs-NPC hostility depends on which fight a ship is in, not on its grid side.
- `atBattle(sim, ship)`: the ship is in a fight now. For the player's ship and ships hostile to the player this keeps today's answer
  (`inCombat`). It is also true for any ship in a live engagement, and for the player's ship while battle stations are on and an engagement
  is live in the node, so the player can join a fight between neutrals.
- `aiFights(sim, ship)`: the doctrine runs for it. That is `isAiFaction(side)`, or the ship is in a live engagement (so a neutral trader
  flees and a neutral patrol shoots back). Never the player's ship.

Callers that ask a per-ship question switch to these: `enemyAi` (the gate, `threatOf`, `firstFoe`), `commit.ts`, `operateJobs` and `jobRank`
manning, `heatAi`, `heat`, `deploy`, `intercept.atWarWith`, `vehicleDefence`, and `firing`'s `isAiFaction` branches. `sector.inCombat` keeps
its meaning (the player is in a fight: combat HUD, yard, handover, mood, fleets held), so the player's view does not flip to combat for a
fight they are only watching. Crew-level hostility (`fight/relations.ts isHostile`) stays faction-based: no NPC-on-NPC boarding in this
issue.

### 2.2 An in-node meeting becomes a real fight

- **Detect** (`meetings.ts`). `findMeetings` also returns same-node pairs at `cur`, only when `sim.sector.state === 'active'` and there is no
  event grid, flagged `live: true`. They are found with the same `wouldFight` and the same one-meeting-per-fleet rule. Lane crossings
  touching `cur` stay off-screen. `resolveMeetings` sends `live` meetings to `engage(sim, m, turn)` instead of `clash()`, so `fleets.ts` is
  not touched: it already calls `resolveMeetings` after materialising arrivals, so both fleets' ships are real, or waiting for room.
- **Record** (`galaxy/engagements.ts`, saved on `GalaxyState.engagements`): `Engagement { id, node, kind: 'meeting' | 'aid',
  sides: [number[], number[]] (fleet ids; for aid, side 1 may be a contact group key), fleets?: [a, b], since: tick, joined?: 0 | 1,
  credited?: true }`. It is plain data with entities referenced by id, so a save bumps `SAVE_VERSION`.
- **Aim.** Starting an engagement sets each real ship's `CombatC.prey` to the nearest opposite-side ship. This is the existing scene
  mechanism, and `TARGET_ORDER` already ranks prey above the player as first foe. So a pirate fleet that meets a trader shoots the trader,
  turns on the player only if the player shoots it (`threat`), and goes back after `AI_THREAT_SEC`. One `engagementSystem` (pipeline, before
  `enemyAiSystem`) re-aims prey when the target is gone. It is the only writer of `prey` for engagements.
- **Room.** If a side has no ship in play within `ENGAGE_WAIT_SEC` (the node cap or grace kept it a descriptor), the engagement falls back
  to `clash()` plus `apply` at that moment, so the fight always happens one way or the other.
- **End.** An engagement ends when a side has no ship in play (wrecked, fled, taken), when it times out (`ENGAGE_MAX_SEC`, a draw), or when
  the player leaves the node. On leaving, `liftFleetsAt` runs first in the jump. The engagement settles the rest with `clash()` on the
  survivors, so a fight the player walks away from still has a result. That hook is `endEngagementsAt(sim, node)`, called from the same
  place as `unbindMarkets`, before `liftFleetsAt`.
- **Feed back.** `reap` stays the only remover of ships (wrecked or taken means forgotten and `owe`d; fled means retreat, as today). At the end
  the system builds a `Clash`-shaped outcome from the real fates (each side `destroyed` / `fled` / `hurt` / `unhurt`; the winner is the
  side still holding the field) and calls a split-out `consequences(sim, m, outcome, turn)` in `meetings.ts`. That is `apply` minus the
  ship losses `reap` already took: news (`destroyed`, `driven`, `clash`, `cut`), `loot` plus `headHome` for a winning pirate, `chase`, and
  `strand` for a side left hurt. Off-screen `apply` becomes `settleLosses` plus `consequences`, so there is one consequence path. No
  `leaveWreck`: the wreck is real and the node's archive keeps it.
- **Hold.** Fleets in a live engagement must not step away mid-fight. `heldFleets` (`fleets.ts:49`) adds `engagedFleets(sim)`. That is a one-line
  change in `fleets.ts`, **after #602 merges**. Until then a fight with a side hostile to the player is held already by `inCombat`. A
  neutral-vs-neutral fight can lose a fleet at the turn boundary, which `reap` and `liftFleet` handle.

### 2.3 Joining a side, and standing

- A player shot or boarding goes through `hostileAct` as now. It also calls `noteJoin(sim, victim)` (`galaxy/engagements.ts`): if the victim is
  in a live engagement the player has not joined, `joined` is set to the other side. Shooting a neutral trader still provokes it and its
  group (today's rule), so joining the pirates makes the trader's faction hostile, which is the cost that comes with it.
- Standing goes to the joined side's faction once per engagement, when it ends, if the player's ship dealt damage on the other side and was
  not provoked by the joined side (shooting both sides earns nothing). The amount is `JOIN_STANDING` (proposed +2), or `JOIN_STANDING_WON`
  (+3) if the joined side held the field. It is written through a new `standingShift(sim, faction, delta)`, with `standingHit` refactored to
  call it (one writer).
- News: a `joined` news kind ("X fought beside Y against Z").

### 2.4 Allies come to the player's aid

- **Trigger.** The player's ship is attacked: its `CombatC.threat` names a ship in play hostile to the player, recent (`AI_THREAT_SEC`). The
  owner is `playerAttacker(sim)` in `combat/engage.ts`.
- **Who.** `canAid(sim, ship, attacker)`: an NPC ship in play in the node, with weapons, not dormant, not immobile (stations keep their own
  alarm logic; see open questions), not already engaged. Its owner (`gen.owner`, the payer for hired escorts) must be at standing `>= AID_AT`
  (proposed = `FRIENDLY_AT`, tier friendly) and must not be the attacker's owner or allied with it (`stanceBetween`).
- **How.** `engagementSystem` opens an `aid` engagement: side 0 is the aiders' fleets plus the player (`joined: 0`, no standing for it), side
  1 is the attacker's group (`shipGroup`, fleet or node contacts). From there it is the 2.2 machinery: prey on the attackers, attackers
  answer via `threat`, it ends when side 1 is out of play. The aiders' fleets are held while it runs. Aid never starts a fight the player
  did not get dragged into: no aid for a fight the player started by provoking a ship.

### 2.5 Traders dock, miners work, patrols inspect

None of these move ships (DESIGN: no movement). They make the agenda visible with what already exists. One `npcTrafficSystem`
(`galaxy/traffic.ts` plus `systems/npcTraffic.ts`) decides, and it acts only through commands, as `enemyAi` does.
- **Placement.** `freeSpot` gains an optional anchor (a ship id). `spawnContact` passes the dock port's station for a trader
  (`dockPort`) and the node's asteroid for a miner, so they appear beside their business instead of beside the player. The owner of "where
  does this contact appear" stays `freeSpot`.
- **Traders.** While the fleet dwells, the station's own shuttle (`freeShuttle(station)`) flies unmanned to the trader's airlock, docks
  for `TRADE_HOP_SEC`, and flies home, repeating every `TRADE_HOP_EVERY_SEC`. It uses the existing vehicle commands (`vehicle.launch` to a
  target airlock, `vehicle.return`). It moves no goods: the trade is settled at descriptor level by `onDock`, and moving grid goods would
  count it twice. A trader leaves as now (`liftFleet`, shown by `ship.departed`). The run never competes with the player: it skips a
  shuttle that `freeShuttle` reports busy, and it yields while a deal of the player's is live.
- **Miners.** The miner parks by the field and issues `mining.order { pod, asteroid }` for its pods. The ore stays aboard and is dropped
  with the packet on lift. `onWork` still owns the descriptor cargo. This needs NPC mining hulls with a pod bay (shipgen; decision below).
- **Patrol inspections of NPCs.** A patrol in the node picks a non-hostile NPC trader or miner in play (hashed by seed, fleet id and turn,
  at most one at a time, `INSPECT_NPC_CHANCE` per dwell turn) and sends its shuttle and two inspectors, through `startInspection`
  generalised with a `target` ship. `liveInspection` stays the player's: it filters `target === playerShip`, so the alert, the settle UI and
  the trip hold are unchanged. On an NPC target the search runs as usual, and settling is automatic: the inspectors leave with no seizure,
  and with `INSPECT_NPC_SEIZE` chance a `seized` news line. NPC cargo has no contraband yet, so this is flavour. A pirate in the node while
  an inspection runs makes the inspection leave (`insp.phase → leave`, today's `inCombat` rule, read through `atBattle` of the patrol).
- **Cap.** At most `NPC_ACTIVITIES` (proposed 2) traffic actions (shuttle hops, pod orders, NPC inspections) run at once in the node, over
  the `FLEET_NODE_SHIPS` cap.

### 2.6 Rules check

- One owner per question: `shipsHostile`, `atBattle`, `aiFights`, `playerAttacker`, `canAid` (`combat/engage.ts`); `engagedFleets`,
  `noteJoin` (`galaxy/engagements.ts`); `consequences` (`meetings.ts`, shared by grid and off-screen fights); `freeSpot` (placement);
  `standingShift` (standing writes).
- Systems never call each other: `engagementSystem` and `npcTrafficSystem` are new pipeline entries, ordered in `pipeline.ts`. They write
  `prey` and engagement records and enqueue vehicle and mining commands. Events stay output only, and `noteJoin` is called from `hostileAct`,
  not from a `shot` event.
- Determinism: meetings and traffic picks are seed, fleet and turn hashes. Grid combat uses `sim.rng` as today. A replay test
  (`expectReplayable`) goes with each slice.

## 3. Slices (each one PR)

| # | Slice | Files | Tests | Risk |
|---|-------|-------|-------|------|
| 1 | **Engagement owners, no behaviour change.** Add `combat/engage.ts` (`shipsHostile`, `atBattle`, `aiFights`) and switch the callers in 2.1 to it. With no engagements they return today's answers. | `combat/engage.ts`, `systems/{enemyAi,heatAi,heat,deploy,operateJobs,vehicleDefence,firing}.ts`, `combat/{commit,intercept}.ts`, `ai/jobRank.ts` | unit tests of the owners; the existing combat suite is the regression (no expectation changes); one replay | M: wide but mechanical; watch `check:push` |
| 2 | **Live meetings become grid fights.** `findMeetings` flags live meetings, `engagements.ts` (record, start, prey, end, fallback to `clash`, settle on leave), `engagementSystem`, split `apply` into `settleLosses` + `consequences`, news from grid outcomes, `SAVE_VERSION` bump. | `galaxy/{meetings,engagements}.ts`, `systems/engagement.ts`, `pipeline.ts`, `galaxy/types.ts`, `save.ts`, the jump/teleport hook site, `tuningWar.ts` | `galaxyClash` stays green (off-screen unchanged); new fast test: pirate fleet plus trader fleet arriving at `cur` start an engagement, the pirate's prey is the trader, the trader flees or is wrecked, `reap` owes, news reads `destroyed` or `driven`; leaving mid-fight settles by `clash`; a no-room side falls back; replay | H: core of the feature; needs a scenario preset (`?scenario=skirmish`) for the user's playtest |
| 3 | **Hold engaged fleets** (after #602 merges): `heldFleets` adds `engagedFleets`. | `galaxy/fleets.ts` (one line) | neutral-vs-neutral engagement survives a turn boundary | L |
| 4 | **Join and standing.** `noteJoin` from `hostileAct`, the end-of-fight credit, `standingShift`, the `joined` news kind, the player's battle-stations firing in a neutral fight, a ship's-log line when a fight starts in the node (UI soft rules: log, not an urgent alert, unless the user wants one). Wiki: mechanics page on standing and fights. | `combat/provoke.ts`, `galaxy/{engagements,standing,news}.ts`, `app/newsSnapshot.ts`, log wiring, `wiki/src/routes/mechanics/…` | joining the trader's side gives +2/+3 once; shooting both sides gives nothing; joining the pirates provokes the trader group | M |
| 5 | **Allies come to aid.** `playerAttacker`, `canAid`, aid engagements in `engagementSystem`, `AID_AT`. Wiki. | `combat/engage.ts`, `galaxy/engagements.ts`, `systems/engagement.ts`, `tuningWar.ts` | a friendly navy patrol in the node engages a pirate that fires on the player; a neutral-standing one does not; an ally of the attacker never does; replay | M: balance (aid can trivialise early fights) |
| 6 | **Placement by business.** `freeSpot` anchor; traders by their station, miners by their field. | `galaxy/arrivals.ts`, `galaxy/fleetShips.ts` | anchored placement passes the gap rule; falls back to player rings | L (visual: screenshot) |
| 7 | **Trader shuttle hops.** `galaxy/traffic.ts`, `npcTrafficSystem`, `NPC_ACTIVITIES` cap. | `galaxy/traffic.ts`, `systems/npcTraffic.ts`, `pipeline.ts`, possibly `vehicles/handlers.ts` if `vehicle.launch` refuses a non-player target | the station shuttle docks at a trader and returns; never while a player deal holds it; replay | M: vehicle flow assumptions about the player (check the `ferry/arrive` docking path first) |
| 8 | **NPC miners mine.** Pod bays on NPC mining hulls (shipgen, needs the user's go and a render check), `mining.order` from traffic. | `content/factions/civilian.ts` or `shipgen/assembly/program.ts`, `galaxy/traffic.ts` | the miner's pod mines ore tiles of the node's asteroid; shipgen seed tests | H: shipgen output change across seeds (`previewHull` searches); visual approval |
| 9 | **Patrols inspect NPCs.** `startInspection` with a `target`; `liveInspection` stays player-only; auto-settle; `seized` news. | `inspect/{start,flow,settle}.ts`, `galaxy/traffic.ts` | an NPC inspection never raises the player's alert or holds a trip; the inspection runs and ends; a pirate arrival aborts it | M: `inspect/` assumes the player's ship in places (audit `homeShip` uses) |

Slices 1 to 5 deliver the user's two decisions; 6 to 9 the "business" half and can go in any order after 1. Each with a player-visible effect
updates `wiki/` and `docs/CATALOG.md` in its PR.

## 4. Needs a user decision

1. **Docking without movement.** Ships do not move in a node (DESIGN "Combat"). Proposal: a trader appears beside the station, and the
   station's shuttle runs back and forth while it dwells. The alternative is real ship flight in the grid, a new feature that goes against the
   design rule. Is the shuttle version enough?
2. **NPC miners need pod bays.** Give NPC mining hulls a pod bay (a shipgen change that alters generated mining ships; visual approval), or have
   them park by the field without pods (flavour only)?
3. **Cap.** `FLEET_NODE_SHIPS` = 3 counts every non-player ship in play, stations included, so a node with stations may not have room
   for both sides of a fight (they then fall back to the stats fight). Raise it to about 5 for engagements (after #602, it lives in
   `tuning.ts`), or keep 3 and accept the fallback?
4. **Join reward sizes:** +2 for joining, +3 if your side won, once per fight? Nothing for joining the pirates beyond their standing (the
   trader's faction turns hostile through the existing provoke)?
5. **Aid threshold and who:** friendly tier (standing 3+) by default, or a higher bar? Should armed stations of a friendly faction fire on the
   player's attacker too (today they react only to their own alarm)?
6. **Watching a trader die beside a navy patrol:** still open on the issue. The plan has no cost for it.
7. **Alert or log line** when a fight starts in the node: a log line (soft rule: not urgent for the player) with a camera jump, or an urgent
   alert with a "Join" hint?
