// Main application logic module for Leonida Trophy Guide v3

const STORAGE_KEY = 'leonida-trophy-guide-v1';

let trophiesData = null;
let roadmapData = null;

let state = {
  version: 1,
  earned: [],
  counts: {},
  spoiler: false
};

let selectedTrophyName = null;
let activeTab = 'checklist';

// Retrieve saved user progression data from browser local storage
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state.earned = Array.isArray(parsed.earned) ? parsed.earned : [];
        state.counts = parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {};
        state.spoiler = !!parsed.spoiler;
      }
    }
  } catch (err) {
    console.error('Failed to load progress from localStorage:', err);
  }
}

// Save state to localStorage
function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save progress to localStorage:', err);
  }
}

// Retrieve local JSON datasets for trophies and roadmap
async function loadData() {
  try {
    const [tRes, rRes] = await Promise.all([
      fetch('data/trophies.json'),
      fetch('data/roadmap.json')
    ]);
    trophiesData = await tRes.json();
    roadmapData = await rRes.json();
  } catch (err) {
    console.error('Failed to fetch data files:', err);
  }
}

// Helper: check if trophy is earned
function isEarned(name) {
  return state.earned.includes(name);
}

// Toggle trophy earned status
function toggleEarned(name, forceValue) {
  const earnedSet = new Set(state.earned);
  const shouldEarn = forceValue !== undefined ? forceValue : !earnedSet.has(name);
  if (shouldEarn) {
    earnedSet.add(name);
  } else {
    earnedSet.delete(name);
  }
  state.earned = [...earnedSet];
  saveProgress();
  renderAll();
}

// Set numeric count for a trophy target
function setCount(name, val) {
  const trophy = trophiesData.trophies.find(t => t.name === name);
  if (!trophy || !trophy.target) return;
  const num = Math.max(0, parseInt(val, 10) || 0);
  state.counts[name] = num;

  // Check/uncheck when reaching or dropping below target
  if (num >= trophy.target) {
    if (!isEarned(name)) {
      toggleEarned(name, true);
    }
  } else {
    if (isEarned(name)) {
      toggleEarned(name, false);
    }
  }
  saveProgress();
  renderAll();
}

// Render header counts, chips, and progress bar
function renderHeader() {
  if (!trophiesData) return;
  const trophies = trophiesData.trophies;
  const total = trophies.length;
  const earnedCount = state.earned.length;
  const pct = Math.round((earnedCount / total) * 100);

  // Subtitle
  const counts = trophiesData.counts;
  const sub = document.getElementById('subtitle');
  if (sub) {
    sub.textContent = `${total} trophies: ${counts.platinum} platinum, ${counts.gold} gold, ${counts.silver} silver, ${counts.bronze} bronze, ${counts.online} online — all offline single-player`;
  }

  // Progress bar & text
  const fill = document.getElementById('progress-bar-fill');
  const pText = document.getElementById('progress-text');
  if (fill) fill.style.width = `${pct}%`;
  if (pText) pText.textContent = `${earnedCount} of ${total} earned (${pct}%)`;

  // Header chips: steps cited & sources count
  let totalSteps = 0;
  const distinctSources = new Set();
  trophies.forEach(t => {
    if (t.steps) totalSteps += t.steps.length;
    if (t.sources) t.sources.forEach(s => distinctSources.add(s.name));
  });

  const headerChips = document.getElementById('header-chips');
  if (headerChips) {
    headerChips.replaceChildren();
    const c1 = document.createElement('div');
    c1.className = 'chip';
    c1.textContent = `${totalSteps} steps cited`;
    const c2 = document.createElement('div');
    c2.className = 'chip';
    c2.textContent = `${distinctSources.size} sources`;
    headerChips.append(c1, c2);
  }

  // Per-kind mini-counts (keys EXACTLY equal to kind strings: story, missable, collectible, activity, platinum)
  const kindMap = {};
  trophies.forEach(t => {
    const k = t.kind || 'story';
    kindMap[k] = (kindMap[k] || 0) + 1;
  });

  const kindCountsContainer = document.getElementById('kind-counts');
  if (kindCountsContainer) {
    kindCountsContainer.replaceChildren();
    ['story', 'missable', 'collectible', 'activity', 'platinum'].forEach(k => {
      if (kindMap[k] !== undefined) {
        const chip = document.createElement('div');
        chip.className = 'kind-chip';
        chip.innerHTML = `${k}: <span>${kindMap[k]}</span>`;
        kindCountsContainer.append(chip);
      }
    });
  }
}

