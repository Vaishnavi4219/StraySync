// ============================================
// STRAYSYNC - CITIZEN DASHBOARD
// ============================================

document.addEventListener("DOMContentLoaded", () => {

    // ============================================
    // 1. GET HTML ELEMENTS
    // ============================================

    const yearElement = document.getElementById("current-year");

    const citizenName = document.getElementById("citizen-name");
    const avatar = document.getElementById("user-avatar");

    const totalCount = document.getElementById("total-count");
    const pendingCount = document.getElementById("pending-count");
    const progressCount = document.getElementById("progress-count");
    const resolvedCount = document.getElementById("resolved-count");

    const recentComplaints = document.getElementById("recent-complaints");
    const dashboardMessage = document.getElementById("dashboard-message");

    const logoutButton = document.getElementById("logout-button");


    // ============================================
    // 2. DISPLAY CURRENT YEAR
    // ============================================

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }


    // ============================================
    // 3. DISPLAY CITIZEN NAME
    // ============================================

    const savedName = sessionStorage.getItem("straySyncCitizenName");

    if (savedName && citizenName) {
        citizenName.textContent = savedName.trim();

        if (avatar) {
            avatar.textContent = savedName.trim().charAt(0).toUpperCase();
        }
    }


    // ============================================
    // 4. LOGOUT HANDLING
    // ============================================

    if (logoutButton) {
        logoutButton.addEventListener("click", () => {

            sessionStorage.removeItem("straySyncPendingCitizenId");
            sessionStorage.removeItem("straySyncPendingMobile");
            sessionStorage.removeItem("straySyncCitizenName");

            // Clear the saved authentication token.
            if (
                window.StraySyncAPI &&
                typeof window.StraySyncAPI.clearAuthToken === "function"
            ) {
                window.StraySyncAPI.clearAuthToken();
            }

        });
    }


    // ============================================
    // 5. DISPLAY DASHBOARD MESSAGES
    // ============================================

    function showDashboardMessage(message, type = "info") {

        if (!dashboardMessage) {
            return;
        }

        dashboardMessage.textContent = message;
        dashboardMessage.className = `dashboard-message ${type}`;

    }


    // ============================================
    // 6. NORMALIZE COMPLAINT STATUS
    // ============================================

    function normalizeStatus(status) {

        return String(status || "")
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ");

    }


    // ============================================
    // 7. COUNT COMPLAINTS
    // ============================================

    function updateStatistics(complaints) {

        let pending = 0;
        let inProgress = 0;
        let resolved = 0;

        complaints.forEach((complaint) => {

            const status = normalizeStatus(complaint.status);

            // Pending review
            if (
                status === "pending review" ||
                status === "pending" ||
                status === "awaiting review"
            ) {
                pending++;
            }

            // Complaints currently being handled
            else if (
                status === "in progress" ||
                status === "assigned" ||
                status === "rescue in progress" ||
                status === "under investigation"
            ) {
                inProgress++;
            }

            // Count as resolved only when the status
            // indicates completion or verification.
            else if (
                status === "resolved" ||
                status === "verified" ||
                status === "completed" ||
                status === "closed"
            ) {
                resolved++;
            }

        });

        if (totalCount) {
            totalCount.textContent = complaints.length;
        }

        if (pendingCount) {
            pendingCount.textContent = pending;
        }

        if (progressCount) {
            progressCount.textContent = inProgress;
        }

        if (resolvedCount) {
            resolvedCount.textContent = resolved;
        }

    }


    // ============================================
    // 8. FORMAT COMPLAINT DATE
    // ============================================

    function formatDate(dateValue) {

        if (!dateValue) {
            return "Date unavailable";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return String(dateValue);
        }

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

    }


    // ============================================
    // 9. CREATE TABLE CELL
    // ============================================

    function createCell(text, className = "") {

        const cell = document.createElement("td");

        cell.textContent = text || "—";

        if (className) {
            cell.className = className;
        }

        return cell;

    }


    // ============================================
    // 10. DISPLAY EMPTY COMPLAINT STATE
    // ============================================

    function displayEmptyComplaints(message) {

        if (!recentComplaints) {
            return;
        }

        recentComplaints.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.className = "empty-state";

        const icon = document.createElement("div");
        icon.className = "empty-icon";
        icon.textContent = "🐾";

        const heading = document.createElement("h3");
        heading.textContent = "No complaints yet";

        const description = document.createElement("p");
        description.textContent = message;

        const link = document.createElement("a");
        link.href = "report.html";
        link.className = "empty-report-button";
        link.textContent = "Submit Your First Report";

        cell.append(icon, heading, description, link);
        row.appendChild(cell);

        recentComplaints.appendChild(row);

    }


    // ============================================
    // 11. DISPLAY RECENT COMPLAINTS
    // ============================================

    function displayRecentComplaints(complaints) {

        if (!recentComplaints) {
            return;
        }

        recentComplaints.replaceChildren();

        if (complaints.length === 0) {

            displayEmptyComplaints(
                "When you submit an animal report, it will appear here."
            );

            return;
        }

        // The backend returns newest complaints first.
        // Display at most five on the dashboard.
        const latestComplaints = complaints.slice(0, 5);

        latestComplaints.forEach((complaint) => {

            const row = document.createElement("tr");

            // Complaint ID
            const complaintId = complaint.id;

            const complaintIdText =
                complaintId !== undefined && complaintId !== null
                    ? `SS-${String(complaintId).padStart(3, "0")}`
                    : "—";

            row.appendChild(
                createCell(complaintIdText)
            );


            // Animal type
            row.appendChild(
                createCell(
                    complaint.animal_type ||
                    complaint.animalType ||
                    "Not specified"
                )
            );


            // Complaint category
            row.appendChild(
                createCell(
                    complaint.category || "Not specified"
                )
            );


            // Date reported
            row.appendChild(
                createCell(
                    formatDate(
                        complaint.created_at ||
                        complaint.createdAt
                    )
                )
            );


            // Complaint status
            const statusText = complaint.status || "Pending Review";

            const statusCell = createCell(statusText, "complaint-status-cell");

            const statusBadge = document.createElement("span");
            statusBadge.className = "status-badge";

            const normalizedStatus = normalizeStatus(statusText);

            if (
                normalizedStatus === "resolved" ||
                normalizedStatus === "verified" ||
                normalizedStatus === "completed" ||
                normalizedStatus === "closed"
            ) {
                statusBadge.classList.add("status-resolved");
            }

            else if (
                normalizedStatus === "in progress" ||
                normalizedStatus === "assigned" ||
                normalizedStatus === "rescue in progress" ||
                normalizedStatus === "under investigation"
            ) {
                statusBadge.classList.add("status-progress");
            }

            else {
                statusBadge.classList.add("status-pending");
            }

            statusBadge.textContent = statusText;

            statusCell.replaceChildren(statusBadge);
            row.appendChild(statusCell);


            // View complaint action
            const actionCell = document.createElement("td");

            const viewLink = document.createElement("a");

            viewLink.href =
                `complaint-details.html?id=${encodeURIComponent(complaintId)}`;

            viewLink.className = "view-complaint-button";
            viewLink.textContent = "View";

            actionCell.appendChild(viewLink);
            row.appendChild(actionCell);

            recentComplaints.appendChild(row);

        });

    }


    // ============================================
    // 12. LOAD COMPLAINTS FROM BACKEND
    // ============================================

    async function loadDashboardComplaints() {

        if (!window.StraySyncAPI) {

            showDashboardMessage(
                "The API helper is not available. Please check api.js.",
                "error"
            );

            return;

        }

        const api = window.StraySyncAPI;

        if (
            typeof api.getAuthToken !== "function" ||
            typeof api.apiRequest !== "function"
        ) {

            showDashboardMessage(
                "The authentication or API helper is unavailable.",
                "error"
            );

            return;

        }

        // A citizen must be logged in to retrieve personal reports.
        if (!api.getAuthToken()) {

            showDashboardMessage(
                "Please log in to view your complaints.",
                "error"
            );

            return;

        }

        showDashboardMessage("Loading your complaints...", "info");

        try {

            // api.js already adds the /api prefix.
            // This requests GET /api/complaints/my.
            const response = await api.apiRequest("/complaints/my", {
                method: "GET"
            });

            if (!response || response.success === false) {

                throw new Error(
                    response?.message ||
                    "Unable to load your complaints."
                );

            }

            const complaints = Array.isArray(response.complaints)
                ? response.complaints
                : [];

            // Update all four statistics.
            updateStatistics(complaints);

            // Display the latest five reports.
            displayRecentComplaints(complaints);

            showDashboardMessage(
                `Successfully loaded ${complaints.length} complaint(s).`,
                "success"
            );

        } catch (error) {

            console.error(
                "Dashboard complaints loading error:",
                error
            );

            showDashboardMessage(
                error.message ||
                "Unable to load complaints. Please try again.",
                "error"
            );

        }

    }


    // ============================================
    // 13. INITIALIZE DASHBOARD
    // ============================================

    loadDashboardComplaints();

});