/* =========================================================
       showToast — global non-blocking notification
       Requirements: 5.4, 6.3
    ========================================================= */
    /**
     * Display an auto-dismissing toast notification.
     * @param {string} message   - Text content to display.
     * @param {number} durationMs - Total display time in ms (default 4000).
     */
    function showToast(message, durationMs) {
      if (durationMs === undefined) { durationMs = 4000; }

      var container = document.getElementById('toast-container');
      if (!container) { return; }

      var toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.textContent = message;
      container.appendChild(toast);

      if (durationMs > 400) {
        // Begin fade-out 400 ms before removal
        setTimeout(function () {
          toast.classList.add('fade-out');
        }, durationMs - 400);
      }

      // Remove element from DOM after full duration
      setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, durationMs);
    }

    /* =========================================================
       StorageUtil — localStorage wrapper singleton
       Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.3
    ========================================================= */
    var StorageUtil = (function () {
      'use strict';

      var _available = false;

      /** Messages */
      var MSG_UNAVAILABLE = 'Data persistence is unavailable in this context.';
      var MSG_QUOTA       = 'Could not save your data \u2014 storage quota exceeded.';

      /**
       * Probe localStorage availability.
       * Sets the module-private _available flag.
       * If unavailable, shows a one-time toast (Req 6.3).
       */
      function init() {
        try {
          var testKey = '__pd_test__';
          window.localStorage.setItem(testKey, '1');
          window.localStorage.removeItem(testKey);
          _available = true;
        } catch (e) {
          _available = false;
          // Guard: showToast is defined later; call only if available
          if (typeof showToast === 'function') {
            showToast(MSG_UNAVAILABLE);
          }
        }
      }

      /** Returns true if localStorage is available */
      function isAvailable() {
        return _available;
      }

      /**
       * Retrieve and JSON-parse the value stored at key.
       * Returns null if unavailable, key is missing, or JSON is corrupt.
       * Req 5.5: corrupt data → silent null, no error shown.
       */
      function get(key) {
        if (!_available) return null;
        try {
          var raw = window.localStorage.getItem(key);
          if (raw === null) return null;
          return JSON.parse(raw);
        } catch (e) {
          // SyntaxError from JSON.parse → return null silently
          return null;
        }
      }

      /**
       * JSON-stringify value and store at key.
       * Returns true on success, false on failure.
       * On DOMException (quota exceeded) shows a toast (Req 5.4).
       */
      function set(key, value) {
        if (!_available) return false;
        try {
          window.localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (e) {
          // DOMException: QuotaExceededError or similar write failure
          if (typeof showToast === 'function') {
            showToast(MSG_QUOTA);
          }
          return false;
        }
      }

      /**
       * Remove the item at key from localStorage.
       * No-op if unavailable or key doesn't exist.
       */
      function remove(key) {
        if (!_available) return;
        try {
          window.localStorage.removeItem(key);
        } catch (e) {
          // Ignore errors on remove
        }
      }

      return {
        init:        init,
        isAvailable: isAvailable,
        get:         get,
        set:         set,
        remove:      remove,
        /** Storage key constants (Req 5.1) */
        PD_TODOS: 'pd_todos',
        PD_LINKS: 'pd_links'
      };
    }());

    /* =========================================================
       GreetingModule — live clock, date, and contextual greeting
       Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
    ========================================================= */
    var GreetingModule = (function () {
      'use strict';

      var WEEKDAYS = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday',
        'Thursday', 'Friday', 'Saturday'
      ];

      var MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      // Cached DOM element references (set in init)
      var _elTime     = null;
      var _elDate     = null;
      var _elGreeting = null;

      // Interval handle stored for potential cleanup
      var _intervalId = null;

      // Cache last-rendered values to avoid unnecessary DOM writes
      var _lastTime = '';
      var _lastDate = '';
      var _lastGreeting = '';

      /**
       * Return the appropriate greeting for the given hour (0–23).
       * Req 1.3 – 1.7
       * @param {number} hour - Integer in [0, 23]
       * @returns {string}
       */
      function getGreeting(hour) {
        if (hour >= 5 && hour <= 11)  { return 'Good Morning'; }
        if (hour >= 12 && hour <= 17) { return 'Good Afternoon'; }
        if (hour >= 18 && hour <= 20) { return 'Good Evening'; }
        return 'Good Night'; // 21–23 and 0–4
      }

      /**
       * Format a Date as "HH:MM:SS" with zero-padded components.
       * Req 1.1
       * @param {Date} date
       * @returns {string}
       */
      function formatTime(date) {
        var h = String(date.getHours()).padStart(2, '0');
        var m = String(date.getMinutes()).padStart(2, '0');
        var s = String(date.getSeconds()).padStart(2, '0');
        return h + ':' + m + ':' + s;
      }

      /**
       * Format a Date as "Weekday, D Month YYYY".
       * Day is non-zero-padded; weekday and month use manual lookup arrays
       * for file:// compatibility.
       * Req 1.2
       * @param {Date} date
       * @returns {string}
       */
      function formatDate(date) {
        var weekday = WEEKDAYS[date.getDay()];
        var day     = date.getDate();          // non-zero-padded integer
        var month   = MONTHS[date.getMonth()];
        var year    = date.getFullYear();
        return weekday + ', ' + day + ' ' + month + ' ' + year;
      }

      /**
       * Read the current time and patch the DOM only when values change.
       * Called once at init() and then by the 1-second interval.
       * Req 1.8: greeting text is recomputed every second from the current
       * hour, so an hour-boundary crossing is reflected within 1 second
       * automatically — no extra hour-change detection is needed.
       */
      function updateDisplay() {
        var now      = new Date();
        var timeStr  = formatTime(now);
        var dateStr  = formatDate(now);
        var greeting = getGreeting(now.getHours());

        if (_elTime && timeStr !== _lastTime) {
          _elTime.textContent = timeStr;
          _lastTime = timeStr;
        }
        if (_elDate && dateStr !== _lastDate) {
          _elDate.textContent = dateStr;
          _lastDate = dateStr;
        }
        // Req 1.8: greeting updates whenever the greeting text changes,
        // which happens exactly when the hour crosses a period boundary.
        if (_elGreeting && greeting !== _lastGreeting) {
          _elGreeting.textContent = greeting;
          _lastGreeting = greeting;
        }
      }

      /**
       * Query and cache DOM refs, render immediately, then start the
       * 1-second interval.  The interval ID is stored so callers can
       * clear it if needed (e.g., during teardown or testing).
       * Req 1.1, 1.2, 1.8
       */
      function init() {
        _elTime     = document.getElementById('greeting-time');
        _elDate     = document.getElementById('greeting-date');
        _elGreeting = document.getElementById('greeting-text');

        updateDisplay();
        _intervalId = setInterval(updateDisplay, 1000);
      }

      return {
        init:          init,
        updateDisplay: updateDisplay,
        getGreeting:   getGreeting,
        formatTime:    formatTime,
        formatDate:    formatDate
      };
    }());

    /* =========================================================
       TimerModule — 25-minute focus countdown timer
       Requirements: 2.3, 2.6, 2.7, 2.8, 2.9
    ========================================================= */
    var TimerModule = (function () {
      'use strict';

      // Module-private state
      var _state = {
        remaining:   1500,   // seconds (25 minutes)
        status:      'idle', // 'idle' | 'running' | 'paused' | 'done'
        _intervalId: null
      };

      /**
       * Called by setInterval each second while the timer is running.
       * Decrements remaining by 1; transitions to 'done' when it reaches 0.
       * Req 2.3, 2.6
       */
      function tick() {
        _state.remaining -= 1;

        if (_state.remaining <= 0) {
          _state.remaining = 0;
          _state.status = 'done';
          clearInterval(_state._intervalId);
          _state._intervalId = null;

          var display = document.getElementById('timer-display');
          if (display) {
            display.classList.add('timer-done');
          }

          renderDisplay();
          applyControlState();
        } else {
          renderDisplay();
        }
      }

      /**
       * Format remaining seconds as MM:SS and update #timer-display textContent.
       * Req 2.3
       */
      function renderDisplay() {
        var minutes = Math.floor(_state.remaining / 60);
        var seconds = _state.remaining % 60;
        var timeStr = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

        var display = document.getElementById('timer-display');
        if (display) {
          display.textContent = timeStr;
        }
      }

      /**
       * Set the disabled property of each control button according to the
       * current status value.
       *
       * | status  | Start disabled | Stop disabled | Reset disabled |
       * |---------|----------------|---------------|----------------|
       * | idle    | false          | true          | false          |
       * | running | true           | false         | false          |
       * | paused  | false          | true          | false          |
       * | done    | true           | true          | false          |
       *
       * Req 2.7, 2.8, 2.9
       */
      function applyControlState() {
        var btnStart = document.getElementById('timer-start');
        var btnStop  = document.getElementById('timer-stop');
        var btnReset = document.getElementById('timer-reset');

        if (!btnStart || !btnStop || !btnReset) { return; }

        var s = _state.status;

        // Start: disabled when running or done
        btnStart.disabled = (s === 'running' || s === 'done');

        // Stop: disabled when idle, paused, or done
        btnStop.disabled  = (s === 'idle' || s === 'paused' || s === 'done');

        // Reset: always enabled (never disabled)
        btnReset.disabled = false;
      }

      // Cached DOM element references (set in init)
      var _elDisplay = null;
      var _btnStart  = null;
      var _btnStop   = null;
      var _btnReset  = null;

      /**
       * Query and cache DOM refs, render the initial state, wire click
       * listeners on each control button.
       * Req 2.1, 2.7, 2.8, 2.9
       */
      function init() {
        _elDisplay = document.getElementById('timer-display');
        _btnStart  = document.getElementById('timer-start');
        _btnStop   = document.getElementById('timer-stop');
        _btnReset  = document.getElementById('timer-reset');

        renderDisplay();
        applyControlState();

        if (_btnStart) { _btnStart.addEventListener('click', start); }
        if (_btnStop)  { _btnStop.addEventListener('click', stop); }
        if (_btnReset) { _btnReset.addEventListener('click', reset); }
      }

      /**
       * Begin the countdown.  No-op if already running (Req 2.7).
       * Req 2.2
       */
      function start() {
        if (_state.status === 'running') { return; }
        _state.status = 'running';
        _state._intervalId = setInterval(tick, 1000);
        applyControlState();
      }

      /**
       * Pause the countdown and retain remaining time.
       * Req 2.4, 2.8
       */
      function stop() {
        clearInterval(_state._intervalId);
        _state._intervalId = null;
        _state.status = 'paused';
        applyControlState();
      }

      /**
       * Stop any active countdown and reset to 25:00 / idle.
       * Req 2.5, 2.6
       */
      function reset() {
        clearInterval(_state._intervalId);
        _state._intervalId = null;
        _state.remaining = 1500;
        _state.status = 'idle';

        var display = document.getElementById('timer-display');
        if (display) {
          display.classList.remove('timer-done');
        }

        renderDisplay();
        applyControlState();
      }

      return {
        tick:              tick,
        renderDisplay:     renderDisplay,
        applyControlState: applyControlState,
        init:              init,
        start:             start,
        stop:              stop,
        reset:             reset
      };
    }());

    /* =========================================================
       TodoModule — to-do list with add, toggle, delete
       Requirements: 3.1, 3.2, 3.3, 3.4, 3.8, 3.9, 3.10
    ========================================================= */
    var TodoModule = (function () {
      'use strict';

      // ── Data model ────────────────────────────────────────────
      // Loaded from localStorage on module init; falls back to []
      // if key is absent, null, or not an array.
      var tasks = (function () {
        var stored = StorageUtil.get(StorageUtil.PD_TODOS);
        return (Array.isArray(stored)) ? stored : [];
      }());

      /**
       * Build and return a <li> element representing the given task.
       * Req 3.5, 3.10
       * @param {Object} task
       * @returns {HTMLLIElement}
       */
      function renderTask(task) {
        var li = document.createElement('li');
        li.setAttribute('data-id', task.id);
        li.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;';

        if (task.completed) {
          li.classList.add('todo-completed');
        }

        // Checkbox + text label
        var label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:0.4rem;flex:1;cursor:pointer;';

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', function () {
          toggleTask(task.id);
        });

        var textSpan = document.createElement('span');
        textSpan.className = 'todo-task-text';
        textSpan.textContent = task.text;

        label.appendChild(checkbox);
        label.appendChild(textSpan);

        // Delete button
        var deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'btn-delete';
        deleteBtn.setAttribute('aria-label', 'Delete task');
        deleteBtn.addEventListener('click', function () {
          deleteTask(task.id);
        });

        li.appendChild(label);
        li.appendChild(deleteBtn);

        return li;
      }

      /**
       * Clear #todo-list and re-render all tasks.
       * Req 3.9, 3.10
       */
      function renderList() {
        var list = document.getElementById('todo-list');
        if (!list) { return; }
        list.innerHTML = '';
        for (var i = 0; i < tasks.length; i++) {
          list.appendChild(renderTask(tasks[i]));
        }
      }

      /**
       * Replace the task row with an inline edit field.
       * Req 3.5
       * @param {string} id
       */
      function beginEdit(id) {
        var li = document.querySelector('#todo-list [data-id="' + id + '"]');
        if (!li) { return; }

        // Find the current task text
        var task = null;
        for (var i = 0; i < tasks.length; i++) {
          if (tasks[i].id === id) { task = tasks[i]; break; }
        }
        if (!task) { return; }

        // Replace li content with edit UI
        li.innerHTML = '';
        li.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;';

        var input = document.createElement('input');
        input.type = 'text';
        input.value = task.text;
        input.style.flex = '1';

        var confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Confirm';
        confirmBtn.setAttribute('aria-label', 'Confirm edit');
        confirmBtn.addEventListener('click', function () {
          confirmEdit(id, input.value);
        });

        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.setAttribute('aria-label', 'Cancel edit');
        cancelBtn.addEventListener('click', function () {
          renderList();
        });

        li.appendChild(input);
        li.appendChild(confirmBtn);
        li.appendChild(cancelBtn);

        input.focus();
      }

      /**
       * Validate and apply an in-place edit to a task.
       * If newText is invalid: keep original text and re-render (Req 3.7).
       * If valid: update task.text, flush to storage, re-render (Req 3.6).
       * @param {string} id
       * @param {string} newText
       */
      function confirmEdit(id, newText) {
        if (!validateText(newText)) {
          // Reject edit — return row to display mode with original text
          renderList();
          return;
        }

        for (var i = 0; i < tasks.length; i++) {
          if (tasks[i].id === id) {
            tasks[i].text = newText.trim();
            break;
          }
        }

        StorageUtil.set(StorageUtil.PD_TODOS, tasks);
        renderList();
      }

      /**
       * Return true only if text contains at least one non-whitespace character.
       * Req 3.3
       * @param {string} text
       * @returns {boolean}
       */
      function validateText(text) {
        return text.trim().length > 0;
      }

      /**
       * Add a new task to the list if text passes validation.
       * On failure: sets #todo-validation message and returns.
       * On success: clears validation, appends task, persists, renders,
       *             and clears #todo-input.
       * Req 3.1, 3.2, 3.3
       * @param {string} text
       */
      function addTask(text) {
        var validationEl = document.getElementById('todo-validation');

        if (!validateText(text)) {
          if (validationEl) {
            validationEl.textContent = 'Task cannot be empty.';
          }
          return;
        }

        // Clear any previous validation message
        if (validationEl) {
          validationEl.textContent = '';
        }

        // Generate a unique ID (prefer crypto.randomUUID for collision safety)
        var id = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : Date.now().toString();

        tasks.push({
          id:        id,
          text:      text.trim(),
          completed: false,
          createdAt: Date.now()
        });

        StorageUtil.set(StorageUtil.PD_TODOS, tasks);
        renderList();

        var inputEl = document.getElementById('todo-input');
        if (inputEl) {
          inputEl.value = '';
        }
      }

      /**
       * Flip the completed state of the task with the given id,
       * persist the updated array, and re-render.
       * Req 3.4
       * @param {string} id
       */
      function toggleTask(id) {
        for (var i = 0; i < tasks.length; i++) {
          if (tasks[i].id === id) {
            tasks[i].completed = !tasks[i].completed;
            break;
          }
        }
        StorageUtil.set(StorageUtil.PD_TODOS, tasks);
        renderList();
      }

      /**
       * Remove the task with the given id from the array,
       * persist the updated array, and re-render.
       * Req 3.8
       * @param {string} id
       */
      function deleteTask(id) {
        tasks = tasks.filter(function (t) { return t.id !== id; });
        StorageUtil.set(StorageUtil.PD_TODOS, tasks);
        renderList();
      }

      /**
       * Initialise the module: wire the #todo-form submit handler.
       * Req 3.1, 3.9
       */
      function init() {
        var form = document.getElementById('todo-form');
        if (form) {
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var inputEl = document.getElementById('todo-input');
            addTask(inputEl ? inputEl.value : '');
          });
        }
        renderList();
      }

      return {
        init:         init,
        validateText: validateText,
        addTask:      addTask,
        toggleTask:   toggleTask,
        deleteTask:   deleteTask,
        renderList:   renderList,
        renderTask:   renderTask,
        beginEdit:    beginEdit,
        confirmEdit:  confirmEdit,
        /** Direct accessor for the internal tasks array (useful for testing). */
        get _tasks() { return tasks; }
      };
    }());

    /* =========================================================
       QuickLinksModule — bookmarks / quick-launch widget
       Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 4.8
    ========================================================= */
    var QuickLinksModule = (function () {
      'use strict';

      // In-memory link list loaded from localStorage at init time (Req 4.7)
      var links = (function () {
        var stored = StorageUtil.get(StorageUtil.PD_LINKS);
        return (Array.isArray(stored)) ? stored : [];
      }());

      // Validation span element reference (set in init)
      var _elValidation = null;

      /**
       * Return true if label has at least one non-whitespace character.
       * Req 4.1, 4.3
       * @param {string} label
       * @returns {boolean}
       */
      function validateLabel(label) {
        return label.trim().length > 0;
      }

      /**
       * Return true if and only if url starts with "http://" or "https://".
       * Case-sensitive; no other checks performed.
       * Req 4.2, 4.4
       * @param {string} url
       * @returns {boolean}
       */
      function validateUrl(url) {
        return url.startsWith('http://') || url.startsWith('https://');
      }

      /**
       * Return true if any link in the current list has the same URL.
       * Req 4.8
       * @param {string} url
       * @returns {boolean}
       */
      function isDuplicateUrl(url) {
        for (var i = 0; i < links.length; i++) {
          if (links[i].url === url) { return true; }
        }
        return false;
      }

      /**
       * Attempt to add a new link.  Runs all validation checks in order,
       * populating #links-validation on the first failure.
       * On success: persists, renders, and clears both input fields.
       * Req 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 4.8
       * @param {string} label
       * @param {string} url
       */
      function addLink(label, url) {
        var elValidation = _elValidation ||
          document.getElementById('links-validation');

        function setMsg(msg) {
          if (elValidation) { elValidation.textContent = msg; }
        }

        // 1. Validate label
        if (!validateLabel(label)) {
          setMsg('Label cannot be empty.');
          return;
        }

        // 2. Validate URL — empty check first
        if (url === '') {
          setMsg('URL cannot be empty.');
          return;
        }

        // 3. Validate URL scheme
        if (!validateUrl(url)) {
          setMsg('URL must begin with http:// or https://');
          return;
        }

        // 4. Check for duplicate URL
        if (isDuplicateUrl(url)) {
          setMsg('This URL is already in your links.');
          return;
        }

        // 5. Enforce 50-link cap (Req 4.2)
        if (links.length >= 50) {
          setMsg('Maximum of 50 links reached.');
          return;
        }

        // Success — clear validation message
        if (elValidation) { elValidation.textContent = ''; }

        // Generate unique ID (Req design: crypto.randomUUID or Date.now fallback)
        var id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : String(Date.now());

        // Push new link object
        links.push({
          id:        id,
          label:     label.trim(),
          url:       url,
          createdAt: Date.now()
        });

        // Flush to localStorage (Req 5.3)
        StorageUtil.set(StorageUtil.PD_LINKS, links);

        // Re-render list
        renderLinks();

        // Clear both input fields
        var elLabel = document.getElementById('link-label-input');
        var elUrl   = document.getElementById('link-url-input');
        if (elLabel) { elLabel.value = ''; }
        if (elUrl)   { elUrl.value   = ''; }
      }

      /**
       * Remove the link with the given id, flush, and re-render.
       * Req 4.6
       * @param {string} id
       */
      function deleteLink(id) {
        links = links.filter(function (link) { return link.id !== id; });
        StorageUtil.set(StorageUtil.PD_LINKS, links);
        renderLinks();
      }

      /**
       * Open a URL in a new tab with noopener,noreferrer for security.
       * Req 4.5
       * @param {string} url
       */
      function openLink(url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }

      /**
       * Build and return a <li> element representing a single link.
       * Contains a button to open the link and a delete button.
       * Req 4.5, 4.6
       * @param {Object} link - Link object with id, label, url properties
       * @returns {HTMLLIElement}
       */
      function renderLink(link) {
        var li = document.createElement('li');

        // Open button (pill left half)
        var btnOpen = document.createElement('button');
        btnOpen.textContent = link.label;
        btnOpen.className = 'btn-link-open';
        btnOpen.setAttribute('aria-label', 'Open ' + link.label);
        btnOpen.addEventListener('click', function () {
          openLink(link.url);
        });

        // Delete (×) button (pill right half)
        var btnDelete = document.createElement('button');
        btnDelete.textContent = '\u00d7';
        btnDelete.className = 'btn-link-delete';
        btnDelete.setAttribute('aria-label', 'Delete ' + link.label);
        btnDelete.addEventListener('click', function () {
          deleteLink(link.id);
        });

        li.appendChild(btnOpen);
        li.appendChild(btnDelete);
        return li;
      }

      /**
       * Clear #links-list and re-render all links from the in-memory array.
       * Req 4.7
       */
      function renderLinks() {
        var list = document.getElementById('links-list');
        if (!list) { return; }
        list.innerHTML = '';
        for (var i = 0; i < links.length; i++) {
          list.appendChild(renderLink(links[i]));
        }
      }

      /**
       * Wire the #links-form submit handler and perform initial render.
       * Caches the validation element reference.
       * Req 4.1, 4.5, 4.6, 4.7
       */
      function init() {
        _elValidation = document.getElementById('links-validation');

        var form = document.getElementById('links-form');
        if (form) {
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var elLabel = document.getElementById('link-label-input');
            var elUrl   = document.getElementById('link-url-input');
            var label   = elLabel ? elLabel.value : '';
            var url     = elUrl   ? elUrl.value   : '';
            addLink(label, url);
          });
        }

        renderLinks();
      }

      return {
        validateLabel:  validateLabel,
        validateUrl:    validateUrl,
        isDuplicateUrl: isDuplicateUrl,
        addLink:        addLink,
        deleteLink:     deleteLink,
        renderLinks:    renderLinks,
        renderLink:     renderLink,
        openLink:       openLink,
        init:           init
      };
    }());

    /* =========================================================
       ThemeModule — dark / light mode toggle with persistence
    ========================================================= */
    var ThemeModule = (function () {
      'use strict';

      var STORAGE_KEY = 'pd_theme';
      var DARK        = 'dark';
      var LIGHT       = 'light';

      var _btn  = null;
      var _icon = null;

      /** Apply theme to <html> and update the button icon */
      function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (_icon) {
          _icon.textContent = (theme === DARK) ? '☀️' : '🌙';
        }
        if (_btn) {
          _btn.setAttribute('aria-label',
            (theme === DARK) ? 'Switch to light mode' : 'Switch to dark mode'
          );
        }
      }

      /** Toggle between dark and light, persist to localStorage */
      function toggle() {
        var current = document.documentElement.getAttribute('data-theme');
        var next    = (current === DARK) ? LIGHT : DARK;
        StorageUtil.set(STORAGE_KEY, next);
        applyTheme(next);
      }

      /**
       * Initialise: read saved preference (or respect OS preference),
       * apply it, and wire the toggle button.
       */
      function init() {
        _btn  = document.getElementById('theme-toggle');
        _icon = document.getElementById('theme-icon');

        // Determine initial theme: saved preference → OS preference → light
        var saved = StorageUtil.get(STORAGE_KEY);
        var prefersDark = window.matchMedia &&
                          window.matchMedia('(prefers-color-scheme: dark)').matches;
        var initial = saved || (prefersDark ? DARK : LIGHT);

        applyTheme(initial);

        if (_btn) {
          _btn.addEventListener('click', toggle);
        }

        // Sync if user changes OS preference while page is open (no saved pref)
        if (window.matchMedia) {
          window.matchMedia('(prefers-color-scheme: dark)')
            .addEventListener('change', function (e) {
              if (!StorageUtil.get(STORAGE_KEY)) {
                applyTheme(e.matches ? DARK : LIGHT);
              }
            });
        }
      }

      return { init: init, toggle: toggle };
    }());

    document.addEventListener('DOMContentLoaded', function () {
      StorageUtil.init();
      ThemeModule.init();
      GreetingModule.init();
      TimerModule.init();
      TodoModule.init();
      QuickLinksModule.init();
    });