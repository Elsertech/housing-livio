
import { supabase } from "./supabase.js";

const message = document.getElementById("properties-message");
const propertyGrid = document.getElementById("property-grid");

async function loadMyProperties() {
    try {
        message.textContent = "Loading your properties...";

        // Get the currently logged-in landlord
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError || !user) {
            throw new Error("Please log in to view your properties.");
        }

        // Retrieve only properties belonging to this landlord
        const { data: properties, error } = await supabase
            .from("properties")
            .select(`
                id,
                property_name,
                property_type,
                county,
                town,
                status,
                verification_status,
                created_at,
                property_units (
                    id,
                    unit_number,
                    rent_amount,
                    availability_status
                )
            `)
            .eq("landlord_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        propertyGrid.innerHTML = "";

        if (!properties || properties.length === 0) {
            message.textContent = "You have not added any properties yet.";
            return;
        }

        message.textContent =
            `You have added ${properties.length} ${properties.length === 1 ? "property" : "properties"}.`;

        properties.forEach(property => {
            const card = document.createElement("article");
            card.className = "property-card";

            const title = document.createElement("h3");
            title.textContent = property.property_name || "Unnamed Property";

            const location = document.createElement("p");
            location.className = "property-location";
            location.textContent =
                `${property.town || ""}, ${property.county || ""}`;

            const status = document.createElement("span");
            status.className = "property-status";
            status.textContent =
                (property.status || "draft").replaceAll("_", " ").toUpperCase();

            const details = document.createElement("div");
            details.className = "property-details";

            const unitCount = property.property_units?.length || 0;

            details.textContent =
                `Type: ${property.property_type || "Not specified"} | ` +
                `Rental units: ${unitCount} | ` +
                `Verification: ${(property.verification_status || "pending").replaceAll("_", " ")}`;

            card.append(title, location, status, details);
            propertyGrid.appendChild(card);
        });

    } catch (error) {
        console.error("My properties error:", error);
        message.textContent = error.message ||
            "Unable to load your properties.";
    }
}

loadMyProperties();
