/**
 * UI iframe. Renders the build dialog and keeps it in sync with the main
 * thread's clientStorage. It owns no document state: every change is posted as a
 * whole BuildState, so a reload always shows what was actually saved.
 */
import {
  clampQuantity,
  CUSTOM_PREFIX,
  deliverablesIn,
  formatSafe,
  formatSize,
  isCustomId,
  type CustomDeliverable,
  type Deliverable,
  type Library,
  type Section,
  SECTION_LABELS,
} from '../core/deliverables';
import type { BuildItem, MainToUI, UIToMain } from '../core/messages';
import { allPresets, type Preset } from '../core/presets';
import { toSeriesId } from '../core/slug';
import {
  frameCount,
  libraryFor,
  normalizePresets,
  stateFromPreset,
  type BuildState,
} from '../core/state';

declare const __VERSION__: string;

const SECTIONS: Section[] = ['screens', 'social-web'];

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: ${id}`);
  return node as T;
}

const dom = {
  version: el('version'),
  menuAbout: el('menu-about'),
  settingsBtn: el<HTMLButtonElement>('settings-btn'),
  settingsMenu: el('settings-menu'),
  folderPrefixCheck: el('folder-prefix-check'),
  preset: el<HTMLSelectElement>('preset'),
  seriesName: el<HTMLInputElement>('series-name'),
  seriesId: el('series-id'),
  checklist: el('checklist'),
  notices: el('notices'),
  status: el('status'),
  statusLabel: el('status-label'),
  buildBtn: el<HTMLButtonElement>('build-btn'),
  addCustom: el<HTMLButtonElement>('add-custom'),
  customSheet: el('custom-sheet'),
  customClose: el<HTMLButtonElement>('custom-close'),
  customName: el<HTMLInputElement>('custom-name'),
  customWidth: el<HTMLInputElement>('custom-width'),
  customHeight: el<HTMLInputElement>('custom-height'),
  customSides: el<HTMLInputElement>('custom-sides'),
  customEnds: el<HTMLInputElement>('custom-ends'),
  customSection: el<HTMLSelectElement>('custom-section'),
  customQuantity: el<HTMLInputElement>('custom-quantity'),
  customStatus: el('custom-status'),
  customSave: el<HTMLButtonElement>('custom-save'),
  presetsSheet: el('presets-sheet'),
  presetsClose: el<HTMLButtonElement>('presets-close'),
  presetsText: el<HTMLTextAreaElement>('presets-text'),
  presetsStatus: el('presets-status'),
  presetsCopy: el<HTMLButtonElement>('presets-copy'),
  presetsDownload: el<HTMLButtonElement>('presets-download'),
  presetsFileBtn: el<HTMLButtonElement>('presets-file-btn'),
  presetsFile: el<HTMLInputElement>('presets-file'),
  presetsLoad: el<HTMLButtonElement>('presets-load'),
  presetName: el<HTMLInputElement>('preset-name'),
  presetSave: el<HTMLButtonElement>('preset-save'),
};

let state: BuildState = stateFromPreset('sermon-series');
/** Suppresses saving while the first render populates controls from storage. */
let hydrating = true;

function post(msg: UIToMain) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

function save() {
  if (hydrating) return;
  post({ type: 'save-state', state });
}

/* ---------------------------------------------------------------- rendering */

function library(): Library {
  return libraryFor(state);
}

function renderPresets() {
  dom.preset.innerHTML = '';
  for (const preset of allPresets(state.savedPresets)) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    dom.preset.appendChild(option);
  }
  dom.preset.value = state.presetId;
}

function checkedCount(section: Section): number {
  return deliverablesIn(library(), section).filter((d) => state.rows[d.id]?.checked).length;
}

function renderGroupHead(section: Section, container: HTMLElement) {
  const all = deliverablesIn(library(), section);
  const checked = checkedCount(section);

  const head = document.createElement('div');
  head.className = 'group-head';

  const check = document.createElement('label');
  check.className = 'check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked === all.length;
  input.indeterminate = checked > 0 && checked < all.length;
  input.setAttribute('aria-label', `Check all in ${SECTION_LABELS[section]}`);
  const box = document.createElement('span');
  box.className = 'check-box';
  check.append(input, box);

  const title = document.createElement('span');
  title.className = 'group-title';
  title.textContent = SECTION_LABELS[section];

  const count = document.createElement('span');
  count.className = 'group-count';
  count.textContent = `${checked} of ${all.length}`;

  input.addEventListener('change', () => {
    const on = input.checked;
    for (const d of all) state.rows[d.id].checked = on;
    state.presetId = 'custom';
    save();
    render();
  });

  head.append(check, title, count);
  container.appendChild(head);
}

function renderRow(d: Deliverable, container: HTMLElement) {
  const row = state.rows[d.id];
  if (!row) return;

  const wrap = document.createElement('div');
  wrap.className = row.checked ? 'row on' : 'row';

  const check = document.createElement('label');
  check.className = 'check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = row.checked;
  input.setAttribute('aria-label', d.name);
  const box = document.createElement('span');
  box.className = 'check-box';
  check.append(input, box);

  const text = document.createElement('div');
  text.className = 'row-text';
  const name = document.createElement('span');
  name.className = 'row-name';
  name.textContent = d.name;
  const meta = document.createElement('span');
  meta.className = 'row-meta';
  meta.textContent = `${formatSize(d)} · ${formatSafe(d.safe)} · ${d.format}`;
  text.append(name, meta);

  input.addEventListener('change', () => {
    row.checked = input.checked;
    state.presetId = 'custom';
    save();
    render();
  });

  wrap.append(check, text);

  if (d.quantity) {
    const qty = document.createElement('div');
    qty.className = 'qty';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.setAttribute('aria-label', `Fewer ${d.name} frames`);
    minus.disabled = !row.checked || row.quantity <= d.quantity.min;

    const value = document.createElement('span');
    value.className = 'qty-value';
    value.textContent = String(row.quantity);

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.textContent = '+';
    plus.setAttribute('aria-label', `More ${d.name} frames`);
    plus.disabled = !row.checked || row.quantity >= d.quantity.max;

    const step = (by: number) => {
      row.quantity = clampQuantity(d, row.quantity + by);
      state.presetId = 'custom';
      save();
      render();
    };
    minus.addEventListener('click', () => step(-1));
    plus.addEventListener('click', () => step(1));

    qty.append(minus, value, plus);
    wrap.appendChild(qty);
  }

  if (isCustomId(d.id)) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'row-remove';
    remove.textContent = '\u00d7';
    remove.title = `Remove ${d.name}`;
    remove.setAttribute('aria-label', `Remove ${d.name}`);
    remove.addEventListener('click', () => {
      state.customs = state.customs.filter((c) => c.id !== d.id);
      delete state.rows[d.id];
      state.presetId = 'custom';
      save();
      render();
    });
    wrap.appendChild(remove);
  }

  container.appendChild(wrap);
}

function renderChecklist() {
  dom.checklist.innerHTML = '';
  for (const section of SECTIONS) {
    const group = document.createElement('div');
    group.className = 'group';
    renderGroupHead(section, group);
    const rows = document.createElement('div');
    rows.className = 'rows';
    for (const d of deliverablesIn(library(), section)) renderRow(d, rows);
    group.appendChild(rows);
    dom.checklist.appendChild(group);
  }
}

function renderFooter() {
  const seriesId = toSeriesId(dom.seriesName.value);
  const frames = frameCount(state);

  dom.seriesId.textContent = seriesId
    ? `Tags every frame with ${seriesId}`
    : 'Names the section and tags every frame.';

  dom.buildBtn.textContent = frames === 1 ? 'Build 1 frame' : `Build ${frames} frames`;
  dom.buildBtn.disabled = !seriesId || frames === 0;

  const reasons: string[] = [];
  if (!seriesId) reasons.push('Name the series to build.');
  if (frames === 0) reasons.push('Check at least one deliverable.');
  showStatus(reasons.join(' '));
}

function render() {
  if (dom.preset.options.length === 0) renderPresets();
  dom.preset.value = state.presetId;
  // A tick rather than a checkbox: this sits in a menu, where a control that
  // looks clickable but isn't would be worse than a mark that just reports.
  dom.folderPrefixCheck.textContent = state.settings.folderPrefix ? '✓' : '';
  renderChecklist();
  renderFooter();
}

/* ------------------------------------------------------------------ notices */

function showStatus(message: string) {
  dom.statusLabel.textContent = message;
  dom.status.hidden = !message;
}

function showError(message: string) {
  dom.notices.innerHTML = '';
  if (message) {
    const notice = document.createElement('p');
    notice.className = 'notice error';
    notice.textContent = message;
    dom.notices.appendChild(notice);
  }
  dom.notices.hidden = !message;
}

/* ------------------------------------------------------------ custom sizes */

function openCustomSheet() {
  dom.customName.value = '';
  dom.customWidth.value = '';
  dom.customHeight.value = '';
  dom.customSides.value = '';
  dom.customEnds.value = '';
  dom.customSection.value = 'social-web';
  dom.customQuantity.value = '1';
  dom.customStatus.textContent = '';
  dom.customSheet.hidden = false;
  dom.customName.focus();
}

function numberFrom(input: HTMLInputElement, fallback = 0): number {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function addCustomSize(): void {
  const name = dom.customName.value.trim();
  const width = Math.round(numberFrom(dom.customWidth));
  const height = Math.round(numberFrom(dom.customHeight));

  if (!name) return fail('Give the size a name.');
  if (width < 1 || height < 1) return fail('Width and height must be at least 1 pixel.');
  if (library().some((d) => d.name.toLowerCase() === name.toLowerCase())) {
    return fail(`There is already a deliverable called ${name}.`);
  }

  const custom: CustomDeliverable = {
    // Time plus a random tail: unique enough across machines that two people
    // saving a preset on the same day can't collide.
    id: `${CUSTOM_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    name,
    section: dom.customSection.value === 'screens' ? 'screens' : 'social-web',
    width,
    height,
    safe: {
      sides: Math.max(0, Math.round(numberFrom(dom.customSides))),
      ends: Math.max(0, Math.round(numberFrom(dom.customEnds))),
    },
    quantity: Math.min(10, Math.max(1, Math.round(numberFrom(dom.customQuantity, 1)))),
  };

  state.customs = [...state.customs, custom];
  state.rows[custom.id] = { checked: true, quantity: custom.quantity };
  state.presetId = 'custom';
  save();
  render();
  dom.customSheet.hidden = true;

  function fail(message: string) {
    dom.customStatus.textContent = message;
  }
}

