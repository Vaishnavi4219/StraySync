// ========================================
// STRAYSYNC - COMPLAINT DETAILS
// ========================================

document.addEventListener("DOMContentLoaded", () => {

const messageBox = document.getElementById("details-message");
const detailsContent = document.getElementById("details-content");

const params = new URLSearchParams(window.location.search);
const complaintId = params.get("id");

document.getElementById("current-year").textContent =
    new Date().getFullYear();


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

document.getElementById("logout-button").addEventListener(
    "click",
    logout
);

document.getElementById("citizen-name").textContent =
    localStorage.getItem("straySyncCitizenName") ||
    sessionStorage.getItem("straySyncCitizenName") ||
    "Citizen";


// ========================================
// SAFE TEXT OUTPUT
// ========================================

function setText(id, value) {

    const element = document.getElementById(id);

    if (element) {
        element.textContent =
            value === null || value === undefined || value === ""
                ? "Not provided"
                : String(value);
    }
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
// FORMATTING
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
        case "Awaiting Citizen Feedback":
        case "Pending Officer Approval":
            return "status-verification";

        case "Resolved":
        case "Completed":
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

function getAnimalEmoji(animal) {

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

    return animals[animal] || "🐾";
}


// ========================================
// DISPLAY ORIGINAL PHOTO
// ========================================

function displayPhoto(photoPath, animalType) {

    const photoContainer = document.getElementById("animal-photo");
    const emoji = getAnimalEmoji(animalType);

    document.getElementById("animal-emoji").textContent = emoji;

    if (
        typeof photoPath !== "string" ||
        !photoPath.startsWith("/uploads/") ||
        photoPath.includes("..")
    ) {
        return;
    }

    const image = document.createElement("img");

    image.src = photoPath;
    image.alt = `Reported ${animalType || "animal"}`;

    image.addEventListener("error", () => {

        image.remove();

        const placeholder = document.createElement("div");
        placeholder.className = "photo-placeholder";

        const icon = document.createElement("span");
        icon.textContent = emoji;

        const text = document.createElement("p");
        text.textContent = "The uploaded photograph could not be loaded.";

        placeholder.append(icon, text);
        photoContainer.replaceChildren(placeholder);

    }, { once: true });

    const caption = photoContainer.nextElementSibling;

    photoContainer.replaceChildren(image);

    if (caption) {
        caption.textContent =
            "Original photograph submitted with this complaint.";
    }
}


// ========================================
// DISPLAY STATUS
// ========================================

function displayStatus(status) {

    const badge = document.getElementById("complaint-status");

    badge.textContent = status || "Unknown";
    badge.className = `status-badge ${getStatusClass(status)}`;

    setText("summary-status", status || "Unknown");

    const descriptions = {

        "Pending Review":
            "Your complaint is awaiting review by an authorized officer.",

        "Assigned":
            "The complaint has been assigned to a rescue staff member.",

        "In Progress":
            "The assigned rescue team is working on the reported issue.",

        "Pending Verification":
            "The rescue report is awaiting verification.",

        "Awaiting Citizen Feedback":
            "The rescue staff has submitted a report. Please review the work and submit your feedback.",

        "Pending Officer Approval":
            "Your feedback has been submitted. The municipal officer will now review the rescue report.",

        "Completed":
            "The municipal officer has approved the rescue report. Your complaint is completed.",

        "Resolved":
            "Your complaint has been marked as resolved."
    };

    setText(
        "progress-title",
        status === "Pending Review"
            ? "Waiting for Review"
            : status
    );

    setText(
        "progress-description",
        descriptions[status] ||
        "The current status is available above."
    );

    setText(
        "resolution-description",
        status === "Completed" || status === "Resolved"
            ? "The rescue report has been approved and the complaint is completed."
            : "The report will be updated when its status changes."
    );

    let nextMessage =
        "Follow the status shown above for updates.";

    if (status === "Pending Review") {
        nextMessage =
            "An authorized officer needs to review this complaint before further action.";
    } else if (status === "Awaiting Citizen Feedback") {
        nextMessage =
            "Please review the rescue team's report and submit your feedback.";
    } else if (status === "Pending Officer Approval") {
        nextMessage =
            "Thank you for your feedback. The municipal officer will review the report before completing the complaint.";
    } else if (status === "Completed" || status === "Resolved") {
        nextMessage =
            "Your complaint has been completed. Thank you for helping animals in your community.";
    }

    setText("next-step-message", nextMessage);
}


// ========================================
// DISPLAY COMPLAINT
// ========================================

function displayComplaint(item) {

    setText("detail-id", `#${item.id}`);
    setText("detail-animal", item.animal_type);
    setText("detail-category", item.category);
    setText("detail-description", item.description);
    setText("detail-location", item.location);

    const priority = item.priority || "Medium";

    setText("detail-priority", priority);

    const priorityBadge =
        document.getElementById("summary-priority");

    priorityBadge.textContent = priority;
    priorityBadge.className =
        `priority-value ${getPriorityClass(priority)}`;

    displayPhoto(item.original_photo, item.animal_type);

    displayStatus(item.status || "Pending Review");

    // Display map link only when coordinates are valid.
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);

    const hasCoordinates =
        item.latitude !== null &&
        item.latitude !== undefined &&
        item.latitude !== "" &&
        item.longitude !== null &&
        item.longitude !== undefined &&
        item.longitude !== "" &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180;

    const mapLink = document.getElementById("map-link");

    if (hasCoordinates) {

        mapLink.href =
            `https://www.google.com/maps?q=${latitude},${longitude}`;

        mapLink.hidden = false;

    } else {

        mapLink.hidden = true;
        mapLink.removeAttribute("href");
    }

    detailsContent.hidden = false;
}


// ========================================
// API REQUEST
// ========================================

async function apiRequest(url, options = {}) {

    const token = getToken();

    if (!token) {
        throw new Error("Your login session has expired. Please log in again.");
    }

    const response = await fetch(url, {
        ...options,

        headers: {
            Authorization: `Bearer ${token}`,

            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),

            ...options.headers
        }
    });

    const result = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
        throw new Error(
            result.message || "Your session has expired. Please log in again."
        );
    }

    if (!response.ok || result.success === false) {
        throw new Error(
            result.message || "Unable to complete the request."
        );
    }

    return result;
}


