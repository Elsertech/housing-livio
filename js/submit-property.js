
import { supabase } from "./supabase.js";

const form = document.getElementById("add-property-form");
const message = document.getElementById("form-message");
const submitButton = document.getElementById("next-btn");

const PHOTO_BUCKET = "property-unit-photos";
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

let submissionState = null;
let isSubmitting = false;

function showSubmissionMessage(text, isError = false) {
    if (!message) return;

    message.textContent = text;
    message.style.display = "block";
    message.style.color = isError ? "#dc2626" : "#15803d";

    message.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

// ------------------------------------------
// PERSISTENT SUBMISSION SESSION
// ------------------------------------------

function getStorageKey(userId) {
    return `livio_property_submission_${userId}`;
}

function loadSubmissionState(userId) {
    const storageKey = getStorageKey(userId);

    try {
        const saved = localStorage.getItem(storageKey);

        if (saved) {
            const parsed = JSON.parse(saved);

            if (
                parsed.propertyId &&
                parsed.unitIds &&
                typeof parsed.unitIds === "object"
            ) {
                submissionState = parsed;
                return;
            }
        }
    } catch (error) {
        console.warn("Could not read saved submission:", error);
    }

    submissionState = {
        propertyId: crypto.randomUUID(),
        unitIds: {}
    };

    persistSubmissionState(userId);
}

function persistSubmissionState(userId) {
    if (!submissionState) return;

    try {
        localStorage.setItem(
            getStorageKey(userId),
            JSON.stringify(submissionState)
        );
    } catch (error) {
        throw new Error(
            "Could not save retry information in this browser. " +
            "Please check your browser storage settings."
        );
    }
}

function clearSubmissionState(userId) {
    localStorage.removeItem(getStorageKey(userId));
    submissionState = null;
}

// ------------------------------------------
// VALIDATE UNIT PHOTOGRAPHS
// ------------------------------------------

function validateUnitPhotos(unitCards) {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    for (const card of unitCards) {
        const photoInput = card.querySelector(
            'input[name="unit_photos[]"]'
        );

        const photos = Array.from(photoInput?.files || []);

        for (const photo of photos) {
            if (!allowedTypes.includes(photo.type)) {
                throw new Error(
                    `Unsupported image format: ${photo.name}. Use JPEG, PNG or WEBP.`
                );
            }

            if (photo.size > MAX_PHOTO_SIZE) {
                throw new Error(
                    `${photo.name} exceeds the 5MB photo limit.`
                );
            }
        }
    }
}

// ------------------------------------------
// VALIDATE PROPERTY COVER PHOTOGRAPH
// ------------------------------------------

function validatePropertyCoverPhoto(photo) {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!photo) {
        throw new Error(
            "Please upload a main property cover photograph."
        );
    }

    if (!allowedTypes.includes(photo.type)) {
        throw new Error(
            "Unsupported cover photograph format. Use JPEG, PNG or WEBP."
        );
    }

    if (photo.size > MAX_PHOTO_SIZE) {
        throw new Error(
            "The property cover photograph exceeds the 5MB limit."
        );
    }
}

// ------------------------------------------
// SAVE PROPERTY
// ------------------------------------------

async function saveProperty(user, propertyData) {
    const propertyId = submissionState.propertyId;

    const { data: existingProperty, error: lookupError } =
        await supabase
            .from("properties")
            .select("id")
            .eq("id", propertyId)
            .eq("landlord_id", user.id)
            .maybeSingle();

    if (lookupError) {
        throw new Error(
            "Could not check the existing property: " +
            lookupError.message
        );
    }

    if (existingProperty) {
        const { error: updateError } = await supabase
            .from("properties")
            .update(propertyData)
            .eq("id", propertyId)
            .eq("landlord_id", user.id);

        if (updateError) {
            throw new Error(
                "Could not update the existing property: " +
                updateError.message
            );
        }

        console.log("Reusing property:", propertyId);
        return existingProperty;
    }

    const { data: property, error } = await supabase
        .from("properties")
        .insert({
            id: propertyId,
            ...propertyData
        })
        .select("id")
        .single();

    if (!error && property) {
        return property;
    }

    const { data: recoveredProperty, error: recoveryError } =
        await supabase
            .from("properties")
            .select("id")
            .eq("id", propertyId)
            .eq("landlord_id", user.id)
            .maybeSingle();

    if (!recoveryError && recoveredProperty) {
        console.log("Recovered existing property:", propertyId);
        return recoveredProperty;
    }

    throw new Error(
        "Property could not be saved: " +
        (error?.message || recoveryError?.message || "Unknown error.")
    );
}

