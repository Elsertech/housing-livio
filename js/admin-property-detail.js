
import { supabase } from "./supabase.js";

const PHOTO_BUCKET = "property-unit-photos";

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent =
            value === null || value === undefined || value === ""
                ? "Not provided"
                : value;
    }
}

function getPropertyId() {
    return new URLSearchParams(window.location.search).get("id");
}

function setReviewMessage(message) {
    const element = document.getElementById("review-message");

    if (element) {
        element.textContent = message;
    }
}

function setButtonsDisabled(disabled) {
    [
        "approve-property",
        "request-corrections",
        "reject-property"
    ].forEach(id => {
        const button = document.getElementById(id);

        if (button) {
            button.disabled = disabled;
        }
    });
}

/* =========================================
   ADMIN PROPERTY DECISIONS
========================================= */

async function updatePropertyDecision(decision) {
    const propertyId = getPropertyId();

    if (!propertyId) {
        setReviewMessage("Property ID is missing from the URL.");
        return;
    }

    const decisions = {
        approve: {
            status: "published",
            verification_status: "verified",
            message: "Property successfully verified and published. It is now eligible for public and tenant visibility."
        },

        corrections: {
            status: "more_information_required",
            verification_status: "pending",
            message: "Corrections have been requested successfully."
        },

        reject: {
            status: "rejected",
            verification_status: "rejected",
            message: "Property successfully rejected."
        }
    };

    const selectedDecision = decisions[decision];

    if (!selectedDecision) {
        setReviewMessage("Invalid verification action.");
        return;
    }

    const confirmation = {
        approve: "Are you sure you want to verify and publish this property?",
        corrections: "Are you sure you want to request corrections?",
        reject: "Are you sure you want to reject this property?"
    };

    if (!window.confirm(confirmation[decision])) {
        return;
    }

    setButtonsDisabled(true);
    setReviewMessage("Processing administrator decision...");

    try {
        const { data, error } = await supabase
            .from("properties")
            .update({
                status: selectedDecision.status,
                verification_status:
                    selectedDecision.verification_status,
                updated_at: new Date().toISOString()
            })
            .eq("id", propertyId)
            .select("id, status, verification_status")
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            throw new Error(
                "No property was updated. Check administrator permissions and property ID."
            );
        }

        await loadAdminPropertyDetails();

        setReviewMessage(selectedDecision.message);

        console.log("PROPERTY DECISION SUCCESSFUL:", data);

    } catch (error) {
        console.error("Property verification error:", error);

        setReviewMessage(
            "Unable to complete the decision: " + error.message
        );

    } finally {
        setButtonsDisabled(false);
    }
}

/* =========================================
   CONNECT VERIFICATION BUTTONS
========================================= */

function connectVerificationButtons() {
    const approveButton =
        document.getElementById("approve-property");

    const correctionsButton =
        document.getElementById("request-corrections");

    const rejectButton =
        document.getElementById("reject-property");

    if (approveButton) {
        approveButton.addEventListener("click", () => {
            updatePropertyDecision("approve");
        });
    }

    if (correctionsButton) {
        correctionsButton.addEventListener("click", () => {
            updatePropertyDecision("corrections");
        });
    }

    if (rejectButton) {
        rejectButton.addEventListener("click", () => {
            updatePropertyDecision("reject");
        });
    }
}

/* =========================================
   LOAD ADMIN PROPERTY DETAILS
========================================= */

