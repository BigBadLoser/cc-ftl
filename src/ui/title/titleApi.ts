import type { UiApi } from '../api';

/** What the title screen may call (built in app/title/boot.ts). */
export interface TitleApi {
  /** The saves, as the Load page lists them (no saving from here). */
  saves: UiApi['saves'];
  canContinue(): boolean;
  continueGame(): void;
  /** Begin a new game with the ship template `ship` (reloads the page into it). */
  startGame(ship: string): void;
  /** Draw `ship` in the backdrop canvas; dispose to stop. */
  stage(canvas: HTMLCanvasElement, ship: string): Promise<{ dispose(): void }>;
}
