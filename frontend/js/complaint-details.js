// ========================================
// STRAYSYNC - COMPLAINT DETAILS
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const messageBox = document.getElementById("details-message");
    const detailsContent = document.getElementById("details-content");

    const params = new URLSearchParams(window.location.search);

    // Example URL: complaint-details.html?id=1
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
    // DISPLAY PHOTO
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
            caption.textContent = "Original photograph submitted with this complaint.";
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

        setText(
            "progress-title",
            status === "Pending Review"
                ? "Waiting for Review"
                : status
        );

        const descriptions = {
            "Pending Review":
                "Your complaint is awaiting review by an authorized officer.",

            "Assigned":
                "The complaint has been assigned for further action.",

            "In Progress":
                "The assigned team is working on the reported issue.",

            "Pending Verification":
                "The reported action is awaiting verification.",

            "Resolved":
                "The complaint has been marked as resolved."
        };

        setText(
            "progress-description",
            descriptions[status] ||
            "The current status is available above."
        );

        setText(
            "resolution-description",
            status === "Resolved"
                ? "This complaint is currently marked as resolved."
                : "The report will be updated when its status changes."
        );

        setText(
            "next-step-message",
            status === "Pending Review"
                ? "An authorized officer needs to review this complaint before further action."
                : status === "Resolved"
                    ? "This complaint is marked as resolved. Contact the responsible municipal office if you have concerns."
                    : "Follow the status shown above for updates. The page displays the latest status returned by the server."
        );
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

// Update priority in Report Information.
setText("detail-priority", priority);

// Update priority in Report Summary.
const priorityBadge = document.getElementById("summary-priority");

priorityBadge.textContent = priority;
priorityBadge.className =
    `priority-value ${getPriorityClass(priority)}`;

        displayPhoto(item.original_photo, item.animal_type);
        displayStatus(item.status || "Pending Review");

        // Show a map link only when both coordinates are valid.
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

            /*
             * Fetch the logged-in citizen's complaints.
             * The backend must return only complaints belonging
             * to the authenticated citizen.
             */
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
                    "Your session may have expired. Please log in again."
                );
            }

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to retrieve complaint details."
                );
            }

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

            showMessage(
                "Complaint details loaded successfully."
            );

        } catch (error) {

            console.error("Complaint details error:", error);

            showMessage(
                error.message || "Unable to load complaint details.",
                "error"
            );
        }
    }


    // ========================================
    // START
    // ========================================

    loadComplaintDetails();

});