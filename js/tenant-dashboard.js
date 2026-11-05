
import { supabase } from "./supabase.js";

async function loadTenantDashboard() {
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) {
        window.location.href = "../login.html";
        return;
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

    if (error || !profile) {
        document.getElementById("user-name").textContent =
            "Unable to load profile.";
        return;
    }

    if (profile.role !== "tenant") {
        window.location.href = "../login.html";
        return;
    }

    document.getElementById("user-name").textContent =
        profile.full_name || "LIVIO Tenant";

    document.querySelector(".welcome h2").textContent =
        `Welcome, ${profile.full_name || "Tenant"}`;
}

// Sign out
document.getElementById("logout-btn")
    .addEventListener("click", async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            alert("Unable to sign out. Please try again.");
            return;
        }

        window.location.href = "../login.html";
    });

loadTenantDashboard();
