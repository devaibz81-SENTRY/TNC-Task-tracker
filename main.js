import { ConvexClient } from "convex/browser";
import { showToast } from "./toast.js";

// Initialize Convex Client
const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL);

// DOM Elements
const authForm = document.getElementById("auth-form");
const usernameInput = document.getElementById("username");
const pinInput = document.getElementById("pin");
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
    } else {
        submitBtn.textContent = "Sign Up";
        toggleAuthBtn.textContent = "Already have an account? Login";
        formSubtitle.textContent = "Create your own profile sandbox";
        adminGroup.classList.remove("hidden");
    }
});

// Handle Form Submission
authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const pin = pinInput.value.trim();

    if (!username || !pin) {
        showToast("Username and PIN are required.", "error");
        return;
    }

    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
        showToast("PIN must be 4 digits.", "error");
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
                pin,
                isAdmin
            });
            if (result.success) {
                showToast("Account created successfully!", "success");
                setTimeout(() => {
                    localStorage.setItem("taskUser", JSON.stringify(result.user));
                    window.location.href = result.user.isAdmin ? "/admin.html" : "/dashboard.html";
                }, 800);
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
