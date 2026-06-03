# Implementation Plan: Productivity Dashboard

## Overview

Implement the Productivity Dashboard as a single self-contained `index.html` file with all CSS and JavaScript inlined. The build follows the IIFE/module-pattern architecture defined in the design document: StorageUtil singleton first, then each widget module, then the Toast notification, wired together in a `DOMContentLoaded` initialisation sequence. Property-based tests (fast-check) and example-based unit tests are added as inline `<script>` blocks inside a dedicated `tests.html` file.

---

## Tasks

- [x] 1. Scaffold the HTML shell and CSS foundation
  - Create `index.html` with the full HTML5 document skeleton: `<head>` with meta charset, viewport, and title; `<body>` containing four `<section>` elements with ids `widget-greeting`, `widget-timer`, `widget-todo`, `widget-links`; a `<div id="toast-container">` for notifications; and a placeholder `<script>` block.
  - Inline all CSS: CSS custom properties for colour palette (WCAG AA contrast), responsive grid layout using CSS Grid (`auto-fit`, `minmax`), breakpoints at 768 px and 1024 px via `@media`, and base component styles for buttons, inputs, and validation `<span>` elements.
  - Ensure no horizontal scroll at 320 px viewport width; all controls visible and operable up to 1920 px.
  - _Requirements: 6.2, 6.4, 7.2, 7.4, 7.5_

- [x] 2. Implement the Storage Utility singleton
  - [x] 2.1 Write the `StorageUtil` IIFE
    - Implement `init()`: probe `localStorage` availability with a `try/catch` around `setItem`/`removeItem`; set module-private `_available` flag; if unavailable call `showToast` with the persistence-unavailable message.
    - Implement `isAvailable()`, `get(key)` (JSON.parse with SyntaxError catch → return null), `set(key, value)` (JSON.stringify with DOMException catch → return false + showToast), and `remove(key)`.
    - Define the storage key constants `PD_TODOS = 'pd_todos'` and `PD_LINKS = 'pd_links'` as properties on the returned object.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.3_

  - [ ]* 2.2 Write unit tests for StorageUtil
    - Test `get`/`set`/`remove` with a mock `localStorage` stub.
    - Test `isAvailable()` returns `false` when `localStorage.setItem` throws `SecurityError`.
    - Test `set()` returns `false` and calls `showToast` when `localStorage.setItem` throws `DOMException` (quota exceeded).
    - Test `get()` returns `null` when stored value is corrupt JSON.
    - _Requirements: 5.1, 5.4, 5.5_

- [x] 3. Implement the Toast Notification utility
  - [x] 3.1 Write the `showToast(message, durationMs=4000)` global function
    - Create a `<div>` inside `#toast-container`, set `role="status"` and `aria-live="polite"`, append the message text, auto-remove after `durationMs` ms via `setTimeout`.
    - Style the toast with position, colour, and fade-out transition (pure CSS class toggle).
    - _Requirements: 5.4, 6.3, 7.3_

  - [ ]* 3.2 Write unit tests for ToastUI
    - Test that calling `showToast` inserts a child element into `#toast-container` with the correct text.
    - Test that the element is removed after the specified duration (use fake timers).
    - _Requirements: 5.4_

