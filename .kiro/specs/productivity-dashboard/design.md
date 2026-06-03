# Design Document: Productivity Dashboard

## Overview

The Productivity Dashboard is a single-file, client-side web application implemented as one self-contained `index.html` file. All CSS and JavaScript are inlined. It requires no build step, no server, and no external dependencies. The application runs via the `file://` protocol in Chrome, Firefox, Edge, and Safari, and may also be packaged as a Manifest V3 browser extension with zero code changes.

The four widgets — Greeting & Live Clock, Focus Timer, To-Do List, and Quick Links — are architecturally independent modules that share only a common localStorage utility and a minimal event-bus for cross-widget communication (e.g., timer completion notification).

**Design Goals:**
- Zero external dependencies (no CDN, no npm, no frameworks)
- All state mutations are synchronous and immediately visible within 100 ms
- Data durability: every mutation flushes to localStorage before the function returns
- Progressive degradation: if localStorage is unavailable the app still renders and works in-memory
- WCAG AA contrast throughout; keyboard navigable; responsive from 320 px to 1920 px

---

## Architecture

The entire application lives inside a single HTML file. The logical architecture follows a **Module Pattern** using JavaScript IIFEs and closures — no ES modules (to avoid CORS restrictions under `file://`) and no class-based frameworks.

```
┌─────────────────────────────────────────────────────────────────┐
│                        index.html                               │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Greeting │  │ Focus Timer  │  │ To-Do    │  │  Quick    │  │
│  │ & Clock  │  │   Module     │  │  List    │  │  Links    │  │
│  │  Module  │  │              │  │  Module  │  │  Module   │  │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └─────┬─────┘  │
│       │               │               │               │        │
│       └───────────────┴───────────────┴───────────────┘        │
│                               │                                 │
│                    ┌──────────▼──────────┐                      │
│                    │  Storage Utility    │                      │
│                    │  (localStorage wrapper) │                  │
│                    └──────────┬──────────┘                      │
│                               │                                 │
│                    ┌──────────▼──────────┐                      │
│                    │  browser localStorage│                      │
│                    └─────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### Module Interaction

- Each module owns its own DOM subtree (a `<section>` element with a unique `id`).
- Modules do **not** call each other directly; they communicate through a minimal pub/sub event bus.
- The only cross-module event is `timer:complete`, published by the Focus Timer module and consumed by no other module in v1 (reserved for future notification hooks).
- The Storage Utility is a shared singleton with no module-specific knowledge; modules pass a namespaced key string.

### Initialization Sequence

```
DOMContentLoaded
  ├── StorageUtil.init()        // detect localStorage availability
  ├── GreetingModule.init()     // render + start 1 s interval
  ├── TimerModule.init()        // render 25:00, wire controls
  ├── TodoModule.init()         // load from storage, render list
  └── QuickLinksModule.init()   // load from storage, render links
```

All `init()` calls are synchronous reads from localStorage and synchronous DOM writes, ensuring the page is fully interactive within the 2-second budget on any modern desktop CPU.

---

## Components and Interfaces

### 1. Storage Utility (`StorageUtil`)

A thin wrapper around `window.localStorage` that:
- Detects availability once at startup (catches both `SecurityError` and quota errors).
- Exposes `get(key)` → parsed value or `null`.
- Exposes `set(key, value)` → `true` on success, `false` on failure (triggers a non-blocking toast notification).
- Exposes `remove(key)`.
- Exposes `isAvailable()` → boolean.

```
StorageUtil
  .init()          → void
  .isAvailable()   → boolean
  .get(key)        → any | null
  .set(key, value) → boolean
  .remove(key)     → void
```

**Storage Keys:**
| Key | Widget | Value Type |
|-----|--------|------------|
| `pd_todos` | To-Do List | `Task[]` (JSON array) |
| `pd_links` | Quick Links | `Link[]` (JSON array) |

### 2. Greeting & Clock Module (`GreetingModule`)

- Owns `<section id="widget-greeting">`.
- On `init()`: renders the current time, date, and greeting; starts a `setInterval` at 1000 ms.
- The interval callback calls `updateDisplay()` which reads `new Date()`, formats all three values, and patches the DOM only if values changed (avoids unnecessary repaints).

```
GreetingModule
  .init()            → void
  .updateDisplay()   → void   (called by interval)
  .formatTime(date)  → string  "HH:MM:SS"
  .formatDate(date)  → string  "Weekday, D Month YYYY"
  .getGreeting(hour) → string
