
import { supabase } from "./supabase.js";

// Load tenant statistics
async function loadTenantStats(userId) {
    const now = new Date().toISOString();

    const statistics = [
        {
            id: "active-applications",
            name: "Active applications",
            query: () => supabase
                .from("applications")
                .select("id", { count: "exact", head: true })
                .eq("tenant_id", userId)
                .in("application_status", ["pending", "under_review"])
        },
        {
            id: "upcoming-viewings",
            name: "Upcoming viewings",
            query: () => supabase
                .from("bookings")
                .select("id", { count: "exact", head: true })
                .eq("tenant_id", userId)
                .in("booking_status", ["pending", "confirmed"])
                .gte("viewing_date", now)
        },
        {
            id: "maintenance-requests",
            name: "Open maintenance requests",
            query: () => supabase
                .from("maintenance_requests")
                .select("id", { count: "exact", head: true })
                .eq("tenant_id", userId)
                .in("request_status", [
                    "pending",
                    "assigned",
                    "in_progress"
                ])
        },
        {
            id: "active-tenancies",
            name: "Active tenancies",
            query: () => supabase
                .from("tenancies")
                .select("id", { count: "exact", head: true })
                .eq("tenant_id", userId)
                .eq("tenancy_status", "active")
        }
    ];

    await Promise.all(
        statistics.map(async (stat) => {
            const element = document.getElementById(stat.id);

            try {
                const { count, error } = await stat.query();

                if (error) throw error;

                element.textContent = count ?? 0;

            } catch (error) {
                console.error(`${stat.name} error:`, error);
                element.textContent = "—";
            }
        })
    );
}

// Load recent tenant activity
async function loadRecentActivity(userId) {
    const activityContainer = document.getElementById("recent-activity");

    const sources = [
        {
            table: "applications",
            statusField: "application_status",
            title: "Rental application",
            icon: "📄"
        },
        {
            table: "bookings",
            statusField: "booking_status",
            title: "Property viewing",
            icon: "🏠"
        },
        {
            table: "maintenance_requests",
            statusField: "request_status",
            title: "Maintenance request",
            icon: "🔧"
        },
        {
            table: "tenancies",
            statusField: "tenancy_status",
            title: "Tenancy record",
            icon: "🔑"
        }
    ];

    try {
        const results = await Promise.all(
            sources.map(async (source) => {
                const { data, error } = await supabase
                    .from(source.table)
                    .select(`id, ${source.statusField}, created_at`)
                    .eq("tenant_id", userId)
                    .order("created_at", { ascending: false })
                    .limit(5);

                if (error) {
                    console.error(
                        `Activity error (${source.table}):`,
                        error
                    );
                    return [];
                }

                return (data || []).map((item) => ({
                    title: source.title,
                    icon: source.icon,
                    status: item[source.statusField],
                    createdAt: item.created_at
                }));
            })
        );

        // Combine and sort all activities
        const activities = results
            .flat()
            .sort(
                (a, b) =>
                    new Date(b.createdAt) - new Date(a.createdAt)
            )
            .slice(0, 8);

        activityContainer.replaceChildren();

        if (activities.length === 0) {
            activityContainer.textContent =
                "No recent activity yet. Your housing updates will appear here.";
            return;
        }

        activities.forEach((activity) => {
            const item = document.createElement("div");
            item.className = "activity-item";

            const heading = document.createElement("h4");
            heading.textContent = `${activity.icon} ${activity.title}`;

            const description = document.createElement("p");
            description.textContent =
                `Status: ${activity.status.replaceAll("_", " ")}`;

            const date = document.createElement("small");
            date.textContent = new Date(
                activity.createdAt
            ).toLocaleString();

            item.append(heading, description, date);
            activityContainer.appendChild(item);
        });

    } catch (error) {
        console.error("Recent activity error:", error);

        activityContainer.textContent =
            "Unable to load recent activity.";
    }
}

// Load tenant dashboard
async function loadTenantDashboard() {
    const userName = document.getElementById("user-name");
    const welcomeTitle = document.querySelector(".welcome h2");

    try {
        // Check authenticated user
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
            window.location.href = "../login.html";
            return;
        }

        // Load tenant profile
        const { data: profile, error: profileError } =
            await supabase
                .from("profiles")
                .select("full_name, role")
                .eq("id", user.id)
                .single();

        if (profileError) throw profileError;

        if (profile.role !== "tenant") {
            window.location.href = "../login.html";
            return;
        }

        // Display tenant name
        const fullName = profile.full_name || "LIVIO Tenant";

        userName.textContent = fullName;
        welcomeTitle.textContent = `Welcome, ${fullName}`;

        // Load real dashboard statistics
        await loadTenantStats(user.id);
        await loadRecentActivity(user.id);

    } catch (error) {
        console.error("Tenant dashboard error:", error);

        userName.textContent = "Profile unavailable";
        welcomeTitle.textContent = "Welcome to LIVIO";
    }
}


// Sign out
document.getElementById("logout-btn")
    .addEventListener("click", async () => {

        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Sign out error:", error);
            alert("Unable to sign out. Please try again.");
            return;
        }

        window.location.href = "../login.html";
    });


// Start dashboard
loadTenantDashboard();
