# Splash Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated splash screen with the Champions trophy image that shows during app startup for ~2-3 seconds.

**Architecture:** A hidden-by-default overlay (`#splash-screen`) in `index.html` becomes visible on page load. CSS handles all animations (fade-in, glow, dots). JS in `main.js` hides it after a minimum 2.5s delay once the app is ready.

**Tech Stack:** Vanilla HTML/CSS/JS (existing stack)

## Global Constraints

- Mobile vertical-first design (480px max-width container)
- Dark mode: background `#03060D`, accent violet `#8B5CF6`
- No external libraries
- Image at `data/img/splash-trophy.png` (768x1376 PNG)
- Cache-busting: increment versions in `index.html` for CSS/JS

---

### Task 1: Add splash screen HTML

**Files:**
- Modify: `index.html:24` (after `<body>` tag, before `#orientation-warning`)

**Interfaces:**
- Consumes: `data/img/splash-trophy.png`
- Produces: `#splash-screen` element visible on page load

- [ ] **Step 1: Add splash screen div**

Insert after the opening `<body>` tag (before `<div id="orientation-warning"`):

```html
<!-- Splash Screen -->
<div id="splash-screen">
  <div class="splash-glow"></div>
  <img class="splash-trophy" src="data/img/splash-trophy.png" alt="Porra Champions">
  <div class="splash-text">
    <span>Preparando la porra...</span>
    <div class="splash-dots">
      <span></span><span></span><span></span>
    </div>
  </div>
  <div class="splash-line"></div>
</div>
```

- [ ] **Step 2: Verify HTML structure**

Open `index.html` in a text editor and confirm:
- `#splash-screen` is the first child of `<body>`
- Image path is `data/img/splash-trophy.png`
- No syntax errors

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add splash screen HTML structure"
```

---

### Task 2: Add splash screen CSS

**Files:**
- Modify: `css/styles.css` (append at end of file, before last newline)

**Interfaces:**
- Consumes: HTML structure from Task 1 (`#splash-screen`, `.splash-glow`, `.splash-trophy`, `.splash-text`, `.splash-dots`, `.splash-line`)
- Produces: Visible splash screen with animations

- [ ] **Step 1: Add splash screen styles**

Append to `css/styles.css`:

```css
/* ── Splash Screen ────────────────────────────────────────── */
#splash-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #03060D;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: opacity 0.6s ease-out;
}
#splash-screen.hidden {
  opacity: 0;
  pointer-events: none;
}

.splash-glow {
  position: absolute;
  top: 35%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%);
  border-radius: 50%;
  filter: blur(40px);
  animation: splashGlow 2s ease-in-out infinite alternate;
}

.splash-trophy {
  position: relative;
  z-index: 2;
  width: 260px;
  max-width: 70vw;
  height: auto;
  filter: drop-shadow(0 0 30px rgba(139,92,246,0.3));
  mask-image: radial-gradient(ellipse 85% 80% at 50% 50%, black 50%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 85% 80% at 50% 50%, black 50%, transparent 100%);
  animation: splashFadeIn 1.2s ease-out forwards, splashGlowImg 2s ease-in-out 0.8s forwards;
  opacity: 0;
}

.splash-text {
  position: relative;
  z-index: 2;
  margin-top: 32px;
  text-align: center;
  animation: splashFadeIn 1s ease-out 0.6s forwards;
  opacity: 0;
}
.splash-text span {
  font-size: 14px;
  color: #94A3B8;
  letter-spacing: 3px;
  text-transform: uppercase;
  font-weight: 500;
}

.splash-dots {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-top: 16px;
}
.splash-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8B5CF6;
  animation: splashDotPulse 1.4s ease-in-out infinite;
}
.splash-dots span:nth-child(2) { animation-delay: 0.2s; }
.splash-dots span:nth-child(3) { animation-delay: 0.4s; }

.splash-line {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #8B5CF6, transparent);
  animation: splashFadeIn 1s ease-out 1s forwards;
  opacity: 0;
}

@keyframes splashFadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes splashGlow {
  from { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
}
@keyframes splashGlowImg {
  from { filter: drop-shadow(0 0 20px rgba(139,92,246,0.2)); }
  to { filter: drop-shadow(0 0 40px rgba(139,92,246,0.5)); }
}
@keyframes splashDotPulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.2); }
}
```

- [ ] **Step 2: Verify CSS loads**

Open browser dev tools, check `#splash-screen` has correct styles and animations are running.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "feat: add splash screen CSS with animations"
```

---

### Task 3: Add splash screen JS logic

**Files:**
- Modify: `js/main.js:223-231` (DOMContentLoaded handler)
- Modify: `js/main.js:2241-2280` (enterApp function)

**Interfaces:**
- Consumes: `#splash-screen` DOM element from Task 1
- Produces: `hideSplashScreen()` function, timing logic in `enterApp()`

- [ ] **Step 1: Add constants and timestamp**

At the top of `js/main.js` (after the existing constants around line 17-55), add:

```javascript
const SPLASH_MIN_MS = 2500;
let splashTimestamp = Date.now();
```

- [ ] **Step 2: Add hideSplashScreen function**

Add this function in `js/main.js` (near the other UI helper functions):

```javascript
function hideSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (!splash) return;
  splash.classList.add('hidden');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
}
```

- [ ] **Step 3: Modify enterApp to hide splash**

In the `enterApp()` function (around line 2241), add splash hide logic at the very beginning of the function, before any other code:

```javascript
async function enterApp() {
  // Hide splash screen after minimum delay
  const elapsed = Date.now() - splashTimestamp;
  const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
  if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
  hideSplashScreen();

  // ... rest of existing enterApp code
```

- [ ] **Step 4: Run existing tests**

Run: `for f in tests/*.test.js; do node "$f" 2>&1 | tail -1; done`
Expected: All tests pass (no regressions)

- [ ] **Step 5: Commit**

```bash
git add js/main.js
git commit -m "feat: add splash screen hide logic with min delay"
```

---

### Task 4: Update cache-busting versions

**Files:**
- Modify: `index.html` (CSS and JS script/link tags)

**Interfaces:**
- Consumes: All changes from Tasks 1-3
- Produces: Updated version query strings

- [ ] **Step 1: Increment CSS version**

Find `<link rel="stylesheet" href="css/styles.css?v=X">` and increment X by 1.

- [ ] **Step 2: Increment JS version**

Find `<script src="js/main.js?v=X"></script>` and increment X by 1.

- [ ] **Step 3: Commit and push**

```bash
git add index.html
git commit -m "chore: bump cache versions for splash screen"
git push
```

---

### Task 5: Verify splash screen works end-to-end

**Files:** None (verification only)

- [ ] **Step 1: Start local dev server**

Run: `node server.mjs`
Open: `http://localhost:3000`

- [ ] **Step 2: Test splash screen**

Verify:
- Splash screen appears immediately on page load
- Trophy image loads and displays correctly
- Glow animation pulses
- Text "Preparando la porra..." appears with animated dots
- After ~2.5-3s, splash fades out
- Auth overlay or main app appears behind it

- [ ] **Step 3: Test on mobile viewport**

Open browser dev tools, set to mobile viewport (375x812), reload and verify:
- Image fits within screen
- No horizontal overflow
- Animations look smooth

- [ ] **Step 4: Test splash doesn't block auth**

- Clear localStorage, reload → splash shows, then auth overlay appears
- Login → splash shows, then app appears
- Reload while logged in → splash shows, then app appears directly

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: splash screen adjustments" && git push
```