// ========================================
// DISPLAY STAFF EVIDENCE PHOTO
// ========================================

function displayResolutionPhoto(photoPath) {

    const container =
        document.getElementById("resolution-evidence");

    container.replaceChildren();

    if (
        typeof photoPath !== "string" ||
        !photoPath.startsWith("/uploads/") ||
        photoPath.includes("..")
    ) {
        const text = document.createElement("p");
        text.textContent = "No evidence photograph available.";
        container.appendChild(text);
        return;
    }

    const image = document.createElement("img");

    image.src = photoPath;
    image.alt = "Rescue staff evidence photograph";
    image.className = "workflow-photo";

    image.onerror = () => {
        container.replaceChildren();

        const text = document.createElement("p");
        text.textContent = "Evidence photograph could not be loaded.";

        container.appendChild(text);
    };

    container.appendChild(image);
}


// ========================================
// DISPLAY STAFF RESOLUTION REPORT
// ========================================

function displayResolutionReport(report) {

    const section =
        document.getElementById("resolution-report-section");

    const feedbackSection =
        document.getElementById("citizen-feedback-section");

    const form =
        document.getElementById("citizen-feedback-form");

    const feedbackMessage =
        document.getElementById("citizen-feedback-message");

    const submittedFeedback =
        document.getElementById("submitted-citizen-feedback");

    section.classList.remove("workflow-hidden");

    if (!report) {

        setText(
            "resolution-status",
            "Waiting for rescue report"
        );

        setText(
            "resolution-action",
            "The rescue staff has not submitted a report yet."
        );

        setText(
            "resolution-officer-feedback",
            "No officer comments yet."
        );

        displayResolutionPhoto(null);

        feedbackSection.classList.add("workflow-hidden");

        return;
    }

    setText(
        "resolution-status",
        report.verification_status || "Report submitted"
    );

    setText(
        "resolution-action",
        report.action_description || "No action description provided."
    );

    setText(
        "resolution-officer-feedback",
        report.officer_feedback || "No officer comments yet."
    );

    displayResolutionPhoto(report.evidence_photo);

    const reportStatus =
        String(report.verification_status || "").trim().toLowerCase();

    const isAwaitingFeedback =
        reportStatus === "awaiting citizen feedback";

    const isPendingApproval =
        reportStatus === "pending officer approval";

    const isRejected =
        reportStatus === "rejected";

    const hasSubmittedFeedback =
        Boolean(report.citizen_feedback);

    // Show feedback form only when citizen feedback is required.
    if (isAwaitingFeedback && !hasSubmittedFeedback) {

        feedbackSection.classList.remove("workflow-hidden");
        form.classList.remove("workflow-hidden");

        submittedFeedback.classList.add("workflow-hidden");
        feedbackMessage.classList.add("workflow-hidden");

        return;
    }

    // Display previously submitted feedback.
    if (hasSubmittedFeedback) {

        feedbackSection.classList.remove("workflow-hidden");
        form.classList.add("workflow-hidden");

        submittedFeedback.classList.remove("workflow-hidden");

        setText(
            "saved-citizen-feedback",
            report.citizen_feedback
        );

        setText(
            "saved-citizen-rating",
            report.citizen_rating
                ? `Your rating: ${report.citizen_rating} / 5`
                : "No rating provided."
        );

        if (isPendingApproval) {
            feedbackMessage.textContent =
                "Your feedback has been submitted. Waiting for municipal officer approval.";

            feedbackMessage.className = "workflow-message success";
            feedbackMessage.classList.remove("workflow-hidden");

        } else if (isRejected) {
            feedbackMessage.textContent =
                "The officer has rejected the rescue report. Please wait for the staff member to submit a corrected report.";

            feedbackMessage.className = "workflow-message error";
            feedbackMessage.classList.remove("workflow-hidden");

        } else if (
            reportStatus === "approved" ||
            reportStatus === "completed"
        ) {
            feedbackMessage.textContent =
                "The rescue report has been approved.";

            feedbackMessage.className = "workflow-message success";
            feedbackMessage.classList.remove("workflow-hidden");
        }

        return;
    }

    // Do not show a feedback form for reports already reviewed.
    feedbackSection.classList.add("workflow-hidden");
}


