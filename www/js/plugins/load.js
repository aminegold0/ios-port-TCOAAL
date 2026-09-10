//=============================================================================
// load.js
//=============================================================================

/*:
 * @target MZ MV
 * @plugindesc Shows img/system/Loading.png as the very first thing when the
 * game opens, before the engine finishes booting. Fails silently if missing.
 * Waits for the disclaimer screen (screen.js) to finish before starting.
 * @author Claude
 *
 * @param imageName
 * @text Image File Name
 * @desc Name of the image file inside img/system/ (no extension).
 * @default Loading
 *
 * @param backgroundColor
 * @text Background Color
 * @desc CSS color to fill behind/around the image while it shows.
 * @default #000000
 *
 * @param blackScreenTime
 * @text Black Screen Duration (ms)
 * @desc How long to show a plain black (or backgroundColor) screen before the image appears.
 * @default 1000
 *
 * @param imageDisplayTime
 * @text Image Display Duration (ms)
 * @desc How long to show the image itself after the black screen.
 * @default 3000
 *
 * @help CustomLoadingImage.js
 *
 * This plugin ONLY handles Loading.png. It does not touch NewGame.png or
 * any other missing image — those are separate issues elsewhere.
 *
 * WHAT IT DOES
 * -------------------------------------------------------------------------
 * Instead of loading the image through the engine's normal asset pipeline
 * (which only shows it partway through boot, after other setup work),
 * this plugin inserts it directly into the page as plain HTML the moment
 * this script file itself runs — which happens before Scene_Boot, before
 * the title screen, before anything else the engine does. That makes it
 * the literal first thing the player sees when the game opens.
 *
 * Sequence:
 *   1. Plain black screen for blackScreenTime (default 1000ms / 1 second)
 *   2. Loading.png fades in and stays for imageDisplayTime (default 3000ms / 3 seconds)
 *   3. Overlay fades out and is removed
 *
 * This timing runs on its own fixed schedule, independent of how fast the
 * game actually finishes booting underneath it.
 *
 * If img/system/Loading.png is missing or fails to load, the overlay is
 * skipped entirely — it will never crash or block the game from starting.
 *
 * WAITING FOR DISCLAIMER SCREEN
 * -------------------------------------------------------------------------
 * If screen.js (DisclaimerScreen.js) is enabled and placed above this plugin
 * in the Plugin Manager, this plugin will automatically wait for it to finish
 * before starting its own loading image sequence. The disclaimer screen sets
 * window.$disclaimerScreenDone = true when dismissed, and this plugin checks
 * that flag before proceeding.
 *
 * SETUP
 * -------------------------------------------------------------------------
 * 1. Place Loading.png inside: www/img/system/Loading.png
 * 2. Add this plugin in the Plugin Manager and turn it ON.
 * 3. For best results, move it to the TOP of your plugin list (but BELOW
 *    screen.js if you're using that), so it runs early and waits for the
 *    disclaimer screen if present.
 *
 * No plugin commands. Just enable it.
 *
 * @noEditable
 */

