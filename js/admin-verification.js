
import { supabase } from "./supabase.js";

const message = document.getElementById("verification-message");
const propertyList = document.getElementById("verification-list");

async function loadVerificationProperties() {
    try {
        message.textContent = "Loading property submissions...";

        const { data: properties, error } = await supabase
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
                verification_status,
                created_at,
                property_units (
                    id,
                    unit_number,
                    unit_type,
                    rent_amount,
                    bedrooms,
                    bathrooms,
                    availability_status
                )
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;

        propertyList.innerHTML = "";

        const records = properties || [];

        // Dashboard statistics
        document.getElementById("pending-count").textContent =
            records.filter(p => p.status === "submitted").length;

        document.getElementById("review-count").textContent =
            records.filter(p => p.status === "under_review").length;

        document.getElementById("verified-count").textContent =
            records.filter(p => p.verification_status === "verified").length;

        document.getElementById("rejected-count").textContent =
            records.filter(p => p.status === "rejected").length;

        if (records.length === 0) {
            message.textContent = "No property submissions found.";
            return;
        }

        message.textContent =
            `${records.length} property record(s) found.`;

        records.forEach(property => {

            // Main card
            const card = document.createElement("article");
            card.className = "verification-property-card";

            // Property name
            const heading = document.createElement("h3");
            heading.textContent =
                property.property_name || "Unnamed Property";

            // Location
            const location = document.createElement("p");
            location.textContent =
                `Location: ${[
                    property.town,
                    property.county
                ].filter(Boolean).join(", ") || "Not specified"}`;

            // Property status
            const status = document.createElement("p");
            status.textContent =
                `Submission status: ${(property.status || "draft").replaceAll("_", " ")}`;

            // Verification status
            const verification = document.createElement("span");
            verification.className = "verification-status";
            verification.textContent =
                (property.verification_status || "pending")
                    .replaceAll("_", " ");

            // Property type
            const type = document.createElement("p");
            type.textContent =
                `Property type: ${property.property_type || "Not specified"}`;

            // Rental units
            const unitCount = property.property_units?.length || 0;

            const units = document.createElement("p");
            units.textContent =
                `Rental units: ${unitCount}`;

            // Submission date
            const date = document.createElement("p");
            date.textContent =
                `Date added: ${
                    property.created_at
                        ? new Date(property.created_at).toLocaleDateString()
                        : "Not available"
                }`;

            // View Property Details button
            const viewButton = document.createElement("a");

            viewButton.href =
                `../properties/property-details.html?id=${encodeURIComponent(property.id)}`;

            viewButton.textContent = "View Property Details →";
            viewButton.className = "admin-button";

            // Assemble card
            card.append(
                heading,
                location,
                status,
                verification,
                type,
                units,
                date,
                viewButton
            );

            propertyList.appendChild(card);
        });

    } catch (error) {
        console.error("Verification Centre error:", error);

        message.textContent =
            "Unable to load properties: " + error.message;
    }
}

export { loadVerificationProperties };