// ========================================
// LOAD RESOLUTION REPORT
// ========================================

async function loadResolutionReport() {

    const data = await apiRequest(
        `/api/complaints/${encodeURIComponent(complaintId)}/resolution`
    );

    displayResolutionReport(data.report || null);

    // Use the latest complaint status returned by the resolution API.
    if (data.complaintStatus) {
        displayStatus(data.complaintStatus);
    }
}


// ========================================
// SUBMIT CITIZEN FEEDBACK
// ========================================

const feedbackForm =
    document.getElementById("citizen-feedback-form");

feedbackForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const feedbackInput =
        document.getElementById("citizen-feedback");

    const feedbackMessage =
        document.getElementById("citizen-feedback-message");

    const submitButton =
        document.getElementById("submit-citizen-feedback");

    const feedback = feedbackInput.value.trim();

    const selectedRating =
        document.querySelector('input[name="citizen-rating"]:checked');

    const rating = selectedRating
        ? Number(selectedRating.value)
        : null;

    if (feedback.length < 5) {

        feedbackMessage.textContent =
            "Please enter at least 5 characters of feedback.";

        feedbackMessage.className = "workflow-message error";
        feedbackMessage.classList.remove("workflow-hidden");

        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    feedbackMessage.classList.add("workflow-hidden");

    try {

        const result = await apiRequest(
            `/api/complaints/${encodeURIComponent(complaintId)}/feedback`,
            {
                method: "POST",

                body: JSON.stringify({
                    feedback,
                    rating
                })
            }
        );

        feedbackMessage.textContent =
            result.message || "Your feedback has been submitted successfully.";

        feedbackMessage.className = "workflow-message success";
        feedbackMessage.classList.remove("workflow-hidden");

        // Refresh the report and status after feedback submission.
        await loadResolutionReport();

    } catch (error) {

        console.error("Citizen feedback error:", error);

        feedbackMessage.textContent =
            error.message || "Unable to submit feedback.";

        feedbackMessage.className = "workflow-message error";
        feedbackMessage.classList.remove("workflow-hidden");

    } finally {

        submitButton.disabled = false;
        submitButton.textContent = "Submit Feedback";
    }
});


// ========================================
// FETCH COMPLAINT DETAILS
// ========================================

async function loadComplaintDetails() {

    if (!complaintId || !/^\d+$/.test(complaintId)) {

        showMessage(
            "Invalid complaint ID. Please open a complaint from My Complaints.",
            "error"
        );

        return;
    }

    const token = getToken();

    if (!token) {

        showMessage(
            "Your login session is missing. Redirecting to login...",
            "error"
        );

        setTimeout(logout, 1500);
        return;
    }

    showMessage("Loading complaint details...");

    try {

        const result = await apiRequest("/api/complaints/my");

        const items = Array.isArray(result.complaints)
            ? result.complaints
            : [];

        const complaint = items.find(
            item => String(item.id) === String(complaintId)
        );

        if (!complaint) {

            showMessage(
                "This complaint was not found in your reports. It may not belong to your account.",
                "error"
            );

            return;
        }

        displayComplaint(complaint);

        // Load the staff report and citizen feedback.
        try {

            await loadResolutionReport();

        } catch (reportError) {

            console.error("Resolution report error:", reportError);

            showMessage(
                "Complaint loaded, but the rescue report could not be retrieved: " +
                reportError.message,
                "error"
            );

            return;
        }

        showMessage("Complaint details loaded successfully.");

    } catch (error) {

        console.error("Complaint details error:", error);

        showMessage(
            error.message || "Unable to load complaint details.",
            "error"
        );

        if (
            error.message &&
            error.message.toLowerCase().includes("session")
        ) {
            setTimeout(logout, 1500);
        }
    }
}


// ========================================
// START
// ========================================

loadComplaintDetails();


});
