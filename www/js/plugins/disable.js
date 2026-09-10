(function() {
    "use strict";

    // Disable all RPG Maker MV touch processing
    TouchInput.update = function() {
        // Completely disabled
    };

    // Prevent map touch movement
    if (typeof Scene_Map !== "undefined") {
        Scene_Map.prototype.processMapTouch = function() {
            // Completely disabled
        };
    }

})();