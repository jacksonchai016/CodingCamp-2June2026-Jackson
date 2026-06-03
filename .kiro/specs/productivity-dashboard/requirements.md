# Requirements Document

## Introduction

A personal productivity dashboard delivered as a standalone, client-side web application. The dashboard consolidates four daily-use tools — a live clock/greeting, a Pomodoro-style focus timer, a to-do list, and a quick-links launcher — into a single HTML page. No backend server is required; all persistent data is stored exclusively in the browser's Local Storage. The application must run correctly in Chrome, Firefox, Edge, and Safari and may also be packaged as a browser extension.

## Glossary

- **Dashboard**: The single-page web application described in this document.
- **User**: The person operating the Dashboard in a web browser.
- **Focus_Timer**: The countdown timer widget included in the Dashboard.
- **Todo_List**: The task-management widget included in the Dashboard.
- **Quick_Links**: The bookmarks/launcher widget included in the Dashboard.
- **Greeting_Widget**: The widget that displays the current time, date, and a contextual greeting.
- **Local_Storage**: The browser's `localStorage` API used for client-side persistence.
- **Task**: A single item managed by the Todo_List.
- **Link**: A single bookmark entry managed by Quick_Links, consisting of a label and a URL.
- **Session**: A single Focus_Timer countdown run from start to zero or until stopped.

---

## Requirements

### Requirement 1: Greeting and Live Clock

**User Story:** As a User, I want to see the current time, date, and a greeting appropriate to the time of day, so that I have immediate context when I open the Dashboard.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL display the current time in HH:MM:SS format, updated every second.
2. THE Greeting_Widget SHALL display the current date in the format "Weekday, D Month YYYY" (e.g., "Monday, 2 June 2025").
3. WHEN the local hour is between 05:00 and 11:59, THE Greeting_Widget SHALL display the greeting "Good Morning".
4. WHEN the local hour is between 12:00 and 17:59, THE Greeting_Widget SHALL display the greeting "Good Afternoon".
5. WHEN the local hour is between 18:00 and 20:59, THE Greeting_Widget SHALL display the greeting "Good Evening".
6. WHEN the local hour is between 21:00 and 23:59, THE Greeting_Widget SHALL display the greeting "Good Night".
7. WHEN the local hour is between 00:00 and 04:59, THE Greeting_Widget SHALL display the greeting "Good Night".
8. WHEN the one-second update interval fires and the local hour has changed since the previous update, THE Greeting_Widget SHALL immediately update the displayed greeting text to match the new time-of-day period.

---

### Requirement 2: Focus Timer

**User Story:** As a User, I want a 25-minute countdown timer with Start, Stop, and Reset controls, so that I can time focused work sessions.

#### Acceptance Criteria

1. THE Focus_Timer SHALL initialise to a duration of 25 minutes (1500 seconds) on page load.
2. WHEN the User activates the Start control, THE Focus_Timer SHALL begin counting down in one-second intervals.
3. WHILE the Focus_Timer is counting down or paused, THE Focus_Timer SHALL display the remaining time in MM:SS format.
4. WHEN the User activates the Stop control, THE Focus_Timer SHALL pause the countdown and retain the remaining time.
5. WHEN the User activates the Reset control, THE Focus_Timer SHALL stop any active countdown and reset the displayed time to 25:00.
6. WHEN the countdown reaches 00:00, THE Focus_Timer SHALL stop the countdown automatically and display a text completion message and apply a distinct visual change (e.g., colour change) to the timer display area.
7. WHILE the Focus_Timer is counting down, THE Focus_Timer SHALL disable the Start control to prevent duplicate timers.
8. WHILE the Focus_Timer is paused or reset, THE Focus_Timer SHALL disable the Stop control.
9. WHEN the countdown reaches 00:00, THE Focus_Timer SHALL disable the Start control and the Stop control, and SHALL enable only the Reset control.

---

### Requirement 3: To-Do List

**User Story:** As a User, I want to add, edit, mark as complete, and delete tasks, with all tasks persisted across browser sessions, so that I can track my daily work items reliably.

#### Acceptance Criteria

1. THE Todo_List SHALL provide an input field and a submit control that allow the User to add a new Task.
2. WHEN the User submits a new Task with a non-empty, non-whitespace-only text value, THE Todo_List SHALL append the Task to the list and persist it to Local_Storage, then clear the input field.
3. IF the User attempts to submit a Task with an empty or whitespace-only text value, THEN THE Todo_List SHALL reject the submission, retain the current input field value, and display an inline validation message adjacent to the input field.
4. WHEN the User activates the complete control on a Task, THE Todo_List SHALL toggle the Task's completion state and update Local_Storage with the new state.
5. WHEN the User activates the edit control on a Task, THE Todo_List SHALL replace the Task's display-mode row with an editable field pre-populated with the current Task text and move input focus to that field.
6. WHEN the User confirms an edit with a non-empty, non-whitespace-only text value, THE Todo_List SHALL update the Task's text in the list and in Local_Storage, then return the row to display mode.
7. IF the User confirms an edit with an empty or whitespace-only text value, THEN THE Todo_List SHALL reject the edit, retain the original Task text, and return the row to display mode.
8. WHEN the User activates the delete control on a Task, THE Todo_List SHALL remove the Task from the list and from Local_Storage immediately without additional confirmation.
9. WHEN the Dashboard is loaded, THE Todo_List SHALL read all Tasks from Local_Storage and render them in the order in which they were saved; IF Local_Storage is unavailable or its data fails to parse, THE Todo_List SHALL render an empty list without displaying an error.
10. THE Todo_List SHALL visually distinguish completed Tasks from incomplete Tasks using at minimum a strikethrough style on the Task text.

