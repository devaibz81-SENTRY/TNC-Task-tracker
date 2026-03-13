import { ConvexClient } from "convex/browser";
import { showToast } from "./toast.js";

// Initialize Convex Client
const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL);

// Verify Admin Authentication
const currentUser = localStorage.getItem("taskUser");
if (!currentUser) window.location.href = "/";

const user = JSON.parse(currentUser);
if (!user.isAdmin) {
    showToast("Unauthorized. Admin access required.", "error");
    setTimeout(() => {
        window.location.href = "/dashboard.html";
    }, 1000);
}

// DOM Elements
const logoutBtn = document.getElementById("logout-btn");
const dashboardBtn = document.getElementById("dashboard-link");
const adminTableBody = document.getElementById("admin-table-body");
const totalPlatformHoursEl = document.getElementById("total-platform-hours");
const exportBtn = document.getElementById("export-btn");
const exportFilter = document.getElementById("export-filter");

// Navigation
logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("taskUser");
    window.location.href = "/";
});

dashboardBtn.addEventListener("click", () => {
    window.location.href = "/dashboard.html";
});

// State for exports
let currentAdminData = [];

// Subscribe to Admin Data Feed
convex.onUpdate("admin:getAdminData", {}, (data) => {
    currentAdminData = data;
    renderTable(data);
});

function renderTable(data) {
    adminTableBody.innerHTML = "";

    if (data.length === 0) {
        adminTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No users found on the platform.</td></tr>';
        return;
    }

    let grandTotalHours = 0;

    data.forEach(u => {
        grandTotalHours += u.totalHours;

        const row = document.createElement("tr");

        const roleBadge = u.isAdmin
            ? '<span class="badge badge-admin">Admin</span>'
            : '<span class="badge badge-user">User</span>';

        row.innerHTML = `
      <td style="font-weight: 500;">${u.username}</td>
      <td>${roleBadge}</td>
      <td>${u.completedTaskCount} / ${u.taskCount}</td>
      <td>${u.regularHours}</td>
      <td style="color: var(--danger-color);">${u.otHours > 0 ? u.otHours : '-'}</td>
      <td style="font-weight: bold; color: var(--accent-color);">${u.totalHours}</td>
    `;
        adminTableBody.appendChild(row);
    });

    // Animation effect on value update
    totalPlatformHoursEl.style.transform = "scale(1.2)";
    totalPlatformHoursEl.style.color = "white";
    setTimeout(() => {
        totalPlatformHoursEl.textContent = grandTotalHours;
        totalPlatformHoursEl.style.transform = "scale(1)";
        totalPlatformHoursEl.style.color = "var(--accent-color)";
        totalPlatformHoursEl.style.transition = "all 0.3s ease";
    }, 100);
}

// Export / Send Report Functionality
exportBtn.addEventListener("click", () => {
    const filter = exportFilter.value;
    let csvContent = "data:text/csv;charset=utf-8,";

    if (filter === "all") {
        // Aggregated
        csvContent += "Username,Role,Total Tasks,Completed Tasks,Regular Hours,Overtime Hours,Total Hours\n";
        currentAdminData.forEach(u => {
            const row = [
                u.username,
                u.isAdmin ? "Admin" : "User",
                u.taskCount,
                u.completedTaskCount,
                u.regularHours,
                u.otHours,
                u.totalHours
            ].join(",");
            csvContent += row + "\n";
        });
    } else if (filter === "tasks_only") {
        // Detailed Tasks
        csvContent += "Username,Task Title,Task Description,Status\n";
        currentAdminData.forEach(u => {
            u.tasks.forEach(t => {
                const desc = t.description ? t.description.replace(/,/g, " ") : ""; // sanitize commas
                const row = [u.username, t.title.replace(/,/g, " "), desc, t.status].join(",");
                csvContent += row + "\n";
            });
        });
    } else if (filter === "time_only") {
        // Detailed Time entries
        csvContent += "Username,Date,Hours,Is Overtime\n";
        currentAdminData.forEach(u => {
            u.timeEntries.forEach(te => {
                const row = [u.username, te.date, te.hours, te.isOvertime ? "Yes" : "No"].join(",");
                csvContent += row + "\n";
            });
        });
    }

    // Trigger Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `Task_OT_Report_${filter}_${dateStr}.csv`);
    document.body.appendChild(link);

    // Animation UX for button
    const ogText = exportBtn.textContent;
    exportBtn.textContent = "✔ Report Downloaded";
    exportBtn.style.backgroundColor = "var(--success-color)";
    exportBtn.style.color = "white";

    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
        exportBtn.textContent = ogText;
        exportBtn.style.backgroundColor = "var(--secondary-color)";
        exportBtn.style.color = "var(--primary-color)";
    }, 2000);
});
