/**
 * Gridly — UI State Management
 * 
 * Manages the plugin panel's DOM state: selection status,
 * control visibility, settings extraction, and status updates.
 */

const GridlyUI = (() => {

    // --- DOM References (cached on init) ---
    let els = {};

    /**
     * Cache all DOM element references.
     */
    function init() {
        els = {
            // Status
            statusDot: document.getElementById("statusDot"),
            statusText: document.getElementById("statusText"),
            warningBar: document.getElementById("warningBar"),
            warningText: document.getElementById("warningText"),

            // Grid type
            gridTypeGroup: document.getElementById("gridTypeGroup"),
            gridTypeBtns: document.querySelectorAll("#gridTypeGroup .segmented-btn"),

            // Grid controls
            gridControlsSection: document.getElementById("gridControlsSection"),
            densitySlider: document.getElementById("densitySlider"),
            densityValue: document.getElementById("densityValue"),
            opacitySlider: document.getElementById("opacitySlider"),
            opacityValue: document.getElementById("opacityValue"),
            visibilityToggle: document.getElementById("visibilityToggle"),

            // Circular controls
            circularControlsSection: document.getElementById("circularControlsSection"),
            ringSlider: document.getElementById("ringSlider"),
            ringValue: document.getElementById("ringValue"),
            centerMarkerToggle: document.getElementById("centerMarkerToggle"),

            // Clear space
            clearSpaceToggle: document.getElementById("clearSpaceToggle"),
            clearSpaceUnitRow: document.getElementById("clearSpaceUnitRow"),
            clearSpaceUnit: document.getElementById("clearSpaceUnit"),
            clearSpaceOpacityRow: document.getElementById("clearSpaceOpacityRow"),
            clearSpaceOpacitySlider: document.getElementById("clearSpaceOpacitySlider"),
            clearSpaceOpacityValue: document.getElementById("clearSpaceOpacityValue"),

            // Actions
            btnGenerateGrid: document.getElementById("btnGenerateGrid"),
            btnGenerateClearSpace: document.getElementById("btnGenerateClearSpace"),

            // Footer
            footerStatus: document.getElementById("footerStatus")
        };
    }

    // --- Current State ---
    let currentGridType = "square";
    let selectionValid = false;

    /**
     * Update the selection status indicator.
     */
    function updateSelectionStatus(status, message, warnings) {
        // Update dot
        els.statusDot.className = "status-dot " + status;

        // Update text
        els.statusText.textContent = message;

        // Update warnings
        if (warnings && warnings.length > 0) {
            els.warningBar.classList.remove("hidden");
            els.warningText.textContent = warnings.join(" • ");
        } else {
            els.warningBar.classList.add("hidden");
        }

        // Enable/disable action buttons
        selectionValid = (status === "valid" || status === "warn");
        els.btnGenerateGrid.disabled = !selectionValid;
        els.btnGenerateClearSpace.disabled = !selectionValid || !els.clearSpaceToggle.checked;
    }

    /**
     * Set the active grid type and update UI.
     */
    function setGridType(type) {
        currentGridType = type;

        // Update button states
        els.gridTypeBtns.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.type === type);
        });

        // Show/hide circular controls
        const showCircular = (type === "circular" || type === "hybrid");
        els.circularControlsSection.classList.toggle("hidden", !showCircular);
    }

    /**
     * Get the current grid type.
     */
    function getGridType() {
        return currentGridType;
    }

    /**
     * Read all current settings from UI controls.
     */
    function getSettings() {
        return {
            gridType: currentGridType,
            density: parseInt(els.densitySlider.value, 10),
            opacity: parseInt(els.opacitySlider.value, 10),
            visible: els.visibilityToggle.checked,
            ringCount: parseInt(els.ringSlider.value, 10),
            showCenter: els.centerMarkerToggle.checked,
            clearSpaceEnabled: els.clearSpaceToggle.checked,
            clearSpaceUnit: els.clearSpaceUnit.value,
            clearSpaceOpacity: parseInt(els.clearSpaceOpacitySlider.value, 10)
        };
    }

    /**
     * Update the footer status message.
     */
    function setStatus(message) {
        els.footerStatus.textContent = message;
    }

    /**
     * Set loading state — disable buttons during generation.
     */
    function setLoading(loading) {
        els.btnGenerateGrid.disabled = loading || !selectionValid;
        els.btnGenerateClearSpace.disabled = loading || !selectionValid || !els.clearSpaceToggle.checked;

        if (loading) {
            els.btnGenerateGrid.textContent = "Generating…";
        } else {
            els.btnGenerateGrid.textContent = "Generate Grid";
        }
    }

    /**
     * Bind event listeners for all controls.
     */
    function bindEvents(callbacks) {
        // Grid type buttons
        els.gridTypeBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                setGridType(btn.dataset.type);
            });
        });

        // Density slider — live value display
        els.densitySlider.addEventListener("input", () => {
            els.densityValue.textContent = els.densitySlider.value;
        });

        // Opacity slider — live value display
        els.opacitySlider.addEventListener("input", () => {
            els.opacityValue.textContent = els.opacitySlider.value + "%";
        });

        // Ring slider — live value display
        els.ringSlider.addEventListener("input", () => {
            els.ringValue.textContent = els.ringSlider.value;
        });

        // Clear space toggle — show/hide sub-controls
        els.clearSpaceToggle.addEventListener("change", () => {
            const enabled = els.clearSpaceToggle.checked;
            els.clearSpaceUnitRow.classList.toggle("hidden", !enabled);
            els.clearSpaceOpacityRow.classList.toggle("hidden", !enabled);
            els.btnGenerateClearSpace.disabled = !enabled || !selectionValid;
        });

        // Clear space opacity slider — live value display
        els.clearSpaceOpacitySlider.addEventListener("input", () => {
            els.clearSpaceOpacityValue.textContent = els.clearSpaceOpacitySlider.value + "%";
        });

        // Generate Grid button
        els.btnGenerateGrid.addEventListener("click", () => {
            if (callbacks.onGenerateGrid) callbacks.onGenerateGrid();
        });

        // Generate Clear Space button
        els.btnGenerateClearSpace.addEventListener("click", () => {
            if (callbacks.onGenerateClearSpace) callbacks.onGenerateClearSpace();
        });

        // Visibility toggle — toggle grid layer visibility
        els.visibilityToggle.addEventListener("change", () => {
            if (callbacks.onToggleVisibility) {
                callbacks.onToggleVisibility(els.visibilityToggle.checked);
            }
        });
    }

    return {
        init,
        updateSelectionStatus,
        setGridType,
        getGridType,
        getSettings,
        setStatus,
        setLoading,
        bindEvents
    };
})();
