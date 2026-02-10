/**
 * Gridly — Plugin Entry Point
 * 
 * Registers the UXP panel, initializes UI, and connects
 * the generation pipeline: Selection → Validation → Generation.
 */

(function () {
    "use strict";

    // Selection polling interval (ms)
    const POLL_INTERVAL = 1000;
    let pollTimer = null;

    /**
     * Initialize the plugin when the panel is shown.
     */
    function onPanelShow() {
        // Initialize UI
        GridlyUI.init();

        // Bind UI events
        GridlyUI.bindEvents({
            onGenerateGrid: handleGenerateGrid,
            onGenerateClearSpace: handleGenerateClearSpace,
            onToggleVisibility: handleToggleVisibility
        });

        // Start polling for selection changes
        startSelectionPolling();

        // Initial selection check
        checkSelection();

        GridlyUI.setStatus("Ready");
    }

    /**
     * Cleanup when panel is hidden.
     */
    function onPanelHide() {
        stopSelectionPolling();
    }

    // --- Selection Polling ---

    function startSelectionPolling() {
        stopSelectionPolling();
        pollTimer = setInterval(checkSelection, POLL_INTERVAL);
    }

    function stopSelectionPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    /**
     * Check current selection and update UI status.
     */
    function checkSelection() {
        try {
            const result = GridlySelection.validateSelection();
            GridlyUI.updateSelectionStatus(
                result.status,
                result.message,
                result.warnings
            );
        } catch (e) {
            GridlyUI.updateSelectionStatus(
                "error",
                "Cannot read selection",
                [e.message]
            );
        }
    }

    // --- Grid Generation ---

    function handleGenerateGrid() {
        try {
            const validation = GridlySelection.validateSelection();
            if (!validation.bounds) {
                GridlyUI.setStatus("No valid selection");
                return;
            }

            GridlyUI.setLoading(true);
            GridlyUI.setStatus("Generating grid…");

            const settings = GridlyUI.getSettings();
            const bounds = validation.bounds;

            // Generate based on selected grid type
            switch (settings.gridType) {
                case "square":
                    GridlySquare.generate(bounds, settings.density, settings.opacity);
                    break;
                case "circular":
                    GridlyCircular.generate(
                        bounds,
                        settings.ringCount,
                        settings.opacity,
                        settings.showCenter
                    );
                    break;
                case "hybrid":
                    GridlyHybrid.generate(
                        bounds,
                        settings.density,
                        settings.ringCount,
                        settings.opacity,
                        settings.showCenter
                    );
                    break;
            }

            GridlyUI.setStatus("Grid generated ✓");
        } catch (e) {
            GridlyUI.setStatus("Error: " + e.message);
            console.error("Gridly — Grid generation error:", e);
        } finally {
            GridlyUI.setLoading(false);
        }
    }

    function handleGenerateClearSpace() {
        try {
            const validation = GridlySelection.validateSelection();
            if (!validation.bounds) {
                GridlyUI.setStatus("No valid selection");
                return;
            }

            GridlyUI.setStatus("Generating clear space…");

            const settings = GridlyUI.getSettings();
            GridlyClearSpace.generate(
                validation.bounds,
                settings.clearSpaceUnit,
                settings.clearSpaceOpacity
            );

            GridlyUI.setStatus("Clear space generated ✓");
        } catch (e) {
            GridlyUI.setStatus("Error: " + e.message);
            console.error("Gridly — Clear space error:", e);
        }
    }

    function handleToggleVisibility(visible) {
        try {
            if (GridlyLayers.layerExists(GridlyLayers.GRID_LAYER_NAME)) {
                GridlyLayers.setLayerVisible(GridlyLayers.GRID_LAYER_NAME, visible);
            }
            GridlyUI.setStatus(visible ? "Grid visible" : "Grid hidden");
        } catch (e) {
            GridlyUI.setStatus("Error toggling visibility");
        }
    }

    // --- UXP Panel Registration ---

    /**
     * UXP entrypoint setup.
     * The `entrypoints` global is provided by the UXP runtime.
     */
    if (typeof entrypoints !== "undefined") {
        entrypoints.setup({
            panels: {
                gridlyPanel: {
                    show: onPanelShow,
                    hide: onPanelHide
                }
            }
        });
    } else {
        // Fallback for development/debugging outside UXP
        document.addEventListener("DOMContentLoaded", () => {
            console.log("Gridly: Running in development mode (no UXP runtime)");
            // Initialize UI in dev mode
            GridlyUI.init();
            GridlyUI.bindEvents({
                onGenerateGrid: () => console.log("Generate Grid clicked", GridlyUI.getSettings()),
                onGenerateClearSpace: () => console.log("Generate Clear Space clicked", GridlyUI.getSettings()),
                onToggleVisibility: (v) => console.log("Visibility:", v)
            });
            GridlyUI.updateSelectionStatus("idle", "Dev mode — no Illustrator", []);
            GridlyUI.setStatus("Development mode");
        });
    }
})();
