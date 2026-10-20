// ============================================
// STRAYSYNC - ASSIGN RESCUE STAFF
// ============================================

const API_BASE_URL = "/api";

const assignmentList = document.getElementById("assignment-list");
const pageMessage = document.getElementById("page-message");
const refreshButton = document.getElementById("refresh-button");


// ============================================
// CHECK MUNICIPAL OFFICER LOGIN
// ============================================

const officerToken = sessionStorage.getItem("straysyncOfficerToken");

if (!officerToken) {
    window.location.href = "../auth/officer-login.html";
}


// ============================================
// DISPLAY MESSAGE
// ============================================

function showMessage(message, type = "") {
    pageMessage.textContent = message;
    pageMessage.className = "assignment-message";

    if (type) {
        pageMessage.classList.add(type);
    }
}


// ============================================
// API REQUEST HELPER
// ============================================

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${officerToken}`,
            ...(options.body ? {
                "Content-Type": "application/json"
            } : {}),
            ...options.headers
        }
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
        if (response.status === 401) {
            sessionStorage.removeItem("straysyncOfficerToken");
            sessionStorage.removeItem("straysyncOfficer");
            window.location.href = "../auth/officer-login.html";
        }

        throw new Error(
            data.message || "You are not authorized to perform this action."
        );
    }

    if (!response.ok || data.success === false) {
        throw new Error(data.message || "The request could not be completed.");
    }

    return data;
}


// ============================================
// LOAD APPROVED RESCUE STAFF
// ============================================

async function loadApprovedStaff() {
    const data = await apiRequest("/admin/staff");

    if (!Array.isArray(data.staff)) {
        throw new Error("The staff list could not be read.");
    }

    return data.staff.filter(
        staff => staff.account_status === "Approved"
    );
}


// ============================================
// LOAD COMPLAINTS AVAILABLE FOR ASSIGNMENT
// ============================================

async function loadAssignableComplaints() {
    assignmentList.replaceChildren();

    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Loading pending complaints...";
    assignmentList.appendChild(loading);

    showMessage("");

    try {
        const [complaintData, approvedStaff] = await Promise.all([
            apiRequest("/complaints/assignable"),
            loadApprovedStaff()
        ]);

        const complaints = complaintData.complaints;

        if (!Array.isArray(complaints)) {
            throw new Error("The complaint list could not be read.");
        }

        assignmentList.replaceChildren();

        if (complaints.length === 0) {
            const emptyState = document.createElement("div");
            emptyState.className = "empty-state";
            emptyState.textContent =
                "No complaints are currently awaiting assignment.";
            assignmentList.appendChild(emptyState);
            return;
        }

        complaints.forEach(complaint => {
            const card = createComplaintCard(complaint, approvedStaff);
            assignmentList.appendChild(card);
        });

    } catch (error) {
        console.error("Loading assignment page failed:", error);

        assignmentList.replaceChildren();

        const errorState = document.createElement("div");
        errorState.className = "empty-state";
        errorState.textContent = error.message;

        assignmentList.appendChild(errorState);
    }
}


// ============================================
// CREATE A COMPLAINT CARD
// ============================================

function createComplaintCard(complaint, approvedStaff) {
    const card = document.createElement("article");
    card.className = "assignment-card";

    // Animal photograph
    const photo = document.createElement("img");
    photo.className = "animal-photo";
    photo.alt = `Photograph of reported ${complaint.animal_type || "animal"}`;

    if (complaint.original_photo) {
        photo.src = complaint.original_photo;
    } else {
        photo.alt = "No animal photograph available";
    }

    photo.addEventListener("error", () => {
        photo.style.display = "none";
    });

    card.appendChild(photo);

    const content = document.createElement("div");
    content.className = "assignment-card-content";

    const heading = document.createElement("h3");
    heading.textContent =
        `Complaint #${complaint.id} — ${complaint.animal_type || "Animal"}`;

    content.appendChild(heading);

    addText(content, "Category", complaint.category);
    addText(content, "Description", complaint.description);
    addText(content, "Location", complaint.location);
    addText(content, "Reported by", complaint.citizen_name);
    addText(content, "Mobile", complaint.citizen_mobile);

    const priority = document.createElement("p");
    priority.textContent = "Priority: ";

    const priorityBadge = document.createElement("span");
    priorityBadge.className = "priority-badge";
    priorityBadge.textContent = complaint.priority || "Medium";

    priority.appendChild(priorityBadge);
    content.appendChild(priority);

    const status = document.createElement("p");
    status.textContent = `Status: ${complaint.status || "Pending Review"}`;
    content.appendChild(status);

    // Approved staff selection
    const selectLabel = document.createElement("label");
    selectLabel.textContent = "Select rescue staff";
    selectLabel.htmlFor = `staff-select-${complaint.id}`;
    content.appendChild(selectLabel);

    const staffSelect = document.createElement("select");
    staffSelect.className = "assignment-select";
    staffSelect.id = `staff-select-${complaint.id}`;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = approvedStaff.length
        ? "Choose an approved staff member"
        : "No approved staff available";

    staffSelect.appendChild(placeholder);

    approvedStaff.forEach(staff => {
        const option = document.createElement("option");
        option.value = staff.id;
        option.textContent =
            `${staff.full_name} (${staff.employee_id})`;

        staffSelect.appendChild(option);
    });

    content.appendChild(staffSelect);

    // Feedback for this complaint
    const feedback = document.createElement("p");
    feedback.className = "assignment-message";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    content.appendChild(feedback);

    // Assignment button
    const assignButton = document.createElement("button");
    assignButton.type = "button";
    assignButton.className = "assign-button";
    assignButton.textContent = "Assign Staff";
    assignButton.disabled = approvedStaff.length === 0;

    assignButton.addEventListener("click", async () => {
        const staffId = Number(staffSelect.value);

        if (!staffId) {
            feedback.textContent = "Please select a rescue staff member.";
            feedback.className = "assignment-message error";
            return;
        }

        assignButton.disabled = true;
        staffSelect.disabled = true;
        assignButton.textContent = "Assigning...";

        try {
            const result = await apiRequest(
                `/complaints/${complaint.id}/assign`,
                {
                    method: "POST",
                    body: JSON.stringify({ staffId })
                }
            );

            feedback.textContent =
                result.message || "Staff assigned successfully.";
            feedback.className = "assignment-message success";

            showMessage(
                `Complaint #${complaint.id} assigned successfully.`,
                "success"
            );

            // Remove the assigned complaint from the pending list.
            card.remove();

            if (assignmentList.children.length === 0) {
                const emptyState = document.createElement("div");
                emptyState.className = "empty-state";
                emptyState.textContent =
                    "All currently available complaints have been assigned.";
                assignmentList.appendChild(emptyState);
            }

        } catch (error) {
            feedback.textContent = error.message;
            feedback.className = "assignment-message error";

            assignButton.disabled = false;
            staffSelect.disabled = false;
            assignButton.textContent = "Assign Staff";
        }
    });

    content.appendChild(assignButton);
    card.appendChild(content);

    return card;
}


// ============================================
// HELPER: ADD TEXT SAFELY
// ============================================

function addText(container, label, value) {
    const paragraph = document.createElement("p");
    paragraph.textContent = `${label}: ${value || "Not provided"}`;
    container.appendChild(paragraph);
}


// ============================================
// REFRESH BUTTON
// ============================================

refreshButton.addEventListener("click", loadAssignableComplaints);


// ============================================
// INITIALIZE PAGE
// ============================================

if (officerToken) {
    loadAssignableComplaints();
}