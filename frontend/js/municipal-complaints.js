// ============================================
// STRAYSYNC - MUNICIPAL COMPLAINTS
// ============================================

document.addEventListener("DOMContentLoaded", initializePage);

let allComplaints = [];

async function initializePage() {
    document.getElementById("current-year").textContent =
        new Date().getFullYear();

    displayOfficerName();
    setupLogout();
    setupFilters();

    const token = sessionStorage.getItem("straysyncOfficerToken");

    if (!token) {
        showMessage("Please log in with your municipal officer account.", true);
        window.location.href = "../auth/officer-login.html";
        return;
    }

    await loadComplaints();
}

// ============================================
// OFFICER PROFILE
// ============================================

function displayOfficerName() {
    const nameElement = document.getElementById("officer-name");

    try {
        const savedOfficer = sessionStorage.getItem("straysyncOfficer");

        if (!savedOfficer) return;

        const officer = JSON.parse(savedOfficer);

        nameElement.textContent =
            officer.full_name ||
            officer.fullName ||
            officer.name ||
            "Municipal Officer";
    } catch (error) {
        console.error("Unable to read officer details:", error);
    }
}

// ============================================
// LOAD COMPLAINTS FROM EXISTING BACKEND
// ============================================

async function loadComplaints() {
    const token = sessionStorage.getItem("straysyncOfficerToken");
    const grid = document.getElementById("complaints-grid");

    grid.replaceChildren();

    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Loading complaints...";
    grid.appendChild(loading);

    try {
        const response = await fetch("/api/complaints", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json"
            }
        });

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
            showMessage("Your officer session has expired. Please log in again.", true);
            sessionStorage.removeItem("straysyncOfficerToken");
            sessionStorage.removeItem("straysyncOfficer");
            window.location.href = "../auth/officer-login.html";
            return;
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to retrieve complaints.");
        }

        allComplaints = Array.isArray(data.complaints)
            ? data.complaints
            : [];

        showMessage(
            `${allComplaints.length} report(s) retrieved successfully.`,
            false
        );

        renderComplaints();

    } catch (error) {
        console.error("Complaint loading error:", error);

        showMessage(
            error.message || "Unable to connect to the backend.",
            true
        );

        grid.replaceChildren();

        const errorBox = document.createElement("div");
        errorBox.className = "empty-state";

        const heading = document.createElement("h2");
        heading.textContent = "Unable to load reports";

        const message = document.createElement("p");
        message.textContent =
            "Check that the StraySync backend is running, then refresh.";

        errorBox.append(heading, message);
        grid.appendChild(errorBox);
    }
}

// ============================================
// FILTERS
// ============================================

function setupFilters() {
    document.getElementById("search-input")
        .addEventListener("input", renderComplaints);

    document.getElementById("status-filter")
        .addEventListener("change", renderComplaints);

    document.getElementById("priority-filter")
        .addEventListener("change", renderComplaints);

    document.getElementById("refresh-button")
        .addEventListener("click", loadComplaints);
}

// ============================================
// RENDER COMPLAINT CARDS
// ============================================

function renderComplaints() {
    const grid = document.getElementById("complaints-grid");

    const searchText = document.getElementById("search-input")
        .value.trim().toLowerCase();

    const selectedStatus = document.getElementById("status-filter").value;
    const selectedPriority = document.getElementById("priority-filter").value;

    const filtered = allComplaints.filter(complaint => {
        const searchableText = [
            complaint.id,
            complaint.animal_type,
            complaint.category,
            complaint.location,
            complaint.description,
            complaint.citizen_name
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(searchText);

        const matchesStatus =
            !selectedStatus || complaint.status === selectedStatus;

        const matchesPriority =
            !selectedPriority || complaint.priority === selectedPriority;

        return matchesSearch && matchesStatus && matchesPriority;
    });

    grid.replaceChildren();

    if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";

        const heading = document.createElement("h2");
        heading.textContent = allComplaints.length === 0
            ? "No reports yet"
            : "No matching reports";

        const description = document.createElement("p");
        description.textContent = allComplaints.length === 0
            ? "Citizen reports will appear here when submitted."
            : "Try changing your search or filter selections.";

        empty.append(heading, description);
        grid.appendChild(empty);
        return;
    }

    filtered.forEach(complaint => {
        grid.appendChild(createComplaintCard(complaint));
    });
}

