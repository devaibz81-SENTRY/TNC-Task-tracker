import { ConvexClient } from "convex/browser";
import { showToast } from "./toast.js";

const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL);

// ── Auth Guard ──────────────────────────────────────────────────────────────
const stored = localStorage.getItem("taskUser");
if (!stored) { window.location.href = "/"; }
const user = JSON.parse(stored);

// ── DOM Refs ─────────────────────────────────────────────────────────────────
const usernameDisplay = document.getElementById("username-display");
const userAvatarInitial = document.getElementById("user-avatar-initial");
const logoutBtn = document.getElementById("logout-btn");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const statToday = document.getElementById("stat-today");
const statWeek = document.getElementById("stat-week");
const statOT = document.getElementById("stat-ot");
const statActive = document.getElementById("stat-active");
const toggleTaskForm = document.getElementById("toggle-task-form");
const addTaskWrapper = document.getElementById("add-task-form-wrapper");
const addTaskForm = document.getElementById("add-task-form");
const cancelTaskBtn = document.getElementById("cancel-task-btn");
const taskTitleInput = document.getElementById("task-title");
const taskDescInput = document.getElementById("task-desc");
const logOverlay = document.getElementById("log-time-overlay");
const logTimeForm = document.getElementById("log-time-form");
const logTaskName = document.getElementById("log-task-name");
const logTaskSelect = document.getElementById("log-task-select");
const logHours = document.getElementById("log-hours");
const logDate = document.getElementById("log-date");
const cancelLogBtn = document.getElementById("cancel-log-btn");
const btnRegular = document.getElementById("btn-regular");
const btnOT = document.getElementById("btn-ot");
const prevWeekBtn = document.getElementById("prev-week");
const nextWeekBtn = document.getElementById("next-week");
const todayBtn = document.getElementById("today-btn");
const weekLabel = document.getElementById("week-label");
const weekGrid = document.getElementById("week-grid");
// Day Detail Panel
const dayDetailPanel = document.getElementById("day-detail-panel");
const dayDetailTitle = document.getElementById("day-detail-title");
const dayDetailHours = document.getElementById("day-detail-hours");
const dayEntryList = document.getElementById("day-entry-list");
const dayLogBtn = document.getElementById("day-log-btn");
const dayDetailClose = document.getElementById("day-detail-close");
// Analytics Modal
const analyticsOverlay = document.getElementById("analytics-overlay");
const analyticsTaskName = document.getElementById("analytics-task-name");
const analyticsTotal = document.getElementById("analytics-total");
const analyticsReg = document.getElementById("analytics-reg");
const analyticsOTEl = document.getElementById("analytics-ot");
const analyticsEntries = document.getElementById("analytics-entries");
const closeAnalytics = document.getElementById("close-analytics");

// ── State ─────────────────────────────────────────────────────────────────────
let allTasks = [];
let allEntries = [];
let activeTimers = {};
let currentLogTaskId = null;
let isOT = false;
let weekOffset = 0;
let selectedDate = null; // currently clicked calendar date

// ── Init ──────────────────────────────────────────────────────────────────────
usernameDisplay.textContent = user.username;
userAvatarInitial.textContent = user.username.charAt(0).toUpperCase();
logDate.value = todayStr();

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtH(h) {
    if (!h || h === 0) return "0h";
    const r = Math.round(h * 10) / 10;
    return `${r}h`;
}

function getWeekDates(offset = 0) {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });
}

function fmtTimer(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
}

function fmtDatePretty(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function taskById(id) { return allTasks.find(t => t._id === id); }

// ── Logout ────────────────────────────────────────────────────────────────────
logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("taskUser");
    window.location.href = "/";
});

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats(entries, tasks) {
    const today = todayStr();
    const weekDays = getWeekDates(0).map(d => d.toISOString().slice(0, 10));
    const ws = weekDays[0], we = weekDays[6];
    let todayH = 0, weekH = 0, weekOTH = 0;
    entries.forEach(e => {
        if (e.date === today) todayH += e.hours;
        if (e.date >= ws && e.date <= we) {
            weekH += e.hours;
            if (e.isOvertime) weekOTH += e.hours;
        }
    });
    statToday.textContent = fmtH(todayH);
    statWeek.textContent = fmtH(weekH);
    statOT.textContent = fmtH(weekOTH);
    statActive.textContent = tasks.filter(t => t.status !== "completed").length;
}

