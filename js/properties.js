
import { supabase } from "./supabase.js";

const COVER_BUCKET = "property-covers";

let allProperties = [];

// ========================================
// HELPERS
// ========================================

function getElement(id) {
    return document.getElementById(id);
}

function formatRent(amount) {
    return new Intl.NumberFormat("en-KE", {
        maximumFractionDigits: 0
    }).format(Number(amount || 0));
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function getCoverUrl(storagePath) {
    if (!storagePath) return null;

    const { data } = supabase.storage
        .from(COVER_BUCKET)
        .getPublicUrl(storagePath);

    return data?.publicUrl || null;
}


// ========================================
// LOAD PROPERTY COVER PHOTOGRAPHS
// ========================================

async function loadCoverPhotos(propertyIds) {
    if (!propertyIds.length) return {};

    const { data, error } = await supabase
        .from("property_images")
        .select("property_id, storage_path, is_cover")
        .in("property_id", propertyIds)
        .eq("is_cover", true);

    if (error) {
        console.error("Property cover photo error:", error);
        return {};
    }

    const photos = {};

    (data || []).forEach(photo => {
        photos[photo.property_id] = getCoverUrl(photo.storage_path);
    });

    return photos;
}


// ========================================
// LOAD AVAILABLE RENTAL UNITS
// ========================================

async function loadPropertyUnits(propertyIds) {
    if (!propertyIds.length) return {};

    const { data, error } = await supabase
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

    if (error) {
        throw new Error("Unable to load available rental units: " + error.message);
    }

    const unitsByProperty = {};

    (data || []).forEach(unit => {
        if (!unitsByProperty[unit.property_id]) {
            unitsByProperty[unit.property_id] = [];
        }

        unitsByProperty[unit.property_id].push(unit);
    });

    return unitsByProperty;
}


// ========================================
// LOAD PUBLIC PROPERTIES
// ========================================

async function loadProperties() {
    const loading = getElement("properties-loading");
    const errorBox = getElement("properties-error");
    const results = getElement("property-results");
    const empty = getElement("no-properties");

    loading.hidden = false;
    errorBox.hidden = true;
    empty.hidden = true;
    results.innerHTML = "";

    try {
        const { data, error } = await supabase
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
                created_at,
                status,
                verification_status
            `)
            .eq("status", "published")
            .eq("verification_status", "verified")
            .order("created_at", { ascending: false });

        if (error) throw error;

        const properties = data || [];

        if (!properties.length) {
            allProperties = [];
            updatePropertyCount(0);
            loading.hidden = true;
            empty.hidden = false;
            return;
        }

        const propertyIds = properties.map(property => property.id);

        const [unitsByProperty, coverPhotos] = await Promise.all([
            loadPropertyUnits(propertyIds),
            loadCoverPhotos(propertyIds)
        ]);

        allProperties = properties
            .map(property => ({
                ...property,
                units: unitsByProperty[property.id] || [],
                coverPhoto: coverPhotos[property.id] || null
            }))
            .filter(property => property.units.length > 0);

        loading.hidden = true;

        updatePropertyCount(allProperties.length);

        if (!allProperties.length) {
            empty.hidden = false;
            return;
        }

        renderProperties(allProperties);

    } catch (error) {
        console.error("LIVIO property loading error:", error);

        loading.hidden = true;
        errorBox.hidden = false;
        updatePropertyCount(0);
    }
}


// ========================================
// PROPERTY COUNT
// ========================================

function updatePropertyCount(count) {
    const element = getElement("property-count");

    if (element) {
        element.textContent = `${count} ${count === 1 ? "property" : "properties"} found`;
    }
}


// ========================================
// RENDER PROPERTY CARDS
// ========================================

function renderProperties(properties) {
    const container = getElement("property-results");
    const empty = getElement("no-properties");

    container.innerHTML = "";

    if (!properties.length) {
        empty.hidden = false;
        updatePropertyCount(0);
        return;
    }

    empty.hidden = true;
    updatePropertyCount(properties.length);

    properties.forEach(property => {
        const availableRents = property.units
            .map(unit => Number(unit.rent_amount))
            .filter(Number.isFinite);

        const lowestRent = availableRents.length
            ? Math.min(...availableRents)
            : 0;

        const unitTypes = [
            ...new Set(property.units.map(unit => unit.unit_type).filter(Boolean))
        ];

        const bedrooms = [
            ...new Set(property.units.map(unit => unit.bedrooms).filter(value => value !== null))
        ];

        const location = [
            property.town,
            property.county
        ].filter(Boolean).join(", ");

        const image = property.coverPhoto
            ? `<img src="${escapeHTML(property.coverPhoto)}"
                    alt="${escapeHTML(property.property_name)}"
                    loading="lazy">`
            : `<div class="property-image-placeholder">
                    <i class="fas fa-house"></i>
               </div>`;

        const card = document.createElement("article");
        card.className = "public-property-card";

        card.innerHTML = `
            <div class="public-property-image">
                ${image}
                <span class="verified-label">
                    <i class="fas fa-circle-check"></i>
                    LIVIO Verified
                </span>
            </div>

            <div class="public-property-content">

                <span class="public-property-type">
                    ${escapeHTML(property.property_type || "Rental property")}
                </span>

                <h3>${escapeHTML(property.property_name)}</h3>

                <p class="public-property-location">
                    <i class="fas fa-location-dot"></i>
                    ${escapeHTML(location || property.location_details || "Location not provided")}
                </p>

                <div class="public-property-features">
                    <span>
                        <i class="fas fa-door-open"></i>
                        ${property.units.length} available ${property.units.length === 1 ? "unit" : "units"}
                    </span>

                    <span>
                        <i class="fas fa-bed"></i>
                        ${bedrooms.length ? escapeHTML(bedrooms.join(", ")) + " bedroom options" : "Bedrooms vary"}
                    </span>
                </div>

                <div class="public-property-bottom">

                    <div class="property-price">
                        <small>Starting from</small>
                        <strong>KSh ${formatRent(lowestRent)}</strong>
                        <small>/ month</small>
                    </div>

                    <button type="button"
                            class="view-property-button"
                            data-property-id="${escapeHTML(property.id)}">
                        View property
                        <i class="fas fa-arrow-right"></i>
                    </button>

                </div>

            </div>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll(".view-property-button").forEach(button => {
        button.addEventListener("click", () => {
            const propertyId = button.dataset.propertyId;

            window.location.href =
                `properties/property-details.html?id=${encodeURIComponent(propertyId)}`;
        });
    });
}


// ========================================
// SEARCH AND FILTER
// ========================================

function filterProperties(event) {
    if (event) event.preventDefault();

    const location = getElement("location-filter").value.trim().toLowerCase();
    const type = getElement("type-filter").value.trim().toLowerCase();
    const minPrice = Number(getElement("min-price").value) || 0;
    const maxPrice = Number(getElement("max-price").value) || Infinity;
    const bedrooms = getElement("bedrooms-filter").value;

    let filtered = allProperties.filter(property => {
        const searchableLocation = [
            property.county,
            property.town,
            property.location_details,
            property.address
        ].filter(Boolean).join(" ").toLowerCase();

        const locationMatches =
            !location || searchableLocation.includes(location);

        const typeMatches =
            !type ||
            String(property.property_type || "").toLowerCase() === type ||
            property.units.some(unit =>
                String(unit.unit_type || "").toLowerCase() === type
            );

        const unitMatches = property.units.filter(unit => {
            const rent = Number(unit.rent_amount) || 0;

            const priceMatches = rent >= minPrice && rent <= maxPrice;

            let bedroomMatches = true;

            if (bedrooms === "0") {
                bedroomMatches = Number(unit.bedrooms || 0) === 0;
            } else if (bedrooms === "4") {
                bedroomMatches = Number(unit.bedrooms || 0) >= 4;
            } else if (bedrooms) {
                bedroomMatches = Number(unit.bedrooms) === Number(bedrooms);
            }

            return priceMatches && bedroomMatches;
        });

        property.filteredUnits = unitMatches;

        return locationMatches &&
            typeMatches &&
            unitMatches.length > 0;
    });

    sortAndRender(filtered);
}


// ========================================
// SORT PROPERTIES
// ========================================

function sortAndRender(properties) {
    const sortValue = getElement("sort-properties").value;

    const sorted = [...properties];

    if (sortValue === "price-low") {
        sorted.sort((a, b) => {
            const priceA = Math.min(...a.filteredUnits.map(unit => Number(unit.rent_amount)));
            const priceB = Math.min(...b.filteredUnits.map(unit => Number(unit.rent_amount)));
            return priceA - priceB;
        });
    }

    if (sortValue === "price-high") {
        sorted.sort((a, b) => {
            const priceA = Math.min(...a.filteredUnits.map(unit => Number(unit.rent_amount)));
            const priceB = Math.min(...b.filteredUnits.map(unit => Number(unit.rent_amount)));
            return priceB - priceA;
        });
    }

    if (sortValue === "newest") {
        sorted.sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );
    }

    const propertiesToRender = sorted.map(property => ({
        ...property,
        units: property.filteredUnits || property.units
    }));

    renderProperties(propertiesToRender);
}


// ========================================
// CLEAR FILTERS
// ========================================

function clearFilters() {
    getElement("property-filter-form").reset();

    allProperties.forEach(property => {
        delete property.filteredUnits;
    });

    sortAndRender(allProperties);
}


// ========================================
// MOBILE NAVIGATION
// ========================================

function setupMobileNavigation() {
    const button = getElement("properties-mobile-toggle");
    const navigation = document.querySelector(".properties-links");

    if (!button || !navigation) return;

    button.addEventListener("click", () => {
        navigation.classList.toggle("mobile-open");
    });
}


// ========================================
// INITIALIZE
// ========================================

document.addEventListener("DOMContentLoaded", () => {
    getElement("property-filter-form")
        ?.addEventListener("submit", filterProperties);

    getElement("sort-properties")
        ?.addEventListener("change", filterProperties);

    getElement("clear-property-filters")
        ?.addEventListener("click", clearFilters);

    getElement("retry-properties")
        ?.addEventListener("click", loadProperties);

    setupMobileNavigation();

    loadProperties();
});