export async function loadAdminPropertyDetails() {
    const message = document.getElementById("review-message");

    try {
        const propertyId = getPropertyId();

        if (!propertyId) {
            throw new Error("Property ID is missing from the URL.");
        }

        if (message) {
            message.textContent = "Loading property information...";
        }

        // 1. Load property record
        const { data: property, error } = await supabase
            .from("properties")
            .select("*")
            .eq("id", propertyId)
            .maybeSingle();

        if (error) throw error;

        if (!property) {
            throw new Error("Property not found.");
        }

        // 2. Load landlord profile
        const { data: landlord, error: landlordError } =
            await supabase
                .from("profiles")
                .select("full_name, phone, role, account_status")
                .eq("id", property.landlord_id)
                .single();

        if (landlordError) throw landlordError;

        // 3. Load rental units
        const { data: units, error: unitsError } =
            await supabase
                .from("property_units")
                .select(`
                    id,
                    unit_number,
                    unit_type,
                    rent_amount,
                    bedrooms,
                    bathrooms,
                    description,
                    availability_status
                `)
                .eq("property_id", propertyId);

        if (unitsError) throw unitsError;

        // 4. Load rental-unit photographs
        const unitIds = (units || []).map(unit => unit.id);

        let photos = [];

        if (unitIds.length > 0) {
            const { data: photoRecords, error: photoError } =
                await supabase
                    .from("property_unit_images")
                    .select("id, unit_id, storage_path")
                    .in("unit_id", unitIds);

            if (photoError) throw photoError;

            photos = photoRecords || [];
        }

        // 5. Display property information
        setText("property-name", property.property_name);
        setText("property-type", property.property_type);
        setText("property-county", property.county);
        setText("property-town", property.town);
        setText("property-address", property.address);
        setText("property-location", property.location_details);
        setText("property-latitude", property.latitude);
        setText("property-longitude", property.longitude);

        setText(
            "property-verification",
            property.verification_status
        );

        setText(
            "property-date",
            property.created_at
                ? new Date(property.created_at).toLocaleString()
                : null
        );

        setText("property-description", property.description);
        setText("property-status", property.status);

        // 6. Display landlord information
        setText("landlord-name", landlord.full_name);
        setText("landlord-phone", landlord.phone);
        setText("landlord-role", landlord.role);
        setText("landlord-status", landlord.account_status);

        // 7. Display rental units
        const unitsContainer =
            document.getElementById("rental-units");

        if (unitsContainer) {
            unitsContainer.innerHTML = "";

            if (!units || units.length === 0) {
                unitsContainer.textContent = "No rental units found.";
            } else {
                units.forEach(unit => {
                    const card = document.createElement("article");
                    card.className = "unit-card";

                    const heading = document.createElement("h3");
                    heading.textContent =
                        unit.unit_number || "Unnamed unit";

                    const details = document.createElement("p");

                    details.textContent =
                        `Type: ${unit.unit_type || "Not specified"} | ` +
                        `Rent: KSh ${Number(
                            unit.rent_amount || 0
                        ).toLocaleString()} | ` +
                        `Bedrooms: ${unit.bedrooms ?? "Not specified"} | ` +
                        `Bathrooms: ${unit.bathrooms ?? "Not specified"} | ` +
                        `Availability: ${
                            unit.availability_status || "Not specified"
                        }`;

                    const description = document.createElement("p");

                    description.textContent =
                        unit.description ||
                        "No unit description provided.";

                    card.append(heading, details, description);
                    unitsContainer.appendChild(card);
                });
            }
        }

        // 8. Display rental-unit photographs
        const photosContainer =
            document.getElementById("property-photos");

        if (photosContainer) {
            photosContainer.innerHTML = "";
            photosContainer.classList.add("photo-grid");

            if (photos.length === 0) {
                photosContainer.textContent =
                    "No photographs found.";
            } else {
                for (const photo of photos) {
                    const { data, error: signedUrlError } =
                        await supabase.storage
                            .from(PHOTO_BUCKET)
                            .createSignedUrl(photo.storage_path, 3600);

                    if (signedUrlError) {
                        console.error(
                            "Photo loading error:",
                            signedUrlError
                        );
                        continue;
                    }

                    const image = document.createElement("img");

                    image.src = data.signedUrl;
                    image.alt = "Rental unit photograph";
                    image.loading = "lazy";

                    photosContainer.appendChild(image);
                }

                if (!photosContainer.children.length) {
                    photosContainer.textContent =
                        "Photographs could not be displayed.";
                }
            }
        }

        if (message) {
            message.textContent =
                "Property information loaded successfully.";
        }

        console.log("PROPERTY DETAILS LOADED SUCCESSFULLY");

    } catch (error) {
        console.error("Property details loading error:", error);

        if (message) {
            message.textContent =
                "Unable to load property information: " +
                error.message;
        }
    }
}

// Connect the buttons once when this module loads.
connectVerificationButtons();
