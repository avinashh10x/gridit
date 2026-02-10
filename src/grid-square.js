/**
 * Gridly — Square / Modular Grid Generator
 * 
 * Generates a uniform vertical + horizontal line grid based on
 * the selected artwork's bounding box and user-specified density.
 */

const GridlySquare = (() => {

    /**
     * Generate a square (modular) grid.
     * 
     * @param {number[]} bounds - [left, top, right, bottom] geometric bounds
     * @param {number} density - Number of grid divisions (2–20)
     * @param {number} opacity - Grid opacity (0–100)
     * @returns {object} The grid group item
     */
    function generate(bounds, density, opacity) {
        const doc = GridlyLayers.getDoc();
        const layer = GridlyLayers.prepareGridLayer();
        const rect = GridlyUtils.boundsToRect(bounds);

        const strokeColor = GridlyUtils.gridColor();
        const strokeWidth = 0.5;
        const aiOpacity = GridlyUtils.opacityToAI(opacity);

        // Calculate grid spacing
        const cellWidth = rect.width / density;
        const cellHeight = rect.height / density;

        // Extension beyond bounds for presentation
        const extend = Math.max(rect.width, rect.height) * 0.15;

        const items = [];

        // --- Vertical lines ---
        for (let i = 0; i <= density; i++) {
            const x = rect.left + i * cellWidth;
            const y1 = rect.top + extend;
            const y2 = rect.bottom - extend;

            const line = doc.pathItems.add();
            line.setEntirePath([
                [x, y1],
                [x, y2]
            ]);
            line.stroked = true;
            line.strokeColor = strokeColor;
            line.strokeWidth = strokeWidth;
            line.filled = false;
            line.opacity = aiOpacity;
            line.move(layer, ElementPlacement.PLACEATEND);
            items.push(line);
        }

        // --- Horizontal lines ---
        for (let i = 0; i <= density; i++) {
            const y = rect.top - i * cellHeight;
            const x1 = rect.left - extend;
            const x2 = rect.right + extend;

            const line = doc.pathItems.add();
            line.setEntirePath([
                [x1, y],
                [x2, y]
            ]);
            line.stroked = true;
            line.strokeColor = strokeColor;
            line.strokeWidth = strokeWidth;
            line.filled = false;
            line.opacity = aiOpacity;
            line.move(layer, ElementPlacement.PLACEATEND);
            items.push(line);
        }

        // --- Bounding box outline ---
        const outline = doc.pathItems.rectangle(
            rect.top, rect.left, rect.width, rect.height
        );
        outline.stroked = true;
        outline.strokeColor = strokeColor;
        outline.strokeWidth = 0.75;
        outline.filled = false;
        outline.opacity = aiOpacity;
        outline.move(layer, ElementPlacement.PLACEATEND);
        items.push(outline);

        // Group all items
        const group = doc.groupItems.add();
        group.name = "Square Grid";
        group.move(layer, ElementPlacement.PLACEATEND);
        for (let i = 0; i < items.length; i++) {
            items[i].move(group, ElementPlacement.PLACEATEND);
        }

        // Lock layer
        layer.locked = true;

        return group;
    }

    return { generate };
})();