// Render audit strip on Checklist tab
function renderAuditStrip() {
  if (!trophiesData || !roadmapData) return;
  const trophies = trophiesData.trophies;
  const total = trophies.length;
  
  let platinum = 0, gold = 0, silver = 0, bronze = 0, missables = 0;
  let hidden = trophiesData.counts && trophiesData.counts.hidden !== undefined ? trophiesData.counts.hidden : 28;
  let totalSteps = 0;
  const distinctSources = new Set();
  let citedCount = 0;

  trophies.forEach(t => {
    if (t.grade === 'platinum') platinum++;
    if (t.grade === 'gold') gold++;
    if (t.grade === 'silver') silver++;
    if (t.grade === 'bronze') bronze++;
    if (t.missable) missables++;
    if (t.steps) totalSteps += t.steps.length;
    if (t.sources && t.sources.length > 0) citedCount++;
    if (t.sources) t.sources.forEach(s => distinctSources.add(s.name));
  });

  const stageCount = roadmapData.stages ? roadmapData.stages.length : 0;

  const auditStrip = document.getElementById('audit-strip');
  if (auditStrip) {
    auditStrip.replaceChildren();
    const chipsData = [
      `${total} trophies`,
      `${platinum}P · ${gold}G · ${silver}S · ${bronze}B`,
      `${hidden} hidden`,
      `${citedCount}/${total} cited`,
      `${totalSteps} steps`,
      `${distinctSources.size} sources`,
      `${missables} missable`,
      `${stageCount} stages`
    ];

    chipsData.forEach(text => {
      const chip = document.createElement('div');
      chip.className = 'audit-chip';
      chip.textContent = text;
      auditStrip.append(chip);
    });
  }
}

// Render Checklist trophy list
function renderList() {
  if (!trophiesData) return;
  const ul = document.getElementById('trophy-list');
  if (!ul) return;
  ul.replaceChildren();

  const searchVal = (document.getElementById('search')?.value || '').toLowerCase();
  const kindVal = document.getElementById('kind-filter')?.value || 'all';
  const gradeVal = document.getElementById('grade-filter')?.value || 'all';
  const earnedOnly = document.getElementById('earned-only')?.checked || false;

  trophiesData.trophies.forEach(t => {
    // Filters
    if (gradeVal !== 'all' && t.grade !== gradeVal) return;
    if (kindVal !== 'all' && t.kind !== kindVal) return;
    if (earnedOnly && !isEarned(t.name)) return;

    if (searchVal) {
      const matchName = t.name.toLowerCase().includes(searchVal);
      const matchDesc = t.description.toLowerCase().includes(searchVal);
      const matchGuide = t.guide.toLowerCase().includes(searchVal);
      if (!matchName && !matchDesc && !matchGuide) return;
    }

    const li = document.createElement('li');
    li.className = 'trophy-row';
    if (selectedTrophyName === t.name) {
      li.classList.add('selected');
    }

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'trophy-checkbox';
    checkbox.checked = isEarned(t.name);
    checkbox.addEventListener('click', (e) => e.stopPropagation());
    checkbox.addEventListener('change', () => {
      toggleEarned(t.name, checkbox.checked);
    });

    // Medal dot
    const dot = document.createElement('div');
    dot.className = `medal-dot ${t.grade}`;

    // Info wrapper
    const info = document.createElement('div');
    info.className = 'trophy-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'trophy-title-row';

    // Spoiler shield check
    const isHiddenStory = t.kind === 'story' && state.spoiler && !isEarned(t.name);
    const displayName = isHiddenStory ? 'Hidden story trophy' : t.name;
    const displayDesc = isHiddenStory ? 'Earn this trophy to reveal its name and description.' : t.description;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'trophy-name';
    nameSpan.textContent = displayName;
    titleRow.append(nameSpan);

    // Kind badge
    const kindBadge = document.createElement('span');
    kindBadge.className = 'badge kind';
    kindBadge.textContent = t.kind;
    titleRow.append(kindBadge);

    // Missable badge
    if (t.missable) {
      const missBadge = document.createElement('span');
      missBadge.className = 'badge missable';
      missBadge.textContent = 'Missable';
      titleRow.append(missBadge);
    }

    info.append(titleRow);

    const descDiv = document.createElement('div');
    descDiv.className = 'trophy-desc';
    descDiv.textContent = displayDesc;
    info.append(descDiv);

    li.append(checkbox, dot, info);

    // Target text if any
    if (t.target) {
      const currentCount = state.counts[t.name] || 0;
      const targetSpan = document.createElement('span');
      targetSpan.className = 'trophy-target';
      targetSpan.textContent = `${currentCount} / ${t.target} ${t.target_label || ''}`;
      li.append(targetSpan);
    }

    // Row click selects trophy
    li.addEventListener('click', () => {
      selectedTrophyName = t.name;
      renderList();
      renderDetail();
    });

    ul.append(li);
  });
}