// ------------------------------------------
// SAVE RENTAL UNIT
// ------------------------------------------

async function saveUnit(propertyId, unitData) {
    const unitNumber = unitData.unit_number.trim();
    const unitKey = unitNumber.toLowerCase();

    let unitId = submissionState.unitIds[unitKey];

    if (!unitId) {
        unitId = crypto.randomUUID();
        submissionState.unitIds[unitKey] = unitId;

        const { data: userResult } = await supabase.auth.getUser();

        if (!userResult?.user) {
            throw new Error("Your session has expired.");
        }

        persistSubmissionState(userResult.user.id);
    }

    const { data: existingUnit, error: lookupError } =
        await supabase
            .from("property_units")
            .select("id")
            .eq("id", unitId)
            .eq("property_id", propertyId)
            .maybeSingle();

    if (lookupError) {
        throw new Error(
            "Could not check the rental unit: " +
            lookupError.message
        );
    }

    if (existingUnit) {
        const { error: updateError } = await supabase
            .from("property_units")
            .update(unitData)
            .eq("id", unitId)
            .eq("property_id", propertyId);

        if (updateError) {
            throw new Error(
                "Could not update the rental unit: " +
                updateError.message
            );
        }

        return existingUnit;
    }

    const { data: savedUnit, error } = await supabase
        .from("property_units")
        .insert({
            id: unitId,
            property_id: propertyId,
            ...unitData
        })
        .select("id")
        .single();

    if (!error && savedUnit) {
        return savedUnit;
    }

    const { data: recoveredUnit, error: recoveryError } =
        await supabase
            .from("property_units")
            .select("id")
            .eq("id", unitId)
            .eq("property_id", propertyId)
            .maybeSingle();

    if (!recoveryError && recoveredUnit) {
        return recoveredUnit;
    }

    throw new Error(
        "Rental unit could not be saved: " +
        (error?.message || recoveryError?.message || "Unknown error.")
    );
}

// ------------------------------------------
// GENERATE A STABLE PHOTO FILENAME
// ------------------------------------------

async function getPhotoHash(photo) {
    const buffer = await photo.arrayBuffer();

    const digest = await crypto.subtle.digest(
        "SHA-256",
        buffer
    );

    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

// ------------------------------------------
// UPLOAD UNIT PHOTOGRAPHS
// ------------------------------------------

async function uploadUnitPhotos(
    userId,
    unitId,
    propertyId,
    photos
) {
    const extensionMap = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
    };

    const folderPath =
        `${userId}/${propertyId}/${unitId}`;

    for (const photo of photos) {
        const extension = extensionMap[photo.type];

        if (!extension) {
            throw new Error(
                `Unsupported image format: ${photo.name}`
            );
        }

        const photoHash = await getPhotoHash(photo);

        const fileName = `${photoHash}.${extension}`;
        const storagePath = `${folderPath}/${fileName}`;

        const { data: existingFiles, error: listError } =
            await supabase
                .storage
                .from(PHOTO_BUCKET)
                .list(folderPath, {
                    search: fileName
                });

        if (listError) {
            throw new Error(
                `Could not check existing photographs: ${listError.message}`
            );
        }

        const fileAlreadyUploaded = (existingFiles || []).some(
            file => file.name === fileName
        );

        if (!fileAlreadyUploaded) {
            const { error: uploadError } = await supabase
                .storage
                .from(PHOTO_BUCKET)
                .upload(storagePath, photo, {
                    contentType: photo.type,
                    upsert: false
                });

            if (uploadError) {
                throw new Error(
                    `Could not upload ${photo.name}: ${uploadError.message}`
                );
            }
        }

        const { data: existingRecord, error: recordLookupError } =
            await supabase
                .from("property_unit_images")
                .select("id")
                .eq("unit_id", unitId)
                .eq("storage_path", storagePath)
                .maybeSingle();

        if (recordLookupError) {
            throw new Error(
                `Could not check photograph records: ${recordLookupError.message}`
            );
        }

        if (!existingRecord) {
            const { error: imageRecordError } = await supabase
                .from("property_unit_images")
                .insert({
                    unit_id: unitId,
                    storage_path: storagePath
                });

            if (imageRecordError) {
                throw new Error(
                    `Photograph uploaded, but its database record could not be saved: ${imageRecordError.message}`
                );
            }
        }

        console.log("Photograph saved:", storagePath);
    }
}

