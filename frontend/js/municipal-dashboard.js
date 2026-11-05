// ============================================
// STRAYSYNC - MUNICIPAL DASHBOARD
// Model 3: Shared Complaints + Notifications
// ============================================

document.addEventListener("DOMContentLoaded", () => {
    initializeDashboard();
});


// ============================================
// 1. INITIALIZE DASHBOARD
// ============================================

async function initializeDashboard() {

    const token = sessionStorage.getItem("straysyncOfficerToken");

    // Display current year
    const yearElement = document.getElementById("current-year");

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // Check officer login
    if (!token) {
        showMessage(
            "Please log in with your municipal officer account.",
            true
        );

        return;
    }

    // Display officer name
    displayOfficerName();

    // Load complaints
    await loadDashboardComplaints();

    // Configure notifications
    setupNotifications();

    // Configure logout
    setupLogout();
}


// ============================================
// 2. DISPLAY OFFICER NAME
// ============================================

function displayOfficerName() {

    const nameElement = document.getElementById("officer-name");

    if (!nameElement) return;

    try {

        const officerData = sessionStorage.getItem("straysyncOfficer");

        if (officerData) {

            const officer = JSON.parse(officerData);

            nameElement.textContent =
                officer.full_name ||
                officer.fullName ||
                officer.name ||
                "Municipal Officer";
        }

    } catch (error) {

        console.error(
            "Unable to read officer information:",
            error
        );
    }
}


// ============================================
// 3. LOAD COMPLAINTS
// ============================================

async function loadDashboardComplaints() {

    const token = sessionStorage.getItem("straysyncOfficerToken");

    const tableBody = document.getElementById("recent-complaints");

    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="loading-cell">
                Loading complaints...
            </td>
        </tr>
    `;

    try {

        const response = await fetch("/api/complaints", {

            method: "GET",

            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json"
            }
        });

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {

            showMessage(
                "Your officer session is invalid or expired. Please log in again.",
                true
            );

            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-cell">
                        Please log in again to view complaints.
                    </td>
                </tr>
            `;

            return;
        }

        if (!response.ok || !data.success) {

            throw new Error(
                data.message || "Unable to retrieve complaints."
            );
        }

        const complaints = Array.isArray(data.complaints)
            ? data.complaints
            : [];

        updateStatistics(complaints);

        renderRecentComplaints(complaints);

        showMessage(
            `Dashboard updated successfully. ${complaints.length} complaint(s) found.`,
            false
        );

    } catch (error) {

        console.error("Dashboard loading error:", error);

        showMessage(
            error.message || "Unable to connect to the backend.",
            true
        );

        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-cell">
                    Unable to load complaints. Please refresh the page.
                </td>
            </tr>
        `;
    }
}


// ============================================
// 4. UPDATE DASHBOARD STATISTICS
// ============================================

function updateStatistics(complaints) {

    setText("total-count", complaints.length);

    const pendingCount = complaints.filter(complaint =>
        normalizeStatus(complaint.status) === "pending review"
    ).length;

    const progressCount = complaints.filter(complaint =>
        [
            "assigned",
            "in progress",
            "pending verification"
        ].includes(normalizeStatus(complaint.status))
    ).length;

    const resolvedCount = complaints.filter(complaint =>
        normalizeStatus(complaint.status) === "resolved"
    ).length;

    setText("pending-count", pendingCount);

    setText("progress-count", progressCount);

    setText("resolved-count", resolvedCount);
}


// ============================================
// 5. DISPLAY RECENT COMPLAINTS
// ============================================

function renderRecentComplaints(complaints) {

    const tableBody = document.getElementById("recent-complaints");

    if (!tableBody) return;

    if (complaints.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-cell">
                    No animal reports have been submitted yet.
                </td>
            </tr>
        `;

        return;
    }

    // Show latest five reports
    const recentComplaints = [...complaints]
        .sort((a, b) => Number(b.id) - Number(a.id))
        .slice(0, 5);

    tableBody.innerHTML = "";

    recentComplaints.forEach(complaint => {

        const row = document.createElement("tr");

        const reportId = document.createElement("td");

        reportId.textContent = `#${complaint.id}`;

        const animalCell = document.createElement("td");

        animalCell.textContent = complaint.animal_type || "Unknown";

        const locationCell = document.createElement("td");

        locationCell.textContent = complaint.location || "Not provided";

        const priorityCell = document.createElement("td");

        const priorityBadge = document.createElement("span");

        priorityBadge.textContent = complaint.priority || "Medium";

        priorityBadge.className =
            "priority-badge " +
            String(complaint.priority || "Medium").toLowerCase();

        priorityCell.appendChild(priorityBadge);

        const statusCell = document.createElement("td");

        const statusBadge = document.createElement("span");

        statusBadge.textContent = complaint.status || "Pending Review";

        statusBadge.className =
            "status-badge " +
            normalizeStatus(complaint.status).replace(/\s+/g, "-");

        statusCell.appendChild(statusBadge);

        const actionCell = document.createElement("td");

        const viewLink = document.createElement("a");

        viewLink.href = "complaints.html";

        viewLink.textContent = "View";

        viewLink.className = "text-link";

        actionCell.appendChild(viewLink);

        row.append(
            reportId,
            animalCell,
            locationCell,
            priorityCell,
            statusCell,
            actionCell
        );

        tableBody.appendChild(row);
    });
}


