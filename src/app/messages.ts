const REASONS: Record<string, string> = {
  jobExists: "There's already a job on that tile",
  noJob: 'No job on that tile to cancel',
  sameStruct: "That's already built there",
  nothingToDeconstruct: 'Nothing to deconstruct there',
  outOfBounds: "That's outside the ship",
  badGrid: "That isn't a ship tile",
  notDrafted: 'Draft the crew member first',
  notWalkable: "Can't walk there",
  noCrew: 'That crew member is gone',
  notFloor: 'Modules need bare floor',
  occupied: 'Something is already there',
  noAccess: 'Keep a walkable tile free for crew access',
  badRot: "Can't rotate that",
  badDef: 'Unknown module',
  badStruct: "Can't build that",
};

/** Plain-text version of a `command.rejected` reason code. */
export function rejectionMessage(reason: string): string {
  return REASONS[reason] ?? `Command rejected (${reason})`;
}
