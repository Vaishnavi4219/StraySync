// ============================================
// STRAYSYNC - MUNICIPAL DASHBOARD
// Model 3: Shared Complaints
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

    // Load complaints from backend
    await loadDashboardComplaints();

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
        console.error("Unable to read officer information:", error);
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

    // Show the latest five reports.
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

        // Open the shared complaints page.
        // Detailed complaint viewing can be connected next.
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
// 6. DISPLAY DASHBOARD MESSAGES
// ============================================

function showMessage(message, isError = false) {
    const messageElement = document.getElementById("dashboard-message");

    if (!messageElement) return;

    messageElement.textContent = message;

    messageElement.classList.toggle("error", isError);
    messageElement.classList.toggle("success", !isError);
}

// ============================================
// 7. HELPER FUNCTIONS
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
// 8. LOGOUT
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