- [x] 4. Implement the Greeting & Clock Module
  - [x] 4.1 Write the `GreetingModule` IIFE with `getGreeting`, `formatTime`, and `formatDate`
    - `getGreeting(hour)`: pure function mapping integer hours 0–23 to one of the four greeting strings per the design table.
    - `formatTime(date)`: returns `HH:MM:SS` with `String.prototype.padStart(2, '0')` for each component.
    - `formatDate(date)`: returns `"Weekday, D Month YYYY"` using `toLocaleDateString` with `{ weekday:'long', day:'numeric', month:'long', year:'numeric' }` locale options (or manual lookup arrays as fallback for `file://` compatibility).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 4.2 Write `GreetingModule.init()` and `updateDisplay()`
    - `init()`: query DOM refs for time, date, and greeting `<span>` elements; call `updateDisplay()`; start `setInterval(updateDisplay, 1000)`.
    - `updateDisplay()`: read `new Date()`, format all three values, compare to last rendered values, patch DOM only if changed.
    - On hour change, update greeting immediately per Requirement 1.8.
    - _Requirements: 1.1, 1.2, 1.8_

  - [ ]* 4.3 Write property test for Greeting correctness (Property 1)
    - **Property 1: Greeting correctness for any hour**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7**
    - Use `fc.integer({ min: 0, max: 23 })` to generate any hour; assert result is one of the four valid strings and matches the period boundary.

  - [ ]* 4.4 Write property test for Clock format invariant (Property 2)
    - **Property 2: Clock format invariant**
    - **Validates: Requirements 1.1**
    - Use `fc.date()` to generate any `Date`; assert `formatTime(date)` matches `/^\d{2}:\d{2}:\d{2}$/`.

  - [ ]* 4.5 Write property test for Date format invariant (Property 3)
    - **Property 3: Date format invariant**
    - **Validates: Requirements 1.2**
    - Use `fc.date()` to generate any `Date`; assert `formatDate(date)` matches the pattern `/<Weekday>, <D> <Month> <YYYY>/` with full English names.

  - [ ]* 4.6 Write example-based unit tests for GreetingModule
    - Test boundary hours: 0, 4, 5, 11, 12, 17, 18, 20, 21, 23.
    - Test `formatTime` for a known date (e.g., midnight → `"00:00:00"`).
    - Test `formatDate` for a known date (e.g., 2 June 2025 Monday → `"Monday, 2 June 2025"`).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 5. Implement the Focus Timer Module
  - [x] 5.1 Write the `TimerModule` IIFE with state, `tick()`, `renderDisplay()`, and `applyControlState()`
    - Module-private state: `{ remaining: 1500, status: 'idle', _intervalId: null }`.
    - `tick()`: decrement `remaining` by 1; if `remaining <= 0` set `remaining = 0`, transition to `'done'`, clear interval, apply visual completion style (CSS class), call `renderDisplay()` and `applyControlState()`.
    - `renderDisplay()`: format `remaining` as `MM:SS` and set the timer display element text.
    - `applyControlState()`: set `disabled` on each button exactly per the control state table in the design.
    - _Requirements: 2.3, 2.6, 2.7, 2.8, 2.9_

  - [x] 5.2 Write `TimerModule.init()`, `start()`, `stop()`, and `reset()`
    - `init()`: query DOM refs for display element and three buttons; call `renderDisplay()` and `applyControlState()`.
    - `start()`: guard if `status === 'running'`; set `status = 'running'`; start `setInterval(tick, 1000)`; call `applyControlState()`.
    - `stop()`: clear interval; set `status = 'paused'`; call `applyControlState()`.
    - `reset()`: clear interval; set `remaining = 1500`, `status = 'idle'`; call `renderDisplay()` and `applyControlState()`.
    - Wire `click` listeners on Start, Stop, Reset buttons to the respective methods.
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]* 5.3 Write property test for countdown monotonicity (Property 4)
    - **Property 4: Focus Timer countdown monotonicity**
    - **Validates: Requirements 2.2, 2.3, 2.6**
    - Use `fc.integer({ min: 1, max: 1500 })` for an initial `remaining`; simulate N ticks; assert `remaining` decreases by 1 per tick and never drops below 0.

  - [ ]* 5.4 Write property test for control state consistency (Property 5)
    - **Property 5: Focus Timer control state consistency**
    - **Validates: Requirements 2.7, 2.8, 2.9**
    - Use `fc.constantFrom('idle','running','paused','done')` to generate a status; call `applyControlState()` with that status; assert each button's `disabled` attribute matches the design table exactly.

  - [ ]* 5.5 Write example-based unit tests for TimerModule
    - Test `init()` → `status === 'idle'`, `remaining === 1500`.
    - Test `start()` → `status === 'running'`, Start disabled, Stop enabled.
    - Test `stop()` → `status === 'paused'`, Stop disabled.
    - Test `reset()` from running → `status === 'idle'`, `remaining === 1500`.
    - Test `tick()` to `remaining === 0` → `status === 'done'`, Start and Stop disabled, Reset enabled.
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

