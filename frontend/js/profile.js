document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 1. GET HTML ELEMENTS
    // ==========================================

    const form = document.getElementById("profileForm");

    const fullNameInput = document.getElementById("fullName");
    const phoneInput = document.getElementById("phone");
    const emailInput = document.getElementById("email");
    const addressInput = document.getElementById("address");

    const heroName = document.getElementById("heroName");
    const heroPhone = document.getElementById("heroPhone");
    const profileAvatar = document.getElementById("profileAvatar");

    const editButton = document.getElementById("editButton");
    const cancelButton = document.getElementById("cancelButton");
    const saveButton = document.getElementById("saveButton");
    const formActions = document.getElementById("formActions");
    const logoutButton = document.getElementById("logoutButton");
    const messageBox = document.getElementById("messageBox");

    // Check whether the required HTML elements exist.
    const requiredElements = {
        form,
        fullNameInput,
        phoneInput,
        emailInput,
        addressInput,
        heroName,
        heroPhone,
        profileAvatar,
        editButton,
        cancelButton,
        saveButton,
        formActions,
        logoutButton,
        messageBox
    };

    for (const [name, element] of Object.entries(requiredElements)) {
        if (!element) {
            console.error(`Profile page is missing the HTML element: ${name}`);
            return;
        }
    }

    // ==========================================
    // 2. PROFILE VARIABLES
    // ==========================================

    let originalProfile = null;
    let isEditing = false;

    // ==========================================
    // 3. DISPLAY MESSAGES
    // ==========================================

    function showMessage(message, type = "info") {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
    }

    function hideMessage() {
        messageBox.textContent = "";
        messageBox.className = "message-box";
    }

    // ==========================================
    // 4. CHECK API FUNCTIONS
    // ==========================================

    function getAPI() {
        const api = window.StraySyncAPI;

        if (api && typeof api.apiRequest === "function") {
            return api;
        }

        // Support projects where functions are exposed individually.
        if (typeof window.apiRequest === "function") {
            return {
                apiRequest: window.apiRequest,
                getAuthToken: window.getAuthToken,
                clearAuthToken: window.clearAuthToken
            };
        }

        throw new Error(
            "The API helper could not be loaded. Please check api.js in profile.html."
        );
    }

    // ==========================================
    // 5. EXTRACT PROFILE FROM API RESPONSE
    // ==========================================

    function getProfileFromResponse(response) {
        if (!response || response.success === false) {
            throw new Error(
                response?.message || "Could not load your profile."
            );
        }

        const profile =
            response.user ||
            response.citizen ||
            response.profile ||
            response.data ||
            response;

        if (!profile || typeof profile !== "object") {
            throw new Error("The server returned invalid profile information.");
        }

        return profile;
    }

    // ==========================================
    // 6. DISPLAY CITIZEN DETAILS
    // ==========================================

    function displayProfile(profile) {
        const name =
            profile.fullName ||
            profile.full_name ||
            profile.name ||
            "";

        const phone =
            profile.phone ||
            profile.mobile ||
            profile.phoneNumber ||
            "";

        const email = profile.email || "";
        const address = profile.address || "";

        fullNameInput.value = name;
        phoneInput.value = phone;
        emailInput.value = email;
        addressInput.value = address;

        heroName.textContent = name || "Citizen";

        heroPhone.textContent =
            phone || "Phone number not available";

        profileAvatar.textContent = name
            ? name.trim().charAt(0).toUpperCase()
            : "U";
    }

    // ==========================================
    // 7. ENABLE OR DISABLE EDITING
    // ==========================================

    function setEditing(enabled) {
        isEditing = enabled;

        fullNameInput.disabled = !enabled;
        emailInput.disabled = !enabled;
        addressInput.disabled = !enabled;

        // Phone changes require a separate verification process.
        phoneInput.disabled = true;

        formActions.hidden = !enabled;
        editButton.hidden = enabled;

        if (enabled) {
            fullNameInput.focus();
        }
    }

    // ==========================================
    // 8. LOAD CITIZEN PROFILE
    // ==========================================

    async function loadProfile() {
        try {
            const api = getAPI();

            if (
                typeof api.getAuthToken !== "function" ||
                !api.getAuthToken()
            ) {
                showMessage(
                    "Please log in to view your profile.",
                    "error"
                );

                setTimeout(() => {
                    window.location.href =
                        "../auth/citizen-login.html";
                }, 1200);

                return;
            }

            showMessage("Loading your profile...", "info");

            // api.js already adds the /api prefix.
            const response = await api.apiRequest("/auth/me", {
                method: "GET"
            });

            const profile = getProfileFromResponse(response);

            originalProfile = {
                fullName:
                    profile.fullName ||
                    profile.full_name ||
                    profile.name ||
                    "",

                phone:
                    profile.phone ||
                    profile.mobile ||
                    profile.phoneNumber ||
                    "",

                email: profile.email || "",
                address: profile.address || ""
            };

            displayProfile(originalProfile);

            hideMessage();

        } catch (error) {
            console.error("Profile loading error:", error);

            showMessage(
                error.message ||
                "Unable to load your profile. Please try again.",
                "error"
            );
        }
    }

    // ==========================================
    // 9. EDIT PROFILE BUTTON
    // ==========================================

    editButton.addEventListener("click", () => {
        if (!originalProfile) {
            showMessage(
                "Your profile has not loaded yet.",
                "error"
            );
            return;
        }

        hideMessage();

        displayProfile(originalProfile);

        setEditing(true);
    });

    // ==========================================
    // 10. CANCEL EDITING
    // ==========================================

    cancelButton.addEventListener("click", () => {
        if (originalProfile) {
            displayProfile(originalProfile);
        }

        setEditing(false);
        hideMessage();
    });

    // ==========================================
    // 11. SAVE UPDATED PROFILE
    // ==========================================

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!isEditing) {
            return;
        }

        const updatedProfile = {
            fullName: fullNameInput.value.trim(),
            email: emailInput.value.trim(),
            address: addressInput.value.trim()
        };

        if (!updatedProfile.fullName) {
            showMessage(
                "Please enter your full name.",
                "error"
            );

            fullNameInput.focus();
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {
            const api = getAPI();

            // api.js already adds /api.
            const response = await api.apiRequest("/auth/profile", {
                method: "PUT",
                body: JSON.stringify(updatedProfile)
            });

            if (!response || response.success === false) {
                throw new Error(
                    response?.message ||
                    "Could not save your profile."
                );
            }

            const returnedProfile =
                response.user ||
                response.citizen ||
                response.profile ||
                response.data ||
                {};

            originalProfile = {
                ...originalProfile,
                ...updatedProfile,
                ...returnedProfile
            };

            displayProfile(originalProfile);

            setEditing(false);

            showMessage(
                "Your profile has been updated successfully.",
                "success"
            );

        } catch (error) {
            console.error("Profile update error:", error);

            showMessage(
                error.message ||
                "Unable to save your profile.",
                "error"
            );

        } finally {
            saveButton.disabled = false;
            saveButton.textContent = "Save Changes";
        }
    });

    // ==========================================
    // 12. LOGOUT
    // ==========================================

    logoutButton.addEventListener("click", () => {
        const confirmed = window.confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmed) {
            return;
        }

        try {
            const api = getAPI();

            if (typeof api.clearAuthToken === "function") {
                api.clearAuthToken();
            }
        } catch (error) {
            console.error("Logout cleanup error:", error);
        }

        window.location.href = "../auth/citizen-login.html";
    });

    // ==========================================
    // 13. INITIALIZE PROFILE PAGE
    // ==========================================

    setEditing(false);
    loadProfile();
});