```

**Greeting mapping:**
| Hour range | Text |
|------------|------|
| 05–11 | Good Morning |
| 12–17 | Good Afternoon |
| 18–20 | Good Evening |
| 21–23, 00–04 | Good Night |

### 3. Focus Timer Module (`TimerModule`)

- Owns `<section id="widget-timer">`.
- State: `{ remaining: 1500, status: 'idle' }` where status ∈ `{ 'idle', 'running', 'paused', 'done' }`.
- Uses a single `setInterval` handle stored in module closure; cleared on Stop/Reset/Complete.
- Control enable/disable rules are derived from `status` on every state change.

```
TimerModule
  .init()            → void
  .start()           → void
  .stop()            → void
  .reset()           → void
  .tick()            → void   (called by interval each second)
  .renderDisplay()   → void
  .applyControlState()→ void
```

**Control state table:**
| Status | Start | Stop | Reset |
|--------|-------|------|-------|
| idle | enabled | disabled | enabled |
| running | disabled | enabled | enabled |
| paused | enabled | disabled | enabled |
| done | disabled | disabled | enabled |

### 4. To-Do List Module (`TodoModule`)

- Owns `<section id="widget-todo">`.
- In-memory state: `tasks: Task[]` loaded from `pd_todos` on init.
- Mutations (add, toggle, edit, delete) update the array, flush to `StorageUtil.set('pd_todos', tasks)`, then call `renderList()`.

```
TodoModule
  .init()                        → void
  .addTask(text)                 → void | ValidationError
  .toggleTask(id)                → void
  .beginEdit(id)                 → void
  .confirmEdit(id, newText)      → void | ValidationError
  .deleteTask(id)                → void
  .renderList()                  → void
  .renderTask(task)              → HTMLElement
  .validateText(text)            → boolean
```

### 5. Quick Links Module (`QuickLinksModule`)

- Owns `<section id="widget-links">`.
- In-memory state: `links: Link[]` loaded from `pd_links` on init.
- Maximum 50 links enforced before calling `StorageUtil.set`.

```
QuickLinksModule
  .init()                        → void
  .addLink(label, url)           → void | ValidationError
  .openLink(url)                 → void   (window.open)
  .deleteLink(id)                → void
  .renderLinks()                 → void
  .renderLink(link)              → HTMLElement
  .validateLabel(label)          → boolean
  .validateUrl(url)              → boolean
  .isDuplicateUrl(url)           → boolean
```

### 6. Toast Notification (`ToastUI`)

A simple, auto-dismissing toast used only for non-fatal errors (e.g., localStorage write failure). No module depends on it; it is driven by a global `showToast(message)` function.

```
ToastUI
  showToast(message, durationMs=4000) → void
