/**
 * Gridly — Layer Management
 * 
 * Creates, finds, clears, and locks layers in the active Illustrator document.
 */

const GridlyLayers = (() => {
    const GRID_LAYER_NAME = "Gridly — Grid";
    const CLEARSPACE_LAYER_NAME = "Gridly — Clear Space";

    /**
     * Get the active document. Throws if none open.
     */
    function getDoc() {
        if (app.documents.length === 0) {
            throw new Error("No document is open.");
        }
        return app.activeDocument;
    }

    /**
     * Find a layer by name, returns null if not found.
     */
    function findLayer(doc, name) {
        for (let i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === name) {
                return doc.layers[i];
            }
        }
        return null;
    }

    /**
     * Get an existing layer or create a new one.
     * New layers are added at the top of the layer stack.
     */
    function getOrCreateLayer(name) {
        const doc = getDoc();
        let layer = findLayer(doc, name);

        if (layer) {
            // Unlock to allow modifications
            layer.locked = false;
            return layer;
        }

        // Create new layer
        layer = doc.layers.add();
        layer.name = name;
        layer.locked = false;
        return layer;
    }

    /**
     * Remove all page items from a layer.
     */
    function clearLayer(name) {
        const doc = getDoc();
        const layer = findLayer(doc, name);
        if (!layer) return;

        // Unlock before clearing
        layer.locked = false;

        // Remove all items (iterate backwards)
        while (layer.pageItems.length > 0) {
            layer.pageItems[0].remove();
        }
    }

    /**
     * Lock or unlock a layer by name.
     */
    function setLayerLocked(name, locked) {
        const doc = getDoc();
        const layer = findLayer(doc, name);
        if (layer) {
            layer.locked = locked;
        }
    }

    /**
     * Check if a layer exists.
     */
    function layerExists(name) {
        const doc = getDoc();
        return findLayer(doc, name) !== null;
    }

    /**
     * Toggle visibility of a layer.
     */
    function setLayerVisible(name, visible) {
        const doc = getDoc();
        const layer = findLayer(doc, name);
        if (layer) {
            layer.locked = false;
            layer.visible = visible;
            layer.locked = true;
        }
    }

    /**
     * Get the Grid layer (create if needed, clear old content).
     */
    function prepareGridLayer() {
        clearLayer(GRID_LAYER_NAME);
        return getOrCreateLayer(GRID_LAYER_NAME);
    }

    /**
     * Get the Clear Space layer (create if needed, clear old content).
     */
    function prepareClearSpaceLayer() {
        clearLayer(CLEARSPACE_LAYER_NAME);
        return getOrCreateLayer(CLEARSPACE_LAYER_NAME);
    }

    /**
     * Lock both output layers after generation.
     */
    function lockOutputLayers() {
        setLayerLocked(GRID_LAYER_NAME, true);
        setLayerLocked(CLEARSPACE_LAYER_NAME, true);
    }

    return {
        GRID_LAYER_NAME,
        CLEARSPACE_LAYER_NAME,
        getDoc,
        getOrCreateLayer,
        clearLayer,
        setLayerLocked,
        setLayerVisible,
        layerExists,
        prepareGridLayer,
        prepareClearSpaceLayer,
        lockOutputLayers
    };
})();
