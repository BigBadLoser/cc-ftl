# Changelog

Player-facing changes, newest first. Each dated entry is a deploy of the live game; milestones are labelled when declared.

## Unreleased

### New

- Medical pod: an escape pod drifts on the lane with one wounded survivor aboard. Scan it, then bring it in: it docks at a free airlock and your crew carry the patient to a bed before they bleed out. A patient who pulls through pays what they carry, may ask you to take them home as a paid passage job, and, if you look after them well, may ask to join the crew. Passengers lodge aboard as guests: they eat, sleep and lend a hand with chores, but never fight. Job payouts and failures now log the standing change by faction name. ([#345](https://github.com/BigBadLoser/cc-ftl/pull/345))
- Weapon upgrades: each weapon has an upgrade slot, and an engineer fits or removes an upgrade at the weapon (it is offline meanwhile). Three upgrades to start: the Quick capacitor (charges faster), the Coolant jacket (less heat per volley) and Hardened housing (the weapon takes half damage). Build them at the fabricator, buy them at stations, or take them from enemy ships, which carry their own. A fitted upgrade shows as a small icon beside the weapon's name, on your bar and on the enemy card. ([#344](https://github.com/BigBadLoser/cc-ftl/pull/344))
- Flak cannon: an ammo weapon that throws a spread of pellets, burning one hull scrap per volley. Each pellet that hits a shield strips a layer, and it scatters more at range. It starts on hold, like the other ammo weapons. ([#344](https://github.com/BigBadLoser/cc-ftl/pull/344))
- Distress freighter: a crippled freighter hails from the lane with its reactor failing. Agree to help and your repair party boards as guests to fix the reactor before the clock runs out, with fires breaking out near the end and raiders on the way. If the clock runs out, the reactor blows: a real blast that wrecks the ship and kills its crew (your party may live if they're clear). Enemy ships now turn on whoever last shot at them, and crew suit up before working in rooms that are airless or dangerously hot. ([#343](https://github.com/BigBadLoser/cc-ftl/pull/343))
- Hailing a station opens a comms channel: each service has its own contact on video (dock control, quartermaster, job broker, recruiter, archivist, yard master), and a sensor screen shows the station with the ships around it, your shuttle's trip and a live traffic log. Services are buttons beside it; Trade opens the trade window. ([#335](https://github.com/BigBadLoser/cc-ftl/pull/335))
- Trading happens in one floating trade window, for stations and trader ships alike: a market list with buy and sell pickers (Shift ±5, Ctrl ±10, Alt for the most you can afford, or type a number), a deal slip showing what you pay and earn, and the deliveries under way. You can agree several deals with the same partner: they queue and run one after another. ([#333](https://github.com/BigBadLoser/cc-ftl/pull/333))
- The crew inspector has a Social tab: friends and rivals in collapsible groups, each a card you can expand to see how both sides feel, what the bond does and what they do together, plus a mood bar. ([#331](https://github.com/BigBadLoser/cc-ftl/pull/331))
- Crew relationships: crew form friendships and rivalries over hours of play, through chats in free time, fighting side by side, rescues and shared losses. Friends lift each other's mood, work a little faster together and sit together at meals; rivals keep apart and sometimes have a shouting match. A friend's death brings grief. The crew card lists friends and rivals, and hovering a crewmate shows what they think of them. New traits can be rolled: Hot-headed, Peacemaker and Protective. ([#330](https://github.com/BigBadLoser/cc-ftl/pull/330))
- Encounter signals open a comms window: a video call with the caller's portrait and ship name, a transcript, and a sensor panel that scans the ship's hologram and marks what it finds. H hails and S scans (rebindable). Watch the caller closely: some tells only show on screen. ([#329](https://github.com/BigBadLoser/cc-ftl/pull/329))
- Mental breaks: crew under stress (low mood, injuries, fire, combat, decompression, isolation) can snap. A break might be a panic (they flee, then cower), a freeze, hiding, a tantrum that sours the mood of everyone nearby, despair in bed, or refusing work. Severe breaks raise an urgent alert, and a breaking crew member still escapes fire or bad air. Player orders are refused while a crew member is breaking. ([#328](https://github.com/BigBadLoser/cc-ftl/pull/328))
- Pirate ambush: the pirate you spared may hail you on the lane, asking to dock and repay the debt. Hail and scan it to judge whether they mean it: an honest crew drops missiles at your airlock, a trap boards you. ([#327](https://github.com/BigBadLoser/cc-ftl/pull/327))
- Repair drones seal hull breaches from outside, paying 2 metal from a small load they refill from storage while docked (the bay panel shows it). Navy and rogue AI ships field their own defence drones from sector depth 3, and drones wreck with their ship. Recalled drones land one at a time, and the ship waits long enough for all of them. ([#326](https://github.com/BigBadLoser/cc-ftl/pull/326))
- Defence drones guard the ship in battle: they launch through the drone bay's ceiling hatch, circle the hull and shoot down incoming missiles, enemy drones and shuttles. Drones dock again before a jump; the ship waits a few seconds for them, and any left outside are lost. ([#325](https://github.com/BigBadLoser/cc-ftl/pull/325))
- Drones: research and build repair and medic drones, and they work the ship on their own. Repair drones fix damaged modules and put out small fires; medic drones stop the bleeding of downed crew and patch up the wounded. They live in a new drone bay that recharges them, fly over modules but wait at doors and airlocks like crew, and the AI core decides how many can be out at once. Ion knocks them out, and losing the core grounds them all. ([#323](https://github.com/BigBadLoser/cc-ftl/pull/323), art [#324](https://github.com/BigBadLoser/cc-ftl/pull/324))
- The fabricator shows recipes that still need research as locked. ([#323](https://github.com/BigBadLoser/cc-ftl/pull/323))
- Drafted crew can force a jammed door: right-click it and pick "Force door". The nearest drafted crew member who isn't fighting does it and stays drafted. ([#316](https://github.com/BigBadLoser/cc-ftl/pull/316))
- Derelicts on the lane: a dead hull can turn up mid-trip. Scan it for its condition, air, doors and signs of life (a hacker with skill 2 can probe it for counts and cargo), then drop out beside it to salvage it, or draft a team, fly them over in the shuttle and explore it by hand. ([#314](https://github.com/BigBadLoser/cc-ftl/pull/314))
- Signals on the lane: a trader skiff can turn up mid-trip. Hail it or scan it from the starmap, then drop out beside it to trade, or fly on. Ships in these scenes leave after a while unless you hail them. ([#309](https://github.com/BigBadLoser/cc-ftl/pull/309))
- Battle stations (C, or the crew-bar button) opens the combat view at any time with every weapon held. Aiming at a ship that is not hostile does nothing; the first shot you fire, or boarding it, turns it and its group hostile and they fight back. ([#309](https://github.com/BigBadLoser/cc-ftl/pull/309))
- Derelict salvage: select a wreck and tick the scrap types to strip. A shuttle takes a suited party out, makes trips home with the loot and the crew who need a rest, and brings everyone back when the wreck is done. ([#273](https://github.com/BigBadLoser/cc-ftl/pull/273), [#275](https://github.com/BigBadLoser/cc-ftl/pull/275), [#277](https://github.com/BigBadLoser/cc-ftl/pull/277), [#297](https://github.com/BigBadLoser/cc-ftl/pull/297))
- Scrap items (hull, tech, energy, weapons, comfort) and cloth, with new art. A 4x2 scrapper module turns scrap into materials such as metal, electronics and parts, and scrap cages store it. ([#272](https://github.com/BigBadLoser/cc-ftl/pull/272), [#279](https://github.com/BigBadLoser/cc-ftl/pull/279), [#283](https://github.com/BigBadLoser/cc-ftl/pull/283), [#296](https://github.com/BigBadLoser/cc-ftl/pull/296))

### Changed

- Urgent alerts come from the ship's current state: fires, breaches, low oxygen, low power, downed or starving crew, suit air, stranded away teams, breaks and attacks come back after you load a save, and a dismissed alert stays quiet until its condition clears (a worse one, like a suit running out after running low, still shows). Parts switched off for fitting work no longer raise a false low-power alert. ([#352](https://github.com/BigBadLoser/cc-ftl/pull/352))
- The quest and jobs trackers on the right lose their boxes for a dark fade from the screen edge. Jobs are split into what you can do in this node (highlighted, with what to do) and the rest, nearest first; each shows turns left and pay, with an amber edge when time is short. ([#348](https://github.com/BigBadLoser/cc-ftl/pull/348))
- Combat HUD: the enemy card reads like your status block (hull, shields and heat in labelled rows; each weapon shows a countdown once it has aimed at you), shows a generated ship's call sign, and tags the ship Hostile, Neutral or Friendly. Board moved to a tab on the left of your strip, mirroring Flee, and the strip sits on one backplane. ([#342](https://github.com/BigBadLoser/cc-ftl/pull/342))
- Buttons and toggles across the UI are joined button groups; the build screens keep their black-and-amber look on every button. ([#342](https://github.com/BigBadLoser/cc-ftl/pull/342))
- The ship's log notes when a hostile ship jumps in or arrives; an alert follows only if it attacks. ([#341](https://github.com/BigBadLoser/cc-ftl/pull/341))
- UI colours follow one meaning each: one red for danger and hostiles, one green for good, gold for credits and amber for warnings, with matching shadows and dimming across windows. ([#337](https://github.com/BigBadLoser/cc-ftl/pull/337))
- Crew show pixel-art icons over their heads in place of the old drawn bubbles: speech bubbles when they chat (a scribble when it goes badly), a red burst in a shouting match, a thought bubble for each kind of mental break (its rim neutral, amber or red by how severe it is), a red cross when downed and a white flag on surrender. ([#340](https://github.com/BigBadLoser/cc-ftl/pull/340))
- Doors strip as tech scrap, so unticking Hull on a salvage order still takes them. ([#312](https://github.com/BigBadLoser/cc-ftl/issues/312), [#314](https://github.com/BigBadLoser/cc-ftl/pull/314))
- Dormant pirate dens and outposts wake when you fire on them or board them, not when you only aim at them. ([#309](https://github.com/BigBadLoser/cc-ftl/pull/309))
- Combat shields show as a hex-lattice bubble round each ship: lit rings count the layers, and lasers ripple, ion drains turn the rim violet, mass drivers tear through, missiles pass, and layers visibly break, return, collapse on a vent and pulse when overcharged. ([#308](https://github.com/BigBadLoser/cc-ftl/pull/308))
- Boarding: the shuttle flies itself, so you no longer pick a pilot. Only the crew you picked board. Recalled boarders head straight for the shuttle, it takes them home and goes back for those who stay, and the fight no longer calls the party home. If the target airlock is lost, the shuttle docks at another or the party goes out of the hatch. ([#304](https://github.com/BigBadLoser/cc-ftl/pull/304))
- Shipyard contractors come and go on the station's shuttle like any away party and draw air from their own shuttle before your airlock's store. ([#304](https://github.com/BigBadLoser/cc-ftl/pull/304))
- Salvage reworked: the crew stage the loot beside the shuttle's landing zone, and the shuttle loads it crate by crate, also when nobody of the party is left out there. ([#297](https://github.com/BigBadLoser/cc-ftl/pull/297))
- Haulers gather several nearby piles going to the same place before they walk, on every ship. ([#297](https://github.com/BigBadLoser/cc-ftl/pull/297))
- Robots ride shuttles to away sites and work there without a suit. ([#297](https://github.com/BigBadLoser/cc-ftl/pull/297))
- Crew on your side gain skill XP from routine work and level up, up to +5. ([#251](https://github.com/BigBadLoser/cc-ftl/pull/251))
- Pyrophobic crew lose mood when a fire burns within six tiles. The "Afraid of the void" trait is renamed Space-sick, and space-sick crew lose mood on a spacewalk. ([#253](https://github.com/BigBadLoser/cc-ftl/pull/253))
- Crew stay awake about 20 minutes before they need sleep, and a full sleep takes about 7 minutes in a bed (about 14 on the floor). Salvage runs get through more work as a result. ([#302](https://github.com/BigBadLoser/cc-ftl/pull/302))
- Crew leave tiles that will hurt them (fire, bad air, extreme heat or cold) instead of standing in them. ([#290](https://github.com/BigBadLoser/cc-ftl/pull/290))
- A suited crew member refills at the nearest air source before the tank runs low, then goes back to their job. ([#294](https://github.com/BigBadLoser/cc-ftl/pull/294))
- Ships carry a roof livery by faction, so factions are easy to tell apart on the map and in the combat panel. ([#142](https://github.com/BigBadLoser/cc-ftl/pull/142))
- Zoom levels snap to whole pixels and stay sharp at any browser zoom. The in-between zoom steps are gone. ([#267](https://github.com/BigBadLoser/cc-ftl/pull/267))
- A failed save raises an urgent alert. Clicking it opens Save game in the Esc menu. ([#269](https://github.com/BigBadLoser/cc-ftl/pull/269))
- A loading screen covers the view until the scene's art has loaded, so ships do not appear half-drawn. ([#271](https://github.com/BigBadLoser/cc-ftl/pull/271))

### Fixed

- Crew can repair, deconstruct, craft at and research at a module from any side, not only its top-left corner, so a module walled in at that corner is no longer out of reach. ([#343](https://github.com/BigBadLoser/cc-ftl/pull/343), [#344](https://github.com/BigBadLoser/cc-ftl/pull/344))
- A hovering shuttle comes close enough to a ragged wreck for crew to get back aboard, and "Back to shuttle" works from deep inside a wreck. ([#314](https://github.com/BigBadLoser/cc-ftl/pull/314))
- Crew no longer repair wrecks they are salvaging or exploring. ([#314](https://github.com/BigBadLoser/cc-ftl/pull/314))
- "Transfer blocked: no free shuttle" no longer fills the log while your shuttles are busy, including on a run you fly by hand. It still shows when you have no shuttle. ([#314](https://github.com/BigBadLoser/cc-ftl/pull/314), [#316](https://github.com/BigBadLoser/cc-ftl/pull/316))
- You can't leave a scene while crew or shuttles are still out, including aboard a captured prize. ([#309](https://github.com/BigBadLoser/cc-ftl/pull/309))
- Civilian traders in fleets could not trade. ([#309](https://github.com/BigBadLoser/cc-ftl/pull/309))
- Crew no longer try to walk through doors that cannot open, such as a jammed door or a dead airlock. ([#292](https://github.com/BigBadLoser/cc-ftl/issues/292), [#297](https://github.com/BigBadLoser/cc-ftl/pull/297))
- Crew no longer stop in doorways when they fetch equipment. ([#255](https://github.com/BigBadLoser/cc-ftl/pull/255))
- Closed weapon hatches and deployed turrets on enemy ships no longer clip under the roof plating. ([#262](https://github.com/BigBadLoser/cc-ftl/pull/262))
- Ships no longer disappear in the new-game ship preview. ([#270](https://github.com/BigBadLoser/cc-ftl/pull/270))
- A sprite sheet that gets stuck while loading no longer holds up the rest of the art. ([#282](https://github.com/BigBadLoser/cc-ftl/pull/282))

## 2026-11-01

### New

- Medical pod: an escape pod drifts on the lane with one wounded survivor aboard. Scan it, then bring it in: it docks at a free airlock and your crew carry the patient to a bed before they bleed out. A patient who pulls through pays what they carry, may ask you to take them home as a paid passage job, and, if you look after them well, may ask to join the crew. Passengers lodge aboard as guests: they eat, sleep and lend a hand with chores, but never fight. Job payouts and failures now log the standing change by faction name. ([#345](https://github.com/BigBadLoser/cc-ftl/pull/345))
- Boarding: press B on an enemy's card to board mid-fight. Pick the party, order sabotage on enemy modules, recall the party, and confirm the jump. A boarding log records it. ([#210](https://github.com/BigBadLoser/cc-ftl/pull/210), [#214](https://github.com/BigBadLoser/cc-ftl/pull/214), [#226](https://github.com/BigBadLoser/cc-ftl/pull/226))
- Lessons: short instructor lessons appear as you play, starting with a combat lesson and a trade lesson (find a station, hail it, learn what its tabs do). ([#213](https://github.com/BigBadLoser/cc-ftl/pull/213), [#227](https://github.com/BigBadLoser/cc-ftl/pull/227))
- Esc menu: Esc closes the top panel, then cancels the tool, then clears the selection. Only then does it open the menu, with Save game, Load game, New game, Controls and Settings. Keys can be rebound, and there are save slots. ([#216](https://github.com/BigBadLoser/cc-ftl/pull/216))
- Saves: three rotating autosaves, a save taken before each fight, and a game-over summary. Saves are kept in the browser's IndexedDB. ([#223](https://github.com/BigBadLoser/cc-ftl/pull/223))
- Stations post jobs that match their type. Trade stations post deliveries, military stations and depots post bounties, and research stations post survey jobs. Hand a finished bounty in at a matching port to be paid. ([#182](https://github.com/BigBadLoser/cc-ftl/pull/182))
- Mining and refining pay. Refined ice gives water and oxygen, and price views show where to sell. ([#229](https://github.com/BigBadLoser/cc-ftl/pull/229))
- Title screen with Continue, New game, Load and Settings. Pick one of three starter ships (Spine Hauler, Claw, Dart), then roll your starting crew. ([#247](https://github.com/BigBadLoser/cc-ftl/pull/247), [#249](https://github.com/BigBadLoser/cc-ftl/pull/249))
- Crew are rolled with skills and traits, shown on the crew card. ([#243](https://github.com/BigBadLoser/cc-ftl/pull/243))
- Gameplay wiki at `/cc-ftl/wiki/`, with reference pages for modules, items, weapons, recipes, factions and research. ([#161](https://github.com/BigBadLoser/cc-ftl/pull/161))
- Bug reports: the bug button in the toolbar, or F8 from anywhere (including mid-fight), opens a report that pre-fills a GitHub issue. You can download your save and a screenshot to attach. The debug menu moves to the backtick key. ([#159](https://github.com/BigBadLoser/cc-ftl/pull/159), [#230](https://github.com/BigBadLoser/cc-ftl/pull/230))

### Changed

- Combat pacing: burst laser, mass driver and missile charge times are shorter. Enemy weapons show their aim in the last 4 seconds of charge, with a red ring on the target. ([#184](https://github.com/BigBadLoser/cc-ftl/pull/184))
- Flee leaves you adrift in hyperspace. "Drop from hyperspace" returns you to the node you fled. ([#184](https://github.com/BigBadLoser/cc-ftl/pull/184))
- Crew fight fires and seal breaches on their own. Combat repairs go to guns, shields and reactors first. ([#184](https://github.com/BigBadLoser/cc-ftl/pull/184))
- Combat readability: a fight report card appears when a fight ends. Stations show EN ROUTE while their crew walk over. Each weapon can be set to AUTO or HOLD (Shift+Q/W/E/R; H holds all). ([#211](https://github.com/BigBadLoser/cc-ftl/pull/211))
- The whole game uses the steel colour palette. ([#211](https://github.com/BigBadLoser/cc-ftl/pull/211))
- The ship's log records every notable event. Clicking an entry jumps to its tile, crew member, ship or node. Payouts show as a green entry. Urgent alerts clear themselves. ([#183](https://github.com/BigBadLoser/cc-ftl/pull/183))
- Space backdrop behind the main view: parallax stars, a faint nebula, and a large render of the node's central body. ([#219](https://github.com/BigBadLoser/cc-ftl/pull/219), [#221](https://github.com/BigBadLoser/cc-ftl/pull/221))
- Off-screen markers point at other ships and stations in the node. Hover to see a name. Station names show in the node strip. ([#220](https://github.com/BigBadLoser/cc-ftl/pull/220))
- The crew inspector has Status, Skills and Gear tabs. ([#246](https://github.com/BigBadLoser/cc-ftl/pull/246))

### Fixed

- Commands sent while the game is paused no longer advance time. Trades that get stuck now end on a timeout instead of hanging. ([#206](https://github.com/BigBadLoser/cc-ftl/pull/206))
- Failed saves show a notice, and an unreadable save is kept aside instead of deleted. Seeded debug sessions no longer overwrite your save. ([#206](https://github.com/BigBadLoser/cc-ftl/pull/206))
- A derelict that cannot be generated no longer stops the rest of the node from loading. ([#206](https://github.com/BigBadLoser/cc-ftl/pull/206))
- Stuck fights end: ship-wide fire aims at standing modules and walls, so big ships can be worn down, and hopeless enemies surrender. ([#231](https://github.com/BigBadLoser/cc-ftl/pull/231))
- Late-game slowdown: crew stop searching for unreachable jobs every tick. A save that ran at about 6 fps now runs at 2x. ([#228](https://github.com/BigBadLoser/cc-ftl/pull/228))
- Frame hitches: crew pathing no longer spikes when many crew get tired on the same tick. ([#196](https://github.com/BigBadLoser/cc-ftl/pull/196))
- Fleets arriving at your node no longer cause a hitch on the galaxy's first turn. ([#199](https://github.com/BigBadLoser/cc-ftl/pull/199))
- Pressing Enter in a text field no longer confirms the deploy picker, and the selection clears after a jump. ([#218](https://github.com/BigBadLoser/cc-ftl/pull/218))

## 2026-10-28

Feature overview of the game as deployed on this date. Themes are grouped by area, not by pull request.

### Ship building

- Build catalog strip with sprite ghosts, a visible construction ghost, a site inspector, and faster builds.
- Hull width rule, hull plan brushes, a hull planner and a shipyard with engine capacity.
- Walls that join correctly at corners, and a Power sub-view, roof toggle and food-stock view for playtest clarity.
- The inspector stays hidden until something is selected.

### Crew

- Crew for hire, a station panel, and a medicine skill.
- Drafted crew: select them, right-click to order them, man a station, and re-board.
- Unarmed crew fetch weapons when boarders are aboard.
- Crew portraits in the crew bar, and a research skill.

### Combat

- Armed crew engage automatically, with an opening grace period. Job cards show target strength.
- Combat panel on the left, with the ship view inside it. Roof fog of war, aiming from the main view, a derelict ending, and station relief.
- Only missile launchers shoot at shuttles. Point defence only chips at them.
- Charge FTL outside combat, using a helm job and a Charge button.

### Galaxy and trade

- A living galaxy: NPC traffic, persistent fleets, port markets, encounters and news.
- Starmap with turn-based hyperspace, a deploy picker, and GPU rendering.
- Trade orders that run multiple trips. Story events happen only in transit.
- Station jobs: deliveries and bounties.
- Danger layers: notoriety, faction hunter fleets, and scavengers near the start area.
- Pirate factions, contraband, and fence and black-market services.
- Per-faction standing, a relations table, and faction stock specialities.

### Progression and research

- Blueprints, tiered core modules, and research stations.
- A research tree with projects.
- Goal chain: a three-act tutorial of goals under the time controls.

### Asteroids and mining

- Asteroids with rock and mining pods, raw ore and a refinery. Rock-walled outposts run as stations.
- Base logistics as jobs, salvage auto-ferry, and a mining paint tool.
- Buyable fuel, a Refuel button, and a distress tug.

### Derelicts and aliens

- Derelict ships with ruin dressing, a Force door, and a wreck panel. Some derelicts are dark.
- Alien egg sacs, hatching, and hunter, brute and spitter aliens on derelicts.

### Interface

- Floating windows that can be dragged, resized and pinned.
- A UI kit on Bits UI with square corners throughout.
- Collapsible goals and jobs cards. Long alert text ellipsizes.
- Saves and game over.

### Art

- New sprites for crew, reactors and life support, shields, refineries, the starmap, asteroids and cargo crates.
- Item art for every item, both on the floor and held.
- Pixel art at one scale, with fixes for crew and modules going invisible mid-game.
