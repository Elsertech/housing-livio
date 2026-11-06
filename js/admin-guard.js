
import { supabase } from "./supabase.js";

// Hide the page until administrator access is verified.
document.documentElement.style.visibility = "hidden";

export async function requireAdmin() {
    const isDashboard = window.location.pathname.includes("/dashboards/");
    const loginPage = isDashboard
        ? "../admin/login.html"
        : "./login.html";

    try {
        // Check whether a user is signed in.
        const { data: sessionData, error: sessionError } =
            await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
            window.location.replace(loginPage);
            return null;
        }

        const user = sessionData.session.user;

        // Verify administrator authorisation in Supabase.
        const { data: admin, error } = await supabase
            .from("admin_users")
            .select("role, status")
            .eq("user_id", user.id)
            .eq("status", "active")
            .maybeSingle();

        if (error || !admin) {
            await supabase.auth.signOut();
            window.location.replace(loginPage);
            return null;
        }

        // Allow the page to become visible.
        document.documentElement.style.visibility = "visible";

        return {
            user,
            role: admin.role
        };

    } catch (error) {
        console.error("Admin security check failed:", error);
        window.location.replace(loginPage);
        return null;
    }
}
