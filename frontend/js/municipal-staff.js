// ============================================
// STRAYSYNC - MUNICIPAL STAFF MANAGEMENT
// ============================================

document.addEventListener("DOMContentLoaded", initializeStaffPage);

let allStaff = [];

async function initializeStaffPage() {
    document.getElementById("current-year").textContent =
        new Date().getFullYear();

    displayOfficerName();
    setupLogout();
    setupFilters();

    const token = sessionStorage.getItem("straysyncOfficerToken");

    if (!token) {
        window.location.href = "../auth/officer-login.html";
        return;
    }

    await loadStaff();
}

// ============================================
// OFFICER PROFILE
// ============================================

function displayOfficerName() {
    const element = document.getElementById("officer-name");

    try {
        const savedOfficer = sessionStorage.getItem("straysyncOfficer");

        if (!savedOfficer) return;

        const officer = JSON.parse(savedOfficer);

        element.textContent =
            officer.full_name ||
            officer.fullName ||
            officer.name ||
            "Municipal Officer";
    } catch (error) {
        console.error("Unable to read officer information:", error);
    }
}

// ============================================
// LOAD STAFF ACCOUNTS
// ============================================

async function loadStaff() {
    const token = sessionStorage.getItem("straysyncOfficerToken");
    const grid = document.getElementById("staff-grid");

    grid.replaceChildren();

    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Loading staff accounts...";
    grid.appendChild(loading);

    try {
        const response = await fetch("/api/admin/staff", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json"
            }
        });

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem("straysyncOfficerToken");
            sessionStorage.removeItem("straysyncOfficer");

            window.location.href = "../auth/officer-login.html";
            return;
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load staff accounts.");
        }

        allStaff = Array.isArray(data.staff) ? data.staff : [];

        updateStatistics();
        renderStaff();

        showMessage(
            `${allStaff.length} staff account(s) retrieved successfully.`,
            false
        );

    } catch (error) {
        console.error("Staff loading error:", error);

        showMessage(
            error.message || "Unable to connect to the backend.",
            true
        );

        grid.replaceChildren();

        const empty = document.createElement("div");
        empty.className = "empty-state";

        const heading = document.createElement("h2");
        heading.textContent = "Unable to load staff";

        const message = document.createElement("p");
        message.textContent =
            "Check that the backend is running, then refresh this page.";

        empty.append(heading, message);
        grid.appendChild(empty);
    }
}

// ============================================
// UPDATE STATISTICS
// ============================================

function updateStatistics() {
    const pending = allStaff.filter(
        staff => staff.account_status === "Pending Approval"
    ).length;

    const approved = allStaff.filter(
        staff => staff.account_status === "Approved"
    ).length;

    setText("total-staff", allStaff.length);
    setText("pending-staff", pending);
    setText("approved-staff", approved);
}

// ============================================
// SEARCH AND FILTER
// ============================================

function setupFilters() {
    document.getElementById("staff-search")
        .addEventListener("input", renderStaff);

    document.getElementById("staff-status-filter")
        .addEventListener("change", renderStaff);

    document.getElementById("refresh-button")
        .addEventListener("click", loadStaff);
}

// ============================================
// RENDER STAFF
// ============================================

function renderStaff() {
    const grid = document.getElementById("staff-grid");

    const searchText = document.getElementById("staff-search")
        .value.trim().toLowerCase();

    const selectedStatus =
        document.getElementById("staff-status-filter").value;

    const filteredStaff = allStaff.filter(staff => {
        const searchableText = [
            staff.full_name,
            staff.employee_id,
            staff.official_email,
            staff.mobile
        ].join(" ").toLowerCase();

        return searchableText.includes(searchText) &&
            (!selectedStatus || staff.account_status === selectedStatus);
    });

    grid.replaceChildren();

    if (filteredStaff.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";

        const heading = document.createElement("h2");
        heading.textContent = allStaff.length === 0
            ? "No staff accounts registered"
            : "No matching staff accounts";

        const message = document.createElement("p");
        message.textContent = allStaff.length === 0
            ? "Registered rescue staff will appear here."
            : "Try changing your search or status filter.";

        empty.append(heading, message);
        grid.appendChild(empty);
        return;
    }

    filteredStaff.forEach(staff => {
        grid.appendChild(createStaffCard(staff));
    });
}

// ============================================
// CREATE STAFF CARD
// ============================================

function createStaffCard(staff) {
    const card = document.createElement("article");
    card.className = "staff-card";

    const header = document.createElement("div");
    header.className = "staff-card-header";

    const avatar = document.createElement("div");
    avatar.className = "staff-avatar";
    avatar.textContent = "🚑";

    const heading = document.createElement("div");

    const name = document.createElement("h2");
    name.className = "staff-name";
    name.textContent = staff.full_name || "Unnamed Staff";

    const employeeId = document.createElement("p");
    employeeId.className = "staff-id";
    employeeId.textContent = staff.employee_id || "No employee ID";

    heading.append(name, employeeId);
    header.append(avatar, heading);

    const email = createDetail(
        "OFFICIAL EMAIL",
        staff.official_email || "Not provided"
    );

    const mobile = createDetail(
        "MOBILE NUMBER",
        staff.mobile || "Not provided"
    );

    const registered = createDetail(
        "REGISTERED ON",
        formatDate(staff.created_at)
    );

    const footer = document.createElement("div");
    footer.className = "staff-card-footer";

    const status = document.createElement("span");

    const accountStatus = staff.account_status || "Unknown";

    status.className = "staff-badge " +
        (accountStatus === "Pending Approval"
            ? "pending"
            : accountStatus === "Approved"
                ? "approved"
                : "other-status");

    status.textContent = accountStatus;

    footer.appendChild(status);

    if (accountStatus === "Pending Approval") {
        const approveButton = document.createElement("button");

        approveButton.type = "button";
        approveButton.className = "approve-button";
        approveButton.textContent = "✓ Approve";
        approveButton.addEventListener("click", () => approveStaff(staff, approveButton));

        footer.appendChild(approveButton);
    }

    card.append(
        header,
        email,
        mobile,
        registered,
        footer
    );

    return card;
}

function createDetail(labelText, valueText) {
    const wrapper = document.createElement("p");
    wrapper.className = "staff-detail";

    const label = document.createElement("strong");
    label.textContent = labelText;

    const value = document.createElement("span");
    value.textContent = valueText;

    wrapper.append(label, value);

    return wrapper;
}

// ============================================
// APPROVE STAFF ACCOUNT
// ============================================

async function approveStaff(staff, button) {
    const staffName = staff.full_name || "this staff member";

    const confirmed = window.confirm(
        `Approve ${staffName}'s rescue staff account?`
    );

    if (!confirmed) return;

    const token = sessionStorage.getItem("straysyncOfficerToken");

    button.disabled = true;
    button.textContent = "Approving...";

    try {
        const response = await fetch(
            `/api/admin/staff/${encodeURIComponent(staff.id)}/approve`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json"
                }
            }
        );

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem("straysyncOfficerToken");
            sessionStorage.removeItem("straysyncOfficer");

            window.location.href = "../auth/officer-login.html";
            return;
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to approve this account.");
        }

        showMessage(
            data.message || "Staff account approved successfully.",
            false
        );

        await loadStaff();

    } catch (error) {
        console.error("Staff approval error:", error);

        showMessage(
            error.message || "Unable to approve the staff account.",
            true
        );

        button.disabled = false;
        button.textContent = "✓ Approve";
    }
}

// ============================================
// HELPERS
// ============================================

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
}

function showMessage(message, isError = false) {
    const element = document.getElementById("staff-message");

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