// ========================================
// STRAYSYNC - AUTHENTICATION PAGE SCRIPTS
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const API_BASE = "/api/auth";

    // ========================================
    // COMMON FUNCTIONS
    // ========================================

    const yearElement = document.getElementById("current-year");

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    function showMessage(element, message, type) {
        if (!element) return;

        element.textContent = message;
        element.className = `form-message visible ${type}`;
    }

    async function readResponse(response) {
        try {
            return await response.json();
        } catch {
            throw new Error(
                "The server returned an invalid response. Please try again."
            );
        }
    }

    // ========================================
    // TOKEN MANAGEMENT
    // ========================================

    function clearLoginSession() {

        if (window.StraySyncAPI) {
            window.StraySyncAPI.clearAuthToken();
        } else {
            localStorage.removeItem("straySyncToken");
            sessionStorage.removeItem("straySyncToken");
            localStorage.removeItem("straySyncCitizenName");
            sessionStorage.removeItem("straySyncCitizenName");
        }
    }

    function saveLoginSession(token, citizen) {

        if (!token || !citizen) {
            throw new Error(
                "The server did not return a valid login session."
            );
        }

        if (window.StraySyncAPI) {
            window.StraySyncAPI.saveAuthToken(token);
        } else {
            localStorage.setItem("straySyncToken", token);
        }

        localStorage.setItem(
            "straySyncCitizenName",
            citizen.fullName || ""
        );

        sessionStorage.removeItem("straySyncToken");
        sessionStorage.removeItem("straySyncCitizenName");
    }

    function clearPendingVerification() {

        sessionStorage.removeItem("straysync_pending_mobile");
        sessionStorage.removeItem("straysync_pending_phone");
        sessionStorage.removeItem("straysync_pending_email");
        sessionStorage.removeItem("straysync_development_otp");
    }

    function redirectToEmailVerification(email) {

        clearLoginSession();
        clearPendingVerification();

        sessionStorage.setItem(
            "straysync_pending_email",
            email
        );

        window.location.href =
            `otp.html?email=${encodeURIComponent(email)}`;
    }

    // ========================================
    // MOBILE NUMBER INPUT
    // ========================================

    const phoneInput = document.getElementById("phone");

    if (phoneInput) {

        phoneInput.addEventListener("input", () => {

            phoneInput.value = phoneInput.value
                .replace(/\D/g, "")
                .slice(0, 10);

        });

    }

    // ========================================
    // SHOW / HIDE PASSWORD
    // ========================================

    const togglePassword =
        document.getElementById("toggle-password");

    const passwordInput =
        document.getElementById("password");

    if (togglePassword && passwordInput) {

        togglePassword.addEventListener("click", () => {

            const shouldShow =
                passwordInput.type === "password";

            passwordInput.type =
                shouldShow ? "text" : "password";

            togglePassword.textContent =
                shouldShow ? "Hide" : "Show";

            togglePassword.setAttribute(
                "aria-label",
                shouldShow ? "Hide password" : "Show password"
            );

        });

    }

    // ========================================
    // CITIZEN REGISTRATION
    // ========================================

    const registerForm =
        document.getElementById("register-form");

    if (registerForm) {

        const messageBox =
            document.getElementById("register-message");

        const registerButton =
            document.getElementById("register-button");

        const registerPassword =
            document.getElementById("password");

        const confirmPassword =
            document.getElementById("confirmPassword");

        registerForm.addEventListener("submit", async (event) => {

            event.preventDefault();

            const fullName =
                document.getElementById("fullName").value.trim();

            const mobile =
                document.getElementById("phone").value.trim();

            const email =
                document.getElementById("email").value.trim().toLowerCase();

            const password = registerPassword.value;

            const confirmation = confirmPassword.value;

            const termsAccepted =
                document.getElementById("terms").checked;

            // Validate name.

            if (fullName.length < 2 || fullName.length > 100) {

                showMessage(
                    messageBox,
                    "Please enter a name between 2 and 100 characters.",
                    "error"
                );

                return;
            }

            // Validate mobile number.

            if (!/^[6-9]\d{9}$/.test(mobile)) {

                showMessage(
                    messageBox,
                    "Please enter a valid 10-digit Indian mobile number.",
                    "error"
                );

                return;
            }

            // Email is compulsory.

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

                showMessage(
                    messageBox,
                    "Please enter a valid email address.",
                    "error"
                );

                return;
            }

            // Validate password.

            if (password.length < 8 || password.length > 128) {

                showMessage(
                    messageBox,
                    "Your password must contain between 8 and 128 characters.",
                    "error"
                );

                return;
            }

            // Confirm password.

            if (password !== confirmation) {

                showMessage(
                    messageBox,
                    "Your passwords do not match.",
                    "error"
                );

                return;
            }

            // Responsible-use agreement.

            if (!termsAccepted) {

                showMessage(
                    messageBox,
                    "Please accept the responsible-use statement.",
                    "error"
                );

                return;
            }

            if (registerButton) {

                registerButton.disabled = true;
                registerButton.textContent = "Creating Account...";

            }

            try {

                const response = await fetch(
                    `${API_BASE}/citizen/register`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify({
                            fullName,
                            mobile,
                            email,
                            password
                        })
                    }
                );

                const result = await readResponse(response);

                // Account created but email OTP delivery failed.
                // Still redirect so the user can use Resend OTP.

                if (result.requiresEmailVerification === true) {

                    showMessage(
                        messageBox,
                        result.message ||
                        "Your account has been created. Continue to email verification.",
                        "success"
                    );

                    sessionStorage.setItem(
                        "straysync_pending_email",
                        email
                    );

                    setTimeout(() => {

                        window.location.href =
                            `otp.html?email=${encodeURIComponent(email)}`;

                    }, 1000);

                    return;
                }

                // Handle normal registration errors.

                if (!response.ok || !result.success) {

                    throw new Error(
                        result.message ||
                        "Registration failed. Please try again."
                    );

                }

                // Save email for the verification page.

                clearPendingVerification();

                sessionStorage.setItem(
                    "straysync_pending_email",
                    email
                );

                showMessage(
                    messageBox,
                    "Account created! An OTP has been sent to your email.",
                    "success"
                );

                setTimeout(() => {

                    window.location.href =
                        `otp.html?email=${encodeURIComponent(email)}`;

                }, 1000);

            } catch (error) {

                console.error("Registration error:", error);

                showMessage(
                    messageBox,
                    error.message ||
                    "Unable to connect to the server. Please try again.",
                    "error"
                );

            } finally {

                if (registerButton) {

                    registerButton.disabled = false;

                    registerButton.innerHTML =
                        'Create Account <span>→</span>';

                }

            }

        });

    }

    // ========================================
    // CITIZEN LOGIN - EMAIL + PASSWORD
    // ========================================

    const loginForm =
        document.getElementById("login-form");

    if (loginForm) {

        const messageBox =
            document.getElementById("login-message");

        const loginButton =
            document.getElementById("login-button");

        const forgotPassword =
            document.getElementById("forgot-password");

        loginForm.addEventListener("submit", async (event) => {

            event.preventDefault();

            if (messageBox) {

                messageBox.textContent = "";
                messageBox.className = "form-message";

            }

            // Get email and password.

            const email =
                document.getElementById("email").value.trim().toLowerCase();

            const password =
                document.getElementById("password").value;

            // Validate email.

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

                showMessage(
                    messageBox,
                    "Please enter a valid email address.",
                    "error"
                );

                return;
            }

            // Validate password.

            if (!password) {

                showMessage(
                    messageBox,
                    "Please enter your password.",
                    "error"
                );

                return;
            }

            if (loginButton) {

                loginButton.disabled = true;
                loginButton.textContent = "Signing In...";

            }

            try {

                const response = await fetch(
                    `${API_BASE}/citizen/login`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify({
                            email,
                            password
                        })
                    }
                );

                const result = await readResponse(response);

                // Email verification required.

                if (result.requiresEmailVerification === true) {

                    if (result.email) {

                        showMessage(
                            messageBox,
                            "Please verify your email to continue.",
                            "info"
                        );

                        sessionStorage.setItem(
                            "straysync_pending_email",
                            result.email
                        );

                        setTimeout(() => {

                            window.location.href =
                                `otp.html?email=${encodeURIComponent(result.email)}`;

                        }, 800);

                        return;
                    }

                    throw new Error(
                        result.message ||
                        "Please contact support to verify your email."
                    );

                }

                // Handle login errors.

                if (!response.ok || !result.success) {

                    throw new Error(
                        result.message || "Unable to sign in."
                    );

                }

                // Normal login: email already verified.

                saveLoginSession(
                    result.token,
                    result.citizen
                );

                clearPendingVerification();

                showMessage(
                    messageBox,
                    "Login successful! Opening your dashboard...",
                    "success"
                );

                setTimeout(() => {

                    window.location.href =
                        "../citizen/dashboard.html";

                }, 800);

            } catch (error) {

                console.error("Citizen login error:", error);

                showMessage(
                    messageBox,
                    error.message ||
                    "Unable to connect to the server. Please try again.",
                    "error"
                );

            } finally {

                if (loginButton) {

                    loginButton.disabled = false;

                    loginButton.innerHTML =
                        'Sign In <span>→</span>';

                }

            }

        });

        // ========================================
        // FORGOT PASSWORD
        // ========================================

        if (forgotPassword) {

            forgotPassword.addEventListener("click", (event) => {

                event.preventDefault();

                showMessage(
                    messageBox,
                    "Password recovery is not connected yet. Please contact the project administrator.",
                    "info"
                );

            });

        }

    }

});