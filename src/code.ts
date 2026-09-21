/**
 * Main thread. Owns the Figma document: dialog state storage and frame building,
 * and later tagging and export. The UI iframe owns rendering and, later, zipping.
 */
import type { MainToUI, UIToMain } from './core/messages';
import { normalizeState, STATE_KEY } from './core/state';
import { buildSeries } from './main/builder';

declare const __VERSION__: string;

figma.showUI(__html__, { width: 340, height: 480, themeColors: true, title: 'Frame Builder' });

function post(msg: MainToUI) {
  figma.ui.postMessage(msg);
}

async function sendInit() {
  const stored = await figma.clientStorage.getAsync(STATE_KEY);
  post({ type: 'init', state: normalizeState(stored), version: __VERSION__ });
}

async function handle(msg: UIToMain) {
  switch (msg.type) {
    case 'ui-ready':
      await sendInit();
      break;
    case 'save-state':
      await figma.clientStorage.setAsync(STATE_KEY, normalizeState(msg.state));
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