// ── Weekly Calendar ───────────────────────────────────────────────────────────
function renderCalendar(entries) {
    const days = getWeekDates(weekOffset);
    const today = todayStr();
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    weekLabel.textContent = `${MONTHS[days[0].getMonth()]} ${days[0].getDate()} — ${MONTHS[days[6].getMonth()]} ${days[6].getDate()}`;

    // Build per-day data keyed by date string
    const dayMap = {};
    entries.forEach(e => {
        if (!dayMap[e.date]) dayMap[e.date] = { reg: 0, ot: 0, taskMap: {} };
        e.isOvertime ? dayMap[e.date].ot += e.hours : dayMap[e.date].reg += e.hours;
        if (!dayMap[e.date].taskMap[e.taskId]) dayMap[e.date].taskMap[e.taskId] = { reg: 0, ot: 0 };
        e.isOvertime ? dayMap[e.date].taskMap[e.taskId].ot += e.hours
            : dayMap[e.date].taskMap[e.taskId].reg += e.hours;
    });

    weekGrid.innerHTML = days.map((d, i) => {
        const k = d.toISOString().slice(0, 10);
        const data = dayMap[k];
        const total = data ? data.reg + data.ot : 0;
        const isToday = k === today;
        const isSel = k === selectedDate;

        // Task blocks for this day
        let blocksHtml = '';
        if (data && Object.keys(data.taskMap).length > 0) {
            Object.entries(data.taskMap).forEach(([tid, th]) => {
                const t = taskById(tid);
                const label = t ? t.title.slice(0, 14) : 'Task';
                const hasOT = th.ot > 0;
                // Regular block
                if (th.reg > 0) {
                    blocksHtml += `<div class="task-block" title="${t ? t.title : ''}: ${fmtH(th.reg)} regular">${label} ${fmtH(th.reg)}</div>`;
                }
                // OT block separate
                if (th.ot > 0) {
                    blocksHtml += `<div class="task-block ot-block" title="${t ? t.title : ''}: ${fmtH(th.ot)} OT">OT ${label} ${fmtH(th.ot)}</div>`;
                }
            });
        } else {
            blocksHtml = `<div class="task-block empty-block">—</div>`;
        }

        const totalStr = total > 0
            ? `${fmtH(data.reg)} reg${data.ot > 0 ? ` +${fmtH(data.ot)} OT` : ''}`
            : '';
        const hasOT = data && data.ot > 0;

        return `
      <div class="day-col ${isToday ? 'today-col' : ''} ${isSel ? 'selected-col' : ''}"
           onclick="window.selectDay('${k}')">
        <div class="day-col-header">
          <div class="day-col-name">${DAYS[i]}</div>
          <div class="day-col-date">${d.getDate()}</div>
        </div>
        ${totalStr ? `<div class="day-col-total ${hasOT ? 'has-ot' : ''}">${totalStr}</div>` : ''}
        <div class="day-col-body">${blocksHtml}</div>
      </div>`;
    }).join('');
}

prevWeekBtn.addEventListener("click", () => { weekOffset--; selectedDate = null; dayDetailPanel.classList.add("hidden"); renderCalendar(allEntries); });
nextWeekBtn.addEventListener("click", () => { weekOffset++; selectedDate = null; dayDetailPanel.classList.add("hidden"); renderCalendar(allEntries); });
todayBtn.addEventListener("click", () => { weekOffset = 0; selectedDate = null; dayDetailPanel.classList.add("hidden"); renderCalendar(allEntries); });

