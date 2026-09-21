/**
 * Main thread. Owns the Figma document: dialog state storage, and (from milestone 2)
 * frame building, tagging and export. The UI iframe owns rendering and, later, zipping.
 */
import type { MainToUI, UIToMain } from './core/messages';
import { normalizeState, STATE_KEY } from './core/state';

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
      // Milestone 2 builds the frames. Until then, confirm the dialog handed over
      // exactly what the user checked, so the wiring is verifiable in Figma.
      const frames = msg.items.reduce((sum, item) => sum + item.quantity, 0);
      console.log(`[Frame Builder] build "${msg.seriesName}" (${msg.seriesId})`, msg.items);
      figma.notify(`Frame Builder: ${frames} frames queued for "${msg.seriesName}". Building lands in the next milestone.`);
      post({ type: 'status', message: `${frames} frames queued. Frame building is not wired up yet.` });
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
