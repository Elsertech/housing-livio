
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("add-property-form");

    if (!form) return;

    const sections = Array.from(
        form.querySelectorAll(".property-form-section")
    );

    // The first four sections are steps 1–4.
    // The fifth section contains media, and the sixth contains final review.
    if (sections.length < 6) {
        console.error("LIVIO registration sections are incomplete.");
        return;
    }

    const steps = [
        "Property Details",
        "Ownership",
        "Features",
        "Rental Units",
        "Media & Review"
    ];

    let currentStep = 0;
    let units = [];
    let selectedFiles = [];

    const agreement = document.getElementById("property-agreement");
    const originalSubmit = form.querySelector('button[type="submit"]');

    // Create a review area.
    const reviewArea = document.createElement("div");
    reviewArea.id = "property-review";
    reviewArea.className = "property-review";

    sections[4].appendChild(reviewArea);

    // Create upload controls.
    const uploadArea = sections[4].querySelector(".property-upload-notice");

    if (uploadArea) {
        uploadArea.innerHTML = `
            <i class="fas fa-cloud-arrow-up"></i>
            <h3>Upload property documents and photos</h3>
            <p>Select images of the property and supporting ownership documents.</p>

            <label class="upload-label">
                <i class="fas fa-images"></i> Select Property Photos
                <input type="file" id="property-photos"
                    accept="image/*" multiple hidden>
            </label>

            <label class="upload-label">
                <i class="fas fa-file-shield"></i> Select Ownership Documents
                <input type="file" id="ownership-documents"
                    accept=".pdf,.jpg,.jpeg,.png" multiple hidden>
            </label>

            <div id="upload-preview"></div>

            <small>
                File previews are local only. Secure upload to LIVIO will be
                connected separately.
            </small>
        `;
    }

    // Create unit registration interface.
    const unitArea = sections[3].querySelector(
        ".unit-registration-placeholder"
    );

    if (unitArea) {
        unitArea.innerHTML = `
            <div class="unit-builder">
                <div class="unit-builder-heading">
                    <div>
                        <h3>Register Rental Units</h3>
                        <p>Add each rentable unit separately.</p>
                    </div>

                    <button type="button" id="add-unit-btn" class="primary-btn">
                        <i class="fas fa-plus"></i> Add Unit
                    </button>
                </div>

                <div id="unit-list"></div>
            </div>
        `;
    }

    // Add navigation controls to every step.
    const navigation = document.createElement("div");
    navigation.className = "wizard-navigation";

    navigation.innerHTML = `
        <button type="button" id="save-draft-btn" class="secondary-btn">
            <i class="fas fa-save"></i> Save Draft
        </button>

        <div>
            <button type="button" id="back-step-btn" class="secondary-btn">
                <i class="fas fa-arrow-left"></i> Back
            </button>

            <button type="button" id="next-step-btn" class="primary-btn">
                Continue <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    `;

    sections[3].after(navigation);

    // Keep the final submit button in the final step.
    if (originalSubmit) {
        originalSubmit.disabled = false;
        originalSubmit.innerHTML =
            'Submit Property <i class="fas fa-paper-plane"></i>';
    }

    function showStep(index) {
        currentStep = index;

        sections.forEach((section, i) => {
            section.style.display =
                (i === index || (index === 4 && i === 5))
                    ? "block"
                    : "none";
        });

        navigation.style.display = index === 4 ? "none" : "flex";

        document.querySelectorAll(".property-step").forEach((step, i) => {
            step.classList.toggle("active", i === index);
            step.classList.toggle("completed", i < index);
        });

        const nextButton = document.getElementById("next-step-btn");
        const backButton = document.getElementById("back-step-btn");

        backButton.style.display = index === 0 ? "none" : "inline-flex";

        nextButton.innerHTML = index === 3
            ? 'Continue to Review <i class="fas fa-arrow-right"></i>'
            : 'Next <i class="fas fa-arrow-right"></i>';

        window.scrollTo({ top: 0, behavior: "smooth" });

        if (index === 4) renderReview();
    }

    function validateStep(index) {
        const fields = sections[index].querySelectorAll(
            "input, select, textarea"
        );

        for (const field of fields) {
            if (field.type === "file" || field.type === "checkbox") continue;

            if (!field.checkValidity()) {
                field.reportValidity();
                return false;
            }
        }

        if (index === 3 && units.length === 0) {
            alert("Please add at least one rental unit.");
            return false;
        }

        return true;
    }

    document.getElementById("next-step-btn").addEventListener("click", () => {
        if (!validateStep(currentStep)) return;

        showStep(Math.min(currentStep + 1, 4));
    });

    document.getElementById("back-step-btn").addEventListener("click", () => {
        showStep(Math.max(currentStep - 1, 0));
    });

    // Unit creation.
    function renderUnits() {
        const list = document.getElementById("unit-list");

        list.innerHTML = "";

        units.forEach((unit, index) => {
            const card = document.createElement("div");
            card.className = "unit-item";

            card.innerHTML = `
                <div class="unit-item-heading">
                    <strong>Rental Unit ${index + 1}</strong>
                    <button type="button" class="remove-unit-btn"
                        data-index="${index}">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>

                <div class="property-form-grid">
                    <div class="form-group">
                        <label>Unit Number *</label>
                        <input required data-field="number"
                            data-index="${index}" value="${escapeHTML(unit.number)}"
                            placeholder="e.g. A01">
                    </div>

                    <div class="form-group">
                        <label>Unit Type *</label>
                        <select required data-field="type" data-index="${index}">
                            <option value="">Select unit type</option>
                            ${["Bedsitter","Studio","1 Bedroom","2 Bedrooms","3 Bedrooms","4+ Bedrooms","Commercial"].map(type =>
                                `<option ${unit.type === type ? "selected" : ""}>${type}</option>`
                            ).join("")}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Monthly Rent (KSh) *</label>
                        <input required type="number" min="1"
                            data-field="rent" data-index="${index}"
                            value="${escapeHTML(unit.rent)}" placeholder="e.g. 12000">
                    </div>

                    <div class="form-group">
                        <label>Bedrooms</label>
                        <input type="number" min="0"
                            data-field="bedrooms" data-index="${index}"
                            value="${escapeHTML(unit.bedrooms)}">
                    </div>

                    <div class="form-group">
                        <label>Bathrooms</label>
                        <input type="number" min="0"
                            data-field="bathrooms" data-index="${index}"
                            value="${escapeHTML(unit.bathrooms)}">
                    </div>

                    <div class="form-group">
                        <label>Availability *</label>
                        <select required data-field="availability" data-index="${index}">
                            <option value="available" ${unit.availability === "available" ? "selected" : ""}>Available</option>
                            <option value="occupied" ${unit.availability === "occupied" ? "selected" : ""}>Occupied</option>
                            <option value="reserved" ${unit.availability === "reserved" ? "selected" : ""}>Reserved</option>
                            <option value="maintenance" ${unit.availability === "maintenance" ? "selected" : ""}>Under Maintenance</option>
                        </select>
                    </div>
                </div>
            `;

            list.appendChild(card);
        });
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    document.getElementById("add-unit-btn").addEventListener("click", () => {
        units.push({
            number: "",
            type: "",
            rent: "",
            bedrooms: "",
            bathrooms: "",
            availability: "available"
        });

        renderUnits();
    });

    document.getElementById("unit-list").addEventListener("input", event => {
        const field = event.target.dataset.field;
        const index = Number(event.target.dataset.index);

        if (field && units[index]) {
            units[index][field] = event.target.value;
        }
    });

    document.getElementById("unit-list").addEventListener("change", event => {
        const field = event.target.dataset.field;
        const index = Number(event.target.dataset.index);

        if (field && units[index]) {
            units[index][field] = event.target.value;
        }
    });

    document.getElementById("unit-list").addEventListener("click", event => {
        const button = event.target.closest(".remove-unit-btn");

        if (!button) return;

        units.splice(Number(button.dataset.index), 1);
        renderUnits();
    });

    // File selection and previews.
    ["property-photos", "ownership-documents"].forEach(id => {
        const input = document.getElementById(id);

        if (!input) return;

        input.addEventListener("change", () => {
            const category = id === "property-photos"
                ? "Property photo"
                : "Ownership document";

            for (const file of input.files) {
                selectedFiles.push({
                    name: file.name,
                    category,
                    file
                });
            }

            renderFiles();
        });
    });

    function renderFiles() {
        const preview = document.getElementById("upload-preview");

        preview.innerHTML = "";

        selectedFiles.forEach((item, index) => {
            const row = document.createElement("div");
            row.className = "upload-file-row";

            const name = document.createElement("span");
            name.textContent = `${item.category}: ${item.name}`;

            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "Remove";
            remove.addEventListener("click", () => {
                selectedFiles.splice(index, 1);
                renderFiles();
            });

            row.append(name, remove);
            preview.appendChild(row);
        });
    }

    // Review summary.
    function renderReview() {
        const data = new FormData(form);
        const fields = [
            ["Property", "property_name"],
            ["Property type", "property_type"],
            ["County", "county"],
            ["Town", "town"],
            ["Estate", "estate"],
            ["Address", "physical_address"],
            ["Relationship", "ownership_type"],
            ["Owner", "owner_name"],
            ["Owner contact", "owner_phone"]
        ];

        reviewArea.innerHTML = `
            <h3>Review Your Registration</h3>
            <p>Please check the details before submitting.</p>

            <div class="review-details">
                ${fields.map(([label, name]) => `
                    <div class="review-row">
                        <strong>${label}</strong>
                        <span>${escapeHTML(data.get(name) || "Not provided")}</span>
                    </div>
                `).join("")}
            </div>

            <h4>Rental Units (${units.length})</h4>

            ${units.map(unit => `
                <div class="review-row">
                    <strong>${escapeHTML(unit.number)} — ${escapeHTML(unit.type)}</strong>
                    <span>KSh ${escapeHTML(unit.rent)} / month</span>
                </div>
            `).join("")}

            <h4>Selected Files (${selectedFiles.length})</h4>
            <p>${selectedFiles.map(file => escapeHTML(file.name)).join(", ") || "No files selected"}</p>
        `;
    }

    // Save and restore draft in this browser.
    function collectDraft() {
        const values = {};

        form.querySelectorAll("input, select, textarea").forEach(field => {
            if (!field.name || field.type === "file") return;

            if (field.type === "checkbox") {
                values[field.name] ??= [];
                if (field.checked) values[field.name].push(field.value);
            } else {
                values[field.name] = field.value;
            }
        });

        return {
            values,
            units,
            currentStep,
            savedAt: new Date().toISOString()
        };
    }

    function saveDraft(showMessage = true) {
        try {
            localStorage.setItem(
                "livio_property_draft",
                JSON.stringify(collectDraft())
            );

            if (showMessage) {
                alert("Your draft has been saved in this browser.");
            }
        } catch (error) {
            alert("Unable to save the draft in this browser.");
            console.error(error);
        }
    }

    function restoreDraft() {
        const saved = localStorage.getItem("livio_property_draft");

        if (!saved) return;

        try {
            const draft = JSON.parse(saved);

            Object.entries(draft.values || {}).forEach(([name, value]) => {
                const fields = form.querySelectorAll(
                    `[name="${CSS.escape(name)}"]`
                );

                fields.forEach(field => {
                    if (field.type === "checkbox") {
                        field.checked = Array.isArray(value) &&
                            value.includes(field.value);
                    } else {
                        field.value = value;
                    }
                });
            });

            units = Array.isArray(draft.units) ? draft.units : [];
            renderUnits();

            alert("Your saved property draft has been restored. Please reselect any files.");
        } catch (error) {
            console.error("Could not restore draft:", error);
        }
    }

    document.getElementById("save-draft-btn").addEventListener("click", () => {
        saveDraft();
    });

    // Agreement controls submission readiness.
    if (agreement && originalSubmit) {
        originalSubmit.disabled = !agreement.checked;

        agreement.addEventListener("change", () => {
            originalSubmit.disabled = !agreement.checked;
        });
    }

    // Prevent false submission until Supabase is connected.
    form.addEventListener("submit", event => {
        event.preventDefault();

        if (!agreement || !agreement.checked) {
            alert("Please confirm the registration declaration.");
            return;
        }

        if (!form.checkValidity()) {
            showStep(0);
            form.reportValidity();
            return;
        }

        if (units.length === 0) {
            showStep(3);
            alert("Please add at least one rental unit.");
            return;
        }

        if (units.some(unit =>
            !unit.number.trim() ||
            !unit.type ||
            !unit.rent ||
            Number(unit.rent) <= 0
        )) {
            showStep(3);
            alert("Please complete the required details for every unit.");
            return;
        }

        saveDraft(false);

        alert(
            "Your registration has passed the browser checks. " +
            "Permanent submission is not enabled yet. " +
            "The Supabase saving and secure document upload connection is the next step."
        );
    });

    restoreDraft();
    showStep(0);
});