- [x] 6. Checkpoint — Ensure all tests pass for StorageUtil, Toast, Greeting, and Timer modules
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement the To-Do List Module
  - [x] 7.1 Write `TodoModule` IIFE with data model, `validateText()`, `addTask()`, `toggleTask()`, `deleteTask()`
    - Load `tasks` array from `StorageUtil.get('pd_todos')` on module init; fall back to `[]` if null or not an array.
    - `validateText(text)`: return `true` only if `text.trim().length > 0`.
    - `addTask(text)`: validate; on failure set the validation `<span>` message and return; on success push `{ id, text: text.trim(), completed: false, createdAt }`, flush to `StorageUtil.set`, call `renderList()`, clear input field.
    - `toggleTask(id)`: find task, flip `completed`, flush, call `renderList()`.
    - `deleteTask(id)`: filter out task, flush, call `renderList()`.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.8, 3.9, 3.10_

  - [x] 7.2 Write `TodoModule.beginEdit()`, `confirmEdit()`, `renderTask()`, and `renderList()`
    - `beginEdit(id)`: replace the task row with an `<input>` pre-populated with task text; set focus.
    - `confirmEdit(id, newText)`: validate; if empty keep original text, return to display mode; if valid update text, flush, call `renderList()`.
    - `renderTask(task)`: build the task row `<li>` with checkbox (complete toggle), task text `<span>` (strikethrough when completed), edit button, delete button, and edit-mode input.
    - `renderList()`: clear `<ul>` and re-render all tasks in array order.
    - Wire form submit and button click events.
    - _Requirements: 3.5, 3.6, 3.7, 3.10_

  - [ ]* 7.3 Write property test for valid task addition (Property 6)
    - **Property 6: Valid task addition grows the list**
    - **Validates: Requirements 3.2**
    - Use `fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)` to generate task text; assert list length increases by 1 and last task text equals trimmed input.

  - [ ]* 7.4 Write property test for whitespace-only rejection (Property 7)
    - **Property 7: Whitespace-only task text is always rejected**
    - **Validates: Requirements 3.3**
    - Use `fc.stringOf(fc.constantFrom(' ','\t','\n'), { minLength: 1 })` to generate whitespace-only strings; assert `validateText` returns `false` and list length is unchanged.

  - [ ]* 7.5 Write property test for task toggle round-trip (Property 8)
    - **Property 8: Task toggle round-trip**
    - **Validates: Requirements 3.4**
    - For any task, toggle twice; assert `completed` returns to original value.

  - [ ]* 7.6 Write property test for task deletion (Property 9)
    - **Property 9: Task deletion removes exactly one task**
    - **Validates: Requirements 3.8**
    - For any non-empty task list, delete a task by id; assert new length is `original.length - 1` and no task with that id remains.

  - [ ]* 7.7 Write property test for task localStorage round-trip (Property 10)
    - **Property 10: localStorage round-trip for tasks**
    - **Validates: Requirements 3.2, 3.4, 3.6, 5.3**
    - Generate an arbitrary valid `Task[]`; serialize with `JSON.stringify`, deserialize with `JSON.parse`; assert deep equality.

  - [ ]* 7.8 Write example-based unit tests for TodoModule
    - Test add valid task; reject empty string; reject whitespace-only string; toggle completion; edit with valid text; reject empty edit (keeps original); delete task; load from serialised array; graceful parse failure → empty list.
    - _Requirements: 3.1–3.10_

- [x] 8. Implement the Quick Links Module
  - [x] 8.1 Write `QuickLinksModule` IIFE with `validateLabel()`, `validateUrl()`, `isDuplicateUrl()`, `addLink()`, `deleteLink()`
    - Load `links` array from `StorageUtil.get('pd_links')` on init; fall back to `[]`.
    - `validateLabel(label)`: return `true` if `label.trim().length > 0`.
    - `validateUrl(url)`: return `true` if and only if `url.startsWith('http://') || url.startsWith('https://')` (case-sensitive).
    - `isDuplicateUrl(url)`: return `true` if any existing link has the same URL.
    - `addLink(label, url)`: run all validations and the 50-link cap check; on any failure set the appropriate validation `<span>` message and return; on success push `{ id, label: label.trim(), url, createdAt }`, flush to `StorageUtil.set`, call `renderLinks()`, clear inputs.
    - `deleteLink(id)`: filter out link, flush, call `renderLinks()`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 4.8_

  - [x] 8.2 Write `QuickLinksModule.openLink()`, `renderLink()`, and `renderLinks()`
    - `openLink(url)`: call `window.open(url, '_blank', 'noopener,noreferrer')`.
    - `renderLink(link)`: build a `<li>` containing a `<button>` (opens link) with label text, and a delete `<button>`.
    - `renderLinks()`: clear the links `<ul>` and re-render all links in array order.
    - Wire form submit and button click events.
    - _Requirements: 4.5, 4.6, 4.7_

  - [ ]* 8.3 Write property test for valid link addition (Property 11)
    - **Property 11: Valid link addition grows the link list (below cap)**
    - **Validates: Requirements 4.2**
    - Generate a link list with `fc.array(validLinkArb, { maxLength: 49 })` and a new valid link; assert list grows by 1.

  - [ ]* 8.4 Write property test for URL scheme validation (Property 12)
    - **Property 12: URL scheme validation**
    - **Validates: Requirements 4.2, 4.4**
    - Use `fc.string()` to generate arbitrary strings; assert `validateUrl` returns `true` iff string starts with `"http://"` or `"https://"`.

  - [ ]* 8.5 Write property test for duplicate URL rejection (Property 13)
    - **Property 13: Duplicate URL rejection**
    - **Validates: Requirements 4.8**
    - For any non-empty link list, attempt to add a link with a URL already in the list; assert list length is unchanged.

  - [ ]* 8.6 Write property test for link localStorage round-trip (Property 14)
    - **Property 14: localStorage round-trip for links**
    - **Validates: Requirements 4.7, 5.3**
    - Generate an arbitrary valid `Link[]`; serialize with `JSON.stringify`, deserialize with `JSON.parse`; assert deep equality.

  - [ ]* 8.7 Write example-based unit tests for QuickLinksModule
    - Test add valid link; reject empty label; reject empty URL; reject non-http(s) URL; reject duplicate URL; reject at 50-link cap; delete link; `openLink` calls `window.open` with correct URL and `'_blank'`; load from serialised array; graceful parse failure → empty list.
    - _Requirements: 4.1–4.8_

