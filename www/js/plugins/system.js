//=============================================================================
// system.js - Title Screen Icons (RPG Maker MV)
//=============================================================================
/*:
 * @plugindesc Adds an icon to the left of each title command's text.
 * @author Claude
 *
 * @help
 * Put PNG files in img/system/ named to match the ICON_MAP below.
 * Keys MUST exactly match each command's symbol (the 2nd argument
 * passed to addCommand() in whatever plugin builds the title menu).
 * Any command not listed in ICON_MAP draws exactly as vanilla.
 * If an icon file is missing or fails to load, that row falls back
 * to normal text-only drawing instead of crashing.
 */
//=============================================================================
(() => {
    "use strict";

    // Map each command's symbol -> icon filename (in img/system/).
    // These keys must match the exact symbol strings your plugins use.
    const ICON_MAP = {
        newGame:  "NewGame",
        continue: "Continue",
  options:  "Settings",
language:  "Support",
        credits:  "Credits",
contact:  "Support",
        exitGame: "QuitGame"   // confirmed via ARP_TitleCommandExit.js -> addCommand(textExit, 'exitGame')
    };

    const ICON_WIDTH = 27;   // 36 reduced by 25%
    const ICON_HEIGHT = 27;  // 36 reduced by 25%

    // Fixed distance (px) from the window's left edge to where every label
    // starts, regardless of icon width. This is your "white line" — all
    // text aligns to it no matter which icon is drawn. Increase this if
    // you want more breathing room between icon and text, decrease it to
    // bring text closer to the icons. It must be >= ICON_WIDTH or icons
    // will overlap the text.
    const TEXT_INDENT = 40;

    // The command window is normally sized to fit the longest text label only,
    // with no allowance for an icon. That's why a long label like "Quit Game"
    // can leave the icon clipped against the window edge. This widens the
    // window to reserve space for the icon column so nothing gets cut off.
    if (typeof Scene_Title !== "undefined" && Scene_Title.prototype.commandWindowRect) {
        const _Scene_Title_commandWindowRect = Scene_Title.prototype.commandWindowRect;
        Scene_Title.prototype.commandWindowRect = function() {
            const rect = _Scene_Title_commandWindowRect.call(this);
            const extra = TEXT_INDENT;
            rect.x -= Math.floor(extra / 2);
            rect.width += extra;
            return rect;
        };
    }

    const iconBitmaps = {};
    for (const symbol in ICON_MAP) {
        iconBitmaps[symbol] = ImageManager.loadBitmap("img/system/", ICON_MAP[symbol]);
    }

    const _Window_TitleCommand_drawItem = Window_TitleCommand.prototype.drawItem;
    Window_TitleCommand.prototype.drawItem = function(index) {
        const symbol = this.commandSymbol(index);
        const iconBitmap = iconBitmaps[symbol];

        if (!iconBitmap) {
            _Window_TitleCommand_drawItem.call(this, index);
            return;
        }

        const rect = this.itemRectForText(index);
        // Force left alignment: the window's default alignment (often
        // "center") would center each label inside its box, and since box
        // width is fixed but label length varies, the visible left edge
        // shifts per row - that's what looked like "random" positioning.
        const align = "left";
        this.resetTextColor();
        this.changePaintOpacity(this.isCommandEnabled(index));

        const drawTextOnly = () => {
            // Falls back to the same fixed indent so text still lines up
            // with icon rows even if this row has no icon of its own.
            this.drawText(this.commandName(index), rect.x + TEXT_INDENT, rect.y, rect.width - TEXT_INDENT, align);
        };

        const bitmapOk = () =>
            iconBitmap && !iconBitmap.isError() &&
            iconBitmap.width > 0 && iconBitmap.height > 0;

        const drawIconAndText = () => {
            const iconY = rect.y + (rect.height - ICON_HEIGHT) / 2;
            try {
                this.contents.blt(
                    iconBitmap, 0, 0, iconBitmap.width, iconBitmap.height,
                    rect.x, iconY, ICON_WIDTH, ICON_HEIGHT
                );
            } catch (e) {
                drawTextOnly();
                return;
            }
            // Text always starts at the same fixed line, not relative to
            // this icon's width - so every row aligns identically.
            const textX = rect.x + TEXT_INDENT;
            const textWidth = rect.width - TEXT_INDENT;
            this.drawText(this.commandName(index), textX, rect.y, textWidth, align);
        };

        if (iconBitmap.isReady()) {
            bitmapOk() ? drawIconAndText() : drawTextOnly();
        } else {
            iconBitmap.addLoadListener(() => {
                this.contents.clearRect(rect.x, rect.y, rect.width, rect.height);
                bitmapOk() ? drawIconAndText() : drawTextOnly();
            });
        }
    };
})();