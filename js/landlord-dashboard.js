
import { supabase } from "./supabase.js";

// Load and verify the logged-in landlord
async function loadLandlordDashboard() {
    const userName = document.getElementById("user-name");
    const welcomeName = document.getElementById("welcome-name");

    try {
        // Get the current authenticated user
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        // Redirect users who are not logged in
        if (!user) {
            window.location.href = "../login.html";
            return;
        }

        // Retrieve the existing profile
        const { data: profile, error: profileError } =
            await supabase
                .from("profiles")
                .select("full_name, role, account_status")
                .eq("id", user.id)
                .single();

        if (profileError) throw profileError;

        // Only active landlords can access this dashboard
        if (
            profile.role !== "landlord" ||
            profile.account_status !== "active"
        ) {
            window.location.href = "../login.html";
            return;
        }

        // Display landlord's name
        const fullName = profile.full_name || "LIVIO Landlord";

        userName.textContent = fullName;
        welcomeName.textContent = fullName;

    } catch (error) {
        console.error("Landlord dashboard error:", error);

        userName.textContent = "Profile unavailable";
        welcomeName.textContent = "Welcome to LIVIO";
    }
}


// Logout
document.getElementById("logout-btn")
    .addEventListener("click", async () => {

        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Logout error:", error);
            alert("Unable to log out. Please try again.");
            return;
        }

        window.location.href = "../login.html";
    });


// Start dashboard
loadLandlordDashboard();
