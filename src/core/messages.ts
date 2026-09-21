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
  | { type: 'select-node'; nodeId: string }
  /** Render these frames and stream the bytes back. */
  | { type: 'export'; nodeIds: string[] }
  /** The UI could not write a file, so stop rendering the rest. */
  | { type: 'export-abort'; reason: string }
  /** The UI has written the file it was last sent and is ready for the next. */
  | { type: 'file-written' };

/** Main thread → UI iframe. */
export type MainToUI =
  | { type: 'init'; state: BuildState; version: string }
  | { type: 'status'; message: string }
  | { type: 'found'; series: FoundSeries[] }
  | { type: 'scanning' }
  | { type: 'progress'; done: number; total: number; label: string }
  /** One rendered file, with its path inside the delivery package. */
  | { type: 'export-file'; nodeId: string; path: string; bytes: Uint8Array }
  | { type: 'export-done'; written: number; failures: { name: string; reason: string }[] }
  | { type: 'error'; message: string };