/* ---------------------------------------------------------------- presets */

/**
 * The checklist as it stands, saved under the name in the sheet. The name field
 * lives in the sheet rather than a prompt() because Figma's plugin iframe is
 * sandboxed without allow-modals, so a prompt would simply never appear.
 */
function savePresetFromChecklist() {
  const name = dom.presetName.value.trim();
  if (!name) {
    dom.presetsStatus.textContent = 'Give the preset a name.';
    dom.presetName.focus();
    return;
  }

  const include = library()
    .filter((d) => state.rows[d.id]?.checked)
    .map((d) => d.id);
  const quantities: Record<string, number> = {};
  for (const id of include) {
    const row = state.rows[id];
    if (row) quantities[id] = row.quantity;
  }
  // Only the customs this preset actually uses travel with it.
  const customs = state.customs.filter((c) => include.indexOf(c.id) !== -1);

  const existing = state.savedPresets.find((p) => p.name.toLowerCase() === name.toLowerCase());
  const preset: Preset = {
    id: existing?.id ?? `saved:${Date.now().toString(36)}`,
    name,
    include,
    quantities,
    customs,
    saved: true,
  };

  state.savedPresets = existing
    ? state.savedPresets.map((p) => (p.id === existing.id ? preset : p))
    : [...state.savedPresets, preset];
  state.presetId = preset.id;
  save();
  renderPresets();
  render();
  dom.presetName.value = '';
  dom.presetsText.value = JSON.stringify(state.savedPresets, null, 2);
  dom.presetsStatus.textContent = existing ? `Updated "${name}".` : `Saved "${name}".`;
}