// Render Detail Pane
function renderDetail() {
  const pane = document.getElementById('detail-pane');
  if (!pane) return;

  if (!selectedTrophyName || !trophiesData) {
    pane.innerHTML = '<div class="detail-placeholder">Select a trophy from the list to view its guide, steps, and sources.</div>';
    return;
  }

  const t = trophiesData.trophies.find(item => item.name === selectedTrophyName);
  if (!t) {
    pane.innerHTML = '<div class="detail-placeholder">Trophy not found.</div>';
    return;
  }

  const isHiddenStory = t.kind === 'story' && state.spoiler && !isEarned(t.name);
  const displayName = isHiddenStory ? 'Hidden story trophy' : t.name;
  const displayDesc = isHiddenStory ? 'Earn this trophy to reveal its name and description.' : t.description;
  const displayGuide = isHiddenStory ? 'Earn this trophy to reveal its guide.' : t.guide;

  pane.replaceChildren();

  // Header: medal dot & grade
  const header = document.createElement('div');
  header.className = 'detail-header';
  const dot = document.createElement('div');
  dot.className = `medal-dot ${t.grade}`;
  const gradeSpan = document.createElement('span');
  gradeSpan.className = 'detail-grade';
  gradeSpan.textContent = `${t.grade} trophy`;
  header.append(dot, gradeSpan);
  pane.append(header);

  // Name
  const nameEl = document.createElement('h2');
  nameEl.className = 'detail-name';
  nameEl.textContent = displayName;
  pane.append(nameEl);

  // Description
  const descEl = document.createElement('p');
  descEl.className = 'detail-desc';
  descEl.textContent = displayDesc;
  pane.append(descEl);

  // Badges
  const badgesDiv = document.createElement('div');
  badgesDiv.className = 'detail-badges';
  const kindB = document.createElement('span');
  kindB.className = 'badge kind';
  kindB.textContent = t.kind;
  badgesDiv.append(kindB);
  if (t.missable) {
    const missB = document.createElement('span');
    missB.className = 'badge missable';
    missB.textContent = 'Missable';
    badgesDiv.append(missB);
  }
  pane.append(badgesDiv);

  // Missable reason box
  if (t.missable && t.missable_reason) {
    const missBox = document.createElement('div');
    missBox.className = 'missable-box';
    missBox.innerHTML = `<strong>Missable warning:</strong> ${t.missable_reason}`;
    pane.append(missBox);
  }

  // Target stepper if numeric target
  if (t.target) {
    const curVal = state.counts[t.name] || 0;
    const stepper = document.createElement('div');
    stepper.className = 'target-stepper';

    const label = document.createElement('span');
    label.style.flex = '1';
    label.style.fontSize = '0.9rem';
    label.textContent = `${t.target_label || 'Progress'}:`;

    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.textContent = '-';
    minusBtn.addEventListener('click', () => {
      setCount(t.name, curVal - 1);
    });

    const input = document.createElement('input');
    input.type = 'number';
    input.value = curVal;
    input.min = '0';
    input.max = t.target;
    input.addEventListener('change', () => {
      setCount(t.name, input.value);
    });

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      setCount(t.name, curVal + 1);
    });

    const maxLabel = document.createElement('span');
    maxLabel.style.fontSize = '0.85rem';
    maxLabel.style.color = 'var(--text-muted)';
    maxLabel.textContent = `/ ${t.target}`;

    stepper.append(label, minusBtn, input, plusBtn, maxLabel);
    pane.append(stepper);
  }

  // Guide text
  const guideEl = document.createElement('div');
  guideEl.className = 'detail-guide';
  guideEl.textContent = displayGuide;
  pane.append(guideEl);

  // Steps section
  if (t.steps && t.steps.length > 0 && !isHiddenStory) {
    const stepsTitle = document.createElement('h3');
    stepsTitle.className = 'detail-section-title';
    stepsTitle.textContent = 'Steps';
    pane.append(stepsTitle);

    const stepsOl = document.createElement('ol');
    stepsOl.className = 'steps-list';
    t.steps.forEach(step => {
      const li = document.createElement('li');
      const textSpan = document.createElement('span');
      textSpan.textContent = `${step.text} — `;
      li.append(textSpan);

      // Find matching source URL
      const sourceObj = t.sources && t.sources.find(s => s.name === step.source);
      const sourceUrl = sourceObj ? sourceObj.url : '#';

      const a = document.createElement('a');
      a.href = sourceUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = step.source;
      li.append(a);

      stepsOl.append(li);
    });
    pane.append(stepsOl);
  }

  // Sources list section
  if (t.sources && t.sources.length > 0 && !isHiddenStory) {
    const sourcesTitle = document.createElement('h3');
    sourcesTitle.className = 'detail-section-title';
    sourcesTitle.textContent = 'Sources';
    pane.append(sourcesTitle);

    const sourcesUl = document.createElement('ul');
    sourcesUl.className = 'sources-list';
    t.sources.forEach(src => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = src.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = src.name;

      const coversSpan = document.createElement('span');
      coversSpan.textContent = `: ${src.covers}`;
      li.append(a, coversSpan);
      sourcesUl.append(sourcesUl.append ? li : li);
      sourcesUl.appendChild(li);
    });
    pane.append(sourcesUl);
  }
}

