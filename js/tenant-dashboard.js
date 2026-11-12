import { supabase } from "./supabase.js";

let allProperties = [];

// Format currency cleanly in Kenyan Shillings
function formatKES(amount) {
    if (amount === null || amount === undefined) return "Price on request";
    return `KSh ${Number(amount).toLocaleString("en-KE")}/mo`;
}

// Format status text into human-readable labels
function formatStatus(status) {
    if (!status) return "Pending";
    return status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Load available properties from Supabase
async function loadProperties() {
    const resultsContainer = document.getElementById("property-results");
    const noPropertiesEl = document.getElementById("no-properties");

    if (!resultsContainer) return;

    try {
        const { data, error } = await supabase
            .from("properties")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        allProperties = data || [];
        applyFiltersAndSort();
    } catch (error) {
        console.error("Error loading properties:", error);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-circle-exclamation"></i>
                <h3>Unable to load properties right now</h3>
                <p>Please check your internet connection and refresh the page.</p>
            </div>
        `;
        if (noPropertiesEl) noPropertiesEl.hidden = true;
    }
}

// Render property cards with trust badges and clear actions
function renderProperties(properties) {
    const resultsContainer = document.getElementById("property-results");
    const noPropertiesEl = document.getElementById("no-properties");

    if (!resultsContainer) return;

    resultsContainer.replaceChildren();

    if (!properties || properties.length === 0) {
        if (noPropertiesEl) noPropertiesEl.hidden = false;
        return;
    }

    if (noPropertiesEl) noPropertiesEl.hidden = true;

    properties.forEach((property) => {
        const card = document.createElement("article");
        card.className = "property-card";

        const imageUrl =
            property.image_url ||
            (Array.isArray(property.images) && property.images[0]) ||
            "https://unsplash.com";

        const title = property.title || property.name || "Verified Residence";
        const location = property.location || property.city || "Kenya";
        const type = formatStatus(property.property_type || property.type || "Residence");
        const bedrooms = property.bedrooms ? `${property.bedrooms} Bed` : type;
        const rent = formatKES(property.rent_amount ?? property.price ?? property.rent);
        const isVerified = property.is_verified !== false;

        card.innerHTML = `
            <div class="property-image" style="position: relative;">
                <img src="${imageUrl}" alt="${title}" loading="lazy" style="width:100%; height:200px; object-fit:cover; border-radius:10px 10px 0 0;">
                ${
                    isVerified
                        ? `<span style="position:absolute; top:12px; left:12px; background:#047857; color:#fff; padding:4px 10px; border-radius:999px; font-size:0.78rem; font-weight:600;">
                            <i class="fas fa-circle-check"></i> Verified
                           </span>`
                        : ""
                }
            </div>
            <div class="property-body" style="padding: 16px;">
                <p style="font-size:0.82rem; color:#047857; font-weight:600; margin-bottom:4px;">
                    <i class="fas fa-location-dot"></i> ${location} &bull; ${bedrooms}
                </p>
                <h3 style="margin: 0 0 8px; font-size:1.1rem;">${title}</h3>
                <p style="font-size:1.15rem; font-weight:700; color:#0f172a; margin-bottom:14px;">${rent}</p>
                <a href="../properties/property-details.html?id=${property.id}" class="search-button" style="display:block; text-align:center; text-decoration:none;">
                    View Details &amp; Book
                </a>
            </div>
        `;

        resultsContainer.appendChild(card);
    });
}

// Filter and sort properties based on user input
function applyFiltersAndSort() {
    const locationVal = (document.getElementById("location-filter")?.value || "").trim().toLowerCase();
    const typeVal = (document.getElementById("type-filter")?.value || "").toLowerCase();
    const minPrice = parseFloat(document.getElementById("min-price")?.value) || 0;
    const maxPrice = parseFloat(document.getElementById("max-price")?.value) || Infinity;
    const bedroomsVal = document.getElementById("bedrooms-filter")?.value || "";
    const sortVal = document.getElementById("sort-properties")?.value || "newest";

    let filtered = allProperties.filter((prop) => {
        const propLoc = `${prop.location || ""} ${prop.city || ""} ${prop.title || ""}`.toLowerCase();
        const propType = (prop.property_type || prop.type || "").toLowerCase();
        const propRent = Number(prop.rent_amount ?? prop.price ?? prop.rent ?? 0);
        const propBeds = Number(prop.bedrooms ?? 0);

        if (locationVal && !propLoc.includes(locationVal)) return false;
        if (typeVal && propType !== typeVal) return false;
        if (propRent < minPrice || propRent > maxPrice) return false;

        if (bedroomsVal) {
            if (bedroomsVal === "4" && propBeds < 4) return false;
            if (bedroomsVal !== "4" && propBeds !== Number(bedroomsVal)) return false;
        }

        return true;
    });

    if (sortVal === "price-low") {
        filtered.sort((a, b) => (a.rent_amount ?? a.price ?? 0) - (b.rent_amount ?? b.price ?? 0));
    } else if (sortVal === "price-high") {
        filtered.sort((a, b) => (b.rent_amount ?? b.price ?? 0) - (a.rent_amount ?? a.price ?? 0));
    } else {
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    renderProperties(filtered);
}

// Load tenant statistics
async function loadTenantStats(userId) {
    const now = new Date().toISOString();

    const statistics = [
        {
            id: "active-applications",
            name: "Active applications",
            query: () =>
                supabase
                    .from("applications")
                    .select("id", { count: "exact", head: true })
                    .eq("tenant_id", userId)
                    .in("application_status", ["pending", "under_review"])
        },
        {
            id: "upcoming-viewings",
            name: "Upcoming viewings",
            query: () =>
                supabase
                    .from("bookings")
                    .select("id", { count: "exact", head: true })
                    .eq("tenant_id", userId)
                    .in("booking_status", ["pending", "confirmed"])
                    .gte("viewing_date", now)
        },
        {
            id: "maintenance-requests",
            name: "Open maintenance requests",
            query: () =>
                supabase
                    .from("maintenance_requests")
                    .select("id", { count: "exact", head: true })
                    .eq("tenant_id", userId)
                    .in("request_status", ["pending", "assigned", "in_progress"])
        },
        {
            id: "active-tenancies",
            name: "Active tenancies",
            query: () =>
                supabase
                    .from("tenancies")
                    .select("id", { count: "exact", head: true })
                    .eq("tenant_id", userId)
                    .eq("tenancy_status", "active")
        }
    ];

    await Promise.all(
        statistics.map(async (stat) => {
            const element = document.getElementById(stat.id);
            if (!element) return;

            try {
                const { count, error } = await stat.query();
                if (error) throw error;
                element.textContent = count ?? 0;
            } catch (error) {
                console.error(`${stat.name} error:`, error);
                element.textContent = "0";
            }
        })
    );
}

// Load recent tenant activity with friendly badges
async function loadRecentActivity(userId) {
    const activityContainer = document.getElementById("recent-activity");
    if (!activityContainer) return;

    const sources = [
        {
            table: "applications",
            statusField: "application_status",
            title: "Rental application",
            icon: "fa-file-signature"
        },
        {
            table: "bookings",
            statusField: "booking_status",
            title: "Property viewing",
            icon: "fa-calendar-check"
        },
        {
            table: "maintenance_requests",
            statusField: "request_status",
            title: "Maintenance request",
            icon: "fa-screwdriver-wrench"
        },
        {
            table: "tenancies",
            statusField: "tenancy_status",
            title: "Tenancy record",
            icon: "fa-key"
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
                    console.error(`Activity error (${source.table}):`, error);
                    return [];
                }

                return (data || []).map((item) => ({
                    title: source.title,
                    icon: source.icon,
                    status: item[source.statusField],
