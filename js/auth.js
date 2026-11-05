
import { supabase } from "./supabase.js";

// REGISTER
const registerForm = document.getElementById("register-form");

if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const fullName = document.getElementById("full_name").value.trim();
        const email = document.getElementById("email").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const password = document.getElementById("password").value;
        const role = document.getElementById("role").value;

        const message = document.getElementById("auth-message");
        message.textContent = "Creating your account...";

        if (!["tenant", "landlord"].includes(role)) {
            message.textContent = "Invalid account type.";
            return;
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    phone: phone,
                    role: role
                }
            }
        });

        if (error) {
            message.textContent = error.message;
            return;
        }

        message.textContent = data.session
            ? "Registration successful! Redirecting..."
            : "Account created. Check your email to confirm your account.";

        if (data.session) {
            window.location.href = "login.html";
        }
    });
}

// LOGIN
const loginForm = document.getElementById("login-form");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const message = document.getElementById("auth-message");

        message.textContent = "Signing in...";

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            message.textContent = error.message;
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role, account_status")
            .eq("id", data.user.id)
            .single();

        if (profileError || !profile) {
            message.textContent = "Unable to load your LIVIO profile.";
            return;
        }

        if (profile.account_status !== "active") {
            await supabase.auth.signOut();
            message.textContent = "Your account is not active. Please contact LIVIO support.";
            return;
        }

        const dashboards = {
            tenant: "dashboards/tenant.html",
            landlord: "dashboards/landlord.html",
            property_manager: "dashboards/property-manager.html",
            admin: "dashboards/admin.html"
        };

        window.location.href = dashboards[profile.role] || "index.html";
    });
}
