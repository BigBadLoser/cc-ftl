export type {
  AccessKind, AsmRecord, NavyGrammar, DroneGrammar, CompDebug, HullFamilyDef, JoinKind, JoinRecord, MetricBands, MetricId, PortRecord, SectionKind,
  ArchetypeId, ArchitectureDef, ChunkDef, FactionDef, GenOrigin, GenResult, GenRoom, RoomRole, Scaled, ShipBudget, ShipRoleDef, Weighted,
} from './types';
export { generateShip, generateAttempt, previewHull, GEN_ATTEMPTS } from './generate';
export { structureParts, validateTemplate } from './validate';
export { scaled, hullChoices } from './plan';
export { roleOfLetter } from './canvas';
export { adjacencyDistance, adjacencySignature, layoutMetrics, meanPairwise, profileDistance, silhouetteDistance, silhouetteMask } from './metrics';
export { Arranger, mirrorBlock, flipId, type Block, type BlockPort, type AttachOpts } from './arranger';
export { generateStation, stationFaction, stationProblems, type StationResult } from './stationGen';
export { planStation, stationCrew, SECURITY_ROLE } from './stationPlan';
export { STATION_MAX, STATION_SIZES, type StationDef, type StationGrammar, type StationInfo, type StationKind, type StationRoomDef, type StationSize, type StationTier } from './stationTypes';
