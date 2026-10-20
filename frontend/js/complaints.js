// ========================================
// STRAYSYNC - MY COMPLAINTS
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const tableBody = document.getElementById("complaints-table-body");
    const messageBox = document.getElementById("complaints-message");

    const searchInput = document.getElementById("search-input");
    const animalFilter = document.getElementById("animal-filter");
    const statusFilter = document.getElementById("status-filter");

    const emptyState = document.getElementById("empty-state");
    const emptyTitle = document.getElementById("empty-title");
    const emptyDescription = document.getElementById("empty-description");

    const refreshButton = document.getElementById("refresh-button");

    const currentYear = document.getElementById("current-year");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    let complaints = [];

    // ========================================
    // AUTHENTICATION
    // ========================================

    function getToken() {
        if (window.StraySyncAPI) {
            return window.StraySyncAPI.getAuthToken();
        }

        return (
            localStorage.getItem("straySyncToken") ||
            sessionStorage.getItem("straySyncToken")
        );
    }

    function logout() {
        if (window.StraySyncAPI) {
            window.StraySyncAPI.clearAuthToken();
        } else {
            localStorage.removeItem("straySyncToken");
            sessionStorage.removeItem("straySyncToken");

            localStorage.removeItem("straySyncCitizenName");
            sessionStorage.removeItem("straySyncCitizenName");
        }

        window.location.href = "../auth/citizen-login.html";
    }

    const logoutButton = document.getElementById("logout-button");

    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    const citizenName = document.getElementById("citizen-name");

    if (citizenName) {
        citizenName.textContent =
            localStorage.getItem("straySyncCitizenName") ||
            sessionStorage.getItem("straySyncCitizenName") ||
            "Citizen";
    }

    // ========================================
    // MESSAGE
    // ========================================

    function showMessage(text, type = "") {
        messageBox.textContent = text;
        messageBox.className = "feedback-message";

        if (type) {
            messageBox.classList.add(type);
        }
    }

    // ========================================
    // SAFE HTML OUTPUT
    // ========================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    // ========================================
    // STATUS FORMATTING
    // ========================================

    function getStatusClass(status) {
        switch (status) {
            case "Pending Review":
                return "status-pending";

            case "Assigned":
                return "status-assigned";

            case "In Progress":
                return "status-progress";

            case "Pending Verification":
                return "status-verification";

            case "Resolved":
                return "status-resolved";

            default:
                return "status-default";
        }
    }

    function getPriorityClass(priority) {
        switch (String(priority || "Medium").toLowerCase()) {
            case "low":
                return "priority-low";

            case "high":
                return "priority-high";

            case "critical":
                return "priority-critical";

            default:
                return "priority-medium";
        }
    }

    function getAnimalEmoji(animalType) {
        const animals = {
            Dog: "🐕",
            Cat: "🐈",
            Cow: "🐄",
            Buffalo: "🐃",
            Goat: "🐐",
            Pig: "🐖",
            Monkey: "🐒",
            Other: "🐾"
        };

        return animals[animalType] || "🐾";
    }

    // ========================================
    // FORMAT COMPLAINT DATE
    // ========================================

    function formatDate(value) {
        if (!value) {
            return "Date unavailable";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    // ========================================
    // UPDATE SUMMARY CARDS
    // ========================================

    function updateStatistics() {
        const total = complaints.length;

        const pending = complaints.filter(item =>
            item.status === "Pending Review"
        ).length;

        const inProgress = complaints.filter(item =>
            ["Assigned", "In Progress", "Pending Verification"].includes(item.status)
        ).length;

        const resolved = complaints.filter(item =>
            item.status === "Resolved"
        ).length;

        document.getElementById("total-count").textContent = total;
        document.getElementById("pending-count").textContent = pending;
        document.getElementById("progress-count").textContent = inProgress;
        document.getElementById("resolved-count").textContent = resolved;

        document.getElementById("record-count").textContent =
            `${total} ${total === 1 ? "report" : "reports"}`;
    }

    // ========================================
    // RENDER COMPLAINTS
    // ========================================

    function renderComplaints() {

        const searchTerm = searchInput.value.trim().toLowerCase();
        const selectedAnimal = animalFilter.value;
        const selectedStatus = statusFilter.value;

        const filteredComplaints = complaints.filter(item => {

            const matchesSearch =
                String(item.id).includes(searchTerm) ||
                String(item.location || "").toLowerCase().includes(searchTerm);

            const matchesAnimal =
                !selectedAnimal || item.animal_type === selectedAnimal;

            const matchesStatus =
                !selectedStatus || item.status === selectedStatus;

            return matchesSearch && matchesAnimal && matchesStatus;
        });

        tableBody.innerHTML = "";

        if (filteredComplaints.length === 0) {

            emptyState.hidden = false;

            if (complaints.length === 0) {
                emptyTitle.textContent = "No complaints yet";

                emptyDescription.textContent =
                    "When you submit an animal report, it will appear here.";
            } else {
                emptyTitle.textContent = "No matching complaints";

                emptyDescription.textContent =
                    "Try changing your search or filters.";
            }

            document.getElementById("showing-count").textContent =
                "Showing 0 complaints";

            return;
        }

        emptyState.hidden = true;

        filteredComplaints.forEach(item => {

            const row = document.createElement("tr");

            const status = item.status || "Pending Review";
            const priority = item.priority || "Medium";

            const safePhoto = typeof item.original_photo === "string" &&
                item.original_photo.startsWith("/uploads/") &&
                !item.original_photo.includes("..")
                ? item.original_photo
                : "";

            const animalImage = safePhoto
                ? `<img src="${escapeHTML(safePhoto)}" alt="${escapeHTML(item.animal_type)}"
                    onerror="this.parentElement.textContent='🐾'">`
                : getAnimalEmoji(item.animal_type);

            row.innerHTML = `
                <td>
                    <span class="complaint-id">
                        #${escapeHTML(item.id)}
                    </span>

                    <span class="complaint-date">
                        ${escapeHTML(formatDate(item.created_at))}
                    </span>
                </td>

                <td>
                    <div class="animal-cell">

                        <div class="animal-thumbnail">
                            ${animalImage}
                        </div>

                        <div>
                            <span class="animal-name">
                                ${escapeHTML(item.animal_type)}
                            </span>

                            <span class="category-text">
                                ${escapeHTML(item.category)}
                            </span>
                        </div>

                    </div>
                </td>

                <td>
                    <span class="location-text">
                        ${escapeHTML(item.location)}
                    </span>
                </td>

                <td>
                    <span class="priority-badge ${getPriorityClass(priority)}">
                        ${escapeHTML(priority)}
                    </span>
                </td>

                <td>
                    <span class="status-badge ${getStatusClass(status)}">
                        ${escapeHTML(status)}
                    </span>
                </td>

                <td>
                    <button
                        type="button"
                        class="view-button"
                        data-complaint-id="${escapeHTML(item.id)}"
                    >
                        View Details →
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });

        document.getElementById("showing-count").textContent =
            `Showing ${filteredComplaints.length} of ${complaints.length} complaints`;
    }

    // ========================================
    // FETCH CITIZEN COMPLAINTS
    // ========================================

    async function loadComplaints() {

        const token = getToken();

        if (!token) {
            showMessage(
                "Your login session is missing. Please log in again.",
                "error"
            );

            setTimeout(logout, 1500);
            return;
        }

        refreshButton.disabled = true;
        refreshButton.textContent = "Loading...";

        showMessage("Loading your complaints...");

        try {

            const response = await fetch("/api/complaints/my", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            let result;

            try {
                result = await response.json();
            } catch {
                throw new Error("The server returned an invalid response.");
            }

            if (response.status === 401 || response.status === 403) {
                throw new Error(
                    "Your login session has expired. Please log in again."
                );
            }

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to load complaints."
                );
            }

            complaints = Array.isArray(result.complaints)
                ? result.complaints
                : [];

            updateStatistics();
            renderComplaints();

            if (complaints.length > 0) {
                showMessage(
                    "Your complaints have been loaded successfully.",
                    "success"
                );
            } else {
                showMessage("You have not submitted any complaints yet.");
            }

        } catch (error) {

            console.error("Load complaints error:", error);

            showMessage(
                error.message || "Unable to load your complaints.",
                "error"
            );

        } finally {

            refreshButton.disabled = false;
            refreshButton.textContent = "↻ Refresh";
        }
    }

    // ========================================
    // SEARCH AND FILTERS
    // ========================================

    searchInput.addEventListener("input", renderComplaints);

    animalFilter.addEventListener("change", renderComplaints);

    statusFilter.addEventListener("change", renderComplaints);

    refreshButton.addEventListener("click", loadComplaints);

    // ========================================
    // VIEW COMPLAINT DETAILS
    // ========================================

    tableBody.addEventListener("click", event => {

        const button = event.target.closest("[data-complaint-id]");

        if (!button) return;

        const complaintId = button.dataset.complaintId;

        sessionStorage.setItem(
            "straySyncSelectedComplaintId",
            complaintId
        );

        window.location.href =
            `complaint-details.html?id=${encodeURIComponent(complaintId)}`;
    });

    // ========================================
    // INITIAL LOAD
    // ========================================

    loadComplaints();

});