```

---

## Data Models

### Task

```js
{
  id:        string,   // crypto.randomUUID() or Date.now().toString() fallback
  text:      string,   // non-empty, non-whitespace-only
  completed: boolean,
  createdAt: number    // Unix timestamp ms
}
```

### Link

```js
{
  id:        string,   // crypto.randomUUID() or Date.now().toString() fallback
  label:     string,   // non-empty display name
  url:       string,   // must begin with "http://" or "https://"
  createdAt: number    // Unix timestamp ms
}
```

### localStorage Schema

Both `pd_todos` and `pd_links` are stored as JSON-serialised arrays. On load, if `JSON.parse` throws or the result is not an array, the module silently falls back to `[]`.

```
localStorage["pd_todos"] = JSON.stringify(Task[])
localStorage["pd_links"] = JSON.stringify(Link[])
```

### Timer State (in-memory only)

The Focus Timer state is **not** persisted to localStorage. Each page load resets to 25:00. This is intentional — the timer is session-scoped.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Greeting correctness for any hour

*For any* integer hour value in [0, 23], `GreetingModule.getGreeting(hour)` SHALL return exactly one of the four valid greeting strings, and the returned string SHALL match the time-of-day period defined in Requirement 1.

**Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7**

### Property 2: Clock format invariant

*For any* `Date` object, `GreetingModule.formatTime(date)` SHALL return a string that matches the pattern `HH:MM:SS` (two-digit zero-padded hours, minutes, and seconds separated by colons).

**Validates: Requirements 1.1**

### Property 3: Date format invariant

*For any* `Date` object, `GreetingModule.formatDate(date)` SHALL return a string of the form `"<Weekday>, <D> <Month> <YYYY>"` where Weekday is a full English weekday name, D is a non-zero-padded day integer, Month is a full English month name, and YYYY is a four-digit year.

**Validates: Requirements 1.2**

### Property 4: Focus Timer countdown monotonicity

*For any* sequence of `tick()` calls on a running timer, the `remaining` value SHALL decrease by exactly 1 each call and SHALL never go below 0.

**Validates: Requirements 2.2, 2.3, 2.6**

### Property 5: Focus Timer control state consistency

*For any* timer status value ∈ `{ 'idle', 'running', 'paused', 'done' }`, the `applyControlState()` function SHALL set the `disabled` attribute of each control button to exactly the value specified in the control state table — no other combination is valid.

**Validates: Requirements 2.7, 2.8, 2.9**

### Property 6: Valid task addition grows the list

*For any* task list and any non-empty, non-whitespace-only task text, calling `addTask(text)` SHALL increase the length of the task list by exactly 1 and the last element SHALL have `text` equal to the trimmed input.

**Validates: Requirements 3.2**

### Property 7: Whitespace-only task text is always rejected

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), `validateText(s)` SHALL return `false`, and calling `addTask(s)` SHALL leave the task list unchanged.

**Validates: Requirements 3.3**

### Property 8: Task toggle round-trip

*For any* task in the list, toggling its completion state twice SHALL return the task to its original `completed` value.

**Validates: Requirements 3.4**

### Property 9: Task deletion removes exactly one task

*For any* task list containing a task with a given `id`, calling `deleteTask(id)` SHALL produce a list of length `original.length - 1` that contains no task with that `id`.

**Validates: Requirements 3.8**

### Property 10: localStorage round-trip for tasks

*For any* array of valid `Task` objects, serialising with `JSON.stringify` and then deserialising with `JSON.parse` SHALL produce an array that is deeply equal to the original.

**Validates: Requirements 3.2, 3.4, 3.6, 5.3**

### Property 11: Valid link addition grows the link list (below cap)

*For any* link list with fewer than 50 entries and a submission with a non-empty label and a URL beginning with `"http://"` or `"https://"`, calling `addLink(label, url)` SHALL increase the link list length by exactly 1.

**Validates: Requirements 4.2**

### Property 12: URL scheme validation

*For any* string URL, `validateUrl(url)` SHALL return `true` if and only if the string starts with `"http://"` or `"https://"` (case-sensitive).

**Validates: Requirements 4.2, 4.4**

### Property 13: Duplicate URL rejection

*For any* link list and a URL that already exists in the list, calling `addLink(label, url)` SHALL leave the list unchanged.

**Validates: Requirements 4.8**

### Property 14: localStorage round-trip for links

*For any* array of valid `Link` objects, serialising with `JSON.stringify` and then deserialising with `JSON.parse` SHALL produce an array that is deeply equal to the original.

**Validates: Requirements 4.7, 5.3**

---

## Error Handling

### localStorage Unavailability

Two distinct scenarios require different handling:

| Scenario | Detection | Response |
|----------|-----------|----------|
| Unavailable at load time | `try { localStorage.setItem('__test__', '1') }` in `StorageUtil.init()` | Set `available = false`; all `set()` calls are no-ops; `get()` returns `null`; display one-time non-blocking toast: "Data persistence is unavailable in this context." |
| Quota exceeded on write | `set()` catches `DOMException` | Return `false`; display non-blocking toast: "Could not save your data — storage quota exceeded." |
| Corrupt data on load | `get()` catches `SyntaxError` from `JSON.parse` | Return `null`; module falls back to `[]` silently |

### Validation Errors

Validation errors are synchronous and inline — no modal dialogs. Each widget has a designated `<span role="alert" aria-live="polite">` element adjacent to its input fields. On rejection, the span is populated with the appropriate message and cleared on the next valid submission attempt.

**Validation messages:**
| Trigger | Message |
|---------|---------|
| Empty task text | "Task cannot be empty." |
| Empty link label | "Label cannot be empty." |
| Empty link URL | "URL cannot be empty." |
| Invalid URL scheme | "URL must begin with http:// or https://" |
| Duplicate URL | "This URL is already in your links." |
| Link cap reached | "Maximum of 50 links reached." |

### Focus Timer Edge Cases

- Calling `start()` while `status === 'running'` is a no-op (the Start button is also disabled, providing a second guard).
- Calling `tick()` when `remaining === 0` transitions to `done` status, clears the interval, and does not decrement further.
- Rapid successive clicks on Reset while running: the interval is cleared before `remaining` is reset, preventing a race condition.

---

## Testing Strategy

### Overview

The feature uses a **dual testing approach**: example-based unit tests for specific behaviours and property-based tests for universal invariants. All tests run in a browser environment (or jsdom) with no external service calls.

### Recommended Library

**[fast-check](https://fast-check.dev/)** (MIT licence) for property-based testing in JavaScript. It generates structured random inputs, shrinks failing examples, and runs comfortably in-browser or under Node/jsdom.

Minimum **100 iterations** per property test.

### Unit Tests (Example-Based)

Unit tests cover:

- **StorageUtil**: `get`/`set`/`remove` with a mocked `localStorage`; `isAvailable()` returns `false` when `localStorage` throws.
- **GreetingModule**: specific hour boundaries (04:59, 05:00, 11:59, 12:00, 17:59, 18:00, 20:59, 21:00); date format for a known date.
- **TimerModule**: start → running status; stop → paused status; reset from running → idle, remaining === 1500; completion at 0 → done status, Start/Stop disabled, Reset enabled.
- **TodoModule**: add valid task; reject empty string; reject whitespace-only string; toggle completion; edit with valid text; reject empty edit; delete task; load from serialised array; graceful parse failure.
- **QuickLinksModule**: add valid link; reject empty label; reject empty URL; reject non-http(s) URL; reject duplicate URL; reject when at 50-link cap; delete link; open link calls `window.open` with correct arguments.

### Property-Based Tests

Each test references its corresponding design property.

| Test | Property | Tag |
|------|----------|-----|
| `getGreeting` returns valid string for all hours 0–23 | Property 1 | `Feature: productivity-dashboard, Property 1: greeting correctness` |
| `formatTime` output matches HH:MM:SS regex for any Date | Property 2 | `Feature: productivity-dashboard, Property 2: clock format invariant` |
| `formatDate` output matches expected pattern for any Date | Property 3 | `Feature: productivity-dashboard, Property 3: date format invariant` |
| Timer `remaining` decreases by 1 per tick, never below 0 | Property 4 | `Feature: productivity-dashboard, Property 4: countdown monotonicity` |
| Control buttons match state table for all status values | Property 5 | `Feature: productivity-dashboard, Property 5: control state consistency` |
| Adding valid task grows list by 1 | Property 6 | `Feature: productivity-dashboard, Property 6: valid task addition` |
| Whitespace-only text leaves list unchanged | Property 7 | `Feature: productivity-dashboard, Property 7: whitespace rejection` |
| Toggle twice = original state | Property 8 | `Feature: productivity-dashboard, Property 8: toggle round-trip` |
| Delete removes exactly the target task | Property 9 | `Feature: productivity-dashboard, Property 9: task deletion` |
| Task array JSON round-trip is identity | Property 10 | `Feature: productivity-dashboard, Property 10: task storage round-trip` |
| Adding valid link below cap grows list by 1 | Property 11 | `Feature: productivity-dashboard, Property 11: link addition` |
| `validateUrl` accepts only http/https | Property 12 | `Feature: productivity-dashboard, Property 12: URL scheme validation` |
| Duplicate URL leaves list unchanged | Property 13 | `Feature: productivity-dashboard, Property 13: duplicate rejection` |
| Link array JSON round-trip is identity | Property 14 | `Feature: productivity-dashboard, Property 14: link storage round-trip` |

### Integration / Smoke Tests

- **Browser smoke test**: open `index.html` via `file://` in each target browser; verify all four widgets render and all controls respond.
- **Extension smoke test**: load as an unpacked Manifest V3 extension; verify the page opens and all widgets function.
- **localStorage unavailability test**: open with DevTools → Application → Storage → disable localStorage; verify toast appears and all widgets render empty.

### Accessibility Tests

- Run automated WCAG AA scan with axe-core on the rendered page.
- Manual keyboard-navigation pass: Tab through all controls in logical order; Space/Enter activates all buttons; Escape cancels edit mode.
- Screen reader pass with NVDA/VoiceOver: verify `aria-live` regions announce validation errors; timer display is announced on completion.
