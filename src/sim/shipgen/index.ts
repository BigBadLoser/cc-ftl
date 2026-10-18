export type {
  AccessKind, AsmRecord, NavyGrammar, DroneGrammar, CompDebug, HullFamilyDef, JoinKind, JoinRecord, MetricBands, MetricId, PortRecord, SectionKind,
  ArchetypeId, ArchitectureDef, ChunkDef, FactionDef, GenOrigin, GenResult, GenRoom, RoomRole, Scaled, ShipBudget, ShipRoleDef, Weighted,
} from './types';
export { generateShip, generateAttempt, GEN_ATTEMPTS } from './generate';
export { validateTemplate } from './validate';
export { scaled } from './plan';
export { roleOfLetter } from './canvas';
export { adjacencyDistance, adjacencySignature, layoutMetrics, meanPairwise, profileDistance, silhouetteDistance, silhouetteMask } from './metrics';
export { Arranger, mirrorBlock, flipId, type Block, type BlockPort, type AttachOpts } from './arranger';