---

### Requirement 4: Quick Links

**User Story:** As a User, I want to add, open, and delete favourite website links, with all links persisted across browser sessions, so that I can launch frequently visited sites in one click.

#### Acceptance Criteria

1. THE Quick_Links widget SHALL provide an input field for a label and an input field for a URL, and a submit control that allows the User to add a new Link.
2. WHEN the User submits a new Link with a non-empty label and a URL that begins with "http://" or "https://", THE Quick_Links widget SHALL add the Link as a clickable button and persist it to Local_Storage, provided the total number of stored Links does not exceed 50.
3. IF the User submits a Link with an empty label or an empty URL, THEN THE Quick_Links widget SHALL reject the submission, preserve the current input field values, and display an inline validation message.
4. IF the User submits a Link with a URL that does not begin with "http://" or "https://", THEN THE Quick_Links widget SHALL reject the submission, preserve the current input field values, and display an inline validation message stating that the URL must begin with "http://" or "https://".
5. WHEN the User activates a Link button, THE Quick_Links widget SHALL open the associated URL in a new browser tab.
6. WHEN the User activates the delete control on a Link, THE Quick_Links widget SHALL remove the Link from the display and from Local_Storage immediately.
7. WHEN the Dashboard is loaded, THE Quick_Links widget SHALL read all Links from Local_Storage and render them in the order in which they were saved; IF Local_Storage is unavailable or its data cannot be parsed as a valid array of Link objects, THEN THE Quick_Links widget SHALL render no Links and display no error message.
8. IF the User submits a Link whose URL is identical to an already-stored Link's URL, THEN THE Quick_Links widget SHALL reject the submission and display an inline validation message indicating that the URL already exists.

---

### Requirement 5: Client-Side Data Persistence

**User Story:** As a User, I want all my tasks and links to be automatically saved in my browser, so that my data is available every time I open the Dashboard without requiring a server or account.

#### Acceptance Criteria

1. THE Dashboard SHALL use the browser Local_Storage API as the sole persistence mechanism.
2. THE Dashboard SHALL NOT make any network requests for the purpose of data storage or retrieval.
3. WHEN any Task or Link is successfully created, updated, or deleted, THE Dashboard SHALL immediately write the updated data set to Local_Storage.
4. WHEN a write to Local_Storage fails due to unavailability or a storage quota error, THE Dashboard SHALL retain the change in memory for the current session and display a user-visible non-blocking error message explaining that the data cannot be persisted.
5. WHEN Local_Storage is unavailable at load time, or when the stored data fails JSON parsing or does not conform to the expected schema, THE Dashboard SHALL render an empty initial state for all affected widgets and SHALL NOT display any error message to the User about the missing saved data.

---

### Requirement 6: Browser Compatibility and Standalone Delivery

**User Story:** As a User, I want the Dashboard to work across all major browsers from a single HTML file, so that I can use it anywhere without installation or a build step.

#### Acceptance Criteria

1. THE Dashboard SHALL function correctly — meaning all widgets render, all controls respond to input, and Local_Storage read/write operations succeed — in the most recent stable release of Chrome, Firefox, Edge, and Safari at the time of delivery.
2. THE Dashboard SHALL be deliverable as a single self-contained HTML file (with all CSS and JavaScript inlined or co-located) that can be opened directly via the file:// protocol without a web server.
3. WHEN the Dashboard is opened via the file:// protocol and the browser blocks Local_Storage access, THE Dashboard SHALL display a one-time non-blocking notice informing the User that data persistence is unavailable in this context, and SHALL otherwise render all widgets in their empty initial state.
4. THE Dashboard SHALL use only HTML, CSS, and Vanilla JavaScript; no external frameworks, libraries, CDN-hosted assets, or build tools SHALL be required to run the application.
5. WHERE the Dashboard is packaged as a browser extension, THE Dashboard SHALL comply with the Manifest V3 extension standard, and the core application logic (HTML, CSS, JavaScript) SHALL require no modification to function as an extension page.

---

### Requirement 7: Performance and Visual Design

**User Story:** As a User, I want the Dashboard to load quickly and present a clean, readable interface, so that it does not slow me down or distract me during my workday.

#### Acceptance Criteria

1. THE Dashboard SHALL render all widgets and become fully interactive — meaning all controls are present in the DOM and respond to user input — within 2 seconds of the file being opened in a browser on a desktop machine with a CPU equivalent to an Intel Core i5 (8th generation) or better, using only locally available resources.
2. THE Dashboard SHALL ensure that all text content meets the WCAG AA colour contrast ratio: at minimum 4.5:1 for normal text and 3:1 for large text (18pt or 14pt bold) and UI component boundaries.
3. WHEN the User interacts with any control (button, input, checkbox), THE Dashboard SHALL reflect the state change visually within 100 milliseconds.
4. THE Dashboard SHALL be responsive such that at any viewport width from 320 px to 1920 px, no content is clipped or requires horizontal scrolling, and all controls remain operable.
5. WHEN the viewport width crosses the breakpoints 768 px and 1024 px, THE Dashboard SHALL reflow the widget layout to suit the available width without requiring a page reload.