(() => {
    'use strict';

    const pluginName = 'CustomLoadingImage';
    const parameters = PluginManager.parameters(pluginName);
    const imageName = String(parameters['imageName'] || 'Loading');
    const bgColor = String(parameters['backgroundColor'] || '#000000');
    const blackScreenTime = Math.max(0, Number(parameters['blackScreenTime'] || 1000));
    const imageDisplayTime = Math.max(0, Number(parameters['imageDisplayTime'] || 3000));

    let overlay = null;
    let img = null;
    let removed = false;
    let failed = false;

    // -------------------------------------------------------------------
    // Hide EVERYTHING else on the page while our overlay is showing - not
    // just game-loop updates. This catches DOM/canvas elements that are
    // unrelated to SceneManager (e.g. mobile d-pad / touch-control
    // buttons some plugins inject directly into the page), which would
    // otherwise still be visible even with the update loop frozen.
    // -------------------------------------------------------------------
    const hiddenElements = new Map(); // element -> previous inline display value
    let hideObserver = null;

    function hideElement(el) {
        if (el === overlay || hiddenElements.has(el)) return;
        hiddenElements.set(el, el.style.display);
        el.style.display = 'none';
    }

    function hideEverythingElse() {
        Array.from(document.body.children).forEach(hideElement);

        // Catch anything added to the page AFTER our overlay goes up
        // (e.g. a d-pad plugin that injects its buttons a moment later).
        hideObserver = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                m.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node !== overlay) {
                        hideElement(node);
                    }
                });
            });
        });
        hideObserver.observe(document.body, { childList: true });
    }

    function restoreEverything() {
        if (hideObserver) {
            hideObserver.disconnect();
            hideObserver = null;
        }
        hiddenElements.forEach((prevDisplay, el) => {
            el.style.display = prevDisplay;
        });
        hiddenElements.clear();
    }

    function buildOverlay() {
        try {
            overlay = document.createElement('div');
            overlay.id = 'customLoadingImageOverlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = bgColor;
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '99999';
            overlay.style.transition = 'opacity 0.4s ease';

            img = document.createElement('img');
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.4s ease';

            img.onerror = () => {
                // Missing/broken file: skip silently, never block the game.
                failed = true;
                removeOverlay(true);
            };

            overlay.appendChild(img);

            const attach = () => {
                if (document.body) {
                    document.body.appendChild(overlay);
                    hideEverythingElse();
                    runSequence();
                } else {
                    // DOM not ready yet, try again very shortly.
                    setTimeout(attach, 1);
                }
            };
            attach();
        } catch (e) {
            console.warn(`[${pluginName}] Could not display loading image — skipping.`, e);
            removed = true;
        }
    }

    function runSequence() {
        // Phase 1: plain black (or backgroundColor) screen only.
        setTimeout(() => {
            if (failed || removed) return;
            // Phase 2: reveal the image (assign src now so it wasn't even
            // fetched-and-flashed during the black phase).
            img.src = `img/system/${imageName}.png`;
            img.style.opacity = '1';

            setTimeout(() => {
                removeOverlay(false);
            }, imageDisplayTime);
        }, blackScreenTime);
    }

    function removeOverlay(instant) {
        if (removed || !overlay) {
            removed = true;
            return;
        }
        removed = true;

        const doRemove = () => {
            try {
                if (overlay && overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            } catch (e) {
                // no-op
            }
        };

        if (instant) {
            doRemove();
            restoreEverything();
            blocking = false;
            return;
        }

        overlay.style.opacity = '0';
        setTimeout(() => {
            doRemove();
            restoreEverything();
            blocking = false;
        }, 400);
    }

    // -------------------------------------------------------------------
    // Freeze the game loop while the disclaimer screen is showing OR while
    // our loading image overlay is showing.
    //
    // Plugin *files* still get parsed/registered as normal — that happens
    // automatically as the browser loads each script tag and can't be
    // paused from inside a single plugin. What this DOES stop is the
    // actual game engine from progressing (scene updates, input handling,
    // animations, d-pad, and therefore every plugin's runtime/update behavior)
    // until both the disclaimer screen AND our black-screen + image sequence
    // have fully finished.
    // -------------------------------------------------------------------
    let blocking = true;

    const _SceneManager_update = SceneManager.update.bind(SceneManager);
    SceneManager.update = function() {
        // Keep blocking while:
        //   1. The disclaimer screen is still showing ($disclaimerScreenDone is false/undefined)
        //   2. Our loading image overlay is still showing (blocking flag is true)
        const disclaimerStillShowing = window.$disclaimerScreenDone !== true;
        if (blocking || disclaimerStillShowing) {
            // IMPORTANT: the real update() also re-schedules the next
            // animation frame at the end of itself. If we just "return"
            // here without doing that, the frame loop dies completely and
            // never comes back — which is what caused the permanent stuck
            // black screen. So keep the loop alive, just skip the actual
            // scene/game logic for this frame.
            if (typeof this.requestUpdate === 'function') {
                this.requestUpdate();
            } else {
                requestAnimationFrame(SceneManager.update.bind(SceneManager));
            }
            return;
        }
        _SceneManager_update();
    };

    // Wait for the disclaimer screen to finish (if present) before starting
    // the loading image sequence.
    function waitForDisclaimerAndStart() {
        if (window.$disclaimerScreenDone === true) {
            // Disclaimer screen either finished or wasn't shown - start now.
            buildOverlay();
        } else {
            // Poll for the disclaimer screen to finish.
            requestAnimationFrame(waitForDisclaimerAndStart);
        }
    }

    // Run immediately as the script is parsed — before Scene_Boot exists.
    // But wait for screen.js to finish first if it's present.
    waitForDisclaimerAndStart();

})();