// ── Day Selection ─────────────────────────────────────────────────────────────
window.selectDay = (dateStr) => {
    selectedDate = dateStr;
    renderCalendar(allEntries);

    // Get all entries for this day
    const dayEntries = allEntries.filter(e => e.date === dateStr);
    let totalH = 0, otH = 0;
    dayEntries.forEach(e => { totalH += e.hours; if (e.isOvertime) otH += e.hours; });

    dayDetailTitle.textContent = fmtDatePretty(dateStr);
    dayDetailHours.textContent = totalH > 0
        ? `${fmtH(totalH)} logged (${fmtH(totalH - otH)} reg · ${fmtH(otH)} OT)`
        : 'No time logged — click "+ Log Time" to add.';

    if (dayEntries.length === 0) {
        dayEntryList.innerHTML = `<div style="color:var(--text-3); font-size:0.88rem; text-align:center; padding:0.75rem;">No entries for this day.</div>`;
    } else {
        // Group by task
        const byTask = {};
        dayEntries.forEach(e => {
            if (!byTask[e.taskId]) byTask[e.taskId] = { reg: 0, ot: 0, entries: [] };
            e.isOvertime ? byTask[e.taskId].ot += e.hours : byTask[e.taskId].reg += e.hours;
            byTask[e.taskId].entries.push(e);
        });
        dayEntryList.innerHTML = Object.entries(byTask).map(([tid, data]) => {
            const t = taskById(tid);
            const title = t ? t.title : 'Unknown Task';
            const status = t ? t.status : '';
            const total = data.reg + data.ot;
            return `
        <div style="background:var(--surface-3); border-radius:var(--radius-sm); padding:0.65rem 0.85rem; display:flex; align-items:center; justify-content:space-between;">
          <div>
            <div style="font-weight:600; font-size:0.9rem;">${title}</div>
            <div style="font-size:0.75rem; color:var(--text-3);">${fmtH(data.reg)} reg${data.ot > 0 ? ` · ${fmtH(data.ot)} OT` : ''}</div>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <div style="font-size:1rem; font-weight:700; color:var(--electric);">${fmtH(total)}</div>
            <button class="btn btn-sm btn-secondary" style="width:auto; font-size:0.75rem; padding:0.3rem 0.6rem;" onclick="window.showAnalytics('${tid}')">Analytics</button>
          </div>
        </div>`;
        }).join('');
    }

    dayDetailPanel.classList.remove("hidden");
    dayDetailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

dayDetailClose.addEventListener("click", () => {
    dayDetailPanel.classList.add("hidden");
    selectedDate = null;
    renderCalendar(allEntries);
});

// Open log time modal pre-filled with the selected date
dayLogBtn.addEventListener("click", () => {
    // Show task selector since no task is pre-selected
    currentLogTaskId = null;
    logTaskName.classList.add("hidden");
    logTaskSelect.classList.remove("hidden");

    // Populate task selector
    const activeTasks = allTasks.filter(t => t.status !== "completed");
    logTaskSelect.innerHTML = activeTasks.map(t =>
        `<option value="${t._id}">${t.title}</option>`
    ).join('');
    if (activeTasks.length === 0) {
        logTaskSelect.innerHTML = '<option disabled>No active tasks — create one first</option>';
    }

    logDate.value = selectedDate || todayStr();
    logOverlay.classList.remove("hidden");
});

// ── Task Analytics ─────────────────────────────────────────────────────────────
window.showAnalytics = (taskId) => {
    const task = taskById(taskId);
    if (!task) return;

    const taskEntries = allEntries.filter(e => e.taskId === taskId);
    let reg = 0, ot = 0;
    taskEntries.forEach(e => { e.isOvertime ? ot += e.hours : reg += e.hours; });

    analyticsTaskName.textContent = task.title;
    analyticsTotal.textContent = fmtH(reg + ot);
    analyticsReg.textContent = fmtH(reg);
    analyticsOTEl.textContent = fmtH(ot);

    // Sorted entries, newest first
    const sorted = [...taskEntries].sort((a, b) => b.date.localeCompare(a.date));
    analyticsEntries.innerHTML = sorted.length === 0
        ? `<div style="color:var(--text-3); text-align:center; padding:1rem; font-size:0.85rem;">No time logged yet.</div>`
        : sorted.map(e => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-3); border-radius:var(--radius-sm); padding:0.55rem 0.8rem; font-size:0.85rem;">
          <span style="color:var(--text-2);">${fmtDatePretty(e.date)}</span>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <span style="font-weight:700; color:${e.isOvertime ? 'var(--warning)' : 'var(--electric)'};">${fmtH(e.hours)}</span>
            ${e.isOvertime ? '<span style="font-size:0.7rem; background:rgba(245,158,11,0.15); color:var(--warning); border-radius:4px; padding:1px 5px;">OT</span>' : ''}
          </div>
        </div>`).join('');

    analyticsOverlay.classList.remove("hidden");
};

closeAnalytics.addEventListener("click", () => analyticsOverlay.classList.add("hidden"));
analyticsOverlay.addEventListener("click", e => { if (e.target === analyticsOverlay) analyticsOverlay.classList.add("hidden"); });

// ── Add Task ──────────────────────────────────────────────────────────────────
toggleTaskForm.addEventListener("click", () => {
    addTaskWrapper.classList.toggle("hidden");
    if (!addTaskWrapper.classList.contains("hidden")) taskTitleInput.focus();
});
cancelTaskBtn.addEventListener("click", () => addTaskWrapper.classList.add("hidden"));

addTaskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = taskTitleInput.value.trim();
    const description = taskDescInput.value.trim();
    if (!title) return;
    const btn = addTaskForm.querySelector("button[type='submit']");
    btn.disabled = true;
    try {
        await convex.mutation("tasks:createTask", { userId: user._id, title, description });
        taskTitleInput.value = "";
        taskDescInput.value = "";
        addTaskWrapper.classList.add("hidden");
        showToast("Task created!", "success");
    } catch (err) { console.error(err); showToast("Failed to create task.", "error"); }
    finally { btn.disabled = false; }
});

// ── OT Toggle ─────────────────────────────────────────────────────────────────
btnRegular.addEventListener("click", () => {
    isOT = false;
    btnRegular.classList.add("active-regular");
    btnOT.classList.remove("active-ot");
});
btnOT.addEventListener("click", () => {
    isOT = true;
    btnOT.classList.add("active-ot");
    btnRegular.classList.remove("active-regular");
});

// ── Log Time Modal ─────────────────────────────────────────────────────────────
cancelLogBtn.addEventListener("click", () => { logOverlay.classList.add("hidden"); currentLogTaskId = null; });
logOverlay.addEventListener("click", e => { if (e.target === logOverlay) { logOverlay.classList.add("hidden"); currentLogTaskId = null; } });

logTimeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    // Resolve task ID — either preset or from selector
    const taskId = currentLogTaskId || logTaskSelect.value;
    if (!taskId) { showToast("Please select a task.", "error"); return; }
    const hours = parseFloat(logHours.value);
    const date = logDate.value;
    if (!hours || hours <= 0 || !date) { showToast("Fill in all fields.", "error"); return; }

    const btn = logTimeForm.querySelector("button[type='submit']");
    btn.disabled = true;
    try {
        await convex.mutation("time_entries:logTime", {
            userId: user._id, taskId,
            hours, isOvertime: isOT, date
        });
        logOverlay.classList.add("hidden");
        currentLogTaskId = null;
        logHours.value = "";
        logDate.value = todayStr();
        isOT = false;
        btnRegular.classList.add("active-regular");
        btnOT.classList.remove("active-ot");
        // Restore normal modal view
        logTaskName.classList.remove("hidden");
        logTaskSelect.classList.add("hidden");
        showToast("Time logged!", "success");
        // Refresh day detail if open
        if (selectedDate) window.selectDay(selectedDate);
    } catch (err) { console.error(err); showToast("Failed to log time.", "error"); }
    finally { btn.disabled = false; }
});

function openLogModal(taskId, taskTitle) {
    currentLogTaskId = taskId;
    logTaskName.textContent = taskTitle;
    logTaskName.classList.remove("hidden");
    logTaskSelect.classList.add("hidden");
    logDate.value = selectedDate || todayStr();
    isOT = false;
    btnRegular.classList.add("active-regular");
    btnOT.classList.remove("active-ot");
    logOverlay.classList.remove("hidden");
}

// ── Stream Timer ──────────────────────────────────────────────────────────────
function startTimer(taskId) {
    if (activeTimers[taskId]) return;
    Object.keys(activeTimers).forEach(tid => stopTimer(tid, true));
    const startMs = Date.now();
    const displayEl = document.getElementById(`timer-${taskId}`);
    const btnEl = document.getElementById(`timer-btn-${taskId}`);

    activeTimers[taskId] = {
        startMs,
        intervalId: setInterval(() => {
            const el = document.getElementById(`timer-${taskId}`);
            if (el) el.textContent = fmtTimer(Date.now() - startMs);
        }, 1000)
    };
    if (displayEl) displayEl.textContent = "00:00";
    if (btnEl) { btnEl.classList.add("running"); btnEl.title = "Stop Timer"; btnEl.textContent = "■"; }
    const card = document.getElementById(`task-card-${taskId}`);
    if (card) card.classList.add("timing");
}

async function stopTimer(taskId, silent = false) {
    const timer = activeTimers[taskId];
    if (!timer) return;
    clearInterval(timer.intervalId);
    const elapsed = Date.now() - timer.startMs;
    delete activeTimers[taskId];

    const displayEl = document.getElementById(`timer-${taskId}`);
    const btnEl = document.getElementById(`timer-btn-${taskId}`);
    const card = document.getElementById(`task-card-${taskId}`);
    if (displayEl) displayEl.textContent = "";
    if (btnEl) { btnEl.classList.remove("running"); btnEl.title = "Start Timer"; btnEl.textContent = "▶"; }
    if (card) card.classList.remove("timing");

    if (silent || elapsed < 5000) return;
    const hours = Math.round((elapsed / 3600000) * 4) / 4;
    if (hours < 0.25) { showToast("Too short to log. Use '+ Log' manually.", "info"); return; }

    const task = taskById(taskId);
    const otChoice = confirm(`Log ${fmtH(hours)} to "${task?.title || 'Task'}"?\n\nOK = Regular Time · Cancel = Overtime`);
    try {
        await convex.mutation("time_entries:logTime", {
            userId: user._id, taskId, hours, isOvertime: !otChoice,
            date: todayStr(), startTime: timer.startMs, endTime: Date.now()
        });
        showToast(`${fmtH(hours)} logged${!otChoice ? ' (OT)' : ''}!`, "success");
    } catch (err) { console.error(err); showToast("Failed to save.", "error"); }
}

// ── Task Rendering ────────────────────────────────────────────────────────────
function renderTasks(tasks, entries) {
    taskCount.textContent = tasks.length;
    if (tasks.length === 0) {
        taskList.innerHTML = `<div style="text-align:center; padding:2.5rem; color:var(--text-3);">No tasks yet. Hit "+ Add New Task" above!</div>`;
        return;
    }
    const taskHours = {};
    entries.forEach(e => {
        if (!taskHours[e.taskId]) taskHours[e.taskId] = { reg: 0, ot: 0 };
        e.isOvertime ? taskHours[e.taskId].ot += e.hours : taskHours[e.taskId].reg += e.hours;
    });
    const order = { in_progress: 0, pending: 1, completed: 2 };
    const sorted = [...tasks].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

    taskList.innerHTML = sorted.map(task => {
        const th = taskHours[task._id] || { reg: 0, ot: 0 };
        const total = th.reg + th.ot;
        const isRunning = !!activeTimers[task._id];
        const isCompleted = task.status === "completed";
        return `
      <div class="task-card ${isCompleted ? 'completed' : ''} ${isRunning ? 'timing' : ''}" id="task-card-${task._id}">
        <div class="task-info">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">
            <span class="task-status-badge badge-${task.status}">${task.status.replace('_', ' ')}</span>
            ${total > 0
                ? `<span style="cursor:pointer; color:var(--electric); text-decoration:underline dotted;" onclick="window.showAnalytics('${task._id}')">⏱ ${fmtH(th.reg)} reg${th.ot > 0 ? ` · ${fmtH(th.ot)} OT` : ''} — View Analytics</span>`
                : '<span>No time logged</span>'}
          </div>
        </div>
        <div class="task-actions">
          ${!isCompleted ? `
            <span class="timer-display" id="timer-${task._id}">${isRunning ? fmtTimer(Date.now() - activeTimers[task._id].startMs) : ''}</span>
            <button class="timer-btn ${isRunning ? 'running' : ''}" id="timer-btn-${task._id}"
              onclick="window.toggleTimer('${task._id}')"
              title="${isRunning ? 'Stop Timer' : 'Start Timer'}">${isRunning ? '■' : '▶'}</button>
            <button class="btn btn-sm btn-secondary" onclick="window.openLog('${task._id}', '${task.title.replace(/'/g, "\\'")}')">+ Log</button>
            <button class="btn btn-sm btn-electric" style="width:auto;" onclick="window.markDone('${task._id}')">✓</button>
          ` : `<span style="font-size:0.8rem; color:var(--success);">✓ Done</span>`}
        </div>
      </div>`;
    }).join('');
}

// ── Global Handlers ───────────────────────────────────────────────────────────
window.toggleTimer = (taskId) => activeTimers[taskId] ? stopTimer(taskId) : startTimer(taskId);
window.openLog = (taskId, title) => openLogModal(taskId, title);
window.markDone = async (taskId) => {
    if (activeTimers[taskId]) await stopTimer(taskId);
    try {
        await convex.mutation("tasks:updateTaskStatus", { taskId, status: "completed" });
        showToast("Task complete! 🎉", "success");
    } catch (err) { console.error(err); showToast("Failed to update.", "error"); }
};

// ── Live Subscriptions ────────────────────────────────────────────────────────
convex.onUpdate("tasks:getUserTasks", { userId: user._id }, (tasks) => {
    allTasks = tasks || [];
    renderTasks(allTasks, allEntries);
    updateStats(allEntries, allTasks);
});

convex.onUpdate("time_entries:getUserTimeEntries", { userId: user._id }, (entries) => {
    allEntries = entries || [];
    renderTasks(allTasks, allEntries);
    updateStats(allEntries, allTasks);
    renderCalendar(allEntries);
    // Refresh open day panel
    if (selectedDate) window.selectDay(selectedDate);
});
