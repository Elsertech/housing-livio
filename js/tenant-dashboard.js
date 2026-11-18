
import { supabase } from "./supabase.js";

const PHOTO_BUCKET = "property-unit-photos";
const PHOTO_EXPIRY = 3600;

let availableHomes = [];

/* =========================================
   HELPERS
========================================= */

function getElement(id) {
    return document.getElementById(id);
}

function formatRent(amount) {
    return `KSh ${Number(amount || 0).toLocaleString("en-KE")}`;
}

function formatLabel(value) {
    if (!value) return "Not specified";

    return String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function showPropertyMessage(message) {
    const results = getElement("property-results");

    if (!results) return;

    results.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    results.appendChild(paragraph);
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
}

/* =========================================
   PROPERTY PHOTOGRAPHS
========================================= */

async function loadUnitPhotos(units) {
    const unitIds = [...new Set(units.map(unit => unit.id))];

    if (!unitIds.length) return {};

    const { data, error } = await supabase
        .from("property_unit_images")
        .select("unit_id, storage_path")
        .in("unit_id", unitIds);

    if (error) {
        console.error("Property photographs error:", error);
        return {};
    }

    const photos = {};

    for (const photo of data || []) {
        if (!photos[photo.unit_id]) {
            photos[photo.unit_id] = [];
        }

        photos[photo.unit_id].push(photo.storage_path);
    }

    const signedPhotos = {};

    await Promise.all(
        Object.entries(photos).map(async ([unitId, paths]) => {
            for (const path of paths) {
                const { data: signedData, error: signedError } =
                    await supabase.storage
                        .from(PHOTO_BUCKET)
                        .createSignedUrl(path, PHOTO_EXPIRY);

                if (signedError) {
                    console.error("Photo URL error:", signedError);
                    continue;
                }

                if (!signedPhotos[unitId]) {
                    signedPhotos[unitId] = [];
                }

                signedPhotos[unitId].push(signedData.signedUrl);
            }
        })
    );

    return signedPhotos;
}

/* =========================================
   LOAD PUBLICLY AVAILABLE HOMES
========================================= */

async function loadAvailableProperties() {
    showPropertyMessage("Loading available homes...");

    try {
        // Only publicly published and verified properties.
        const { data: properties, error: propertyError } =
            await supabase
                .from("properties")
                .select(`
                    id,
                    property_name,
                    property_type,
                    description,
                    county,
                    town,
                    location_details,
                    address,
                    status,
                    verification_status
                `)
                .eq("status", "published")
                .eq("verification_status", "verified");

        if (propertyError) throw propertyError;

        if (!properties || properties.length === 0) {
            availableHomes = [];
            renderProperties();
            return;
        }

        const propertyIds = properties.map(property => property.id);

        // Retrieve available rental units.
        const { data: units, error: unitError } = await supabase
            .from("property_units")
            .select(`
                id,
                property_id,
                unit_number,
                unit_type,
                rent_amount,
                bedrooms,
                bathrooms,
                description,
                availability_status
            `)
            .in("property_id", propertyIds)
            .eq("availability_status", "available");

        if (unitError) throw unitError;

        if (!units || units.length === 0) {
            availableHomes = [];
            renderProperties();
            return;
        }

        // Retrieve rental-unit photographs.
        const photos = await loadUnitPhotos(units);

        // Combine property and unit information.
        availableHomes = units.map(unit => {
            const property = properties.find(
                item => item.id === unit.property_id
            );

            return {
                ...unit,
                property,
                photo: photos[unit.id]?.[0] || null
            };
        }).filter(home => home.property);

        renderProperties();

    } catch (error) {
        console.error("Property loading error:", error);

        showPropertyMessage(
            "Unable to load available homes. Please refresh the page."
        );
    }
}

/* =========================================
   PROPERTY CARD
========================================= */

function createPropertyCard(home) {
    const card = createElement("article", "property-card");

    const media = createElement("div", "property-card-media");

    if (home.photo) {
        const image = document.createElement("img");

        image.src = home.photo;
        image.alt = `${home.property.property_name} rental unit`;
        image.loading = "lazy";

        media.appendChild(image);
    } else {
        const placeholder = createElement(
            "div",
            "property-photo-placeholder",
            "LIVIO"
        );

        media.appendChild(placeholder);
    }

    const verified = createElement(
        "span",
        "property-verified-tag",
        "✓ Verified"
    );

    media.appendChild(verified);

    const body = createElement("div", "property-card-body");

    const location = [
        home.property.town,
        home.property.county
    ].filter(Boolean).join(", ");

    const type = createElement(
        "p",
        "property-card-meta",
        `${formatLabel(home.unit_type)} · ${location || "Location unavailable"}`
    );

    const title = createElement(
        "h3",
        "property-card-title",
        home.property.property_name
    );

    const unitNumber = createElement(
        "p",
        "property-card-meta",
        `Unit: ${home.unit_number || "Not specified"}`
    );

    const price = createElement(
        "p",
        "property-card-price",
        `${formatRent(home.rent_amount)} / month`
    );

    const features = createElement(
        "p",
        "property-card-features",
        `${home.bedrooms ?? 0} bedroom(s) · ${home.bathrooms ?? 0} bathroom(s)`
    );

    const description = createElement(
        "p",
        "property-card-description",
        home.description || home.property.description || ""
    );

    body.append(
        type,
        title,
        unitNumber,
        price,
        features
    );

    if (description.textContent) {
        body.appendChild(description);
    }

    card.append(media, body);

    return card;
}

/* =========================================
   PROPERTY FILTERING AND SORTING
========================================= */

function renderProperties() {
    const results = getElement("property-results");
    const emptyState = getElement("no-properties");

    if (!results) return;

    const location = (
        getElement("location-filter")?.value || ""
    ).trim().toLowerCase();

    const type = (
        getElement("type-filter")?.value || ""
    ).toLowerCase();

    const minPrice = Number(
        getElement("min-price")?.value || 0
    );

    const maxPrice = Number(
        getElement("max-price")?.value || 0
    );

    const bedrooms = Number(
        getElement("bedrooms-filter")?.value || 0
    );

    const sort = getElement("sort-properties")?.value || "newest";

    let filtered = availableHomes.filter(home => {
        const property = home.property;

        const searchableLocation = [
            property.county,
            property.town,
            property.location_details,
            property.address
        ].filter(Boolean).join(" ").toLowerCase();

        const matchesLocation =
            !location || searchableLocation.includes(location);

        const propertyType = String(home.unit_type || "")
            .toLowerCase();

        const matchesType =
            !type ||
            propertyType === type ||
            propertyType.replaceAll("_", "-") === type;

        const rent = Number(home.rent_amount || 0);

        const matchesMinPrice =
            !minPrice || rent >= minPrice;

        const matchesMaxPrice =
            !maxPrice || rent <= maxPrice;

        const bedroomCount = Number(home.bedrooms || 0);

        const matchesBedrooms =
            !bedrooms ||
            (bedrooms === 4
                ? bedroomCount >= 4
                : bedroomCount === bedrooms);

        return (
            matchesLocation &&
            matchesType &&
            matchesMinPrice &&
            matchesMaxPrice &&
            matchesBedrooms
        );
    });

    if (sort === "price-low") {
        filtered.sort(
            (a, b) => Number(a.rent_amount) - Number(b.rent_amount)
        );
    }

    if (sort === "price-high") {
        filtered.sort(
            (a, b) => Number(b.rent_amount) - Number(a.rent_amount)
        );
    }

    results.replaceChildren();

    if (filtered.length === 0) {
        if (emptyState) emptyState.hidden = false;

        const message = createElement(
            "p",
            "",
            "No matching homes found."
        );

        results.appendChild(message);
        return;
    }

    if (emptyState) emptyState.hidden = true;

    filtered.forEach(home => {
        results.appendChild(createPropertyCard(home));
    });
}

/* =========================================
   PROPERTY FILTER EVENTS
========================================= */

function initializePropertyFilters() {
    const filterForm = getElement("property-filter-form");
    const sortSelect = getElement("sort-properties");

    if (filterForm) {
        filterForm.addEventListener("submit", event => {
            event.preventDefault();
            renderProperties();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener("change", renderProperties);
    }
}

/* =========================================
   TENANT STATISTICS
========================================= */

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
        statistics.map(async stat => {
            const element = getElement(stat.id);

            if (!element) return;

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

/* =========================================
   RECENT TENANT ACTIVITY
========================================= */

async function loadRecentActivity(userId) {
    const activityContainer = getElement("recent-activity");

    if (!activityContainer) return;

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
            sources.map(async source => {
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

                return (data || []).map(item => ({
                    title: source.title,
                    icon: source.icon,
                    status: item[source.statusField],
                    createdAt: item.created_at
                }));
            })
        );

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

        activities.forEach(activity => {
            const item = createElement("div", "activity-item");

            const heading = createElement(
                "h4",
                "",
                `${activity.icon} ${activity.title}`
            );

            const description = createElement(
                "p",
                "",
                `Status: ${formatLabel(activity.status)}`
            );

            const date = createElement(
                "small",
                "",
                activity.createdAt
                    ? new Date(activity.createdAt).toLocaleString()
                    : ""
            );

            item.append(heading, description, date);
            activityContainer.appendChild(item);
        });

    } catch (error) {
        console.error("Recent activity error:", error);

        activityContainer.textContent =
            "Unable to load recent activity.";
    }
}

/* =========================================
   TENANT DASHBOARD INITIALIZATION
========================================= */

async function loadTenantDashboard() {
    const userName = getElement("user-name");

    try {
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
            window.location.href = "../login.html";
            return;
        }

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

        const fullName = profile.full_name || "LIVIO Tenant";

        if (userName) {
            userName.textContent = fullName;
        }

        await Promise.all([
            loadTenantStats(user.id),
            loadRecentActivity(user.id),
            loadAvailableProperties()
        ]);

    } catch (error) {
        console.error("Tenant dashboard error:", error);

        if (userName) {
            userName.textContent = "Profile unavailable";
        }
    }
}

/* =========================================
   SIGN OUT
========================================= */

const logoutButton = getElement("logout-btn");

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Sign out error:", error);
            alert("Unable to sign out. Please try again.");
            return;
        }

        window.location.href = "../login.html";
    });
}

/* =========================================
   START
========================================= */

initializePropertyFilters();
loadTenantDashboard();
