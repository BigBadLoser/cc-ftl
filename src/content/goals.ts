import type { GoalActDef } from '../sim/story/defs';

/**
 * The tutorial goal chain: three acts, each a handful of goals done in any order, that walk a new captain through the
 * game's loop. Small rewards: the point is the walk, not the pay. `stat.*` counters are bumped where the moment happens
 * in the sim (story/goals.ts `bumpStat`).
 */
export const goals = [
  {
    id: 'act.underway',
    title: 'Get underway',
    goals: [
      { id: 'goal.first_jump', title: 'First jump', text: 'Open the starmap and jump to another node.', check: { kind: 'visited', count: 2 } },
      { id: 'goal.first_trade', title: 'Open for business', text: 'Buy or sell anything with a trader.', check: { kind: 'stat', stat: 'trades' } },
      { id: 'goal.take_job', title: 'Take a contract', text: 'Accept a job from a station board.', check: { kind: 'stat', stat: 'jobsTaken' } },
      { id: 'goal.finish_job', title: 'Deliver', text: 'Complete any job.', check: { kind: 'stat', stat: 'jobsDone' } },
    ],
    reward: { credits: 150, reputation: 1 },
  },
  {
    id: 'act.flying',
    title: 'Keep her flying',
    goals: [
      { id: 'goal.buy_fuel', title: 'Topped up', text: 'Buy fuel from a trader.', check: { kind: 'stat', stat: 'fuelBought' } },
      { id: 'goal.build', title: 'Shipwright', text: 'Have your crew build a module.', check: { kind: 'stat', stat: 'built' } },
      { id: 'goal.prospect', title: 'Prospector', text: 'Bring home ore from an asteroid, or salvage a wreck.', check: { kind: 'stat', stat: 'gathered' } },
      { id: 'goal.repair', title: 'Patch her up', text: 'Repair a damaged module.', check: { kind: 'stat', stat: 'repaired' } },
    ],
    reward: { credits: 100, items: [{ item: 'item.parts', count: 10 }, { item: 'item.missile', count: 6 }] },
  },
  {
    id: 'act.beyond',
    title: 'Beyond the verge',
    goals: [
      { id: 'goal.blooded', title: 'Blooded', text: 'Destroy or capture a hostile ship.', check: { kind: 'stat', stat: 'kills' } },
      { id: 'goal.bounty', title: 'Bounty hunter', text: 'Complete a bounty job.', check: { kind: 'stat', stat: 'bountiesDone' } },
      { id: 'goal.hire', title: 'New blood', text: 'Hire a crew member at a trading hub.', check: { kind: 'stat', stat: 'hired' } },
      { id: 'goal.leave_home', title: 'Out of the cradle', text: 'Reach a cluster beyond the one you started in.', check: { kind: 'otherCluster' } },
    ],
    reward: { credits: 250 },
  },
] satisfies GoalActDef[];