// ------------------------------------------
// UPLOAD MAIN PROPERTY COVER PHOTOGRAPH
// ------------------------------------------

async function uploadPropertyCoverPhoto(propertyId, photo) {
    const extensionMap = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
    };

    const extension = extensionMap[photo.type];

    if (!extension) {
        throw new Error(
            "Unsupported property cover photograph format."
        );
    }

    const photoHash = await getPhotoHash(photo);
    const fileName = `${photoHash}.${extension}`;

    const folderPath = `property-covers/${propertyId}`;
    const storagePath = `${folderPath}/${fileName}`;

    const { data: existingFiles, error: listError } =
        await supabase
            .storage
            .from(PHOTO_BUCKET)
            .list(folderPath, {
                search: fileName
            });

    if (listError) {
        throw new Error(
            `Could not check cover photograph: ${listError.message}`
        );
    }

    const alreadyUploaded = (existingFiles || []).some(
        file => file.name === fileName
    );

    if (!alreadyUploaded) {
        const { error: uploadError } = await supabase
            .storage
            .from(PHOTO_BUCKET)
            .upload(storagePath, photo, {
                contentType: photo.type,
                upsert: false
            });

        if (uploadError) {
            throw new Error(
                `Could not upload cover photograph: ${uploadError.message}`
            );
        }
    }

    const { data: existingRecord, error: lookupError } =
        await supabase
            .from("property_images")
            .select("id")
            .eq("property_id", propertyId)
            .eq("storage_path", storagePath)
            .maybeSingle();

    if (lookupError) {
        throw new Error(
            `Could not check cover photograph record: ${lookupError.message}`
        );
    }

    if (!existingRecord) {
        const { error: insertError } = await supabase
            .from("property_images")
            .insert({
                property_id: propertyId,
                storage_path: storagePath,
                is_cover: true
            });

        if (insertError) {
            throw new Error(
                `Cover photograph uploaded, but its database record failed: ${insertError.message}`
            );
        }
    }

    console.log("Property cover photograph saved:", storagePath);
}

// ------------------------------------------
// MAIN PROPERTY SUBMISSION
// ------------------------------------------

