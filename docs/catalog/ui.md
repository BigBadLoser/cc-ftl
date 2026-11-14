# Catalog: UI windows and panels

The Svelte UI (`src/ui`, 91 top-level components plus `combat`, `comms`, `crew`, `inspector`, `kit`, `lessons`, `menu`, `module`, `title`) mounted by `src/ui/App.svelte`
and `GameSession.svelte`. The UI reads snapshots built in `src/app/*Snapshot.ts` and sends commands through `src/app/bridge.ts`; it never mutates the sim.
All top-level components are imported by something except `EnemyCharges.svelte`. The game is desktop only. UI soft rules are in `docs/DESIGN.md` ("UI").

| Name | id | What it does | Status | Where |
|---|---|---|---|---|
| Title screen and ship pick | `TitleApp, ShipPick, CrewRoll, CrewDossier` | New game: pick one of 3 ships and its crew; load saves | In game | src/ui/title/* |
| Esc menu, saves, settings, controls | `EscMenu, SavesPage, SettingsPage, ControlsPage` | Save slots, settings, key bindings | In game | src/ui/menu/*, ui/keymap/*, ui/settings/* |
| Clock strip | `ClockStrip` | Pause, speed, game time | In game | src/ui/ClockStrip.svelte |
| Tool bar and build catalog | `ToolBar, BuildCatalog, BuildCard, BuildPopover, BuildPreview` | Build modules and hull, categories, thumbnails, ghosts | In game | src/ui/BuildCatalog.svelte, buildCatalog.ts |
| Hull plan bar | `HullPlanBar` | Hull plan brushes and shipyard order | In game | src/ui/HullPlanBar.svelte |
| Crew bar and crew window | `CrewBar, CrewWindow, CrewInspector, crew/*` | Roster, status, skills, social, gear tabs, paper doll | Partial: gear tab art | src/ui/crew/*, inspector/*; the gear-tab figure art is issue #245 |
| Selection panel and module inspector | `SelectionPanel, ModuleInspector, module/*` | Selected thing: module overview, condition, upgrades, plot panel | In game | src/ui/module/* |
| Tile and site inspectors | `TileInspector, SiteInspector` | Tile numbers and site status | In game | src/ui/TileInspector.svelte |
| Power panel | `PowerPanel, PriorityTable` | Power supply, draw priorities | In game | src/ui/PowerPanel.svelte |
| Jobs panel, cards, tracker | `JobsPanel, JobCards, JobsTracker, SchedulePane` | Work priorities per crew, station job cards, schedules | In game | src/ui/JobsPanel.svelte, SchedulePane.svelte |
| Stock drawer and storage | `StockDrawer, StoragePanel, FabPanel` | Ship stock, storage filters, fabricator queue | In game | src/ui/StockDrawer.svelte |
| Research overlay | `ResearchOverlay, ResearchTree, Queue, Sidebar, Selected` | Tree by band, queue, costs | In game | src/ui/Research*.svelte |
| Starmap | `StarmapView, Drawer, Info, News, Stats, Sell, Encounter, JumpConfirm, DeployPicker` | Map, route, news, encounter choices, jump confirm | In game | src/ui/Starmap*.svelte |
| Node strip, nav strip, POI markers | `NodeStrip, NavStrip, PoiMarkers` | Where you are, bearings to things | In game | src/ui/NodeStrip.svelte |
| Comms and hail | `HailWindow, comms/*, SignalWindow` | Hail transcript, decision bar, sensor panel | In game | src/ui/comms/* |
| Station channel | `ChannelPanel, StationServices, StationInfo, StationDock, StationSensors, StationVideo` | Dock UI: services, trade, jobs, crew, blueprints, yard | In game | src/ui/channel.ts |
| Trade window | `TradeWindow, TradeMarket, TradeSlip, TradeDeliveries` | Buy and sell, deliveries | In game | src/ui/TradeWindow.svelte |
| Recruit, blueprint and pod lists | `RecruitList, BlueprintList, PodList` | Hire crew, buy blueprints, pods | In game | src/ui/RecruitList.svelte |
| Yard pane | `YardPane` | Shipyard hull orders | In game | src/ui/YardPane.svelte |
| Combat HUD | `combat/*` | Weapon bay, shields, heat, enemy card, board picker, fight report, flee | In game | src/ui/combat/* |
| Enemy weapon charge bars | `EnemyCharges` | Per-weapon charge with aim commit notch | Defined, unused | src/ui/EnemyCharges.svelte: no component imports it (combat HUD shows charge elsewhere) |
| Drone bay, robot bay, shuttle, salvage, prize, asteroid panels | `DroneBayPanel, RobotBayPanel, ShuttlePanel, SalvagePanel, PrizePanel, AsteroidPanel` | Module and craft control panels | In game | src/ui/*Panel.svelte |
| Ship overview and meters | `ShipOverview, ShipMeters, FtlCharge` | Resources by the numbers, FTL charge | Partial: improvement planned | issue #164 |
| Alerts and event log | `AlertList, EventLog, StrandedBanner` | Urgent clickable alerts vs the ship log | In game | src/ui/AlertList.svelte, EventLog.svelte |
| Goals card and story modal | `GoalsCard, StoryModal, EventPanel` | Tutorial goals, event decisions | In game | src/ui/GoalsCard.svelte |
| Lessons | `lessons/*` | Coach mark engine with two lessons | Partial: two lessons | see events-story.md |
| Overlay picker | `OverlayPicker` | Air, power, rooms and other field views | In game | src/ui/OverlayPicker.svelte |
| Context menu and select box | `ContextMenu, SelectBox, FloatingWindow` | Right-click orders, drag select, floating windows | In game | src/ui/ContextMenu.svelte |
| UI kit | `kit/*` | Frame, Tabs, Meter, Chip, Dialog, Slider, Select, tooltips | In game | src/ui/kit/*; FloatingWindow, Dialog, event card and deploy picker use the rail frame, decisions use kit/DecisionBar; consistency pass is issue #336 |
| Bug report and error overlay | `BugReport, ErrorOverlay` | Report a bug with state and params | In game | src/ui/BugReport.svelte |
| Debug panel | `DebugPanel` | Spawn items, modules, ships, enemies, outposts; set credits and crew | Debug only | src/ui/DebugPanel.svelte |
| UI scale setting | `-` | Scale the whole UI | Planned | issue #215 |
| Phone layout | `phoneHud.ts` | Existing phone breakpoints; the game is desktop only and they are not maintained | Partial: not maintained | src/ui/phoneHud.ts |
