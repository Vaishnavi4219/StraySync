// ========================================
// STRAYSYNC - ANIMAL REPORT PAGE
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("animal-report-form");
    const message = document.getElementById("report-message");
    const submitButton = document.getElementById("submit-report-button");

    const photoInput = document.getElementById("photo");
    const previewContainer = document.getElementById("photo-preview-container");
    const photoPreview = document.getElementById("photo-preview");
    const removePhotoButton = document.getElementById("remove-photo");

    const locationButton = document.getElementById("location-button");
    const locationMessage = document.getElementById("location-message");

    const yearElement = document.getElementById("current-year");

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    let previewUrl = null;

    // ========================================
    // MESSAGE FUNCTIONS
    // ========================================

    function showMessage(text, type) {
        if (!message) return;

        message.textContent = text;
        message.className = `report-message ${type}`;
    }

    function clearMessage() {
        if (!message) return;

        message.textContent = "";
        message.className = "report-message";
    }

    // ========================================
    // GET AUTHENTICATION TOKEN
    // ========================================

    function getAuthToken() {
        if (window.StraySyncAPI) {
            return window.StraySyncAPI.getAuthToken();
        }

        return (
            localStorage.getItem("straySyncToken") ||
            sessionStorage.getItem("straySyncToken")
        );
    }

    // ========================================
    // PHOTO PREVIEW
    // ========================================

    if (photoInput) {
        photoInput.addEventListener("change", () => {

            clearMessage();

            const file = photoInput.files[0];

            if (!file) {
                if (previewContainer) {
                    previewContainer.hidden = true;
                }
                return;
            }

            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (!allowedTypes.includes(file.type)) {
                photoInput.value = "";

                if (previewContainer) {
                    previewContainer.hidden = true;
                }

                showMessage(
                    "Please choose a JPG, PNG, or WEBP image.",
                    "error"
                );

                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                photoInput.value = "";

                if (previewContainer) {
                    previewContainer.hidden = true;
                }

                showMessage(
                    "The photograph must be smaller than 5 MB.",
                    "error"
                );

                return;
            }

            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }

            previewUrl = URL.createObjectURL(file);

            if (photoPreview) {
                photoPreview.src = previewUrl;
            }

            if (previewContainer) {
                previewContainer.hidden = false;
            }
        });
    }

    // ========================================
    // REMOVE PHOTO
    // ========================================

    if (removePhotoButton) {
        removePhotoButton.addEventListener("click", () => {

            if (photoInput) {
                photoInput.value = "";
            }

            if (photoPreview) {
                photoPreview.removeAttribute("src");
            }

            if (previewContainer) {
                previewContainer.hidden = true;
            }

            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                previewUrl = null;
            }
        });
    }

    // ========================================
    // GET GPS LOCATION
    // ========================================

    if (locationButton) {
        locationButton.addEventListener("click", () => {

            clearMessage();

            if (!navigator.geolocation) {
                if (locationMessage) {
                    locationMessage.textContent =
                        "Your browser does not support location access.";
                }
                return;
            }

            locationButton.disabled = true;

            if (locationMessage) {
                locationMessage.textContent =
                    "Getting your location...";
            }

            navigator.geolocation.getCurrentPosition(

                (position) => {

                    document.getElementById("latitude").value =
                        position.coords.latitude;

                    document.getElementById("longitude").value =
                        position.coords.longitude;

                    if (locationMessage) {
                        locationMessage.textContent =
                            "Location coordinates added. Please verify the address.";
                    }

                    locationButton.disabled = false;
                },

                (error) => {

                    const errorMessages = {
                        1: "Location permission was denied. You can enter the location manually.",
                        2: "Your location could not be determined. Please enter it manually.",
                        3: "Location request timed out. Please try again."
                    };

                    if (locationMessage) {
                        locationMessage.textContent =
                            errorMessages[error.code] ||
                            "Unable to get your location. Enter it manually.";
                    }

                    locationButton.disabled = false;
                },

                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    // ========================================
    // SUBMIT COMPLAINT
    // ========================================

    if (form) {
        form.addEventListener("submit", async (event) => {

            event.preventDefault();

            clearMessage();

            // Get the authenticated citizen's token.
            const token = getAuthToken();

            if (!token) {
                showMessage(
                    "Please log in to your citizen account before submitting a complaint.",
                    "error"
                );

                return;
            }

            // A photograph is required.
            const photo = photoInput?.files?.[0];

            if (!photo) {
                showMessage(
                    "Please upload a photograph of the reported situation.",
                    "error"
                );

                return;
            }

            // Validate required form fields.
            if (!form.reportValidity()) {
                return;
            }

            // Prepare the form data.
            const formData = new FormData(form);

            // The backend obtains the citizen ID from the token.
            formData.delete("citizenId");

            submitButton.disabled = true;
            submitButton.textContent = "Submitting...";

            try {

                const response = await fetch("/api/complaints", {
                    method: "POST",

                    headers: {
                        "Authorization": `Bearer ${token}`
                    },

                    body: formData
                });

                let result;

                try {
                    result = await response.json();
                } catch {
                    throw new Error(
                        "The server returned an invalid response. Please try again."
                    );
                }

                if (response.status === 401 || response.status === 403) {
                    throw new Error(
                        "Your login session is invalid or expired. Please sign in again."
                    );
                }

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message ||
                        "Unable to submit your complaint."
                    );
                }

                // ========================================
                // SAVE SUCCESSFUL COMPLAINT ID
                // ========================================

                const complaintId = result.complaintId;

                if (
                    complaintId !== undefined &&
                    complaintId !== null
                ) {
                    sessionStorage.setItem(
                        "straySyncLastComplaintId",
                        String(complaintId)
                    );

                    showMessage(
                        `Complaint submitted successfully! Your complaint ID is ${complaintId}. Redirecting to your complaints...`,
                        "success"
                    );
                } else {
                    showMessage(
                        "Your complaint was submitted successfully. Redirecting to your complaints...",
                        "success"
                    );
                }

                // ========================================
                // RESET THE FORM
                // ========================================

                form.reset();

                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    previewUrl = null;
                }

                if (photoPreview) {
                    photoPreview.removeAttribute("src");
                }

                if (previewContainer) {
                    previewContainer.hidden = true;
                }

                if (locationMessage) {
                    locationMessage.textContent =
                        "Your location has not been selected.";
                }

                // ========================================
                // GO TO THE NEXT PAGE
                // ========================================

                setTimeout(() => {
                    window.location.href = "complaints.html";
                }, 1500);

            } catch (error) {

                console.error("Complaint submission error:", error);

                showMessage(
                    error.message ||
                    "Unable to submit your complaint. Please try again.",
                    "error"
                );

            } finally {

                submitButton.disabled = false;
                submitButton.textContent = "Submit Complaint →";
            }
        });
    }

});