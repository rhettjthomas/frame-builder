/**
 * Main thread. Owns the Figma document: dialog state storage and frame building,
 * and later tagging and export. The UI iframe owns rendering and, later, zipping.
 */
import type { MainToUI, UIToMain } from './core/messages';
import { normalizeState, STATE_KEY, type BuildState } from './core/state';
import { buildSeries } from './main/builder';
import { exportFrames } from './main/exporter';
import { findAllSeries, revealNode } from './main/finder';

declare const __VERSION__: string;

figma.showUI(__html__, { width: 340, height: 480, themeColors: true, title: 'Frame Builder' });

function post(msg: MainToUI) {
  figma.ui.postMessage(msg);
}

/**
 * clientStorage needs a plugin ID and can fail for reasons the user can do
 * nothing about. Losing the saved checklist is a far smaller problem than the
 * plugin refusing to open, so storage failures degrade to the defaults and say
 * so once, rather than throwing.
 */
let storageWarned = false;

function warnStorage(err: unknown) {
  console.warn('[Frame Builder] client storage unavailable', err);
  if (storageWarned) return;
  storageWarned = true;
  post({ type: 'status', message: 'Checklist changes will not be remembered on this machine.' });
}

async function loadState(): Promise<BuildState> {
  try {
    return normalizeState(await figma.clientStorage.getAsync(STATE_KEY));
  } catch (err) {
    warnStorage(err);
    return normalizeState(undefined);
  }
}

async function saveState(state: BuildState) {
  try {
    await figma.clientStorage.setAsync(STATE_KEY, normalizeState(state));
  } catch (err) {
    warnStorage(err);
  }
}

async function sendInit() {
  post({ type: 'init', state: await loadState(), version: __VERSION__ });
}

/* ------------------------------------------------------------ export search */

/** Whether the UI is sitting on the Export tab and wants to stay current. */
let watchingExport = false;
let rescanTimer: ReturnType<typeof setTimeout> | null = null;
let watchingDocument = false;

async function rescan() {
  post({ type: 'found', series: await findAllSeries() });
  watchDocument();
}

/**
 * Keep the Export tab current without the user pressing Rescan. Only registered
 * after the first search, because documentchange needs every page loaded, and
 * only acted on while the Export tab is open, so an ordinary design session
 * isn't searching the whole file after every nudge of a layer.
 */
function watchDocument() {
  if (watchingDocument) return;
  watchingDocument = true;
  figma.on('documentchange', (event) => {
    if (!watchingExport) return;
    // Style edits can't change which frames belong to a series.
    const touchesNodes = event.documentChanges.some(
      (c) => c.type === 'CREATE' || c.type === 'DELETE' || c.type === 'PROPERTY_CHANGE',
    );
    if (!touchesNodes) return;
    if (rescanTimer !== null) clearTimeout(rescanTimer);
    // Canvas edits arrive in bursts; one search after the burst is enough.
    rescanTimer = setTimeout(() => {
      rescanTimer = null;
      rescan().catch((err) => {
        console.error('[Frame Builder]', err);
        post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    }, 500);
  });
}

/* ------------------------------------------------------------------ export */

/** Set when the UI reports it can no longer write, to stop rendering early. */
let exportAborted: string | null = null;
/** Resolves when the UI acknowledges the file it was just sent. */
let drain: (() => void) | null = null;

function waitForDrain(): Promise<void> {
  return new Promise<void>((resolve) => {
    drain = () => {
      drain = null;
      resolve();
    };
  });
}

async function handle(msg: UIToMain) {
  switch (msg.type) {
    case 'ui-ready':
      await sendInit();
      break;
    case 'save-state':
      await saveState(msg.state);
      break;
    case 'scan':
      post({ type: 'scanning' });
      await rescan();
      break;
    case 'watch-export':
      watchingExport = msg.on;
      break;
    case 'export-abort':
      // The UI hit a write error; stop rendering rather than burning through the
      // rest of a 4K series with nowhere to put it.
      exportAborted = msg.reason;
      break;
    case 'export': {
      exportAborted = null;
      const summary = await exportFrames(msg.nodeIds, async (file, done, total) => {
        if (exportAborted) throw new Error(exportAborted);
        post({ type: 'progress', done, total, label: `Exporting ${done} of ${total}` });
        post({ type: 'export-file', nodeId: file.nodeId, path: file.path, bytes: file.bytes });
        // Let the UI's write settle before rendering the next frame, so the
        // queue can't outrun the disk on a large series.
        await waitForDrain();
      });
      post({
        type: 'export-done',
        written: summary.written,
        failures: summary.failures.map((f) => ({ name: f.name, reason: f.reason })),
      });
      break;
    }
    case 'file-written':
      drain?.();
      break;
    case 'select-node':
      await revealNode(msg.nodeId);
      break;
    case 'build': {
      const { frames } = buildSeries(msg.seriesName, msg.seriesId, msg.items, __VERSION__);
      const count = frames.length;
      const label = count === 1 ? '1 frame' : `${count} frames`;
      figma.notify(`Frame Builder: built ${label} for "${msg.seriesName}"`);
      post({ type: 'status', message: `Built ${label} in "${msg.seriesName}".` });
      // The export tab's picture of the file is now stale.
      await rescan();
      break;
    }
  }
}

// Handle messages strictly in order, so a save never races the build that follows it.
let queue: Promise<void> = Promise.resolve();

figma.ui.onmessage = (msg: UIToMain) => {
  queue = queue.then(async () => {
    try {
      await handle(msg);
    } catch (err) {
      console.error('[Frame Builder]', err);
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  });
};
