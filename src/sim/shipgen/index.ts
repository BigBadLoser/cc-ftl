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
export { crewPosts, crewSize, docksOf, stationCrew, SECURITY_ROLE, type CrewPosts } from './stationCrew';
export { assemble, recipeRooms, type Assembly } from './assembly/assemble';
export { deptOf, type Dept } from './assembly/dept';
export { missing as missingRooms } from './assembly/finish';
export { hullProblems } from './assembly/hull';
export { stationProgram, warehoused, withCommons } from './assembly/program';
export { assembleStation, stationFaction, stationProblems, type StationResult } from './assembly/station';
export { buildStation, STATION_TRIES } from './stationBuild';
export { recipeAt, type BranchRule, type Recipe } from './assembly/recipe';
export type { RoomSpec, StationDept } from './plan';
export type { BladeKind, BladeSpec, OutlineRecipe, RaiderNose, ShipRoom } from './outlineRecipe';
export type { Profile, Part as HullPart } from './hull/silhouette';
export { STATION_SIZES, type StationDef, type StationInfo, type StationKind, type StationRoomDef, type StationSize, type StationTier } from './stationTypes';