// Render Roadmap Tab
function renderRoadmap() {
  const container = document.getElementById('roadmap-container');
  if (!container || !roadmapData || !trophiesData) return;

  container.replaceChildren();

  // Overview card
  const overview = document.createElement('div');
  overview.className = 'roadmap-overview';
  const h2 = document.createElement('h2');
  h2.textContent = roadmapData.title || 'Road to the Platinum';
  const p = document.createElement('p');
  p.textContent = 'A comprehensive 7-stage roadmap to earn all 55 trophies in Grand Theft Auto VI.';
  
  const metaChips = document.createElement('div');
  metaChips.className = 'roadmap-meta-chips';
  ['Difficulty: ' + roadmapData.difficulty, 'Time: ' + roadmapData.hours, 'Playthroughs: ' + roadmapData.playthroughs].forEach(text => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = text;
    metaChips.append(chip);
  });

  overview.append(h2, p, metaChips);
  container.append(overview);

  // Stages
  if (roadmapData.stages) {
    roadmapData.stages.forEach(stage => {
      const card = document.createElement('div');
      card.className = 'roadmap-stage-card';

      const header = document.createElement('div');
      header.className = 'roadmap-stage-header';
      const stageTitle = document.createElement('h3');
      stageTitle.className = 'roadmap-stage-title';
      stageTitle.textContent = `Stage ${stage.number}: ${stage.title}`;
      const hoursEl = document.createElement('span');
      hoursEl.className = 'roadmap-stage-hours';
      hoursEl.textContent = stage.hours;
      header.append(stageTitle, hoursEl);
      card.append(header);

      const summaryEl = document.createElement('p');
      summaryEl.className = 'roadmap-stage-summary';
      summaryEl.textContent = stage.summary;
      card.append(summaryEl);

      // Per-stage progress count
      const stageTrophies = stage.trophy_names || [];
      const earnedInStage = stageTrophies.filter(name => isEarned(name)).length;
      const progLine = document.createElement('div');
      progLine.className = 'roadmap-stage-progress';
      progLine.textContent = `${earnedInStage} of ${stageTrophies.length} earned in this stage`;
      card.append(progLine);

      // Trophy chips
      const trophiesDiv = document.createElement('div');
      trophiesDiv.className = 'roadmap-stage-trophies';
      stageTrophies.forEach(tName => {
        const tObj = trophiesData.trophies.find(tr => tr.name === tName);
        const grade = tObj ? tObj.grade : 'bronze';

        const tChip = document.createElement('div');
        tChip.className = 'roadmap-trophy-chip';
        const dot = document.createElement('div');
        dot.className = `medal-dot ${grade}`;
        const nameSpan = document.createElement('span');
        nameSpan.textContent = tName;
        tChip.append(dot, nameSpan);
        trophiesDiv.append(tChip);
      });
      card.append(trophiesDiv);

      if (stage.tip) {
        const tipEl = document.createElement('div');
        tipEl.className = 'roadmap-stage-tip';
        tipEl.textContent = `Tip: ${stage.tip}`;
        card.append(tipEl);
      }

      container.append(card);
    });
  }

  // Platinum card below stages (must NOT repeat playthroughs line)
  const platTrophy = trophiesData.trophies.find(t => t.kind === 'platinum');
  const platCard = document.createElement('div');
  platCard.className = 'platinum-card';
  const platTitle = document.createElement('h3');
  platTitle.textContent = platTrophy ? platTrophy.name : 'Vice Got a Price!';
  const platDesc = document.createElement('p');
  platDesc.textContent = 'Earn the other 54 trophies to unlock the Platinum trophy.';
  
  const platCheck = document.createElement('div');
  platCheck.style.marginTop = '12px';
  platCheck.style.fontWeight = 'bold';
  platCheck.style.color = isEarned(platTitle.textContent) ? '#2ecc71' : 'var(--coral-amber)';
  platCheck.textContent = isEarned(platTitle.textContent) ? '✓ Platinum Earned!' : 'Status: In Progress';

  platCard.append(platTitle, platDesc, platCheck);
  container.append(platCard);
}