function openPresetsSheet() {
  dom.presetName.value = '';
  dom.presetsText.value = JSON.stringify(state.savedPresets, null, 2);
  dom.presetsStatus.textContent = state.savedPresets.length
    ? ''
    : 'No saved presets yet. Paste some here to load them.';
  dom.presetsSheet.hidden = false;
}

function loadPresetsFromText() {
  let parsed: unknown;
  try {
    parsed = JSON.parse(dom.presetsText.value);
  } catch {
    dom.presetsStatus.textContent = 'That is not valid JSON.';
    return;
  }
  const incoming = normalizePresets(parsed);
  if (incoming.length === 0) {
    dom.presetsStatus.textContent = 'No usable presets in there.';
    return;
  }
  // Loading adds to what is already saved, replacing by name rather than
  // stacking a second copy of a preset the user already has.
  const byName = new Map(state.savedPresets.map((p) => [p.name.toLowerCase(), p]));
  for (const preset of incoming) byName.set(preset.name.toLowerCase(), preset);
  state.savedPresets = [...byName.values()];
  save();
  renderPresets();
  render();
  dom.presetsSheet.hidden = true;
  const noun = incoming.length === 1 ? 'preset' : 'presets';
  showStatus(`Loaded ${incoming.length} ${noun}.`);
}

