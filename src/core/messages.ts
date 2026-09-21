import type { FoundSeries } from './confirm';
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
  | { type: 'build'; seriesName: string; seriesId: string; items: BuildItem[] }
  /** Search the whole file for tagged frames and sections. */
  | { type: 'scan' }
  /** Whether the Export tab is open and wants to stay current. */
  | { type: 'watch-export'; on: boolean }
  /** Select a found frame in the file. */
  | { type: 'select-node'; nodeId: string };

/** Main thread → UI iframe. */
export type MainToUI =
  | { type: 'init'; state: BuildState; version: string }
  | { type: 'status'; message: string }
  | { type: 'found'; series: FoundSeries[] }
  | { type: 'scanning' }
  | { type: 'error'; message: string };
