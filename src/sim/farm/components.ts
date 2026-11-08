import { defineComponent } from '../ecs';

/**
 * On hydroponics beds (`ModuleDef.plot`): what the bed is set to sow and what is in the soil.
 * `crop` is the player's pick (a CropDef id; null = leave the bed alone). `planted` is the crop in the soil, which a later change of `crop` does not
 * disturb: it grows on and is harvested as it was sown. `grown` counts the powered ticks since it was planted; the bed is `ready` once that
 * reaches the crop's growing time.
 */
export interface Plot {
  crop: string | null;
  planted: string | null;
  grown: number;
  ready: boolean;
}
export const PlotC = defineComponent<Plot>('plot');