function downloadPresets() {
  const blob = new Blob([JSON.stringify(state.savedPresets, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'frame-builder-presets.json';
  link.click();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------- wiring */

function closeMenu() {
  dom.settingsMenu.hidden = true;
  dom.settingsBtn.setAttribute('aria-expanded', 'false');
}

function buildItems(): BuildItem[] {
  const items: BuildItem[] = [];
  for (const d of library()) {
    const row = state.rows[d.id];
    if (row?.checked) items.push({ deliverableId: d.id, quantity: clampQuantity(d, row.quantity) });
  }
  return items;
}

dom.settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = dom.settingsMenu.hidden;
  dom.settingsMenu.hidden = !open;
  dom.settingsBtn.setAttribute('aria-expanded', String(open));
});

document.addEventListener('click', (e) => {
  if (!dom.settingsMenu.hidden && !dom.settingsMenu.contains(e.target as Node)) closeMenu();
});

dom.settingsMenu.addEventListener('click', (e) => {
  const action = (e.target as HTMLElement).closest('button')?.dataset.action;
  if (action === 'folder-prefix') {
    state.settings.folderPrefix = !state.settings.folderPrefix;
    save();
    render();
    // Leave the menu open: this is a toggle, and seeing the tick change is the
    // confirmation that it worked.
    return;
  }
  if (action === 'reset') {
    const settings = state.settings;
    state = stateFromPreset(
      state.presetId === 'custom' ? 'sermon-series' : state.presetId,
      state.savedPresets,
      state.customs,
    );
    state.settings = settings;
    save();
    render();
  }
  if (action === 'share-presets') openPresetsSheet();
  closeMenu();
});

dom.preset.addEventListener('change', () => {
  const settings = state.settings;
  state = stateFromPreset(dom.preset.value, state.savedPresets, state.customs);
  state.settings = settings;
  save();
  render();
});

dom.seriesName.addEventListener('input', () => {
  showError('');
  renderFooter();
});

dom.buildBtn.addEventListener('click', () => {
  const seriesName = dom.seriesName.value.trim();
  const seriesId = toSeriesId(seriesName);
  if (!seriesId) return;
  showError('');
  post({
    type: 'build',
    seriesName,
    seriesId,
    items: buildItems(),
    folderPrefix: state.settings.folderPrefix,
    customs: state.customs,
  });
});

dom.addCustom.addEventListener('click', openCustomSheet);
dom.customClose.addEventListener('click', () => {
  dom.customSheet.hidden = true;
});
dom.customSave.addEventListener('click', addCustomSize);
dom.customSheet.addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') addCustomSize();
  if ((e as KeyboardEvent).key === 'Escape') dom.customSheet.hidden = true;
});

dom.presetsClose.addEventListener('click', () => {
  dom.presetsSheet.hidden = true;
});
dom.presetSave.addEventListener('click', savePresetFromChecklist);
dom.presetName.addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') savePresetFromChecklist();
});
dom.presetsLoad.addEventListener('click', loadPresetsFromText);
dom.presetsDownload.addEventListener('click', downloadPresets);
dom.presetsCopy.addEventListener('click', () => {
  dom.presetsText.select();
  dom.presetsStatus.textContent = document.execCommand('copy') ? 'Copied.' : 'Copy that by hand.';
});
dom.presetsFileBtn.addEventListener('click', () => dom.presetsFile.click());
dom.presetsFile.addEventListener('change', async () => {
  const file = dom.presetsFile.files?.[0];
  if (!file) return;
  dom.presetsText.value = await file.text();
  dom.presetsFile.value = '';
  loadPresetsFromText();
});

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data?.pluginMessage as MainToUI | undefined;
  if (!msg) return;
  switch (msg.type) {
    case 'init':
      hydrating = true;
      state = msg.state;
      dom.version.textContent = `v${msg.version}`;
      dom.menuAbout.textContent = `Frame Builder v${msg.version}`;
      render();
      hydrating = false;
      break;
    case 'status':
      showStatus(msg.message);
      break;
    case 'error':
      showError(msg.message);
      break;
  }
});

dom.version.textContent = `v${__VERSION__}`;
dom.menuAbout.textContent = `Frame Builder v${__VERSION__}`;

// Render from the defaults first so the window is never blank, then let `init`
// replace the state with whatever was saved on this machine.
renderPresets();
render();
post({ type: 'ui-ready' });
