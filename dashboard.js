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

// ── State ────────────────────────────────────────────────────────────────────
let allTasks = [];
let allEntries = [];
let activeTimers = {}; // taskId → { startMs, intervalId }
let currentLogTaskId = null;
let isOT = false;
let weekOffset = 0;  // 0 = current week, -1 = last week, etc.

// ── Init ─────────────────────────────────────────────────────────────────────
usernameDisplay.textContent = user.username;
userAvatarInitial.textContent = user.username.charAt(0).toUpperCase();
logDate.value = todayStr();

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function formatHours(h) {
    if (!h || h === 0) return "0h";
    const rounded = Math.round(h * 10) / 10;
    return rounded % 1 === 0 ? `${rounded}h` : `${rounded}h`;
}

function getWeekDates(offset = 0) {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        days.push(d);
    }
    return days;
}

function fmtTimer(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
}

// ── Logout ───────────────────────────────────────────────────────────────────
logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("taskUser");
    window.location.href = "/";
});

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats(entries, tasks) {
    const today = todayStr();
    const weekDays = getWeekDates(0).map(d => d.toISOString().slice(0, 10));
    const weekStart = weekDays[0], weekEnd = weekDays[6];

    let todayReg = 0, todayOT = 0, weekReg = 0, weekOT = 0;
    entries.forEach(e => {
        if (e.date === today) { e.isOvertime ? todayOT += e.hours : todayReg += e.hours; }
        if (e.date >= weekStart && e.date <= weekEnd) {
            e.isOvertime ? weekOT += e.hours : weekReg += e.hours;
        }
    });

    const activeTasks = tasks.filter(t => t.status !== "completed").length;
    statToday.textContent = formatHours(todayReg + todayOT);
    statWeek.textContent = formatHours(weekReg + weekOT);
    statOT.textContent = formatHours(weekOT);
    statActive.textContent = activeTasks;
}

// ── Weekly Calendar ───────────────────────────────────────────────────────────
function renderCalendar(entries) {
    const days = getWeekDates(weekOffset);
    const today = todayStr();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    weekLabel.textContent = `${months[days[0].getMonth()]} ${days[0].getDate()} — ${months[days[6].getMonth()]} ${days[6].getDate()}`;

    // Build per-day totals from entries
    const dayMap = {};
    entries.forEach(e => {
        if (!dayMap[e.date]) dayMap[e.date] = { reg: 0, ot: 0 };
        e.isOvertime ? dayMap[e.date].ot += e.hours : dayMap[e.date].reg += e.hours;
    });

    const maxHours = Math.max(...days.map(d => {
        const k = d.toISOString().slice(0, 10);
        return dayMap[k] ? (dayMap[k].reg + dayMap[k].ot) : 0;
    }), 1);

    weekGrid.innerHTML = days.map((d, i) => {
        const k = d.toISOString().slice(0, 10);
        const data = dayMap[k];
        const total = data ? data.reg + data.ot : 0;
        const heat = Math.min((total / maxHours) * 100, 100);
        const isToday = k === today;

        return `
      <div class="day-cell ${isToday ? 'today' : ''} ${total > 0 ? 'has-hours' : ''}">
        <div class="day-name">${dayNames[i]}</div>
        <div class="day-date">${d.getDate()}</div>
        ${total > 0 ? `<div class="day-hours">${formatHours(total)}</div>` : ''}
        ${data && data.ot > 0 ? `<div class="day-ot">+${formatHours(data.ot)} OT</div>` : ''}
        <div class="day-heat"><div class="day-heat-bar" style="width:${heat}%"></div></div>
      </div>`;
    }).join('');
}

prevWeekBtn.addEventListener("click", () => { weekOffset--; renderCalendar(allEntries); });
nextWeekBtn.addEventListener("click", () => { weekOffset++; renderCalendar(allEntries); });
todayBtn.addEventListener("click", () => { weekOffset = 0; renderCalendar(allEntries); });

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
        await convex.mutation("tasks:createTask", {
            userId: user._id, title, description, status: "pending",
            createdAt: Date.now()
        });
        taskTitleInput.value = "";
        taskDescInput.value = "";
        addTaskWrapper.classList.add("hidden");
        showToast("Task created!", "success");
    } catch (err) {
        console.error(err);
        showToast("Failed to create task.", "error");
    } finally { btn.disabled = false; }
});

// ── Log Time Modal ────────────────────────────────────────────────────────────
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

cancelLogBtn.addEventListener("click", () => {
    logOverlay.classList.add("hidden");
    currentLogTaskId = null;
});
logOverlay.addEventListener("click", (e) => {
    if (e.target === logOverlay) { logOverlay.classList.add("hidden"); currentLogTaskId = null; }
});

logTimeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentLogTaskId) return;
    const hours = parseFloat(logHours.value);
    const date = logDate.value;
    if (!hours || hours <= 0 || !date) { showToast("Please fill in all fields.", "error"); return; }

    const btn = logTimeForm.querySelector("button[type='submit']");
    btn.disabled = true;
    try {
        await convex.mutation("time_entries:logTime", {
            userId: user._id, taskId: currentLogTaskId,
            hours, isOvertime: isOT, date, createdAt: Date.now()
        });
        logOverlay.classList.add("hidden");
        currentLogTaskId = null;
        logHours.value = "";
        logDate.value = todayStr();
        isOT = false;
        btnRegular.classList.add("active-regular");
        btnOT.classList.remove("active-ot");
        showToast("Time logged!", "success");
    } catch (err) {
        console.error(err);
        showToast("Failed to log time.", "error");
    } finally { btn.disabled = false; }
});

