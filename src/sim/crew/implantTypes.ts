import { defineComponent } from '../ecs';
import type { Modifier } from '../stats';

/**
 * Implants and surgery (DESIGN.md "Injuries and cyberware", slice 2a, #311): the content shape on an item (`ItemDef.implant`), the fitted implants
 * and the surgery queue of a crew member, and the events. The rules live in crew/implants.ts (what a fitted implant gives), crew/surgery.ts (which
 * operations apply, their odds and outcome) and systems/surgery.ts (the surgery jobs).
 */

/** Where an implant goes: a kind of body part (`BodyPartDef.slot`: one slot kind covers both arms), or the skin (`dermal`, body-wide, no flesh part). */
export type ImplantSlot = 'brain' | 'eye' | 'heart' | 'lungs' | 'spine' | 'arm' | 'leg' | 'dermal';

/** An implant item (`ItemDef.implant`). */
export interface ImplantDef {
  slot: ImplantSlot;
  /** Mk I, II or III: also the surgery's difficulty. */
  tier: 1 | 2 | 3;
  /** A replacement takes the flesh part's place (and restores a lost one); an augment sits beside it. */
  kind: 'replacement' | 'augment';
  /** A replacement: the part's condition while fitted, against flesh = 1 (Mk I 0.8, Mk III above 1). */
  capacity?: number;
  /** Stat modifiers on top (origin `implant` in the stat resolver). */
  mods?: readonly Modifier[];
  /** Body multipliers on top: bleed-out time, healing speed, suit air. */
  bleedOutMul?: number;
  healMul?: number;
  suitAirMul?: number;
  /** Armour (share of weapon damage shrugged off), added to the species' (dermal armour). */
  armor?: number;
  /** Cyber points: the sum is the crew member's implant load (`HEAVY_LOAD`: heavily augmented). */
  load: number;
  /** Seconds an ion hit shuts it down (slice 2b reads it). */
  ionSec: number;
  /** Military hardware: contraband (slice 2b inspections read it). */
  contraband?: true;
}

/** One fitted implant: the body part it is on (`part.dermal` for the skin) and its item id. */
export interface FittedImplant {
  part: string;
  item: string;
}

/** A crew member's fitted implants: at most one replacement and one augment per part. */
export interface Implants {
  list: FittedImplant[];
}
export const ImplantsC = defineComponent<Implants>('implants');

/** The skin's part id: the dermal slot's only part (not in the body map). */
export const DERMAL_PART = 'part.dermal';

/** What an operation does. */
export type OperationKind = 'fit' | 'remove' | 'repair' | 'amputate';

/** One queued operation on a patient. */
export interface Operation {
  id: number;
  kind: OperationKind;
  part: string;
  /** fit: the implant item; remove: the fitted implant taken out. */
  item?: string;
  /** Saves a life (a lost heart or lungs): ahead of everything, and the surgery job ranks as a rescue does. */
  urgent?: true;
  /** The tick the patient gave up waiting in the bed for a surgeon (they do not seek it again for `STRANDED_RETRY_SEC`). */
  untended?: number;
}

/** A crew member's surgery queue, worked in order. `next`: the id the next queued operation gets. */
export interface Operations {
  list: Operation[];
  next: number;
}
export const OperationsC = defineComponent<Operations>('operations');

/** The surgery queue commands (crew/surgeryHandlers.ts), part of `Command`. */
export type SurgeryCommand =
  /**
   * Queue an operation on crew member `id` (crew/surgery.ts): fit the implant `item` to `part`, remove the fitted `item`, repair an organ, amputate a lost limb.
   * A surgeon does it at a medical bed, safer with a surgical rig beside it (systems/surgery.ts). Rejected with `crew/surgery.ts operationError`'s reason, or `queued`.
   */
  | { type: 'crew.queueOperation'; id: number; kind: OperationKind; part: string; item?: string }
  /** Take operation `op` off crew member `id`'s queue (a surgeon at work on it stops). */
  | { type: 'crew.cancelOperation'; id: number; op: number };

/** How an operation went: done; failed (the part is injured); botched (the part is destroyed, or a brain badly hurt). */
export type SurgeryOutcome = 'success' | 'failure' | 'botched';

/** Output only (the ship's log). */
export type SurgeryEvent =
  | { type: 'crew.surgery'; crew: number; by: number; kind: OperationKind; part: string; item?: string; outcome: SurgeryOutcome };