// Render Missables Tab
function renderMissables() {
  const container = document.getElementById('missables-container');
  if (!container || !trophiesData) return;

  container.replaceChildren();

  // Find missable trophies
  const missables = trophiesData.trophies.filter(t => t.missable);

  // Hero card for Positive Mental Attitude
  const hero = document.createElement('div');
  hero.className = 'missables-hero';
  const h2 = document.createElement('h2');
  h2.textContent = 'Missable Trophies Warning';
  const p = document.createElement('p');
  p.textContent = 'Grand Theft Auto VI features open-world freedom for almost every achievement, but one specific trophy requires strict vigilance during early campaign chapters.';

  hero.append(h2, p);

  missables.forEach(t => {
    const card = document.createElement('div');
    card.style.backgroundColor = 'var(--bg-input)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderRadius = '8px';
    card.style.padding = '20px';
    card.style.marginTop = '16px';

    const tHeader = document.createElement('div');
    tHeader.style.display = 'flex.s';
    tHeader.style.alignItems = 'center';
    tHeader.style.gap = '10px';
    tHeader.style.marginBottom = '8px';

    const dot = document.createElement('div');
    dot.className = `medal-dot ${t.grade}`;
    const nameEl = document.createElement('h3');
    nameEl.style.fontFamily = 'Georgia, serif';
    nameEl.style.fontSize = '1.3rem';
    nameEl.textContent = t.name;
    tHeader.append(dot, nameEl);
    card.append(tHeader);

    const reasonEl = document.createElement('div');
    reasonEl.className = 'missable-box';
    reasonEl.innerHTML = `<strong>Missable Reason:</strong> ${t.missable_reason}`;
    card.append(reasonEl);

    const guideEl = document.createElement('p');
    guideEl.style.color = 'var(--text-muted)';
    guideEl.style.fontSize = '0.95rem';
    guideEl.textContent = t.guide;
    card.append(guideEl);

    hero.append(card);
  });

  // Save advice box
  const saveBox = document.createElement('div');
  saveBox.className = 'save-advice-box';
  saveBox.innerHTML = `<strong>Save Advice:</strong> The game features no mission replay option and supports manual saves across 15 slots plus 1 autosave slot. To safeguard against missed achievements, always keep a dedicated manual save at the start and end of each chapter.`;
  hero.append(saveBox);

  container.append(hero);

  // Reassurance list stating every other trophy stays available in free-roam
  const reassurance = document.createElement('div');
  reassurance.className = 'reassurance-list';
  const rTitle = document.createElement('h3');
  rTitle.textContent = 'Free-Roam Availability Reassurance';
  reassurance.append(rTitle);

  const rDesc = document.createElement('p');
  rDesc.style.color = 'var(--text-muted)';
  rDesc.style.marginBottom = '16px';
  rDesc.textContent = 'Every other trophy in Leonida remains fully accessible in free-roam after completing the storyline. Below is the confirmation for non-missable trophies:';
  reassurance.append(rDesc);

  trophiesData.trophies.filter(t => !t.missable && t.kind !== 'platinum').forEach(t => {
    const item = document.createElement('div');
    item.className = 'reassurance-item';
    item.innerHTML = `<strong>${t.name}</strong> (${t.grade}): ${t.missable_reason || 'Available in free-roam after story completion.'}`;
    reassurance.append(item);
  });

  container.append(reassurance);
}

