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
import type { BuildItem, MainToUI, UIToMain } from '../core/messages';
import { SHIPPED_PRESETS } from '../core/presets';
import { frameCount, stateFromPreset, type BuildState } from '../core/state';
import { toSeriesId } from '../core/slug';

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
selectTab('build');
renderPresets();
render();
post({ type: 'ui-ready' });
