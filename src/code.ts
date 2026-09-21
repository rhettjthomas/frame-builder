/**
 * Main thread. Owns the Figma document: dialog state storage and frame building,
 * and later tagging and export. The UI iframe owns rendering and, later, zipping.
 */
import type { MainToUI, UIToMain } from './core/messages';
import { normalizeState, STATE_KEY, type BuildState } from './core/state';
import { buildSeries } from './main/builder';

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

async function handle(msg: UIToMain) {
  switch (msg.type) {
    case 'ui-ready':
      await sendInit();
      break;
    case 'save-state':
      await saveState(msg.state);
      break;
    case 'build': {
      const { frames } = buildSeries(msg.seriesName, msg.items);
      const count = frames.length;
      const label = count === 1 ? '1 frame' : `${count} frames`;
      figma.notify(`Frame Builder: built ${label} for "${msg.seriesName}"`);
      post({ type: 'status', message: `Built ${label} in "${msg.seriesName}".` });
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
