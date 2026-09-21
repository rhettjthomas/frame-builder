/**
 * UI iframe. Renders the build dialog and keeps it in sync with the main
 * thread's clientStorage. It owns no document state: every change is posted as a
 * whole BuildState, so a reload always shows what was actually saved.
 */
import {
  clampQuantity,
  CUSTOM_PREFIX,
  CUSTOM_SECTION_PREFIX,
  deliverablesIn,
  formatSafe,
  formatSize,
  isCustomId,
  sectionLabel,
  sectionsFor,
  SHIPPED_SECTIONS,
  SUGGESTED_SECTIONS,
  type CustomDeliverable,
  type Deliverable,
  type Library,
  type Section,
} from '../core/deliverables';
import type { BuildItem, MainToUI, SelectionCommand, UIToMain } from '../core/messages';
import { allPresets, type Preset } from '../core/presets';
import { safeFolder } from '../core/delivery';
import { toSeriesId } from '../core/slug';
import {
  frameCount,
  libraryFor,
  normalizePresets,
  stateFromPreset,
  type BuildState,
} from '../core/state';

declare const __VERSION__: string;

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
  customNewGroup: el('custom-new-group'),
  customGroupName: el<HTMLInputElement>('custom-group-name'),
  customFolderHint: el('custom-folder-hint'),
  groupSuggestions: el('group-suggestions'),
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
  presetsList: el('presets-list'),
  presetsEmpty: el('presets-empty'),
  presetsJson: el<HTMLDetailsElement>('presets-json'),
  newPreset: el('new-preset'),
  newPresetName: el<HTMLInputElement>('new-preset-name'),
  newPresetSave: el<HTMLButtonElement>('new-preset-save'),
  newPresetCancel: el<HTMLButtonElement>('new-preset-cancel'),
  newPresetHint: el('new-preset-hint'),
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

const NEW_PRESET = '__new__';

function renderPresets() {
  dom.preset.innerHTML = '';
  for (const preset of allPresets(state.savedPresets)) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    dom.preset.appendChild(option);
  }
  // Saving lives next to the list it adds to, rather than only in the menu.
  const add = document.createElement('option');
  add.value = NEW_PRESET;
  add.textContent = 'Add new…';
  dom.preset.appendChild(add);
  dom.preset.value = state.presetId;
}

