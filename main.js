import { ConvexClient } from "convex/browser";
import { showToast } from "./toast.js";

// Initialize Convex Client
const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL);

// DOM Elements
const authForm = document.getElementById("auth-form");
const usernameInput = document.getElementById("username");
const pinInput = document.getElementById("pin");
const pinGroup = document.getElementById("pin-group");
const submitBtn = document.getElementById("submit-btn");
const toggleAuthBtn = document.getElementById("toggle-auth");
const formSubtitle = document.getElementById("form-subtitle");
const adminGroup = document.getElementById("admin-group");
const isAdminCheckbox = document.getElementById("isAdmin");

// State
let isLoginMode = true;

// Check if user is already logged in
const currentUser = localStorage.getItem("taskUser");
if (currentUser) {
    const user = JSON.parse(currentUser);
    if (user.isAdmin) {
        window.location.href = "/admin.html";
    } else {
        window.location.href = "/dashboard.html";
    }
}

// Toggle Login / Signup Mode
toggleAuthBtn.addEventListener("click", () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        submitBtn.textContent = "Login";
        toggleAuthBtn.textContent = "Need an account? Sign Up";
        formSubtitle.textContent = "Login to your sandbox";
        adminGroup.classList.add("hidden");
        pinGroup.classList.remove("hidden");
    } else {
        submitBtn.textContent = "Sign Up";
        toggleAuthBtn.textContent = "Already have an account? Login";
        formSubtitle.textContent = "Create Name - Get assigned a PIN";
        adminGroup.classList.remove("hidden");
        pinGroup.classList.add("hidden");
    }
});

// Handle Form Submission
authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const pin = pinInput.value.trim();

    if (!username) {
        showToast("Username is required.", "error");
        return;
    }

    if (isLoginMode && (!pin || pin.length !== 4)) {
        showToast("4-digit PIN is required for Login.", "error");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Processing...";

    try {
        if (isLoginMode) {
            // Login
            const result = await convex.query("users:login", { username, pin });
            if (result.success) {
                showToast("Login successful!", "success");
                setTimeout(() => {
                    localStorage.setItem("taskUser", JSON.stringify(result.user));
                    window.location.href = result.user.isAdmin ? "/admin.html" : "/dashboard.html";
                }, 800);
            } else {
                showToast(result.message, "error");
            }
        } else {
            // Signup
            const isAdmin = isAdminCheckbox.checked;
            const result = await convex.mutation("users:signup", {
                username,
                isAdmin
            });
            if (result.success) {
                // IMPORTANT: Show the generated PIN clearly!
                showToast(`SUCCESS! Your assigned PIN is: ${result.pin}`, "success");

                // Switch to login mode automatically so they can log in with their new PIN
                setTimeout(() => {
                    isLoginMode = true;
                    submitBtn.textContent = "Login";
                    toggleAuthBtn.textContent = "Need an account? Sign Up";
                    formSubtitle.textContent = "Account Created! Login with your new PIN";
                    adminGroup.classList.add("hidden");
                    pinGroup.classList.remove("hidden");
                    pinInput.value = result.pin; // Auto-fill PIN
                    showToast("Login now using your new PIN.", "info");
                }, 4000);
            } else {
                showToast(result.message, "error");
            }
        }
    } catch (error) {
        console.error("Auth Error:", error);
        showToast("An error occurred during authentication.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isLoginMode ? "Login" : "Sign Up";
    }
});
