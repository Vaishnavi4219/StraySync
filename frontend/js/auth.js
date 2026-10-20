// ========================================
// STRAYSYNC - AUTHENTICATION PAGE SCRIPTS
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // COMMON FUNCTIONS
    // ========================================

    const API_BASE = "/api/auth";

    const yearElement = document.getElementById("current-year");

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // Display messages.
    function showMessage(element, message, type) {
        if (!element) return;

        element.textContent = message;
        element.className = `form-message visible ${type}`;
    }

    // Read JSON responses.
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
            throw new Error("The server did not return a valid login session.");
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

        // Remove any stale session-storage values.
        sessionStorage.removeItem("straySyncToken");
        sessionStorage.removeItem("straySyncCitizenName");
    }

    function clearPendingVerification() {
        sessionStorage.removeItem("straysync_pending_mobile");
        sessionStorage.removeItem("straysync_pending_phone");
        sessionStorage.removeItem("straysync_development_otp");
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

    const togglePassword = document.getElementById("toggle-password");
    const passwordInput = document.getElementById("password");

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener("click", () => {
            const shouldShow = passwordInput.type === "password";

            passwordInput.type = shouldShow ? "text" : "password";
            togglePassword.textContent = shouldShow ? "Hide" : "Show";

            togglePassword.setAttribute(
                "aria-label",
                shouldShow ? "Hide password" : "Show password"
            );
        });
    }

    // ========================================
    // CITIZEN REGISTRATION
    // ========================================

    const registerForm = document.getElementById("register-form");

    if (registerForm) {
        const messageBox = document.getElementById("register-message");
        const registerButton = document.getElementById("register-button");

        const registerPassword = document.getElementById("password");
        const confirmPassword = document.getElementById("confirmPassword");

        registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const fullName =
                document.getElementById("fullName").value.trim();

            const mobile =
                document.getElementById("phone").value.trim();

            const email =
                document.getElementById("email").value.trim();

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

            // Validate Indian mobile number.
            if (!/^[6-9]\d{9}$/.test(mobile)) {
                showMessage(
                    messageBox,
                    "Please enter a valid 10-digit Indian mobile number.",
                    "error"
                );
                return;
            }

            // Validate email if provided.
            if (
                email &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ) {
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
                            email: email || null,
                            password
                        })
                    }
                );

                const result = await readResponse(response);

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message ||
                        "Registration failed. Please try again."
                    );
                }

                // Remember the mobile number for the next page.
                // This is not an authenticated session.
                sessionStorage.setItem(
                    "straysync_pending_mobile",
                    mobile
                );

                clearPendingVerification();

                sessionStorage.setItem(
                    "straysync_pending_mobile",
                    mobile
                );

                showMessage(
                    messageBox,
                    "Registration successful! Redirecting you to citizen login...",
                    "success"
                );

                setTimeout(() => {
                    window.location.href = "citizen-login.html";
                }, 1200);

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
                    registerButton.innerHTML = 'Create Account <span>→</span>';
                }
            }
        });
    }

    // ========================================
    // CITIZEN LOGIN
    // ========================================

    const loginForm = document.getElementById("login-form");

    if (loginForm) {
        const messageBox = document.getElementById("login-message");
        const loginButton = document.getElementById("login-button");

        const forgotPassword =
            document.getElementById("forgot-password");

        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (messageBox) {
                messageBox.textContent = "";
                messageBox.className = "form-message";
            }

            const mobile =
                document.getElementById("phone").value.trim();

            const password =
                document.getElementById("password").value;

            // Validate mobile number.
            if (!/^[6-9]\d{9}$/.test(mobile)) {
                showMessage(
                    messageBox,
                    "Please enter a valid 10-digit Indian mobile number.",
                    "error"
                );
                return;
            }

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
                            mobile,
                            password
                        })
                    }
                );

                const result = await readResponse(response);

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message || "Unable to sign in."
                    );
                }

                // ========================================
                // CASE 1: OTP VERIFICATION REQUIRED
                // ========================================

                if (result.requiresOTP === true) {
                    // Clear any previous authenticated session.
                    clearLoginSession();

                    // Clear any previous OTP.
                    clearPendingVerification();

                    const pendingMobile = result.mobile || mobile;

                    sessionStorage.setItem(
                        "straysync_pending_mobile",
                        pendingMobile
                    );

                    sessionStorage.setItem(
                        "straysync_pending_phone",
                        pendingMobile
                    );

                    // Save an OTP only when explicitly supplied
                    // by the backend in development mode.
                    if (
                        result.developmentOnly === true &&
                        typeof result.developmentOTP === "string" &&
                        /^\d{6}$/.test(result.developmentOTP)
                    ) {
                        sessionStorage.setItem(
                            "straysync_development_otp",
                            result.developmentOTP
                        );
                    }

                    const loginMessage =
                        result.developmentOnly === true
                            ? "Development OTP generated. No SMS was sent."
                            : "Opening mobile verification...";

                    showMessage(
                        messageBox,
                        loginMessage,
                        "success"
                    );

                    setTimeout(() => {
                        window.location.href =
                            `otp.html?phone=${encodeURIComponent(pendingMobile)}`;
                    }, 800);

                    return;
                }

                // ========================================
                // CASE 2: MOBILE ALREADY VERIFIED
                // ========================================

                saveLoginSession(result.token, result.citizen);

                clearPendingVerification();

                showMessage(
                    messageBox,
                    "Login successful! Opening your dashboard...",
                    "success"
                );

                setTimeout(() => {
                    window.location.href = "../citizen/dashboard.html";
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
                    loginButton.innerHTML = 'Sign In <span>→</span>';
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