function openLogModal(taskId, taskTitle) {
    currentLogTaskId = taskId;
    logTaskName.textContent = taskTitle;
    logDate.value = todayStr();
    logOverlay.classList.remove("hidden");
}

// ── Stream Timer ──────────────────────────────────────────────────────────────
function startTimer(taskId) {
    if (activeTimers[taskId]) return;

    // Stop any other running timers
    Object.keys(activeTimers).forEach(tid => stopTimer(tid, true));

    const startMs = Date.now();
    const displayEl = document.getElementById(`timer-${taskId}`);
    const btnEl = document.getElementById(`timer-btn-${taskId}`);

    activeTimers[taskId] = {
        startMs,
        intervalId: setInterval(() => {
            const elapsed = Date.now() - startMs;
            if (displayEl) displayEl.textContent = fmtTimer(elapsed);
        }, 1000)
    };

    if (displayEl) displayEl.textContent = "00:00";
    if (btnEl) { btnEl.classList.add("running"); btnEl.title = "Stop Timer"; btnEl.textContent = "■"; }

    // Mark task card as timing
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

    if (silent || elapsed < 5000) return; // Ignore <5s stray clicks

    const hours = Math.round((elapsed / 3600000) * 4) / 4; // round to nearest 0.25h
    if (hours < 0.25) { showToast("Too short to log (< 15 min). Use 'Log Time' manually.", "info"); return; }

    const task = allTasks.find(t => t._id === taskId);
    const taskTitle = task ? task.title : "Task";

    // Prompt for OT
    const otChoice = confirm(`Log ${formatHours(hours)} to "${taskTitle}"?\n\nClick OK for Regular Time, Cancel for Overtime.`);

    try {
        await convex.mutation("time_entries:logTime", {
            userId: user._id, taskId,
            hours, isOvertime: !otChoice,
            date: todayStr(),
            startTime: timer.startMs,
            endTime: Date.now(),
        });
        showToast(`${formatHours(hours)} logged ${!otChoice ? '(OT)' : ''}!`, "success");
    } catch (err) {
        console.error(err);
        showToast("Failed to save timer entry.", "error");
    }
}

// ── Task Rendering ────────────────────────────────────────────────────────────
function renderTasks(tasks, entries) {
    taskCount.textContent = tasks.length;

    if (tasks.length === 0) {
        taskList.innerHTML = `<div style="text-align:center; padding:2.5rem 1rem; color:var(--text-3);">
      No tasks yet. Create one above to get started!
    </div>`;
        return;
    }

    // Build hours per task
    const taskHours = {};
    entries.forEach(e => {
        if (!taskHours[e.taskId]) taskHours[e.taskId] = { reg: 0, ot: 0 };
        e.isOvertime ? taskHours[e.taskId].ot += e.hours : taskHours[e.taskId].reg += e.hours;
    });

    const statusOrder = { in_progress: 0, pending: 1, completed: 2 };
    const sorted = [...tasks].sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));

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
            ${total > 0 ? `<span>⏱ ${formatHours(th.reg)} reg${th.ot > 0 ? ` · ${formatHours(th.ot)} OT` : ''}</span>` : '<span>No time logged</span>'}
          </div>
        </div>
        <div class="task-actions">
          ${!isCompleted ? `
            <span class="timer-display" id="timer-${task._id}">${isRunning ? fmtTimer(Date.now() - activeTimers[task._id].startMs) : ''}</span>
            <button class="timer-btn ${isRunning ? 'running' : ''}" id="timer-btn-${task._id}"
              onclick="window.toggleTimer('${task._id}')"
              title="${isRunning ? 'Stop Timer' : 'Start Timer'}"
            >${isRunning ? '■' : '▶'}</button>
            <button class="btn btn-sm btn-secondary" onclick="window.openLog('${task._id}', '${task.title.replace(/'/g, "\\'")}')">+ Log</button>
            <button class="btn btn-sm btn-electric" style="width:auto;" onclick="window.markDone('${task._id}')">✓ Done</button>
          ` : `<span style="font-size:0.8rem; color:var(--success);">✓ Completed</span>`}
        </div>
      </div>`;
    }).join('');
}

// ── Global Handlers ───────────────────────────────────────────────────────────
window.toggleTimer = (taskId) => {
    if (activeTimers[taskId]) stopTimer(taskId);
    else startTimer(taskId);
};

window.openLog = (taskId, taskTitle) => openLogModal(taskId, taskTitle);

window.markDone = async (taskId) => {
    if (activeTimers[taskId]) await stopTimer(taskId);
    try {
        await convex.mutation("tasks:updateTaskStatus", { taskId, status: "completed" });
        showToast("Task completed! 🎉", "success");
    } catch (err) {
        console.error(err);
        showToast("Failed to update task.", "error");
    }
};

// ── Live Data Subscriptions ───────────────────────────────────────────────────
convex.onUpdate(
    "tasks:getUserTasks",
    { userId: user._id },
    (tasks) => {
        allTasks = tasks || [];
        renderTasks(allTasks, allEntries);
        updateStats(allEntries, allTasks);
    }
);

convex.onUpdate(
    "time_entries:getUserTimeEntries",
    { userId: user._id },
    (entries) => {
        allEntries = entries || [];
        renderTasks(allTasks, allEntries);
        updateStats(allEntries, allTasks);
        renderCalendar(allEntries);
    }
);