async function submitProperty() {
    if (!form || !message || !submitButton) {
        console.error("Property submission elements are missing.");
        return;
    }

    if (isSubmitting || submitButton.disabled) {
        return;
    }

    isSubmitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    try {
        // 1. Authenticate the user.
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError || !user) {
            throw new Error(
                "Your session has expired. Please log in again."
            );
        }

        // 2. Verify landlord account.
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role, account_status")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            throw new Error(
                "Unable to verify your LIVIO profile: " +
                (profileError?.message || "Profile not found.")
            );
        }

        if (
            profile.role !== "landlord" ||
            profile.account_status !== "active"
        ) {
            throw new Error(
                "Only active landlord accounts can submit properties."
            );
        }

        // 3. Restore or create the persistent submission session.
        if (!submissionState) {
            loadSubmissionState(user.id);
        }

        // 4. Validate the main property cover photograph.
        const coverInput = document.getElementById(
            "property-cover-image"
        );

        const coverPhoto = coverInput?.files?.[0];

        validatePropertyCoverPhoto(coverPhoto);

        // 5. Collect property details.
        const propertyName =
            document.getElementById("property-name")?.value.trim();

        const propertyType =
            document.getElementById("property-type")?.value;

        const county =
            document.getElementById("county")?.value;

        const town =
            document.getElementById("town")?.value.trim();

        const estate =
            document.getElementById("estate")?.value.trim();

        const directions =
            document.getElementById("location")?.value.trim();

        const description =
            document.getElementById("description")?.value.trim();

        if (
            !propertyName ||
            !propertyType ||
            !county ||
            !town
        ) {
            throw new Error(
                "Please complete the required property details."
            );
        }

        // 6. Collect rental units.
        const unitCards = Array.from(
            document.querySelectorAll(".unit-card")
        );

        if (unitCards.length === 0) {
            throw new Error(
                "Add at least one rental unit before submitting."
            );
        }

        validateUnitPhotos(unitCards);

        const units = unitCards.map(card => {
            const getField = name =>
                card.querySelector(`[name="${name}"]`);

            const unitNumber = getField("unit_number[]");
            const unitType = getField("unit_type[]");
            const unitRent = getField("unit_rent[]");
            const unitBedrooms = getField("unit_bedrooms[]");
            const unitBathrooms = getField("unit_bathrooms[]");
            const unitDescription = getField("unit_description[]");
            const unitAvailability = getField("unit_availability[]");

            if (
                !unitNumber ||
                !unitType ||
                !unitRent ||
                !unitBedrooms ||
                !unitBathrooms ||
                !unitDescription ||
                !unitAvailability
            ) {
                throw new Error(
                    "A rental unit is missing required fields."
                );
            }

            const availabilityMap = {
                "Available": "available",
                "Occupied": "occupied",
                "Coming Soon": "unavailable"
            };

            return {
                card,
                data: {
                    unit_number: unitNumber.value.trim(),
                    unit_type: unitType.value,
                    rent_amount: Number(unitRent.value),
                    bedrooms: Number(unitBedrooms.value || 0),
                    bathrooms: Number(unitBathrooms.value || 0),
                    description:
                        unitDescription.value.trim() || null,
                    availability_status:
                        availabilityMap[unitAvailability.value]
                }
            };
        });

        const unitNumbers = units.map(unit =>
            unit.data.unit_number.toLowerCase()
        );

        if (new Set(unitNumbers).size !== unitNumbers.length) {
            throw new Error(
                "Each rental unit must have a different unit number."
            );
        }

        // 7. Save or reuse the property.
        const propertyData = {
            landlord_id: user.id,
            property_name: propertyName,
            property_type: propertyType,
            county: county,
            town: town,
            location_details: [
                estate,
                directions
            ].filter(Boolean).join(" — "),
            description: description
        };

        const property = await saveProperty(user, propertyData);

        console.log("Property ID:", property.id);

        // 8. Upload and register the main property cover photograph.
        showSubmissionMessage(
            "Uploading main property cover photograph..."
        );

        await uploadPropertyCoverPhoto(
            property.id,
            coverPhoto
        );

        // 9. Save rental units and their photographs.
        for (let index = 0; index < units.length; index++) {
            const unit = units[index];

            showSubmissionMessage(
                `Saving rental unit ${index + 1} of ${units.length}...`
            );

            const savedUnit = await saveUnit(
                property.id,
                unit.data
            );

            console.log(
                `Rental unit ${index + 1}:`,
                savedUnit.id
            );

            const photoInput = unit.card.querySelector(
                'input[name="unit_photos[]"]'
            );

            const photos = Array.from(
                photoInput?.files || []
            );

            if (photos.length > 0) {
                showSubmissionMessage(
                    `Uploading photographs for rental unit ${index + 1}...`
                );

                await uploadUnitPhotos(
                    user.id,
                    savedUnit.id,
                    property.id,
                    photos
                );
            }
        }

        // 10. Submit for administrator verification.
        showSubmissionMessage(
            "Property cover photograph, rental units and photographs saved. Submitting property..."
        );

        const {
            data: submittedProperty,
            error: submissionError
        } = await supabase
            .from("properties")
            .update({
                status: "submitted",
                verification_status: "pending"
            })
            .eq("id", property.id)
            .eq("landlord_id", user.id)
            .select("id, status, verification_status")
            .single();

        if (submissionError || !submittedProperty) {
            throw new Error(
                "Property and photographs were saved, but submission failed: " +
                (submissionError?.message ||
                    "No updated property was returned.")
            );
        }

        if (submittedProperty.status !== "submitted") {
            throw new Error(
                "Property submission was not confirmed."
            );
        }

        // 11. Confirm success and clear the saved retry session.
        clearSubmissionState(user.id);

        showSubmissionMessage(
            "Property submitted successfully! Your cover photograph, property, rental units and unit photographs are awaiting administrator verification."
        );

        console.log(
            "Successfully submitted property:",
            submittedProperty
        );

        form.reset();

        submitButton.textContent = "Submitted";
        submitButton.disabled = true;

    } catch (error) {
        console.error("LIVIO property submission error:", error);

        showSubmissionMessage(
            error.message ||
            "Something went wrong while submitting your property.",
            true
        );

        submitButton.disabled = false;
        submitButton.textContent = "Retry Submission";

    } finally {
        isSubmitting = false;
    }
}

// ------------------------------------------
// LISTEN FOR THE EXISTING WIZARD EVENT
// ------------------------------------------

window.addEventListener(
    "livio:submit-property",
    submitProperty
);
