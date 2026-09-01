# Avisos en Tab Clasificación del Perfil - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show classification points table with0 points and a notice before jornada 1 starts, and actual points with a different notice once jornada 1 has results.

**Architecture:** Modify `calculateClassificationPoints` to return predicted positions even without real standings, adapt `buildClassificationRowHtml` to handle missing real positions, and update `renderClassificationTab` to detect2 states (pre-jornada vs active) and render appropriate notices.

**Tech Stack:** Vanilla JS (ES6+), CSS3 with CSS variables

## Global Constraints

- Follow existing code style in `js/main.js` (no frameworks, vanilla JS)
- Use CSS variables defined in `:root` for colors
- Mobile vertical first design
- No comments unless asked

---

### Task 1: Add CSS styles for classification notices

**Files:**
- Modify: `css/styles.css` (after `.classification-legend` block, ~line 3840)

**Interfaces:**
- Produces: `.classification-notice` and `.notice-pre-jornada` CSS classes used by `renderClassificationTab` in Task 3

- [ ] **Step 1: Add notice styles**

Add after the `.classification-legend` block in `css/styles.css`:

```css
.classification-notice {
  padding: 8px 16px;
  font-size: 11px;
  text-align: center;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-muted);
}
.classification-notice.notice-pre-jornada {
  color: var(--accent-gold);
}
```

- [ ] **Step 2: Verify no syntax errors**

Open `css/styles.css` in browser dev tools or run a CSS linter if available. The new classes should not conflict with existing styles.

---

### Task 2: Modify `calculateClassificationPoints` to return predicted positions without real standings

**Files:**
- Modify: `js/main.js:5659-5668` (`calculateClassificationPoints` function)

**Interfaces:**
- Consumes: `calculateUserPredictedStandings(username)` which returns `[{ teamId, name, badgeExt, position, ... }]`
- Produces: `{ totalPoints: 0, teamDetails: [{ teamId, name, badgeExt, predictedPos, realPos: '-', points: 0 }] }` when no real standings exist but predicted standings do

- [ ] **Step 1: Replace early return when no realStandings**

In `js/main.js`, find the block at line 5665-5668:

```javascript
  const realStandings = calculateRealStandings();
  if (!realStandings.length) {
    return { totalPoints: 0, teamDetails: [] };
  }
```

Replace with:

```javascript
  const realStandings = calculateRealStandings();
  if (!realStandings.length) {
    const predictedStandings = calculateUserPredictedStandings(username);
    if (!predictedStandings.length) {
      return { totalPoints: 0, teamDetails: [] };
    }
    const teamDetails = predictedStandings.map(t => ({
      teamId: t.teamId,
      name: t.name,
      badgeExt: t.badgeExt,
      predictedPos: t.position,
      realPos: '-',
      points: 0
    }));
    return { totalPoints: 0, teamDetails };
  }
```

- [ ] **Step 2: Verify the function still works for the normal case**

The rest of the function (lines 5670-5728) remains unchanged. When `realStandings` has data, it continues to calculate points normally.

---

### Task 3: Adapt `buildClassificationRowHtml` for pre-jornada state

**Files:**
- Modify: `js/main.js:1382-1396` (`buildClassificationRowHtml` function)

**Interfaces:**
- Consumes: `team` object with `{ teamId, name, badgeExt, predictedPos, realPos, points }` where `realPos` can be `'-'` (string) or a number
- Produces: HTML string for a classification table row

- [ ] **Step 1: Update muted logic to handle string realPos**

In `js/main.js`, find `buildClassificationRowHtml` at line 1382:

```javascript
function buildClassificationRowHtml(team) {
  const muted = team.realPos > 24 ? ' muted' : '';
  const ptsClass = team.points > 0 ? ' positive' : '';
```

Replace with:

```javascript
function buildClassificationRowHtml(team) {
  const isPreJornada = team.realPos === '-';
  const muted = isPreJornada ? '' : (team.realPos > 24 ? ' muted' : '');
  const ptsClass = team.points > 0 ? ' positive' : '';
```

The rest of the function (the return template) remains unchanged since `${team.realPos}` will render `'-'` as a string naturally.

---

### Task 4: Update `renderClassificationTab` with2-state logic and notices

**Files:**
- Modify: `js/main.js:1399-1436` (`renderClassificationTab` function)

**Interfaces:**
- Consumes: `calculateClassificationPoints(username)` (modified in Task 2), `AppState.matches`, `AppState.matchStats`
- Produces: HTML with classification table + contextual notice

- [ ] **Step 1: Replace the entire function body**

In `js/main.js`, find `renderClassificationTab` at line 1399 and replace lines 1399-1436:

```javascript
function renderClassificationTab(container, username) {
  const classData = calculateClassificationPoints(username);

  if (!classData.teamDetails.length) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay datos de clasificación disponibles.</div>';
    return;
  }

  const leagueMatches = AppState.matches.filter(m => m.fase === 'liga');
  const hasLeagueResult = leagueMatches.some(m =>
    AppState.matchStats.some(ms =>
      ms.eventId === m.id &&
      ms.stats?.[m.homeTeamId] !== undefined &&
      ms.stats?.[m.awayTeamId] !== undefined
    )
  );

  const sortedTeams = sortTeamsByPredicted(classData.teamDetails);

  const noticeHtml = hasLeagueResult
    ? '<div class="classification-notice">Los puntos por clasificación varían según la clasificación real después de cada partido</div>'
    : '<div class="classification-notice notice-pre-jornada">Los puntos de clasificación empezarán a contarse cuando empiece la jornada 1</div>';

  const html = `
    <div class="profile-total-points">Puntos totales clasificación: <strong>${classData.totalPoints}</strong></div>
    <div class="classification-legend" style="padding: 8px 16px; font-size: 11px; color: var(--text-muted); text-align: center;">
      Solo puntúan equipos en posición 1-24 | Mínimo entre posición pronosticada y real
    </div>
    ${noticeHtml}
    <div class="classification-section">
      <div class="classification-table">
        <div class="classification-header">
          <span class="col-pos">Pron</span>
          <span class="col-team">Equipo</span>
          <span class="col-real">Real</span>
          <span class="col-pts">Pts</span>
        </div>
        ${sortedTeams.map(buildClassificationRowHtml).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;
}
```

- [ ] **Step 2: Verify in browser**

1. Open the app with no matchStats → open a user profile → tab Clasificación
2. Should show table with 36 teams, Real=`-`, Pts=0, golden notice
3. Add a matchStat for a liga match → re-open the tab
4. Should show calculated points, grey notice

---

### Task 5: Cache-busting version bump

**Files:**
- Modify: `index.html` (CSS and JS version params)

**Interfaces:**
- N/A

- [ ] **Step 1: Increment versions in index.html**

Find the CSS link and JS script tags in `index.html` and increment their `?v=` parameters:

```html
<link rel="stylesheet" href="css/styles.css?v=NEW_VERSION">
<script src="js/main.js?v=NEW_VERSION"></script>
```

- [ ] **Step 2: Commit**

```bash
git add css/styles.css js/main.js index.html
git commit -m "feat: classification tab shows0 points and notice before jornada 1"
```
