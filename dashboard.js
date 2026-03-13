import { ConvexClient } from "convex/browser";
import { showToast } from "./toast.js";

// Initialize Convex Client
const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL);

// Verify Authentication
const currentUser = localStorage.getItem("taskUser");
if (!currentUser) {
    window.location.href = "/";
}
const user = JSON.parse(currentUser);
if (user.isAdmin) {
    document.getElementById("admin-link").classList.remove("hidden");
    document.getElementById("admin-link").addEventListener("click", () => {
        window.location.href = "/admin.html";
    });
}
document.getElementById("username-display").textContent = user.username;

// DOM Elements
const logoutBtn = document.getElementById("logout-btn");
const addTaskForm = document.getElementById("add-task-form");
const taskTitleInput = document.getElementById("task-title");
const taskDescInput = document.getElementById("task-desc");
const tasksList = document.getElementById("tasks-list");
const noTasksMsg = document.getElementById("no-tasks-msg");

const timeLogCard = document.getElementById("time-log-card");
const selectedTaskTitle = document.getElementById("selected-task-title");
const logTimeForm = document.getElementById("log-time-form");
const logTaskIdInput = document.getElementById("log-task-id");
const logHoursInput = document.getElementById("log-hours");
const logDateInput = document.getElementById("log-date");
const logOtCheckbox = document.getElementById("log-ot");
const cancelLogBtn = document.getElementById("cancel-log-btn");

const totalHoursEl = document.getElementById("total-hours");
const regularHoursEl = document.getElementById("regular-hours");
const otHoursEl = document.getElementById("ot-hours");

// Set default date to today
logDateInput.valueAsDate = new Date();

// Logout Logic
logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("taskUser");
    window.location.href = "/";
});

// Update Stats
async function updateStats() {
    const stats = await convex.query("time_entries:getUserTotals", { userId: user._id });
    totalHoursEl.textContent = stats.totalHours;
    regularHoursEl.textContent = stats.regularHours;
    otHoursEl.textContent = stats.otHours;
}

// Render Tasks
function renderTasks(tasks) {
    tasksList.innerHTML = "";
    if (tasks.length === 0) {
        noTasksMsg.classList.remove("hidden");
        noTasksMsg.textContent = "No tasks yet. Create one on the left!";
        return;
    }

    noTasksMsg.classList.add("hidden");

    tasks.forEach((task) => {
        const div = document.createElement("div");
        div.className = "task-item";

        // Status Badge
        let statusColor = "var(--text-muted)";
        if (task.status === "in_progress") statusColor = "var(--secondary-color)";
        if (task.status === "completed") statusColor = "var(--success-color)";

        div.innerHTML = `
      <div>
        <div style="font-weight: 600; font-size: 1.1rem; color: var(--text-main);">${task.title}</div>
        <div class="task-meta">${task.description || "No description"}</div>
        <div style="margin-top: 0.5rem;">
            <span style="font-size: 0.8rem; background: ${statusColor}; color: var(--bg-color); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: bold;">
              ${task.status.replace("_", " ")}
            </span>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <button class="btn btn-sm" onclick="openLogTime('${task._id}', '${task.title}')" style="background-color: var(--secondary-color); color: var(--primary-color);">Log Time</button>
        ${task.status !== 'completed' ? `<button class="btn btn-sm btn-secondary" onclick="markCompleted('${task._id}')" style="border-color: var(--success-color); color: var(--success-color);">Complete</button>` : ''}
      </div>
    `;
        tasksList.appendChild(div);
    });
}

// Fetch initial data & setup subscriptions
updateStats();
convex.onUpdate("tasks:getUserTasks", { userId: user._id }, renderTasks);
// Also subscribe to time entry changes to update stats automatically
convex.onUpdate("time_entries:getUserTimeEntries", { userId: user._id }, updateStats);

// Add Task Logic
addTaskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = taskTitleInput.value.trim();
    const description = taskDescInput.value.trim();

    if (!title) return;

    try {
        const btn = addTaskForm.querySelector('button');
        btn.disabled = true;
        await convex.mutation("tasks:createTask", {
            userId: user._id,
            title,
            description
        });
        taskTitleInput.value = "";
        taskDescInput.value = "";
        showToast("Task created successfully!", "success");
    } catch (error) {
        console.error("Error adding task:", error);
        showToast("Failed to add task.", "error");
    } finally {
        addTaskForm.querySelector('button').disabled = false;
    }
});

// Expose functions to global window for inline onclick handlers
window.openLogTime = (taskId, taskTitle) => {
    selectedTaskTitle.textContent = taskTitle;
    logTaskIdInput.value = taskId;
    timeLogCard.classList.remove("hidden");
    logHoursInput.focus();
    // highlight form
    timeLogCard.style.transform = "scale(1.02)";
    setTimeout(() => timeLogCard.style.transform = "scale(1)", 200);
};

window.markCompleted = async (taskId) => {
    try {
        await convex.mutation("tasks:updateTaskStatus", { taskId, status: "completed" });
        showToast("Task marked as completed!", "success");
    } catch (error) {
        console.error("Error updating status:", error);
        showToast("Failed to update status", "error");
    }
};

// Cancel logging
cancelLogBtn.addEventListener("click", () => {
    timeLogCard.classList.add("hidden");
    logHoursInput.value = "";
    logOtCheckbox.checked = false;
});

// Log Time Submission
logTimeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const taskId = logTaskIdInput.value;
    const hours = parseFloat(logHoursInput.value);
    const date = logDateInput.value;
    const isOvertime = logOtCheckbox.checked;

    if (!taskId || isNaN(hours) || !date) return;

    try {
        const btn = logTimeForm.querySelector('button[type="submit"]');
        btn.disabled = true;

        await convex.mutation("time_entries:logTime", {
            userId: user._id,
            taskId,
            hours,
            isOvertime,
            date
        });

        // Success
        cancelLogBtn.click(); // Hide and reset form
        updateStats(); // Force refresh stats instantly just in case
        showToast("Time logged successfully!", "success");

    } catch (error) {
        console.error("Error logging time:", error);
        showToast("Failed to log time.", "error");
    } finally {
        logTimeForm.querySelector('button[type="submit"]').disabled = false;
    }
});
