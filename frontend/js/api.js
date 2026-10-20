// ============================================
// STRAYSYNC - API CONNECTION
// ============================================

// Backend API base URL
const API_BASE_URL = "/api";

// ============================================
// TOKEN MANAGEMENT
// ============================================

// Save the login token.
function saveAuthToken(token) {
    if (!token) {
        console.error("Cannot save an empty authentication token.");
        return;
    }

    localStorage.setItem("straySyncToken", token);
}

// Get the saved login token.
function getAuthToken() {
    return (
        localStorage.getItem("straySyncToken") ||
        sessionStorage.getItem("straySyncToken")
    );
}

// Remove the login token when logging out.
function clearAuthToken() {
    localStorage.removeItem("straySyncToken");
    sessionStorage.removeItem("straySyncToken");
    localStorage.removeItem("straySyncCitizenName");
    sessionStorage.removeItem("straySyncCitizenName");
}

// ============================================
// API REQUEST FUNCTION
// ============================================

async function apiRequest(endpoint, options = {}) {
    const headers = new Headers(options.headers || {});

    // Attach the token when one is available.
    const token = getAuthToken();

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    // Do not set Content-Type manually for FormData.
    // The browser must add the multipart boundary itself.
    const isFormData = options.body instanceof FormData;

    if (
        options.body &&
        !isFormData &&
        !headers.has("Content-Type")
    ) {
        headers.set("Content-Type", "application/json");
    }
 
    const requestURL = `${API_BASE_URL}${endpoint}`;

console.log("StraySync API request:", requestURL);

const response = await fetch(requestURL, {
    ...options,
    headers
});

console.log("API response status:", response.status);
    
    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
        throw new Error(
            result.message || `Request failed (${response.status}).`
        );
    }

    return result;
}

// ============================================
// CHECK LOGIN STATUS
// ============================================

function isCitizenLoggedIn() {
    return Boolean(getAuthToken());
}

// ============================================
// EXPORT FUNCTIONS FOR OTHER FRONTEND FILES
// ============================================

// These functions are available to other scripts
// when api.js is included using a normal script tag.

window.StraySyncAPI = {
    baseURL: API_BASE_URL,
    saveAuthToken,
    getAuthToken,
    clearAuthToken,
    apiRequest,
    isCitizenLoggedIn
};