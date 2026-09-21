/**
 * UI iframe. Renders the build dialog and keeps the checklist in sync with the
 * main thread's clientStorage. It owns no document state: every change is posted
 * as a whole BuildState, so a reload always shows what was actually saved.
 */
import {
  clampQuantity,
  DELIVERABLES,
  deliverablesIn,
  formatSafe,
  formatSize,
  SECTION_LABELS,
  type Deliverable,
  type Section,
} from '../core/deliverables';
import {
  collidingNames,
  countFrames,
  groupForConfirm,
  type ConfirmGroup,
  type FoundSeries,
} from '../core/confirm';
import type { BuildItem, MainToUI, UIToMain } from '../core/messages';
import { SHIPPED_PRESETS } from '../core/presets';
import { frameCount, stateFromPreset, type BuildState } from '../core/state';
import { toSeriesId } from '../core/slug';
import {
  FolderCancelled,
  FolderUnavailable,
  pickFolder,
  preparePackage,
  writeFile,
} from './folder';

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
  tabBuild: el<HTMLButtonElement>('tab-build'),
  tabExport: el<HTMLButtonElement>('tab-export'),
  panelBuild: el('panel-build'),
  panelExport: el('panel-export'),
  preset: el<HTMLSelectElement>('preset'),
  seriesName: el<HTMLInputElement>('series-name'),
  seriesId: el('series-id'),
  checklist: el('checklist'),
  notices: el('notices'),
  status: el('status'),
  statusLabel: el('status-label'),
  buildBtn: el<HTMLButtonElement>('build-btn'),
  exportBtn: el<HTMLButtonElement>('export-btn'),
  seriesPicker: el<HTMLSelectElement>('series-picker'),
  seriesSummary: el('series-summary'),
  confirm: el('confirm'),
  exportEmpty: el('export-empty'),
  rescan: el<HTMLButtonElement>('rescan'),
  statusCount: el('status-count'),
  progress: el('progress'),
  progressBar: el<HTMLElement>('progress-bar'),
};

let state: BuildState = stateFromPreset('sermon-series');
/** Suppresses saving while the first render populates controls from storage. */
let hydrating = true;

/** Everything the last scan found, and which series the export tab is showing. */
let foundSeries: FoundSeries[] = [];
let activeSeriesId = '';
/** Frames the user has unchecked, by node id. Excluded without being deleted. */
const excluded = new Set<string>();
let scanned = false;
/** The chosen package folder while an export is running. */
let exportTarget: Awaited<ReturnType<typeof preparePackage>> | null = null;
let exporting = false;

function post(msg: UIToMain) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

function save() {
  if (hydrating) return;
  post({ type: 'save-state', state });
}

/* ---------------------------------------------------------------- rendering */

function renderPresets() {
  dom.preset.innerHTML = '';
  for (const preset of SHIPPED_PRESETS) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    dom.preset.appendChild(option);
  }
  dom.preset.value = state.presetId;
}

function checkedCount(section: Section): number {
  return deliverablesIn(section).filter((d) => state.rows[d.id].checked).length;
}

function renderGroupHead(section: Section, container: HTMLElement) {
  const all = deliverablesIn(section);
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
  meta.textContent = `${formatSize(d)} · ${formatSafe(d.safe)}`;
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
    for (const d of deliverablesIn(section)) renderRow(d, rows);
    group.appendChild(rows);
    dom.checklist.appendChild(group);
  }
}

function renderFooter() {
  const name = dom.seriesName.value.trim();
  const seriesId = toSeriesId(name);
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
  renderChecklist();
  renderFooter();
}

/* ------------------------------------------------------------------- export */

function activeSeries(): FoundSeries | undefined {
  return foundSeries.find((s) => s.seriesId === activeSeriesId) ?? foundSeries[0];
}

function renderSeriesPicker() {
  dom.seriesPicker.innerHTML = '';
  for (const series of foundSeries) {
    const option = document.createElement('option');
    option.value = series.seriesId;
    option.textContent = `${series.label} (${series.frames.length})`;
    dom.seriesPicker.appendChild(option);
  }
  const current = activeSeries();
  if (current) {
    activeSeriesId = current.seriesId;
    dom.seriesPicker.value = current.seriesId;
  }
}

