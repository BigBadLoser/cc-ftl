import { dockReducer, loadDock, saveDock, type DockAction, type DockState } from './dock';

/** The live docking arrangement: the reducer's state, saved on every change. */
class DockStore {
  state = $state<DockState>(loadDock());
  dispatch(a: DockAction): void {
    this.state = dockReducer(this.state, a);
    saveDock(this.state);
  }
}
export const docks = new DockStore();
