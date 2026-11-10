import { BindGroup } from 'pixi.js';

/**
 * Backports of two Pixi 8.9 BindGroup bugs, fixed upstream in later 8.x releases (issue #406). Drop this file when pixi.js is
 * upgraded past them.
 *
 * - `onResourceChange` rebuilt the group's key on every change of a live resource. A group whose texture was destroyed holds a
 *   null in that slot, so the rebuild threw `Cannot read properties of null (reading '_resourceId')`. Pixi keeps such groups
 *   forever (the batcher caches a group per texture set, in a module-level map shared by every renderer), so any later change
 *   of a texture or sampler they once shared (a style `update()`, a render texture resize) threw. The key is rebuilt where it is
 *   used anyway (`BindGroupSystem.getBindGroup` calls `_updateKey` first), so the change handler now only marks it dirty.
 * - `setResource` took its listener off the new resource instead of the old one, so a group kept listening to every texture it
 *   ever held: a tiling sprite's shader that started on `Texture.EMPTY` stayed subscribed to its sampler, the one every batch
 *   bind group shares.
 */
let applied = false;

export function applyPixiFixes(): void {
  if (applied) return;
  applied = true;
  type Res = { destroyed?: boolean; on?(e: 'change', fn: (r: Res) => void, ctx: unknown): void; off?(e: 'change', fn: (r: Res) => void, ctx: unknown): void };
  type Group = { resources: Record<number, Res | null>; _dirty: boolean; onResourceChange(r: Res): void };
  const proto = BindGroup.prototype as unknown as Group & { setResource(r: Res, i: number): void };
  proto.onResourceChange = function (this: Group, resource: Res): void {
    this._dirty = true;
    if (!resource.destroyed) return;
    const resources = this.resources;
    for (const i in resources) if (resources[i] === resource) resources[i] = null;
  };
  proto.setResource = function (this: Group, resource: Res, index: number): void {
    const current = this.resources[index];
    if (resource === current) return;
    current?.off?.('change', this.onResourceChange, this);
    resource.on?.('change', this.onResourceChange, this);
    this.resources[index] = resource;
    this._dirty = true;
  };
}
