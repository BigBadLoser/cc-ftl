import type { StationFlowDef } from '../sim/shipgen/flow/types';

/**
 * Station flows (docs/STATIONFLOWS.md): the department graphs stations are planned from. Topology and intent only; the
 * planner chooses the structure. Three for trading stations.
 */
const commons = { id: 'commons', roles: ['support', 'medbay'], place: ['court'] } as const;
const habitation = { id: 'habitation', roles: ['quarters'], place: ['band', 'arm'] } as const;
const defence = { id: 'defence', roles: ['weapons', 'plant'], place: ['band'] } as const;
const secure = { id: 'secure', roles: ['reactor', 'shields', 'core'], access: 'controlled', place: ['arm', 'wing'] } as const;
const prefs = [
  { kind: 'near', a: 'freight', b: 'harbour' }, { kind: 'far', a: 'habitation', b: 'harbour' }, { kind: 'far', a: 'secure', b: 'harbour' },
  { kind: 'near', a: 'defence', b: 'secure' }, { kind: 'far', a: 'habitation', b: 'freight', weight: 0.5 },
] as const;

export const stationFlows = {
  // One harbour; everything arriving passes customs, then the concourse to a market round the central court.
  'flow.trading.harbourMarket': {
    name: 'Harbour and market',
    depts: [
      { id: 'harbour', roles: ['dock', 'bridge', 'armoury'], place: ['wing'], docks: 'all', customs: true },
      { id: 'market', roles: ['shop'], place: ['court'], fill: true },
      { id: 'freight', roles: ['cargo'], place: ['arm', 'wing'] },
      commons, secure, habitation, defence,
    ],
    prefs,
    intent: { landmark: 'harbour', court: 'large' },
  },
  // No market court: shops line the concourse from the harbour to a small rotunda.
  'flow.trading.marketStreet': {
    name: 'Market street',
    depts: [
      { id: 'harbour', roles: ['dock', 'bridge', 'armoury'], place: ['wing'], docks: 'all', customs: true },
      { id: 'market', roles: ['shop'], place: ['arm'], with: 'harbour', fill: true },
      { id: 'freight', roles: ['cargo'], place: ['arm'] },
      commons, secure, habitation, defence,
    ],
    prefs,
    intent: { landmark: 'market', court: 'small' },
  },
  // Passengers and freight arrive apart: the warehouses stand on their own wing with their own docks and customs.
  'flow.trading.twoHarbours': {
    name: 'Two harbours',
    depts: [
      { id: 'freight', roles: ['cargo'], place: ['wing'], docks: 2, customs: true },
      { id: 'harbour', roles: ['dock', 'bridge', 'armoury'], place: ['wing'], docks: 'all', customs: true },
      { id: 'market', roles: ['shop'], place: ['court'], fill: true },
      commons, secure, habitation, defence,
    ],
    prefs: [...prefs, { kind: 'far', a: 'freight', b: 'harbour', weight: 2 }],
    intent: { landmark: 'freight', court: 'large' },
  },
} as const satisfies Record<string, StationFlowDef>;