// ============================================
// 6. NOTIFICATION STYLES
// ============================================

function addNotificationStyles() {

    if (document.getElementById("notification-styles")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "notification-styles";

    style.textContent = `

        .notification-wrapper {
            position: relative;
        }

        .notification-panel {
            position: absolute;
            top: 55px;
            right: 0;
            width: 340px;
            max-width: calc(100vw - 30px);
            background: #fff;
            border: 1px solid #eadced;
            border-radius: 14px;
            box-shadow: 0 8px 30px rgba(80, 40, 80, 0.15);
            z-index: 1000;
            overflow: hidden;
        }

        .notification-header {
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #f0e7f0;
        }

        .notification-header h3 {
            margin: 0;
            color: #7B3F72;
            font-size: 16px;
        }

        .notification-list {
            max-height: 350px;
            overflow-y: auto;
        }

        .notification-item {
            padding: 15px;
            border-bottom: 1px solid #f3edf3;
            cursor: pointer;
            transition: 0.2s;
        }

        .notification-item:hover {
            background: #faf5fb;
        }

        .notification-item.unread {
            background: #f8f0fa;
            border-left: 3px solid #7B3F72;
        }

        .notification-item h4 {
            margin: 0 0 6px;
            color: #55304f;
            font-size: 14px;
        }

        .notification-item p {
            margin: 0;
            color: #777;
            font-size: 13px;
            line-height: 1.5;
        }

        .notification-date {
            display: block;
            margin-top: 8px;
            color: #a08aa0;
            font-size: 11px;
        }

        .notification-empty {
            padding: 25px 15px;
            text-align: center;
            color: #888;
            font-size: 13px;
        }

        .notification-loading {
            padding: 20px;
            text-align: center;
            color: #7B3F72;
            font-size: 13px;
        }

        .notification-header button {
            border: none;
            background: none;
            color: #7B3F72;
            cursor: pointer;
            font-size: 12px;
        }

        @media (max-width: 600px) {

            .notification-panel {
                right: -50px;
                width: 300px;
            }
        }
    `;

    document.head.appendChild(style);
}


// ============================================
// 7. SETUP NOTIFICATIONS
// ============================================

function setupNotifications() {

    const button = document.getElementById("notification-button");

    if (!button) return;

    addNotificationStyles();

    // Create notification wrapper
    const wrapper = document.createElement("div");

    wrapper.className = "notification-wrapper";

    // Move existing notification button into wrapper
    button.parentNode.insertBefore(wrapper, button);

    wrapper.appendChild(button);

    // Create notification panel
    const panel = document.createElement("div");

    panel.id = "notification-panel";

    panel.className = "notification-panel";

    panel.hidden = true;

    panel.innerHTML = `

        <div class="notification-header">

            <h3>Notifications</h3>

            <button type="button" id="mark-all-read">
                Mark all read
            </button>

        </div>

        <div class="notification-list" id="notification-list">

            <div class="notification-loading">
                Loading notifications...
            </div>

        </div>
    `;

    wrapper.appendChild(panel);

    // Load notifications
    loadOfficerNotifications();

    // Bell click
    button.addEventListener("click", async (event) => {

        event.stopPropagation();

        panel.hidden = !panel.hidden;

        if (!panel.hidden) {
            await loadOfficerNotifications();
        }
    });

    // Mark all as read
    document.getElementById("mark-all-read")
        .addEventListener("click", markAllNotificationsRead);

    // Close panel when clicking outside
    document.addEventListener("click", (event) => {

        if (!wrapper.contains(event.target)) {
            panel.hidden = true;
        }
    });

    // Automatically refresh notifications every 30 seconds
    setInterval(() => {

        loadOfficerNotifications();

    }, 30000);
}


// ============================================
// 8. LOAD OFFICER NOTIFICATIONS
// ============================================

async function loadOfficerNotifications() {

    const token = sessionStorage.getItem("straysyncOfficerToken");

    if (!token) return;

    const list = document.getElementById("notification-list");

    try {

        const response = await fetch("/api/notifications/officer", {

            method: "GET",

            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json"
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.message || "Unable to load notifications."
            );
        }

        const notifications = Array.isArray(data.notifications)
            ? data.notifications
            : [];

        // Update unread count
        updateNotificationCount(notifications);

        // Display notifications
        renderNotifications(notifications);

    } catch (error) {

        console.error("Notification loading error:", error);

        if (list) {

            list.innerHTML = `
                <div class="notification-empty">
                    Unable to load notifications.
                </div>
            `;
        }
    }
}


// ============================================
// 9. UPDATE NOTIFICATION COUNT
// ============================================

function updateNotificationCount(notifications) {

    const countElement = document.getElementById("notification-count");

    if (!countElement) return;

    const unreadCount = notifications.filter(notification =>
        Number(notification.is_read) === 0
    ).length;

    countElement.textContent = unreadCount;

    countElement.hidden = unreadCount === 0;
}


// ============================================
// 10. DISPLAY NOTIFICATIONS
// ============================================

function renderNotifications(notifications) {

    const list = document.getElementById("notification-list");

    if (!list) return;

    list.innerHTML = "";

    if (notifications.length === 0) {

        list.innerHTML = `
            <div class="notification-empty">
                No notifications yet. 💜
            </div>
        `;

        return;
    }

    notifications.forEach(notification => {

        const item = document.createElement("div");

        const isUnread = Number(notification.is_read) === 0;

        item.className = isUnread
            ? "notification-item unread"
            : "notification-item";

        const title = document.createElement("h4");

        title.textContent = notification.title || "Notification";

        const message = document.createElement("p");

        message.textContent = notification.message || "";

        const date = document.createElement("span");

        date.className = "notification-date";

        date.textContent = notification.created_at
            ? new Date(notification.created_at).toLocaleString()
            : "";

        item.append(title, message, date);

        // Mark notification as read on click
        item.addEventListener("click", () => {

            if (isUnread) {
                markNotificationRead(notification.id);
            }
        });

        list.appendChild(item);
    });
}


// ============================================
// 11. MARK ONE NOTIFICATION AS READ
// ============================================

async function markNotificationRead(notificationId) {

    const token = sessionStorage.getItem("straysyncOfficerToken");

    try {

        const response = await fetch(
            `/api/notifications/officer/${notificationId}/read`,
            {
                method: "PATCH",

                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.message || "Unable to mark notification as read."
            );
        }

        // Refresh notification list and unread count
        await loadOfficerNotifications();

    } catch (error) {

        console.error("Mark notification read error:", error);
    }
}


// ============================================
// 12. MARK ALL NOTIFICATIONS AS READ
// ============================================

async function markAllNotificationsRead() {

    const token = sessionStorage.getItem("straysyncOfficerToken");

    try {

        const response = await fetch(
            "/api/notifications/officer/read-all",
            {
                method: "PATCH",

                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.message || "Unable to mark notifications as read."
            );
        }

        await loadOfficerNotifications();

    } catch (error) {

        console.error("Mark all notifications read error:", error);
    }
}


// ============================================
// 13. DISPLAY DASHBOARD MESSAGES
// ============================================

function showMessage(message, isError = false) {

    const messageElement = document.getElementById("dashboard-message");

    if (!messageElement) return;

    messageElement.textContent = message;

    messageElement.classList.toggle("error", isError);

    messageElement.classList.toggle("success", !isError);
}


// ============================================
// 14. HELPER FUNCTIONS
// ============================================

function setText(elementId, value) {

    const element = document.getElementById(elementId);

    if (element) {
        element.textContent = value;
    }
}


function normalizeStatus(status) {

    return String(status || "")
        .trim()
        .toLowerCase();
}


// ============================================
// 15. LOGOUT
// ============================================

function setupLogout() {

    const logoutButton = document.getElementById("logout-button");

    if (!logoutButton) return;

    logoutButton.addEventListener("click", () => {

        sessionStorage.removeItem("straysyncOfficerToken");

        sessionStorage.removeItem("straysyncOfficer");

        window.location.href = "../auth/officer-login.html";
    });
}