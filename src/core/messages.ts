import type { CustomDeliverable } from './deliverables';
import type { BuildState } from './state';

/** One deliverable the user asked to build. The main thread resolves sizes from the library. */
export interface BuildItem {
  deliverableId: string;
  quantity: number;
}

/** UI iframe → main thread. */
export type UIToMain =
  | { type: 'ui-ready' }
  | { type: 'save-state'; state: BuildState }
  | {
      type: 'build';
      seriesName: string;
      seriesId: string;
      items: BuildItem[];
      folderPrefix: boolean;
      /** Custom sizes in play, so the main thread can resolve them. */
      customs: CustomDeliverable[];
    }
  /** A selection command run from the window. */
  | { type: 'command'; command: SelectionCommand };

export type SelectionCommand =
  | 'select-series'
  | 'retag'
  | 'untag'
  | 'prefix-on'
  | 'prefix-off';

/** Main thread → UI iframe. */
export type MainToUI =
  | { type: 'init'; state: BuildState; version: string }
  | { type: 'status'; message: string }
  | { type: 'error'; message: string };
