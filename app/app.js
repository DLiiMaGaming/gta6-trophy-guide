// Leonida Trophy Atlas: an offline checklist, roadmap and missable-flag guide for the
// 55 GTA VI PlayStation 5 trophies. All data comes from this app's own JSON files;
// progress lives in localStorage and can be exported to a file and imported back.
// Nothing here reaches the network.
const STORAGE_KEY = 'leonida-trophy-atlas-v1';
const SPOILER_KEY = 'leonida-trophy-atlas-spoilers';

const listEl = document.getElementById('trophy-list');
const missableEl = document.getElementById('missable-list');
const emptyNote = document.getElementById('empty-note');
const filterNote = document.getElementById('filter-note');
const searchInput = document.getElementById('search');
const kindSelect = document.getElementById('kind-filter');
const gradeSelect = document.getElementById('grade-filter');
const earnedOnlyBox = document.getElementById('earned-only');
const spoilerBox = document.getElementById('spoiler-toggle');
const savedNote = document.getElementById('saved-note');

const params = new URLSearchParams(location.search);
let earned = loadEarned();
let spoilersHidden = loadSpoilers();
let trophies = [];
let roadmap = null;

function loadEarned() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'string') : []);
  } catch {
    return new Set();
  }
}

function loadSpoilers() {
  try {
    if (params.get('spoilers') === 'on') return true;
    return localStorage.getItem(SPOILER_KEY) === '1';
  } catch {
    return false;
  }
}

function persistEarned() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...earned].sort()));
    savedNote.textContent = 'Saved just now.';
  } catch {
    savedNote.textContent = 'Could not save in this browser.';
  }
}

function persistSpoilers() {
  try {
    localStorage.setItem(SPOILER_KEY, spoilersHidden ? '1' : '0');
  } catch {
    // Spoiler preference is a nicety; the checklist itself still works.
  }
}