function sections(): Section[] {
  return sectionsFor(state.customs).map((s) => s.id);
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
  const label = sectionLabel(section, state.customs);
  input.setAttribute('aria-label', `Check all in ${label}`);
  const box = document.createElement('span');
  box.className = 'check-box';
  check.append(input, box);

  const title = document.createElement('span');
  title.className = 'group-title';
  title.textContent = label;

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
  for (const section of sections()) {
    if (deliverablesIn(library(), section).length === 0) continue;
    const group = document.createElement('div');
    group.className = 'group';
    renderGroupHead(section, group);
    const inSection = deliverablesIn(library(), section);
    if (inSection.length === 0) continue;
    const rows = document.createElement('div');
    rows.className = 'rows';
    for (const d of inSection) renderRow(d, rows);
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

const NEW_GROUP = '__new__';

function renderGroupOptions() {
  dom.customSection.innerHTML = '';
  for (const section of sectionsFor(state.customs)) {
    const option = document.createElement('option');
    option.value = section.id;
    option.textContent = section.label;
    dom.customSection.appendChild(option);
  }
  const add = document.createElement('option');
  add.value = NEW_GROUP;
  add.textContent = 'Add new…';
  dom.customSection.appendChild(add);

  dom.groupSuggestions.innerHTML = '';
  const taken = sectionsFor(state.customs).map((s) => s.label.toLowerCase());
  for (const name of SUGGESTED_SECTIONS) {
    if (taken.indexOf(name.toLowerCase()) !== -1) continue;
    const option = document.createElement('option');
    option.value = name;
    dom.groupSuggestions.appendChild(option);
  }
}

/** Show the name field only while "Add new…" is the chosen group. */
function syncNewGroupField() {
  const adding = dom.customSection.value === NEW_GROUP;
  dom.customNewGroup.hidden = !adding;
  const typed = dom.customGroupName.value.trim();
  dom.customFolderHint.textContent =
    adding && typed ? `Delivers to ${safeFolder(typed)}` : 'Also names the delivery folder.';
  if (adding) dom.customGroupName.focus();
}

function openCustomSheet() {
  renderGroupOptions();
  dom.customGroupName.value = '';
  dom.customName.value = '';
  dom.customWidth.value = '';
  dom.customHeight.value = '';
  dom.customSides.value = '';
  dom.customEnds.value = '';
  dom.customSection.value = 'social-web';
  dom.customQuantity.value = '1';
  dom.customStatus.textContent = '';
  syncNewGroupField();
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

  // A new group lives only because a size uses it: it is carried by the size
  // and by any preset that includes it, never added to the shipped list.
  let section = dom.customSection.value;
  let label = sectionLabel(section, state.customs);
  let folder = sectionsFor(state.customs).find((s) => s.id === section)?.folder ?? 'EXTRAS';

  if (section === NEW_GROUP) {
    const typed = dom.customGroupName.value.trim();
    if (!typed) return fail('Name the new group.');
    const existing = sectionsFor(state.customs).find(
      (s) => s.label.toLowerCase() === typed.toLowerCase(),
    );
    if (existing) {
      section = existing.id;
      label = existing.label;
      folder = existing.folder;
    } else {
      section = `${CUSTOM_SECTION_PREFIX}${typed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      label = typed;
      folder = safeFolder(typed);
    }
  }

  const custom: CustomDeliverable = {
    // Time plus a random tail: unique enough across machines that two people
    // saving a preset on the same day can't collide.
    id: `${CUSTOM_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    name,
    section,
    sectionLabel: label,
    folder,
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

function openNewPreset() {
  dom.newPreset.hidden = false;
  dom.newPresetHint.hidden = false;
  dom.newPresetHint.textContent = `Saves the ${frameCount(state)} frames you have checked.`;
  dom.newPresetName.value = '';
  dom.newPresetName.focus();
}

function closeNewPreset() {
  dom.newPreset.hidden = true;
  dom.newPresetHint.hidden = true;
}

/**
 * The checklist as it stands, saved under a name. The name is typed into the
 * window rather than a prompt() because Figma's plugin iframe is sandboxed
 * without allow-modals, so a prompt would simply never appear.
 */
function saveNamedPreset(rawName: string): boolean {
  const name = rawName.trim();
  if (!name) {
    dom.newPresetHint.hidden = false;
    dom.newPresetHint.textContent = 'Give the preset a name.';
    dom.newPresetName.focus();
    return false;
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
  closeNewPreset();
  renderPresets();
  render();
  showStatus(existing ? `Updated the preset "${name}".` : `Saved the preset "${name}".`);
  return true;
}

function deletePreset(id: string) {
  state.savedPresets = state.savedPresets.filter((p) => p.id !== id);
  // Dropping the preset you were on falls back to the default rather than
  // leaving the list pointing at something that no longer exists.
  if (state.presetId === id) state.presetId = 'custom';
  save();
  renderPresets();
  render();
  renderPresetsSheet();
}

function renderPresetsSheet() {
  dom.presetsList.innerHTML = '';
  dom.presetsEmpty.hidden = state.savedPresets.length > 0;

  for (const preset of state.savedPresets) {
    const item = document.createElement('div');
    item.className = 'preset-item';

    const text = document.createElement('div');
    text.className = 'preset-text';
    const name = document.createElement('span');
    name.className = 'preset-name';
    name.textContent = preset.name;
    const meta = document.createElement('span');
    meta.className = 'preset-meta';
    const count = preset.include === 'all' ? 'everything' : `${preset.include.length} checked`;
    const customs = preset.customs?.length ?? 0;
    meta.textContent = customs
      ? `${count} · ${customs} custom ${customs === 1 ? 'size' : 'sizes'}`
      : count;
    text.append(name, meta);

    const use = document.createElement('button');
    use.type = 'button';
    use.className = 'link';
    use.textContent = 'Use';
    use.addEventListener('click', () => {
      const settings = state.settings;
      state = stateFromPreset(preset.id, state.savedPresets, state.customs);
      state.settings = settings;
      save();
      render();
      dom.presetsSheet.hidden = true;
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'row-remove';
    remove.textContent = '\u00d7';
    remove.title = `Delete ${preset.name}`;
    remove.setAttribute('aria-label', `Delete ${preset.name}`);
    remove.addEventListener('click', () => deletePreset(preset.id));

    item.append(text, use, remove);
    dom.presetsList.appendChild(item);
  }

  dom.presetsText.value = JSON.stringify(state.savedPresets, null, 2);
}

function openPresetsSheet() {
  dom.presetsStatus.textContent = '';
  dom.presetsJson.open = false;
  renderPresetsSheet();
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
  renderPresetsSheet();
  dom.presetsJson.open = false;
  const noun = incoming.length === 1 ? 'preset' : 'presets';
  dom.presetsStatus.textContent = `Loaded ${incoming.length} ${noun}.`;
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
  const button = (e.target as HTMLElement).closest('button');
  const command = button?.dataset.command;
  if (command) {
    showError('');
    showStatus('Working…');
    post({ type: 'command', command: command as SelectionCommand });
    closeMenu();
    return;
  }
  const action = button?.dataset.action;
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
  if (dom.preset.value === NEW_PRESET) {
    // Put the list back where it was: naming is the action, not a selection.
    dom.preset.value = state.presetId;
    openNewPreset();
    return;
  }
  const settings = state.settings;
  state = stateFromPreset(dom.preset.value, state.savedPresets, state.customs);
  state.settings = settings;
  save();
  render();
});

dom.newPresetSave.addEventListener('click', () => saveNamedPreset(dom.newPresetName.value));
dom.newPresetCancel.addEventListener('click', closeNewPreset);
dom.newPresetName.addEventListener('keydown', (e) => {
  const key = (e as KeyboardEvent).key;
  if (key === 'Enter') saveNamedPreset(dom.newPresetName.value);
  if (key === 'Escape') closeNewPreset();
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
dom.customSection.addEventListener('change', syncNewGroupField);
dom.customGroupName.addEventListener('input', syncNewGroupField);
dom.customSheet.addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') addCustomSize();
  if ((e as KeyboardEvent).key === 'Escape') dom.customSheet.hidden = true;
});

dom.presetsClose.addEventListener('click', () => {
  dom.presetsSheet.hidden = true;
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
