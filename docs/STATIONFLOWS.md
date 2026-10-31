# Station flows (draft for review)

A proposal, not built yet. Round stations would start from a **flow**: a small hand-made graph of the station's parts
and how they connect, with no positions. The geometry (rings, sections, bands) is then laid out to honour it. The method
comes from Enter the Gungeon and Dormans' mission graphs; see "Generator techniques" in
[LAYOUT_RESEARCH.md](LAYOUT_RESEARCH.md). Today the structure comes first and rooms are ordered into it afterwards
([STATIONGEN.md](STATIONGEN.md)).

## What a flow is

- **Nodes are departments**, not single rooms: a group of rooms that belong together, with a short internal hall, one
  front door and (optionally) a back door. Examples: the dock department (dock banks, customs, warehouse, harbour
  office), habitation (cabins, mess, galley, medbay), the secure core (reactors, shields, AI core, plant room).
- **Edges are routes:** `main` (the concourse, 3 wide), `ring` (ring corridors, 2 wide), `service` (a back passage, 1
  wide). An edge can be `guarded` (a guard post or customs on it).
- **Each flow is built round one notable feature,** as Gungeon's are: a market loop, a keep with one way in, a works
  spine. A kind has two or three flows; one is picked per station.
- **Injections** add optional set pieces by rule after the flow is picked: a type, where it may go, a chance, and
  preconditions (size tier, kind, the station's owner).

The layout then maps the flow onto the station: the hub node to the centre, each department to a section of a ring (the
station's symmetry number sets how many sections), routes to spokes and ring corridors. Rooms inside a department are laid
out as one unit.

## Trading station

**Flow A, "market loop"** (the default):

- Centre: the **rotunda** (landmark, stalls).
- `main` concourse: north dock department, rotunda, south dock department.
- **Dock department** (north, the main one): dock banks, **customs** on the `main` edge (`guarded`), the harbour office
  (the bridge), a warehouse.
- **Market ring:** the inner ring, a loop of shops and stalls round the rotunda; a court between rings opens onto it.
- **Habitation** (west section): cabins, mess and galley, medbay as the buffer next to the works.
- **Secure core** (east, the stern): reactors, shields, AI core, plant room; one front door off the outer ring, a
  `service` back door.
- **Freight** (south dock department): warehouses, a cargo office; a `service` loop runs from it round the outer ring's
  back to the secure core.

**Flow B, "two harbours":** both dock departments are full harbours with their own customs and warehouses, habitation
sits on the east-west axis between them, and the market is a court on the concourse instead of a ring.

## Military station

**Flow A, "keep"** (the default):

- Centre: the **command heart** (the bridge), with one `guarded` way in from the north spoke; the void round it stays.
- **Dock department** (north): dock banks, a security checkpoint on the `main` edge, an armoury.
- **Barracks** (west section): bunk rows, mess and galley, medbay, the drill hall court beside them.
- **Secure core** (east, the stern): reactors, shields, AI core; the inner ring's back door leads to the heart's
  guard post.
- **Bastions:** gun bays in mirrored groups on the rim, each with an ammunition and armoury room behind it, joined by a
  `service` ring so gun crews and boarders have a second route.

**Flow B, "fortress":** two keeps (the heart and a hangar deck) joined by a guarded concourse, the barracks between
them, and four bastions with their own armouries.

## Injections (set pieces)

| Set piece | Where it may go | Chance | Preconditions |
|---|---|---|---|
| Customs checkpoint | on the `main` edge next to the main dock | always | trading, research, mining, farming |
| Brig | a dead end off the dock department or the guard post | 0.5 | security 0.3 or more, or military |
| Cantina | beside the rotunda or a court | 0.6 | trading, station size or larger |
| Chapel or memorial | off a court, far from the docks | 0.2 | not pirate |
| Observation gallery | on the stern rim, between bastions | 0.4 | station size or larger |

New modules and art are needed for the customs scanner, the brig cells and the cantina's stage; until then those set
pieces use existing pieces (lockers, consoles, mess tables).

## Open questions for the user

1. Is a department (a few rooms with their own hall and front door) the right unit, or should rooms still door straight
   onto ring corridors?
2. Two or three flows per kind: enough variety, or should flows be mixed and matched (a dock department from one, a
   habitation layout from another)?
3. Should the service loop exist on civil stations, or only on military ones, where boarding is likeliest?
4. Which set pieces are worth new modules and art (customs scanner, brig cells, cantina stage)?