// Render Sources Tab
function renderSources() {
  const container = document.getElementById('sources-container');
  if (!container || !trophiesData || !roadmapData) return;

  container.replaceChildren();

  const wrap = document.createElement('div');
  wrap.className = 'sources-container';

  const h2 = document.createElement('h2');
  h2.style.fontFamily = 'Georgia, serif';
  h2.style.fontSize = '1.8rem';
  h2.style.marginBottom = '16px';
  h2.textContent = 'Source Matrix & Methodology';

  const p = document.createElement('p');
  p.style.color = 'var(--text-muted)';
  p.style.marginBottom = '20px';
  p.textContent = 'The guide aggregates verified data and methods from eight trusted community tracking and guide sources.';
  wrap.append(h2, p);

  // Compute citation counts per source
  const sourceCounts = {};
  roadmapData.sources.forEach(s => {
    sourceCounts[s.name] = 0;
  });

  trophiesData.trophies.forEach(t => {
    if (t.sources) {
      t.sources.forEach(src => {
        if (sourceCounts[src.name] !== undefined) {
          sourceCounts[src.name]++;
        } else {
          sourceCounts[src.name] = 1;
        }
      });
    }
  });

  // Source matrix table
  const table = document.createElement('table');
  table.className = 'source-matrix-table';
  
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Source Name</th><th>What it covers</th><th>Trophies Citing</th></tr>';
  table.append(thead);

  const tbody = document.createElement('tbody');
  roadmapData.sources.forEach(src => {
    const tr = document.createElement('tr');
    
    const tdName = document.createElement('td');
    const a = document.createElement('a');
    a.href = src.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = src.name;
    tdName.append(a);

    const tdCovers = document.createElement('td');
    tdCovers.textContent = src.covers;

    const tdCount = document.createElement('td');
    tdCount.textContent = `${sourceCounts[src.name] || 0} trophies`;

    tr.append(tdName, tdCovers, tdCount);
    tbody.append(tr);
  });
  table.append(tbody);
  wrap.append(table);

  // Honesty note
  const honesty = document.createElement('div');
  honesty.className = 'honesty-note';
  honesty.innerHTML = `
    <h3>Editorial Honesty & Unconfirmed Methods</h3>
    <p>Two trophies (<strong>Bad Luck, I Guess</strong> and <strong>Ten Pin</strong>) currently have no published community method yet; our guide explicitly states this fact rather than inventing unverified procedures. Two additional trophies (<strong>In The Beginning…</strong> and <strong>Capital Offense</strong>) feature published methods whose exact trigger conditions are still actively being tested and confirmed by players.</p>
  `;
  wrap.append(honesty);

  container.append(wrap);
}

