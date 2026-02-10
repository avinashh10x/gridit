/**
 * Gridly — Selection & Validation
 * 
 * Detects and validates the user's selection in Illustrator.
 * Ensures a single vector artwork is selected before grid generation.
 */

const GridlySelection = (() => {

    // Status constants
    const STATUS = {
        VALID: "valid",
        WARN: "warn",
        ERROR: "error",
        IDLE: "idle"
    };

    /**
     * Validate the current selection.
     * 
     * Returns: {
     *   status: "valid" | "warn" | "error" | "idle",
     *   message: string,
     *   warnings: string[],
     *   bounds: [left, top, right, bottom] | null
     * }
     */
    function validateSelection() {
        const result = {
            status: STATUS.IDLE,
            message: "No artwork selected",
            warnings: [],
            bounds: null
        };

        // Check if a document is open
        if (app.documents.length === 0) {
            result.status = STATUS.ERROR;
            result.message = "No document is open";
            return result;
        }

        const doc = app.activeDocument;
        const sel = doc.selection;

        // No selection
        if (!sel || sel.length === 0) {
            result.status = STATUS.IDLE;
            result.message = "Select a logo artwork";
            return result;
        }

        // Multiple objects selected — warn but allow (they can group first)
        if (sel.length > 1) {
            result.status = STATUS.WARN;
            result.message = "Multiple objects selected";
            result.warnings.push("Tip: Group your logo (Cmd+G) for best results");
            // Still calculate bounds for the entire selection
            result.bounds = getSelectionBounds(sel);
            return result;
        }

        const item = sel[0];

        // Check for raster artwork
        if (item.typename === "RasterItem") {
            result.status = STATUS.ERROR;
            result.message = "Raster artwork not supported";
            result.warnings.push("Select vector artwork only");
            return result;
        }

        // Check for live text
        if (item.typename === "TextFrame") {
            result.status = STATUS.WARN;
            result.message = "Live text detected";
            result.warnings.push("Convert text to outlines for accuracy");
            result.bounds = item.geometricBounds;
            return result;
        }

        // Check for placed items (linked images, etc.)
        if (item.typename === "PlacedItem") {
            result.status = STATUS.ERROR;
            result.message = "Placed image not supported";
            result.warnings.push("Use embedded vector artwork");
            return result;
        }

        // Valid vector selection
        result.status = STATUS.VALID;
        result.message = "Ready to generate";
        result.bounds = item.geometricBounds;

        // Check if it's a very complex path
        if (item.typename === "CompoundPathItem" || item.typename === "GroupItem") {
            const itemCount = countNestedItems(item);
            if (itemCount > 200) {
                result.warnings.push("Complex logo — grid may not align perfectly");
            }
        }

        return result;
    }

    /**
     * Calculate the bounding box for a multi-object selection.
     * Returns [left, top, right, bottom].
     */
    function getSelectionBounds(selection) {
        let minX = Infinity, maxY = -Infinity, maxX = -Infinity, minY = Infinity;

        for (let i = 0; i < selection.length; i++) {
            const b = selection[i].geometricBounds;
            if (b[0] < minX) minX = b[0];
            if (b[1] > maxY) maxY = b[1];
            if (b[2] > maxX) maxX = b[2];
            if (b[3] < minY) minY = b[3];
        }

        return [minX, maxY, maxX, minY];
    }

    /**
     * Count nested items in a group or compound path (rough estimate).
     */
    function countNestedItems(item) {
        if (item.typename === "GroupItem") {
            let count = 0;
            for (let i = 0; i < item.pageItems.length; i++) {
                count += countNestedItems(item.pageItems[i]);
            }
            return count;
        }
        return 1;
    }

    /**
     * Quick check — is there a valid selection to work with?
     */
    function hasValidSelection() {
        const result = validateSelection();
        return result.status === STATUS.VALID || result.status === STATUS.WARN;
    }

    return {
        STATUS,
        validateSelection,
        getSelectionBounds,
        hasValidSelection
    };
})();