function renderConfirmGroup(group: ConfirmGroup, clashes: Set<string>, container: HTMLElement) {
  const included = group.frames.filter((f) => !excluded.has(f.nodeId)).length;

  const wrap = document.createElement('div');
  wrap.className = 'confirm-group';

  const head = document.createElement('div');
  head.className = 'confirm-head';

  const check = document.createElement('label');
  check.className = 'check';
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = included === group.frames.length;
  toggle.indeterminate = included > 0 && included < group.frames.length;
  toggle.setAttribute('aria-label', `Include all ${group.label}`);
  const box = document.createElement('span');
  box.className = 'check-box';
  check.append(toggle, box);

  const title = document.createElement('span');
  title.className = 'confirm-title';
  title.textContent = group.label;

  const count = document.createElement('span');
  count.className = 'confirm-count';
  count.textContent = `${included} of ${group.frames.length}`;

  toggle.addEventListener('change', () => {
    for (const frame of group.frames) {
      if (toggle.checked) excluded.delete(frame.nodeId);
      else excluded.add(frame.nodeId);
    }
    renderExport();
  });

  head.append(check, title, count);
  wrap.appendChild(head);

  const rows = document.createElement('div');
  rows.className = 'rows';
  for (const frame of group.frames) {
    const on = !excluded.has(frame.nodeId);
    const row = document.createElement('div');
    row.className = on ? 'found on' : 'found';

    const rowCheck = document.createElement('label');
    rowCheck.className = 'check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = on;
    input.setAttribute('aria-label', frame.name);
    const rowBox = document.createElement('span');
    rowBox.className = 'check-box';
    rowCheck.append(input, rowBox);
    input.addEventListener('change', () => {
      if (input.checked) excluded.delete(frame.nodeId);
      else excluded.add(frame.nodeId);
      renderExport();
    });

    const text = document.createElement('div');
    text.className = 'found-text';
    // Clicking the name selects the frame in the file, so a surprising count is
    // something the user can go and look at rather than just read about.
    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'found-name';
    name.textContent = frame.name;
    name.title = 'Select this frame in the file';
    name.addEventListener('click', () => post({ type: 'select-node', nodeId: frame.nodeId }));
    const meta = document.createElement('span');
    meta.className = 'found-meta';
    meta.textContent = `${frame.pageName} · ${frame.group}`;
    text.append(name, meta);

    row.append(rowCheck, text);
    if (on && clashes.has(frame.name)) {
      const tag = document.createElement('span');
      tag.className = 'tag warn';
      tag.textContent = 'same name';
      tag.title = 'Another frame in this export has this name; one would overwrite the other';
      row.appendChild(tag);
    }
    if (frame.adopted) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = 'untagged';
      tag.title = 'Found inside the series section, but carries no tags of its own';
      row.appendChild(tag);
    }
    rows.appendChild(row);
  }
  wrap.appendChild(rows);
  container.appendChild(wrap);
}

function renderExport() {
  const series = activeSeries();
  dom.confirm.innerHTML = '';
  dom.exportEmpty.hidden = foundSeries.length > 0 || !scanned;

  if (!series) {
    dom.seriesSummary.textContent = scanned ? '' : 'Scanning the file…';
    dom.exportBtn.textContent = 'Export frames';
    dom.exportBtn.disabled = true;
    return;
  }

  const groups = groupForConfirm(series.frames);
  const includedFrames = series.frames.filter((f) => !excluded.has(f.nodeId));
  // Only frames actually going into the ZIP can collide inside it.
  const clashes = collidingNames(includedFrames);
  for (const group of groups) renderConfirmGroup(group, clashes, dom.confirm);

  const total = countFrames(groups);
  const included = includedFrames.length;
  const noun = total === 1 ? 'frame' : 'frames';
  dom.seriesSummary.textContent =
    total === included
      ? `${total} ${noun} tagged ${series.seriesId}`
      : `${included} of ${total} ${noun} tagged ${series.seriesId}`;

  if (clashes.size > 0) {
    const noun = clashes.size === 1 ? 'name is' : 'names are';
    showError(`${clashes.size} ${noun} used by more than one frame. Rename in the file before exporting.`);
  } else {
    showError('');
  }

  dom.exportBtn.textContent = included === 1 ? 'Export 1 frame' : `Export ${included} frames`;
  dom.exportBtn.disabled = exporting || included === 0 || clashes.size > 0;
  dom.exportBtn.title = clashes.size > 0 ? 'Two frames share a name; rename one first' : '';
}

/* ------------------------------------------------------------------ notices */

function showStatus(message: string, count = '') {
  dom.statusLabel.textContent = message;
  dom.statusCount.textContent = count;
  dom.status.hidden = !message;
  if (!message) dom.progress.hidden = true;
}