// Export progress JSON
function exportProgress() {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leonida-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(url);
}

// Import progress JSON
async function importProgress(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.earned)) {
      state.earned = parsed.earned;
      if (parsed.counts && typeof parsed.counts === 'object') {
        state.counts = parsed.counts;
      }
      if (typeof parsed.spoiler === 'boolean') {
        state.spoiler = parsed.spoiler;
      }
      saveProgress();
      renderAll();
      alert('Progress imported successfully!');
    } else {
      alert('Invalid progress file format: missing earned array.');
    }
  } catch (err) {
    alert('Failed to parse JSON file: ' + err.message);
  }
}

// Switch active tab
function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-section').forEach(sec => {
    if (sec.id === `section-${tabId}`) {
      sec.classList.add('active');
    } else {
      sec.classList.remove('active');
    }
  });

  if (tabId === 'roadmap') renderRoadmap();
  if (tabId === 'missables') renderMissables();
  if (tabId === 'sources') renderSources();
}

// Render everything
function renderAll() {
  renderHeader();
  renderAuditStrip();
  renderList();
  renderDetail();
  if (activeTab === 'roadmap') renderRoadmap();
  if (activeTab === 'missables') renderMissables();
  if (activeTab === 'sources') renderSources();

  const spoilerBtn = document.getElementById('spoiler-toggle');
  if (spoilerBtn) {
    spoilerBtn.textContent = `Spoiler shield: ${state.spoiler ? 'on' : 'off'}`;
  }

  // Set shotReady flag for screenshot automation
  window.__shotReady = true;
}

// Initialize application
async function init() {
  loadProgress();
  await loadData();

  // Default selected trophy if none selected
  if (trophiesData && trophiesData.trophies.length > 0) {
    selectedTrophyName = trophiesData.trophies[0].name;
  }

  // Setup event listeners
  document.getElementById('search')?.addEventListener('input', renderList);
  document.getElementById('kind-filter')?.addEventListener('change', renderList);
  document.getElementById('grade-filter')?.addEventListener('change', renderList);
  document.getElementById('earned-only')?.addEventListener('change', renderList);

  const spoilerBtn = document.getElementById('spoiler-toggle');
  if (spoilerBtn) {
    spoilerBtn.textContent = `Spoiler shield: ${state.spoiler ? 'on' : 'off'}`;
    spoilerBtn.addEventListener('click', () => {
      state.spoiler = !state.spoiler;
      spoilerBtn.textContent = `Spoiler shield: ${state.spoiler ? 'on' : 'off'}`;
      saveProgress();
      renderAll();
    });
  }

  document.getElementById('export-btn')?.addEventListener('click', exportProgress);

  const importInput = document.getElementById('import-input');
  if (importInput) {
    importInput.addEventListener('change', (e) => {
      importProgress(e.target.files[0]);
      e.target.value = '';
    });
  }

  // Tab buttons
  ['checklist', 'roadmap', 'missables', 'sources'].forEach(tabName => {
    const btn = document.getElementById(`tab-${tabName}`);
    if (btn) {
      btn.addEventListener('click', () => switchTab(tabName));
    }
  });

  renderAll();

  // Expose bridge for shots.js
  window.__trophyGuide = {
    state,
    trophiesData,
    roadmapData,
    renderAll,
    switchTab,
    toggleEarned,
    setCount,
    selectTrophy: (name) => {
      selectedTrophyName = name;
      renderAll();
    }
  };
}

init();
