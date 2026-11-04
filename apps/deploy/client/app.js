import { deployText as t } from '@vocespace/i18n/deploy';

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="topbar"><a class="brand" href="/"><span class="brand-mark">V</span>${t.brand}<span class="product">DEPLOY</span></a><button id="logout" class="quiet" hidden>${t.logout}</button></header>
  <main>
    <section id="login" class="login-card"><div class="eyebrow">DEPLOY CONSOLE</div><h1>${t.loginTitle}</h1><p>${t.loginHint}</p><form id="login-form"><label for="token">${t.token}</label><input id="token" type="password" autocomplete="current-password" required maxlength="4096"><button class="primary" type="submit">${t.login}</button></form><p id="login-error" class="error" role="alert"></p></section>
    <section id="workspace" hidden>
      <div class="page-heading"><div><div class="eyebrow">RELEASE MANAGEMENT</div><h1>${t.title}</h1><p>${t.intro}</p></div><button id="refresh" class="secondary">${t.refresh}</button></div>
      <div id="notice" role="status" class="notice" hidden></div>
      <div id="services" class="services"></div>
      <div class="work-grid">
        <section class="panel publish-panel"><div class="panel-heading"><h2>${t.create}</h2><span class="pill">${t.only}</span></div>
          <div class="mode-tabs" role="group"><button id="create-mode" class="selected" aria-pressed="true">${t.create}</button><button id="update-mode" aria-pressed="false">${t.update}</button></div>
          <p id="mode-hint" class="hint">${t.createHint}</p>
          <form id="publish-form"><label for="project">${t.project}</label><select id="project"><option value="web">Web</option><option value="api">Server</option><option value="platform">Platform</option></select><label for="version">${t.version}</label><input id="version" required maxlength="80" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}" placeholder="web-002" autocomplete="off"><p class="hint small">${t.versionHint}</p><button id="publish" type="submit" class="primary">${t.submit}<span aria-hidden="true">↗</span></button></form>
        </section>
        <section class="panel log-panel"><div class="panel-heading"><h2>${t.history}</h2><span class="live-dot">${t.live}</span></div><div class="log-toolbar"><select id="jobs" aria-label="${t.history}"></select><label class="scroll-label"><input id="follow" type="checkbox" checked>${t.autoScroll}</label></div><div id="job-info" class="job-info"></div><pre id="log" tabindex="0" aria-label="${t.history}">${t.chooseJob}</pre></section>
      </div>
      <section class="panel versions-panel"><div class="panel-heading"><div><h2>${t.releases}</h2><p class="hint">${t.releaseHint}</p></div><span id="release-count" class="pill">0</span></div><div class="table-wrap"><table><thead><tr><th>${t.version}</th><th>${t.project}</th><th>${t.built}</th><th>${t.state}</th><th>${t.actions}</th></tr></thead><tbody id="versions"></tbody></table></div></section>
    </section>
  </main><footer>VoceSpace · Deploy</footer>`;
const $ = (selector) => document.querySelector(selector);
const element = (tag, className = '', text = '') => {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
};
const displayTime = (value) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
const actionLabel = (action) => ({ create: t.create, update: t.update, rollback: t.rollbackAction, delete: t.deleteAction })[action];
let authenticated = false;
let mode = 'create';
let selectedJob = null;
let busy = false;
let pending = false;
let timer;
let generation = 0;
let previousState = '';
let refreshing = false;
let suspended = false;

async function request(url, data) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...(data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || t.error), { status: response.status });
  return result;
}
function notice(message = '', error = false) {
  $('#notice').textContent = message; $('#notice').hidden = !message; $('#notice').classList.toggle('error', error);
}
function showLogin() {
  authenticated = false; generation++; clearTimeout(timer);
  $('#workspace').hidden = true; $('#logout').hidden = true; $('#login').hidden = false;
  $('#token').value = ''; previousState = '';
}
function enter() {
  authenticated = true; generation++;
  $('#login').hidden = true; $('#workspace').hidden = false; $('#logout').hidden = false;
  refresh();
}
function setDisabled() {
  $('#publish').disabled = busy || pending;
  document.querySelectorAll('[data-operation]').forEach((button) => { button.disabled = busy || pending; });
}
function render(state) {
  busy = !!state.active;
  if (!selectedJob && state.jobs.length) selectedJob = state.active || state.jobs[0].id;
  $('#services').replaceChildren(...['web', 'api', 'platform'].map((project) => {
    const card = element('article', 'service-card');
    const label = element('div', 'service-label', t[project]); label.prepend(element('span', `service-icon ${project}`, project === 'web' ? 'W' : project === 'platform' ? 'P' : 'S'));
    const current = element('div', 'service-version', state.projects[project].current || t.empty);
    const foot = element('div', 'service-foot', `${t.previous} · ${state.projects[project].previous || '—'}`);
    card.append(label, element('span', 'hint small', t.current), current, foot); return card;
  }));
  $('#release-count').textContent = String(state.versions.length);
  const rows = state.versions.map((version) => {
    const row = element('tr');
    row.append(element('td', 'version-name', version.name), element('td', '', version.projects.map((p) => t[p]).join(' / ') || '—'), element('td', 'date', displayTime(version.builtAt)));
    const badges = element('td');
    if (version.current.length) badges.append(element('span', 'badge active', `${t.active} · ${version.current.map((p) => t[p]).join('/')}`));
    if (version.previous.length) badges.append(element('span', 'badge retained', t.retained));
    if (!version.protected) badges.append(element('span', `badge ${version.ready ? '' : 'warning'}`, version.ready ? t.ready : t.incomplete));
    const actions = element('td', 'row-actions');
    if (version.ready) for (const project of version.projects.filter((p) => !version.current.includes(p))) {
      const button = element('button', 'secondary compact', `${t.rollback} · ${t[project]}`); button.dataset.operation = 'true';
      button.addEventListener('click', () => submit('rollback', project, version.name, t.rollbackConfirm)); actions.append(button);
    }
    if (!version.protected) {
      const button = element('button', 'danger compact', t.remove); button.dataset.operation = 'true';
      button.addEventListener('click', () => submit('delete', version.projects[0] || 'web', version.name, t.deleteConfirm)); actions.append(button);
    }
    if (!actions.childNodes.length) actions.textContent = '—';
    row.append(badges, actions); return row;
  });
  if (!rows.length) { const row = element('tr'); const cell = element('td', 'empty', t.noReleases); cell.colSpan = 5; row.append(cell); rows.push(row); }
  $('#versions').replaceChildren(...rows);
  $('#jobs').replaceChildren(...(state.jobs.length ? state.jobs.map((job) => {
    const option = element('option', '', `${actionLabel(job.action)} · ${t[job.project]} / ${job.version} · ${t[job.status]}`); option.value = job.id; return option;
  }) : [element('option', '', t.noJobs)]));
  if (selectedJob) $('#jobs').value = selectedJob;
  setDisabled();
}
async function loadLog(epoch) {
  if (!selectedJob) return;
  const id = selectedJob;
  const job = await request(`/api/jobs/${id}`);
  if (epoch !== generation || id !== selectedJob) return;
  $('#job-info').replaceChildren(element('span', `badge ${job.status}`, t[job.status]), element('span', 'hint small', `${t.started} ${displayTime(job.startedAt || job.createdAt)}${job.finishedAt ? ` · ${t.finished} ${displayTime(job.finishedAt)}` : ''}`));
  const text = job.log || job.error || t.logsEmpty;
  if ($('#log').textContent !== text) {
    $('#log').textContent = text;
    if ($('#follow').checked) $('#log').scrollTop = $('#log').scrollHeight;
  }
}
async function refresh() {
  clearTimeout(timer);
  if (!authenticated || suspended || refreshing) return;
  refreshing = true;
  const epoch = generation;
  try {
    const state = await request('/api/state');
    if (epoch !== generation) return;
    const serialized = JSON.stringify(state);
    if (serialized !== previousState) { previousState = serialized; render(state); }
    notice(state.active ? t.busy : '');
    await loadLog(epoch);
  } catch (error) {
    if (epoch !== generation) return;
    if (error.status === 401) { showLogin(); return; }
    notice(error.message, true);
  } finally {
    refreshing = false;
    if (authenticated && !suspended) timer = setTimeout(refresh, epoch === generation ? 1500 : 0);
  }
}
async function submit(action, project, version, confirmation) {
  if (busy || pending || (confirmation && !window.confirm(`${confirmation}\n\n${t[project]} / ${version}`))) return;
  pending = true; setDisabled();
  try {
    const job = await request('/api/jobs', { action, project, version });
    selectedJob = job.id; previousState = ''; notice(t.busy);
    await refresh();
  } catch (error) { if (error.status === 401) showLogin(); else notice(error.message, true); }
  finally { pending = false; setDisabled(); }
}
$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
  try { await request('/api/login', { hostToken: $('#token').value }); $('#token').value = ''; $('#login-error').textContent = ''; enter(); }
  catch (error) { $('#login-error').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#logout').addEventListener('click', async () => {
  try { await request('/api/logout', {}); showLogin(); }
  catch (error) { notice(error.message, true); }
});
for (const action of ['create', 'update']) $(`#${action}-mode`).addEventListener('click', () => {
  mode = action; $('.publish-panel h2').textContent = t[action]; $('#mode-hint').textContent = t[`${action}Hint`];
  for (const option of ['create', 'update']) { $(`#${option}-mode`).classList.toggle('selected', option === action); $(`#${option}-mode`).setAttribute('aria-pressed', String(option === action)); }
});
$('#project').addEventListener('change', () => { $('#version').placeholder = `${$('#project').value}-002`; });
$('#publish-form').addEventListener('submit', (event) => { event.preventDefault(); submit(mode, $('#project').value, $('#version').value.trim()); });
$('#jobs').addEventListener('change', () => { selectedJob = $('#jobs').value; refresh(); });
$('#refresh').addEventListener('click', () => { previousState = ''; refresh(); });
window.addEventListener('pagehide', () => { suspended = true; generation++; clearTimeout(timer); });
window.addEventListener('pageshow', (event) => { suspended = false; if (event.persisted && authenticated) refresh(); });
request('/api/session').then(enter).catch(() => showLogin());
