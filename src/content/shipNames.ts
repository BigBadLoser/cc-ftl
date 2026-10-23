/** Ship name lists for the galaxy factions' fleets (`FactionFleetDef.names`): a faction's prefix, then a first name, then optionally a second one. */

/** Concord Navy: "CNS Valiant". */
export const navyNames = [
  'Valiant', 'Resolute', 'Bulwark', 'Sentinel', 'Vigilant', 'Aegis', 'Tempest', 'Halcyon', 'Marshal', 'Concord', 'Steadfast', 'Ardent', 'Paladin',
  'Bastion', 'Ironside', 'Dauntless', 'Warden', 'Lancer', 'Vanguard', 'Intrepid', 'Gallant', 'Redoubt', 'Stalwart', 'Tenacity', 'Fortitude',
  'Endeavour', 'Clarion', 'Provost', 'Ranger', 'Garrison', 'Talon', 'Citadel', 'Oath', 'Mandate', 'Arbiter', 'Beacon',
] as const;

/** The corporations' merchant and escort ships: "MCV Longhaul". */
export const corpNames = [
  'Longhaul', 'Horizon', 'Fair Wind', 'Ledger', 'Tidewater', 'Surplus', 'Consignment', 'Prospect', 'Dividend', 'Charter', 'Meridian Star', 'Bountiful',
  'Cartwright', 'Steward', 'Provision', 'Waypoint', 'Gantry', 'Assay', 'Freehold', 'Courier', 'Granary', 'Halyard', 'Tariff', 'Venture', 'Quorum',
  'Lode', 'Keystone', 'Mercantile', 'Outbound', 'Stockpile',
] as const;

/** Free traders: "Lucky Margin". */
export const traderFirst = ['Lucky', 'Wandering', 'Patient', 'Gilded', 'Tin', 'Last', 'Rusty', 'Humble', 'Merry', 'Stubborn', 'Quiet', 'Honest'] as const;
export const traderSecond = ['Margin', 'Ledger', 'Wren', 'Hauler', 'Dividend', 'Magpie', 'Penny', 'Drifter', 'Compass', 'Promise', 'Barrow', 'Tinker'] as const;

/** Scrapper Clans: "Rust Jackal". */
export const pirateFirst = ['Rust', 'Gutter', 'Knife', 'Ash', 'Bone', 'Scrap', 'Black', 'Red', 'Sour', 'Gallows', 'Hollow', 'Mad'] as const;
export const pirateSecond = ['Jackal', 'Saint', 'Widow', 'Crow', 'Tithe', 'Maw', 'Reaper', 'Vulture', 'Hound', 'Wake', 'Fang', 'Gambit'] as const;

/** Rogue AI: "Unit Reap 31". */
export const droneFirst = ['Cull', 'Reap', 'Null', 'Hush', 'Void', 'Rend', 'Grind', 'Sift', 'Echo', 'Wane'] as const;
export const droneSecond = ['7', '12', '19', '23', '31', '44', '58', '63', '77', '90'] as const;