function gradeLabel(grade) {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

function kindLabel(kind) {
  return { story: 'Story', collectible: 'Collectible', activity: 'Activity', online: 'Online' }[kind] ?? kind;
}

function sourceLine(trophy) {
  if (!trophy.sources || trophy.sources.length === 0) return 'Sources: official trophy list.';
  const parts = trophy.sources.map((s) => (s.url ? { text: s.name, url: s.url } : { text: s.name }));
  return { label: 'Sources: ', parts };
}

function buildCard(trophy) {
  const card = document.createElement('article');
  card.className = 'trophy-card' + (earned.has(trophy.name) ? ' earned' : '');
  card.dataset.trophy = trophy.name;

  const top = document.createElement('div');
  top.className = 'card-top';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = earned.has(trophy.name);
  box.setAttribute('aria-label', `Mark ${trophy.name} as earned`);
  box.addEventListener('change', () => {
    if (box.checked) earned.add(trophy.name);
    else earned.delete(trophy.name);
    persistEarned();
    // A tick that changes what the card shows (a hidden trophy being revealed
    // by earning it, or a card leaving the earned-only filter) needs a fresh
    // render; anything else is a small update so the page never rebuilds the
    // list under the user's cursor.
    if ((spoilersHidden && trophy.hidden) || earnedOnlyBox.checked) {
      renderAll();
      return;
    }
    card.classList.toggle('earned', box.checked);
    renderProgress();
    renderRoadmap();
    renderMissables();
  });
  top.append(box);

  const titleWrap = document.createElement('div');
  const masked = spoilersHidden && trophy.hidden && !earned.has(trophy.name);
  if (masked) {
    const mask = document.createElement('div');
    mask.className = 'spoiler-mask';
    mask.textContent = 'Hidden trophy — earn it (or turn spoilers off) to reveal its name and description.';
    titleWrap.append(mask);
  } else {
    const nameEl = document.createElement('div');
    nameEl.className = 'trophy-name';
    nameEl.textContent = trophy.name;
    const descEl = document.createElement('p');
    descEl.className = 'trophy-desc';
    descEl.textContent = trophy.description;
    titleWrap.append(nameEl, descEl);
  }
  top.append(titleWrap);
  card.append(top);

  const badges = document.createElement('div');
  badges.className = 'badges';
  const gradeBadge = document.createElement('span');
  gradeBadge.className = `badge ${trophy.grade}`;
  gradeBadge.textContent = gradeLabel(trophy.grade);
  badges.append(gradeBadge);
  const kindBadge = document.createElement('span');
  kindBadge.className = 'badge kind';
  kindBadge.textContent = kindLabel(trophy.kind);
  badges.append(kindBadge);
  if (trophy.hidden) {
    const hiddenBadge = document.createElement('span');
    hiddenBadge.className = 'badge hidden-flag';
    hiddenBadge.textContent = 'Hidden on PS5';
    badges.append(hiddenBadge);
  }
  if (trophy.missable) {
    const missBadge = document.createElement('span');
    missBadge.className = 'badge missable';
    missBadge.textContent = 'Potentially missable';
    badges.append(missBadge);
  }
  card.append(badges);

  if (typeof trophy.count === 'number') {
    const countEl = document.createElement('p');
    countEl.className = 'count-line';
    countEl.textContent = `Target: ${trophy.count.toLocaleString('en-US')}`;
    card.append(countEl);
  }

  if (!masked) {
    const guideEl = document.createElement('p');
    guideEl.className = 'trophy-guide';
    guideEl.textContent = trophy.guide;
    card.append(guideEl);

    const src = document.createElement('p');
    src.className = 'sources';
    const built = sourceLine(trophy);
    if (typeof built === 'string') {
      src.textContent = built;
    } else {
      src.append(document.createTextNode(built.label));
      built.parts.forEach((part, i) => {
        if (i > 0) src.append(document.createTextNode(' · '));
        if (part.url) {
          const link = document.createElement('a');
          link.href = part.url;
          link.textContent = part.text;
          link.rel = 'noopener';
          src.append(link);
        } else {
          src.append(document.createTextNode(part.text));
        }
      });
    }
    card.append(src);
  }
  return card;
}

function trophyMatches(trophy) {
  const query = searchInput.value.trim().toLowerCase();
  if (query) {
    const hay = `${trophy.name} ${trophy.description} ${trophy.guide}`.toLowerCase();
    if (!hay.includes(query)) return false;
  }
  const kind = kindSelect.value;
  if (kind === 'missable') {
    if (!trophy.missable) return false;
  } else if (kind === 'online') {
    return false; // No online trophies: all 55 are single-player.
  } else if (kind !== 'all' && trophy.kind !== kind) {
    return false;
  }
  if (gradeSelect.value !== 'all' && trophy.grade !== gradeSelect.value) return false;
  if (earnedOnlyBox.checked && !earned.has(trophy.name)) return false;
  return true;
}

function renderProgress() {
  const total = trophies.length;
  const done = trophies.filter((t) => earned.has(t.name)).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById('earned-count').textContent = `${done} / ${total}`;
  document.getElementById('earned-percent').textContent = `${pct}% to the Platinum`;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  const byGrade = ['platinum', 'gold', 'silver', 'bronze'].map((g) => {
    const have = trophies.filter((t) => t.grade === g && earned.has(t.name)).length;
    const all = trophies.filter((t) => t.grade === g).length;
    return `${gradeLabel(g)} ${have}/${all}`;
  });
  document.getElementById('grade-counts').textContent = byGrade.join(' · ');
}

function renderChecklist() {
  listEl.replaceChildren();
  const shown = trophies.filter(trophyMatches);
  shown.forEach((t) => listEl.append(buildCard(t)));
  emptyNote.hidden = shown.length !== 0;
  if (kindSelect.value === 'online') {
    filterNote.textContent = 'No online trophies: all 55 trophies are single-player, so this filter is empty on purpose.';
  } else if (shown.length === 0) {
    filterNote.textContent = 'No trophies match these filters. Clear the search or change a filter.';
  } else {
    filterNote.textContent = `Showing ${shown.length} of ${trophies.length} trophies.`;
  }
}

function renderMissables() {
  missableEl.replaceChildren();
  trophies.filter((t) => t.missable).forEach((t) => missableEl.append(buildCard(t)));
}

function renderRoadmap() {
  const intro = document.getElementById('roadmap-intro');
  intro.textContent = roadmap.intro;
  const stagesEl = document.getElementById('roadmap-stages');
  stagesEl.replaceChildren();
  roadmap.stages.forEach((stage) => {
    const li = document.createElement('li');
    li.className = 'roadmap-stage';
    const heading = document.createElement('h3');
    heading.textContent = `Stage ${stage.n} — ${stage.title}`;
    const when = document.createElement('span');
    when.className = 'stage-when';
    when.textContent = stage.when;
    heading.append(when);
    const body = document.createElement('p');
    body.textContent = stage.body;
    const chips = document.createElement('ul');
    chips.className = 'roadmap-trophies';
    stage.trophies.forEach((name) => {
      const chip = document.createElement('li');
      chip.textContent = name + (earned.has(name) ? ' ✓' : '');
      if (earned.has(name)) chip.className = 'done';
      chips.append(chip);
    });
    li.append(heading, body, chips);
    stagesEl.append(li);
  });
}

function renderAll() {
  renderProgress();
  renderChecklist();
  renderMissables();
  if (roadmap) renderRoadmap();
}

function downloadFile(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportProgress() {
  downloadFile(
    'gta6-trophy-progress.json',
    JSON.stringify({ app: 'leonida-trophy-atlas', version: 1, earned: [...earned].sort() }, null, 2),
  );
  savedNote.textContent = 'Progress exported.';
}

async function importProgress(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const names = Array.isArray(parsed) ? parsed : parsed.earned;
    if (!Array.isArray(names)) throw new Error('not a progress file');
    const known = new Set(trophies.map((t) => t.name));
    earned = new Set(names.filter((n) => typeof n === 'string' && known.has(n)));
    persistEarned();
    renderAll();
    savedNote.textContent = `Imported ${earned.size} earned trophies.`;
  } catch {
    savedNote.textContent = 'That file is not a valid progress export.';
  }
}

async function boot() {
  spoilerBox.checked = spoilersHidden;
  const [trophyDoc, roadmapDoc] = await Promise.all([
    fetch('data/trophies.json').then((r) => r.json()),
    fetch('data/roadmap.json').then((r) => r.json()),
  ]);
  trophies = trophyDoc.trophies;
  roadmap = roadmapDoc;
  renderAll();

  searchInput.addEventListener('input', renderChecklist);
  kindSelect.addEventListener('change', renderChecklist);
  gradeSelect.addEventListener('change', renderChecklist);
  earnedOnlyBox.addEventListener('change', renderChecklist);
  spoilerBox.addEventListener('change', () => {
    spoilersHidden = spoilerBox.checked;
    persistSpoilers();
    renderAll();
  });
  document.getElementById('export-btn').addEventListener('click', exportProgress);
  document.getElementById('import-input').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) importProgress(file);
    event.target.value = '';
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (window.confirm('Clear every tick on the checklist?')) {
      earned = new Set();
      persistEarned();
      renderAll();
      savedNote.textContent = 'Checklist reset.';
    }
  });

  // Deep link: ?trophy=<name> scrolls to that trophy's card; ?view=roadmap jumps to the roadmap.
  const focusName = params.get('trophy');
  if (focusName) {
    const card = listEl.querySelector(`[data-trophy="${CSS.escape(focusName)}"]`);
    if (card) card.scrollIntoView({ block: 'start' });
  } else if (params.get('view') === 'roadmap') {
    document.getElementById('roadmap').scrollIntoView();
  }
}

boot().catch((error) => {
  listEl.replaceChildren();
  const note = document.createElement('p');
  note.className = 'empty-note';
  note.textContent = `The guide data could not be loaded (${error.message}). Serve the app/ folder over HTTP and reload.`;
  listEl.append(note);
});