// ============================================
// BUILD A COMPLAINT CARD SAFELY
// ============================================

function createComplaintCard(complaint) {
    const card = document.createElement("article");
    card.className = "complaint-card";

    // Uploaded photograph
    if (complaint.original_photo) {
        const photo = document.createElement("img");

        photo.className = "complaint-photo";
        photo.alt = `Photograph for animal report ${complaint.id}`;
        photo.loading = "lazy";

        photo.addEventListener("error", () => {
            const placeholder = document.createElement("div");
            placeholder.className = "photo-placeholder";
            placeholder.textContent = "📷 Photograph unavailable";

            photo.replaceWith(placeholder);
        }, { once: true });

        photo.src = complaint.original_photo;
        card.appendChild(photo);
    } else {
        const placeholder = document.createElement("div");
        placeholder.className = "photo-placeholder";
        placeholder.textContent = "📷 No photograph available";
        card.appendChild(placeholder);
    }

    const details = document.createElement("div");
    details.className = "complaint-details";

    const top = document.createElement("div");
    top.className = "complaint-top";

    const reportId = document.createElement("span");
    reportId.className = "complaint-id";
    reportId.textContent = `Report #${complaint.id}`;

    const priority = document.createElement("span");
    priority.className =
        `badge priority-${String(complaint.priority || "Medium").toLowerCase()}`;
    priority.textContent = complaint.priority || "Medium";

    top.append(reportId, priority);

    const animalHeading = document.createElement("h2");
    animalHeading.textContent =
        complaint.animal_type || "Unknown animal";

    const category = document.createElement("p");
    category.className = "complaint-category";
    category.textContent = complaint.category || "Uncategorized";

    const location = createDetail(
        "Location: ",
        complaint.location || "Not provided"
    );

    const citizen = createDetail(
        "Reported by: ",
        complaint.citizen_name || "Citizen"
    );

    const mobile = createDetail(
        "Mobile: ",
        complaint.citizen_mobile || "Not available"
    );

    const date = createDetail(
        "Submitted: ",
        formatDate(complaint.created_at)
    );

    const description = document.createElement("p");
    description.className = "complaint-description";
    description.textContent =
        complaint.description || "No description provided.";

    const footer = document.createElement("div");
    footer.className = "complaint-footer";

    const status = document.createElement("span");
    status.className = "badge";
    status.textContent = complaint.status || "Pending Review";

    const action = document.createElement("a");
    action.className = "secondary-button";
    action.href = `assign-staff.html?complaintId=${encodeURIComponent(complaint.id)}`;
    action.textContent = "Assign Staff";

    footer.append(status, action);

    details.append(
        top,
        animalHeading,
        category,
        location,
        citizen,
        mobile,
        date,
        description,
        footer
    );

    card.appendChild(details);

    return card;
}

function createDetail(labelText, valueText) {
    const element = document.createElement("p");
    element.className = "detail-line";

    const label = document.createElement("span");
    label.className = "detail-label";
    label.textContent = labelText;

    const value = document.createElement("span");
    value.textContent = valueText;

    element.append(label, value);

    return element;
}

// ============================================
// HELPERS
// ============================================

function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
}

function showMessage(message, isError = false) {
    const element = document.getElementById("complaints-message");

    element.textContent = message;
    element.classList.toggle("error", isError);
}

// ============================================
// LOGOUT
// ============================================

function setupLogout() {
    document.getElementById("logout-button")
        .addEventListener("click", () => {
            sessionStorage.removeItem("straysyncOfficerToken");
            sessionStorage.removeItem("straysyncOfficer");

            window.location.href = "../auth/officer-login.html";
        });
}