- [x] 9. Checkpoint — Ensure all tests pass for Todo and Quick Links modules
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Wire all modules together and finalise `index.html`
  - [ ] 10.1 Compose the `DOMContentLoaded` initialisation sequence
    - Inside a single `<script>` block at the bottom of `<body>`, add the `DOMContentLoaded` listener that calls: `StorageUtil.init()`, `GreetingModule.init()`, `TimerModule.init()`, `TodoModule.init()`, `QuickLinksModule.init()`.
    - Place all IIFE module declarations above this listener in dependency order (StorageUtil → Toast → Greeting → Timer → Todo → QuickLinks).
    - _Requirements: 6.1, 6.2, 7.1_

  - [ ] 10.2 Apply WCAG AA colour contrast and accessibility attributes
    - Audit every text/background pair against the 4.5:1 (normal text) and 3:1 (large text / UI components) ratios; adjust CSS custom property values where needed.
    - Add `aria-label` to all icon-only buttons; add `role="alert" aria-live="polite"` to all validation `<span>` elements; add `aria-label` to the timer display region; ensure logical tab order.
    - _Requirements: 7.2, 6.1_

  - [ ] 10.3 Validate responsive layout across breakpoints
    - Verify via browser DevTools that at 320 px, 768 px, 1024 px, and 1920 px viewport widths, no content is clipped, no horizontal scrollbar appears, and all controls are reachable.
    - Fix any overflow or min-width issues in the inline CSS.
    - _Requirements: 7.4, 7.5_

  - [ ]* 10.4 Write integration smoke test script
    - Create `tests.html` that imports fast-check from a local copy (bundled inline or as a `<script src="fast-check.min.js">` sibling file), then runs all 14 property tests plus example-based unit tests for every module using a minimal test harness (`console.assert`-based or a tiny TAP reporter).
    - _Requirements: 6.1, 7.1_

- [ ] 11. Final Checkpoint — Ensure all tests pass and the dashboard is fully functional
  - Open `index.html` via `file://` in at least one browser and confirm all four widgets render, controls respond, localStorage read/write works, and the responsive layout is correct at 320 px and 1920 px.
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build.
- Each task references specific requirements for traceability back to `requirements.md` and design properties in `design.md`.
- Checkpoints at tasks 6, 9, and 11 provide natural integration validation gates.
- All 14 correctness properties from the design document are covered by property-based test sub-tasks (4.3–4.5, 5.3–5.4, 7.3–7.7, 8.3–8.6).
- The `tests.html` file requires a local copy of `fast-check` (download from https://cdn.jsdelivr.net/npm/fast-check/lib/fast-check.min.js and place alongside `index.html`) or inline the bundle — no CDN allowed at runtime per Requirement 6.4.
- Timer state is intentionally not persisted to localStorage; each page load resets to 25:00.
- `crypto.randomUUID()` is used for IDs with a `Date.now().toString()` fallback for older browsers.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "3.2", "4.1"] },
    { "id": 2, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6", "5.1"] },
    { "id": 3, "tasks": ["5.2", "7.1", "8.1"] },
    { "id": 4, "tasks": ["5.3", "5.4", "5.5", "7.2", "8.2"] },
    { "id": 5, "tasks": ["7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "8.3", "8.4", "8.5", "8.6", "8.7"] },
    { "id": 6, "tasks": ["10.1"] },
    { "id": 7, "tasks": ["10.2", "10.3"] },
    { "id": 8, "tasks": ["10.4"] }
  ]
}
```