function showProgress(done: number, total: number, label: string) {
  showStatus(label, `${done} of ${total}`);
  dom.progress.hidden = false;
  dom.progressBar.style.width = `${total ? (done / total) * 100 : 0}%`;
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

/* -------------------------------------------------------------------- wiring */

function selectTab(which: 'build' | 'export') {
  const build = which === 'build';
  dom.tabBuild.classList.toggle('active', build);
  dom.tabExport.classList.toggle('active', !build);
  dom.tabBuild.setAttribute('aria-selected', String(build));
  dom.tabExport.setAttribute('aria-selected', String(!build));
  dom.panelBuild.hidden = !build;
  dom.panelExport.hidden = build;
  dom.buildBtn.hidden = !build;
  dom.exportBtn.hidden = build;
  // Opening the tab is itself a request for a current picture of the file.
  post({ type: 'watch-export', on: !build });
  if (!build) post({ type: 'scan' });
}

function closeMenu() {
  dom.settingsMenu.hidden = true;
  dom.settingsBtn.setAttribute('aria-expanded', 'false');
}

function buildItems(): BuildItem[] {
  const items: BuildItem[] = [];
  for (const d of DELIVERABLES) {
    const row = state.rows[d.id];
    if (row.checked) items.push({ deliverableId: d.id, quantity: clampQuantity(d, row.quantity) });
  }
  return items;
}

dom.tabBuild.addEventListener('click', () => selectTab('build'));
dom.tabExport.addEventListener('click', () => selectTab('export'));

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
  if (action === 'reset') {
    state = stateFromPreset(state.presetId === 'custom' ? 'sermon-series' : state.presetId);
    save();
    render();
  }
  closeMenu();
});

dom.seriesPicker.addEventListener('change', () => {
  activeSeriesId = dom.seriesPicker.value;
  renderExport();
});

dom.rescan.addEventListener('click', () => {
  scanned = false;
  post({ type: 'scan' });
});

dom.preset.addEventListener('change', () => {
  state = stateFromPreset(dom.preset.value);
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
  post({ type: 'build', seriesName, seriesId, items: buildItems() });
});

dom.exportBtn.addEventListener('click', async () => {
  const series = activeSeries();
  if (!series || exporting) return;
  const nodeIds = series.frames.filter((f) => !excluded.has(f.nodeId)).map((f) => f.nodeId);
  if (nodeIds.length === 0) return;

  showError('');
  let target;
  try {
    // Straight off the click: the picker needs user activation.
    target = await preparePackage(await pickFolder(), series.label);
  } catch (err) {
    if (err instanceof FolderCancelled) return;
    if (err instanceof FolderUnavailable) {
      showError(`Figma will not let the plugin choose a folder. ${err.message}`);
      return;
    }
    showError(err instanceof Error ? err.message : String(err));
    return;
  }

  exportTarget = target;
  exporting = true;
  renderExport();
  showProgress(0, nodeIds.length, 'Exporting');
  post({ type: 'export', nodeIds });
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
    case 'scanning':
      scanned = false;
      showStatus('Scanning the file…');
      break;
    case 'found': {
      foundSeries = msg.series;
      scanned = true;
      // Drop exclusions for frames that have since left the file.
      const live = new Set(foundSeries.flatMap((s) => s.frames.map((f) => f.nodeId)));
      for (const id of [...excluded]) if (!live.has(id)) excluded.delete(id);
      renderSeriesPicker();
      renderExport();
      showStatus('');
      break;
    }
    case 'progress':
      showProgress(msg.done, msg.total, msg.label);
      break;
    case 'export-file':
      void (async () => {
        try {
          if (!exportTarget) throw new Error('No destination folder.');
          await writeFile(exportTarget, msg.path, msg.bytes);
          post({ type: 'file-written' });
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          showError(`Could not write ${msg.path}. ${reason}`);
          post({ type: 'export-abort', reason });
          post({ type: 'file-written' });
        }
      })();
      break;
    case 'export-done': {
      exporting = false;
      exportTarget = null;
      const noun = msg.written === 1 ? 'file' : 'files';
      showStatus(`Exported ${msg.written} ${noun}.`);
      if (msg.failures.length > 0) {
        showError(
          `${msg.failures.length} did not export: ` +
            msg.failures.map((f) => `${f.name} (${f.reason})`).join(', '),
        );
      }
      renderExport();
      break;
    }
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
selectTab('build');
renderPresets();
render();
post({ type: 'ui-ready' });
