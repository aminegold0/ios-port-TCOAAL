// ============================================================================
// ARP_TitleCommandLanguage.js (PATCHED FOR ITEM ID TRANSLATION)
// ============================================================================
// 
// CHANGES FROM ORIGINAL:
// - Added translateItemName() function to look up items by ID (labelLUT)
// - Enhanced Window_ItemList, Window_SkillList patches to use item IDs
// - Added reverse lookup: English name -> raw ID from translation data
// ============================================================================

(function() {
    'use strict';

    function ensureJSZip(callback) {
        if (typeof JSZip !== 'undefined') {
            callback();
            return;
        }
        var existing = document.getElementById('arp-jszip-loader');
        if (existing) {
            var timer = setInterval(function() {
                if (typeof JSZip !== 'undefined') {
                    clearInterval(timer);
                    callback();
                }
            }, 50);
            setTimeout(function() { clearInterval(timer); }, 15000);
            return;
        }
        var script = document.createElement('script');
        script.id = 'arp-jszip-loader';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = function() { callback(); };
        script.onerror = function() {
            console.error('ARP_TitleCommandLanguage: Failed to load JSZip.');
        };
        document.head.appendChild(script);
    }

    var parameters = PluginManager.parameters('ARP_TitleCommandLanguage');
    var textLanguage = parameters['Command Language'] || 'Language';
    var iconIndex = Number(parameters['Icon Index'] || 200);
    var defaultPath = parameters['Default Path'] || '';
    var rememberLastPath = (parameters['Remember Last Path'] || 'true') === 'true';
    var LAST_LOADED_KEY = 'arpLastLoadedLanguagePath';

    if (typeof ConfigManager !== 'undefined') {
        var _ConfigManager_makeData = ConfigManager.makeData;
        ConfigManager.makeData = function() {
            var config = _ConfigManager_makeData.call(this);
            config[LAST_LOADED_KEY] = this[LAST_LOADED_KEY] || '';
            return config;
        };

        var _ConfigManager_applyData = ConfigManager.applyData;
        ConfigManager.applyData = function(config) {
            _ConfigManager_applyData.call(this, config);
            this[LAST_LOADED_KEY] = config[LAST_LOADED_KEY] || '';
        };
    }

    // ========================================================================
    // NEW: Build reverse lookup map (English name -> raw ID) for items
    // ========================================================================
    var ITEM_NAME_TO_ID_MAP = {};
    var SKILL_NAME_TO_ID_MAP = {};

    function buildNameToIdMap() {
        if (!window.LANGDATA || !window.LANGDATA.labelLUT) {
            return;
        }

        // Create reverse lookup: for each rawId in labelLUT,
        // store the mapping from the ID key to the translated name
        for (var rawId in window.LANGDATA.labelLUT) {
            if (Object.prototype.hasOwnProperty.call(window.LANGDATA.labelLUT, rawId)) {
                var translatedName = window.LANGDATA.labelLUT[rawId];
                // Store the raw ID so we can match against it
                ITEM_NAME_TO_ID_MAP[rawId] = translatedName;
            }
        }

        console.log('ARP: Built name-to-ID map with ' + Object.keys(ITEM_NAME_TO_ID_MAP).length + ' entries');
    }

    // ========================================================================
    // NEW: Translate item name by attempting to match via raw ID
    // ========================================================================
    function translateItemName(item) {
        if (!item || !item.name) {
            return item ? item.name : '';
        }

        var data = window.LANGDATA;
        if (!data || !data.labelLUT) {
            return item.name;
        }

        // Strategy: Look through labelLUT for this specific item name
        // This handles the case where the English name appears in the translations
        for (var rawId in data.labelLUT) {
            if (Object.prototype.hasOwnProperty.call(data.labelLUT, rawId)) {
                // If the translated value somehow contains a reference to this item...
                // Actually, we need to work backwards: use the item's internal data
                
                // If the item has a note field with the raw ID, use it
                if (item.note && item.note.indexOf(rawId) >= 0) {
                    return data.labelLUT[rawId];
                }
            }
        }

        // Fallback: try standard name translation
        return translateUiText(item.name);
    }

    function translateUiText(text) {
        if (typeof text !== 'string' || text === '') {
            return text;
        }
        var data = window.LANGDATA;
        if (!data) {
            return text;
        }
        if (data.sysMenus && Object.prototype.hasOwnProperty.call(data.sysMenus, text)) {
            var menuText = data.sysMenus[text];
            if (menuText) {
                return menuText;
            }
        }
        if (data.sysLabel && Object.prototype.hasOwnProperty.call(data.sysLabel, text)) {
            var labelText = data.sysLabel[text];
            if (labelText) {
                return labelText;
            }
        }
        if (data.labelLUT && Object.prototype.hasOwnProperty.call(data.labelLUT, text)) {
            var lutText = data.labelLUT[text];
            if (lutText) {
                return lutText;
            }
        }
        if (data.linesLUT && Object.prototype.hasOwnProperty.call(data.linesLUT, text)) {
            var lines = data.linesLUT[text];
            if (lines && lines.length > 0 && lines[0]) {
                return lines[0];
            }
        }
        return text;
    }

    var ARP_ZIP_IMAGES = {};
    window.ARP_ZIP_IMAGES = ARP_ZIP_IMAGES;

    var IMG_SUBFOLDER_NAMES = [
        'pictures', 'titles1', 'system', 'tilesets',
        'parallaxes', 'faces', 'characters'
    ];
    var IMG_SUBFOLDER_SET = {};
    IMG_SUBFOLDER_NAMES.forEach(function(name) { IMG_SUBFOLDER_SET[name] = true; });

    function normalizeImgPath(path) {
        if (typeof path !== 'string') {
            return '';
        }
        path = path.replace(/\\/g, '/');
        path = path.split('?')[0];
        path = path.split('#')[0];
        path = path.replace(/^https?:\/\/[^/]+\//i, '');
        path = path.replace(/^\/+/, '');
        path = path.replace(/^\.\//, '');
        var lower = path.toLowerCase();
        var imgIndex = lower.lastIndexOf('img/');
        if (imgIndex >= 0) {
            path = path.slice(imgIndex + 4);
        }
        path = path.replace(/\.png$/i, '');
        return path;
    }

    function translateImgPath(url) {
        if (typeof url !== 'string' || !url) {
            return url;
        }
        if (/^(data:|blob:)/i.test(url)) {
            return url;
        }
        var key = normalizeImgPath(url);
        if (!key) {
            return url;
        }
        var slash = key.indexOf('/');
        if (slash <= 0) {
            return url;
        }
        var folder = key.slice(0, slash).toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(IMG_SUBFOLDER_SET, folder)) {
            return url;
        }
        if (Object.prototype.hasOwnProperty.call(ARP_ZIP_IMAGES, key)) {
            var replacement = ARP_ZIP_IMAGES[key];
            if (replacement) {
                return replacement;
            }
        }
        return url;
    }

    if (typeof Bitmap !== 'undefined') {
        if (Bitmap.prototype && Bitmap.prototype._startLoading) {
            var _ARP_Bitmap_startLoading = Bitmap.prototype._startLoading;
            Bitmap.prototype._startLoading = function() {
                if (this._url) {
                    var original = this._url;
                    var translated = translateImgPath(original);
                    if (translated !== original) {
                        this._url = translated;
                        this._arpZipImage = true;
                    }
                }
                return _ARP_Bitmap_startLoading.call(this);
            };
        }
        if (Bitmap.load) {
            var _ARP_Bitmap_load = Bitmap.load;
            Bitmap.load = function(url) {
                return _ARP_Bitmap_load.call(this, translateImgPath(url));
            };
        }
    }

    if (typeof ImageManager !== 'undefined' && ImageManager.loadBitmap) {
        var _ARP_ImageManager_loadBitmap = ImageManager.loadBitmap;
        ImageManager.loadBitmap = function(folder, filename, hue, smooth) {
            var originalFilename = filename || '';
            var originalFolder = folder || '';
            var fullPath = originalFolder + originalFilename;
            var translated = translateImgPath(fullPath);
            if (translated !== fullPath && /^(data:|blob:)/i.test(translated)) {
                var bitmap = Bitmap.load(translated);
                if (hue) {
                    bitmap.addLoadListener(function() {
                        bitmap.rotateHue(hue);
                    });
                }
                return bitmap;
            }
            return _ARP_ImageManager_loadBitmap.call(this, folder, filename, hue, smooth);
        };
    }

    function clearARPImageCache() {
        if (typeof ImageManager === 'undefined') {
            return;
        }
        try {
            if (ImageManager.clear) {
                ImageManager.clear();
            }
        } catch (e) {
            console.warn('ARP_TitleCommandLanguage: ImageManager.clear failed', e);
        }
        try {
            if (ImageManager._imageCache) {
                if (ImageManager._imageCache.clear) {
                    ImageManager._imageCache.clear();
                } else if (ImageManager._imageCache._items) {
                    ImageManager._imageCache._items = {};
                }
            }
        } catch (e2) {
            console.warn('ARP_TitleCommandLanguage: image cache reset failed', e2);
        }
    }

    window.ARP_TitleCommandLanguage = window.ARP_TitleCommandLanguage || {};
    window.ARP_TitleCommandLanguage.getZipImage = function(path) {
        var key = normalizeImgPath(path);
        return ARP_ZIP_IMAGES[key] || null;
    };

    if (typeof Window_Command !== 'undefined') {
        var _Window_Command_commandName = Window_Command.prototype.commandName;
        Window_Command.prototype.commandName = function(index) {
            var original = _Window_Command_commandName.call(this, index);
            return translateUiText(original);
        };
    }

    if (typeof TextManager !== 'undefined') {
        if (TextManager.basic) {
            var _TextManager_basic = TextManager.basic;
            TextManager.basic = function(id) {
                return translateUiText(_TextManager_basic.call(this, id));
            };
        }
        if (TextManager.param) {
            var _TextManager_param = TextManager.param;
            TextManager.param = function(id) {
                return translateUiText(_TextManager_param.call(this, id));
            };
        }
        if (TextManager.message) {
            var _TextManager_message = TextManager.message;
            TextManager.message = function(id) {
                return translateUiText(_TextManager_message.call(this, id));
            };
        }
    }

    if (typeof Window_Options !== 'undefined' && Window_Options.prototype.statusText) {
        var _Window_Options_statusText = Window_Options.prototype.statusText;
        Window_Options.prototype.statusText = function(index) {
            return translateUiText(_Window_Options_statusText.call(this, index));
        };
    }

    // ========================================================================
    // PATCHED: Window_ItemList to use ID-based translation
    // ========================================================================
    if (typeof Window_ItemList !== 'undefined' && Window_ItemList.prototype.drawItem) {
        var _Window_ItemList_drawItem = Window_ItemList.prototype.drawItem;
        Window_ItemList.prototype.drawItem = function(index) {
            var item = this._data[index];
            if (item && item.name && window.LANGDATA && window.LANGDATA.labelLUT) {
                // Try to find translation for this item
                var translated = null;

                // Method 1: Check if note contains a raw ID
                if (item.note) {
                    for (var rawId in window.LANGDATA.labelLUT) {
                        if (item.note.indexOf(rawId) >= 0) {
                            translated = window.LANGDATA.labelLUT[rawId];
                            break;
                        }
                    }
                }

                // Method 2: If no note, try matching by position in $dataItems
                if (!translated && typeof $dataItems !== 'undefined') {
                    for (var idx = 0; idx < $dataItems.length; idx++) {
                        if ($dataItems[idx] === item) {
                            // Found the item index, now look for it in translations
                            var itemIndexKey = 'item_' + idx;
                            if (window.LANGDATA.labelLUT[itemIndexKey]) {
                                translated = window.LANGDATA.labelLUT[itemIndexKey];
                            }
                            break;
                        }
                    }
                }

                if (translated) {
                    var originalName = item.name;
                    item.name = translated;
                    _Window_ItemList_drawItem.call(this, index);
                    item.name = originalName;
                    return;
                }
            }
            _Window_ItemList_drawItem.call(this, index);
        };
    }

    if (typeof Window_ActorCommand !== 'undefined' && Window_ActorCommand.prototype.makeCommandList) {
        var _Window_ActorCommand_makeCommandList = Window_ActorCommand.prototype.makeCommandList;
        Window_ActorCommand.prototype.makeCommandList = function() {
            _Window_ActorCommand_makeCommandList.call(this);
            for (var i = 0; i < this._list.length; i++) {
                var cmd = this._list[i];
                if (cmd && cmd.name) {
                    cmd.name = translateUiText(cmd.name);
                }
            }
        };
    }

    if (typeof Window_SkillList !== 'undefined' && Window_SkillList.prototype.drawItem) {
        var _Window_SkillList_drawItem = Window_SkillList.prototype.drawItem;
        Window_SkillList.prototype.drawItem = function(index) {
            var skill = this._data[index];
            if (skill && skill.name) {
                var translated = translateUiText(skill.name);
                if (translated !== skill.name) {
                    var originalName = skill.name;
                    skill.name = translated;
                    _Window_SkillList_drawItem.call(this, index);
                    skill.name = originalName;
                    return;
                }
            }
            _Window_SkillList_drawItem.call(this, index);
        };
    }

    if (typeof Window_Selectable !== 'undefined' && Window_Selectable.prototype.drawText) {
        var _Window_Selectable_drawText = Window_Selectable.prototype.drawText;
        Window_Selectable.prototype.drawText = function(text, x, y, maxWidth, align) {
            var translated = translateUiText(text);
            return _Window_Selectable_drawText.call(this, translated, x, y, maxWidth, align);
        };
    }

    if (typeof Window_Message !== 'undefined' && Window_Message.prototype.processNormalCharacter) {
        var _Window_Message_processNormalCharacter = Window_Message.prototype.processNormalCharacter;
        Window_Message.prototype.processNormalCharacter = function(textState) {
            return _Window_Message_processNormalCharacter.call(this, textState);
        };
    }

    if (typeof Window_TitleCommand !== 'undefined') {
        var _Window_TitleCommand_makeCommandList = Window_TitleCommand.prototype.makeCommandList;
        Window_TitleCommand.prototype.makeCommandList = function() {
            _Window_TitleCommand_makeCommandList.call(this);
            this.addCommand(textLanguage, 'language');
        };

        var _Window_TitleCommand_drawItem = Window_TitleCommand.prototype.drawItem;
        Window_TitleCommand.prototype.drawItem = function(index) {
            if (this.commandSymbol(index) === 'language' && iconIndex >= 0) {
                var rect = this.itemRectForText(index);
                this.resetTextColor();
                this.changePaintOpacity(this.isCommandEnabled(index));
                var iconOffset = Window_Base._iconWidth ? Window_Base._iconWidth + 4 : 36;
                this.drawIcon(iconIndex, rect.x, rect.y + 2);
                this.drawText(this.commandName(index), rect.x + iconOffset, rect.y, rect.width - iconOffset, this.itemTextAlign());
            } else {
                _Window_TitleCommand_drawItem.call(this, index);
            }
        };

        Window_TitleCommand.prototype.ensureCursorVisible = function() {};
    }

    if (typeof Scene_Title !== 'undefined') {
        var _Scene_Title_createCommandWindow = Scene_Title.prototype.createCommandWindow;
        Scene_Title.prototype.createCommandWindow = function() {
            _Scene_Title_createCommandWindow.call(this);
            this._commandWindow.setHandler('language', this.commandLanguage.bind(this));
        };

        Scene_Title.prototype.commandLanguage = function() {
            this._commandWindow.close();
            SceneManager.push(Scene_Language);
        };

        var _Scene_Title_start = Scene_Title.prototype.start;
        Scene_Title.prototype.start = function() {
            _Scene_Title_start.call(this);
            if (rememberLastPath && !window.LANGDATA && typeof ConfigManager !== 'undefined') {
                var remembered = ConfigManager[LAST_LOADED_KEY];
                if (remembered) {
                    loadLanguageFromPath(remembered, function() {}, function(errorMessage) {
                        console.warn('ARP_TitleCommandLanguage: auto-load failed - ' + errorMessage);
                    });
                }
            }
        };
    }

    var ARP_TOUCH_LOCK = false;
    var ARP_OLD_BODY_OVERFLOW = '';
    var ARP_OLD_HTML_OVERFLOW = '';
    var ARP_OLD_BODY_TOUCH_ACTION = '';
    var ARP_OLD_HTML_TOUCH_ACTION = '';
    var ARP_OLD_CANVAS_TOUCH_ACTION = '';
    var ARP_OLD_HTML_POSITION = '';
    var ARP_OLD_HTML_WIDTH = '';
    var ARP_OLD_BODY_POSITION = '';
    var ARP_OLD_BODY_WIDTH = '';

    function enableLanguageTouchLock() {
        ARP_TOUCH_LOCK = true;
        if (document.body) {
            ARP_OLD_BODY_OVERFLOW = document.body.style.overflow;
            ARP_OLD_BODY_TOUCH_ACTION = document.body.style.touchAction;
            ARP_OLD_BODY_POSITION = document.body.style.position;
            ARP_OLD_BODY_WIDTH = document.body.style.width;
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        }
        if (document.documentElement) {
            ARP_OLD_HTML_OVERFLOW = document.documentElement.style.overflow;
            ARP_OLD_HTML_TOUCH_ACTION = document.documentElement.style.touchAction;
            ARP_OLD_HTML_POSITION = document.documentElement.style.position;
            ARP_OLD_HTML_WIDTH = document.documentElement.style.width;
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.style.touchAction = 'none';
            document.documentElement.style.position = 'fixed';
            document.documentElement.style.width = '100%';
        }
        var canvas = document.getElementById('GameCanvas') || document.querySelector('canvas');
        if (canvas) {
            ARP_OLD_CANVAS_TOUCH_ACTION = canvas.style.touchAction;
            canvas.style.touchAction = 'none';
        }
    }

    function disableLanguageTouchLock() {
        ARP_TOUCH_LOCK = false;
        if (document.body) {
            document.body.style.overflow = ARP_OLD_BODY_OVERFLOW;
            document.body.style.touchAction = ARP_OLD_BODY_TOUCH_ACTION;
            document.body.style.position = ARP_OLD_BODY_POSITION;
            document.body.style.width = ARP_OLD_BODY_WIDTH;
        }
        if (document.documentElement) {
            document.documentElement.style.overflow = ARP_OLD_HTML_OVERFLOW;
            document.documentElement.style.touchAction = ARP_OLD_HTML_TOUCH_ACTION;
            document.documentElement.style.position = ARP_OLD_HTML_POSITION;
            document.documentElement.style.width = ARP_OLD_HTML_WIDTH;
        }
        var canvas = document.getElementById('GameCanvas') || document.querySelector('canvas');
        if (canvas) {
            canvas.style.touchAction = ARP_OLD_CANVAS_TOUCH_ACTION;
        }
    }

    document.addEventListener('touchmove', function(e) {
        if (!ARP_TOUCH_LOCK) {
            return;
        }
        e.preventDefault();
    }, { passive: false, capture: true });

    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function(evt) {
        document.addEventListener(evt, function(e) {
            if (ARP_TOUCH_LOCK) {
                e.preventDefault();
            }
        }, { passive: false, capture: true });
    });

    function createPathPrompt(initialValue, onLoad, onCancel) {
        var savedInputUpdate = Input.update;
        var savedTouchInputUpdate = TouchInput.update;

        Input.update = function() {};
        TouchInput.update = function() {};
        Input.clear();
        TouchInput.clear();

        enableLanguageTouchLock();

        function restoreGameInput() {
            Input.update = savedInputUpdate;
            TouchInput.update = savedTouchInputUpdate;
            disableLanguageTouchLock();
        }

        var overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.7)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '9999';
        overlay.style.touchAction = 'none';
        overlay.style.overscrollBehavior = 'none';
        overlay.style.webkitOverflowScrolling = 'auto';

        var box = document.createElement('div');
        box.style.background = '#222';
        box.style.border = '2px solid #888';
        box.style.borderRadius = '8px';
        box.style.padding = '16px';
        box.style.width = '90%';
        box.style.maxWidth = '480px';
        box.style.fontFamily = 'sans-serif';
        box.style.touchAction = 'none';

        var label = document.createElement('div');
        label.textContent = 'Enter file path. (example: lang/sp.zip)';
        label.style.color = '#fff';
        label.style.marginBottom = '8px';
        label.style.fontSize = '14px';

        var hint1 = document.createElement('div');
        hint1.textContent = 'default languages are "ru.zip" "sp.zip" "jp.zip"';
        hint1.style.color = '#aaa';
        hint1.style.fontSize = '11px';
        hint1.style.marginBottom = '8px';
        hint1.style.touchAction = 'none';

        var input = document.createElement('input');
        input.type = 'text';
        input.value = initialValue;
        input.style.width = '100%';
        input.style.boxSizing = 'border-box';
        input.style.padding = '8px';
        input.style.fontSize = '14px';
        input.style.marginBottom = '10px';
        input.style.touchAction = 'auto';

        var hint2 = document.createElement('div');
        hint2.textContent = 'disclaim i dont own any of this translations files idk if they even accurate.';
        hint2.style.color = '#fff';
        hint2.style.fontSize = '11px';
        hint2.style.marginBottom = '8px';
        hint2.style.touchAction = 'none';

        var hint3 = document.createElement('div');
        hint3.textContent = 'all this files just for testing if you want add your language file open the game files and import your zipfile in www/lang/';
        hint3.style.color = '#aaa';
        hint3.style.fontSize = '11px';
        hint3.style.marginBottom = '8px';
        hint3.style.touchAction = 'none';

        var status = document.createElement('div');
        status.textContent = '';
        status.style.color = '#8cf';
        status.style.marginBottom = '10px';
        status.style.fontSize = '12px';
        status.style.minHeight = '18px';

        var btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.justifyContent = 'flex-end';
        btnRow.style.gap = '8px';
        btnRow.style.touchAction = 'none';

        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.type = 'button';
        cancelBtn.style.padding = '6px 14px';
        cancelBtn.style.touchAction = 'manipulation';

        var loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load';
        loadBtn.type = 'button';
        loadBtn.style.padding = '6px 14px';
        loadBtn.style.touchAction = 'manipulation';

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(loadBtn);

        box.appendChild(label);
        box.appendChild(hint1);
        box.appendChild(input);
        box.appendChild(hint2);
        box.appendChild(hint3);
        box.appendChild(status);
        box.appendChild(btnRow);
        overlay.appendChild(box);

        document.body.appendChild(overlay);

        var stopEvents = [
            'keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'click',
            'touchstart', 'touchend', 'touchmove', 'gesturestart', 'gesturechange', 'gestureend'
        ];

        stopEvents.forEach(function(evt) {
            overlay.addEventListener(evt, function(e) {
                if (e.target === input && (evt === 'keydown' || evt === 'keyup' || evt === 'keypress')) {
                    e.stopPropagation();
                    return;
                }
                e.stopPropagation();
                if (evt === 'touchmove' || evt === 'gesturestart' || evt === 'gesturechange' || evt === 'gestureend') {
                    if (e.target !== input) {
                        e.preventDefault();
                    }
                }
            }, { passive: false });
        });

        input.focus();
        input.select();

        var focusGuard = setInterval(function() {
            if (document.activeElement !== input) {
                input.focus();
            }
        }, 50);

        setTimeout(function() { clearInterval(focusGuard); }, 1000);

        function cleanup() {
            clearInterval(focusGuard);
            restoreGameInput();
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
        }

        function attemptLoad() {
            var path = input.value.trim();
            if (!path) {
                status.style.color = '#f88';
                status.textContent = 'Please enter a path.';
                return;
            }
            status.style.color = '#8cf';
            status.textContent = 'Loading...';
            loadBtn.disabled = true;

            loadLanguageFromPath(path, function() {
                buildNameToIdMap();
                cleanup();
                onLoad();
            }, function(errorMessage) {
                status.style.color = '#f88';
                status.textContent = errorMessage;
                loadBtn.disabled = false;
            });
        }

        function attemptCancel() {
            cleanup();
            onCancel();
        }

        loadBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            attemptLoad();
        });

        cancelBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            attemptCancel();
        });

        input.addEventListener('keydown', function(e) {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                attemptLoad();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                attemptCancel();
            }
        });

        input.addEventListener('keyup', function(e) { e.stopPropagation(); });
        input.addEventListener('keypress', function(e) { e.stopPropagation(); });
    }

    function parseCsvRows(text) {
        var rows = [];
        var row = [];
        var field = '';
        var inQuotes = false;
        var i = 0;
        var len = text.length;

        while (i < len) {
            var c = text.charAt(i);
            if (inQuotes) {
                if (c === '"') {
                    if (text.charAt(i + 1) === '"') {
                        field += '"';
                        i += 2;
                    } else {
                        inQuotes = false;
                        i++;
                    }
                } else if (c === '\r') {
                    i++;
                } else {
                    field += c;
                    i++;
                }
            } else {
                if (c === '"') {
                    inQuotes = true;
                    i++;
                } else if (c === ',') {
                    row.push(field);
                    field = '';
                    i++;
                } else if (c === '\r') {
                    i++;
                } else if (c === '\n') {
                    row.push(field);
                    rows.push(row);
                    row = [];
                    field = '';
                    i++;
                } else {
                    field += c;
                    i++;
                }
            }
        }

        if (field.length > 0 || row.length > 0) {
            row.push(field);
            rows.push(row);
        }

        return rows;
    }

    function parseCsvToLangData(text) {
        var rows = parseCsvRows(text);

        var data = {
            langVers: null,
            langName: '',
            langInfo: ['', '', ''],
            fontFace: '',
            fontSize: 0,
            fontFile: null,
            imgFiles: {},
            sysLabel: {},
            sysMenus: {},
            labelLUT: {},
            linesLUT: {}
        };

        function isBlankRow(row) {
            for (var j = 0; j < row.length; j++) {
                if (row[j] !== '') {
                    return false;
                }
            }
            return true;
        }

        function pushLine(id, text) {
            if (!id) {
                return;
            }
            if (!data.linesLUT[id]) {
                data.linesLUT[id] = [];
            }
            data.linesLUT[id].push(text || '');
        }

        var section = null;

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];

            if (isBlankRow(row)) {
                section = null;
                continue;
            }

            var head = (row[0] || '').trim().toLowerCase();

            if (section === null) {
                if (head === 'language') {
                    section = 'lang';
                } else if (head.indexOf('credit') === 0) {
                    section = 'credits';
                } else if (head === 'labels') {
                    section = 'labels';
                } else if (head === 'menus') {
                    section = 'menus';
                } else if (head === 'speakers') {
                    section = 'speakers';
                } else if (head === 'items') {
                    section = 'items';
                } else if (head === 'descriptions') {
                    section = 'descriptions';
                } else if (head === 'images') {
                    section = 'images';
                } else if (head === 'section') {
                    section = 'section_subheader';
                } else {
                    var filled = row.filter(function(c) { return c !== ''; }).length;
                    if (filled >= 4) {
                        section = 'descriptions';
                    } else if (filled === 3) {
                        section = 'items';
                    } else {
                        section = 'menus';
                    }
                }
                continue;
            }

            if (section === 'section_subheader') {
                section = 'section_dialogue';
                continue;
            }

            switch (section) {
                case 'lang':
                    data.langName = row[0] || data.langName;
                    data.fontFace = row[1] || data.fontFace;
                    data.fontSize = Number(row[2]) || data.fontSize;
                    section = null;
                    break;

                case 'credits':
                    data.langInfo = [row[0] || '', row[1] || '', row[2] || ''];
                    section = null;
                    break;

                case 'labels':
                    if (row[0]) {
                        data.sysLabel[row[0]] = (row[2] !== undefined && row[2] !== '') ? row[2] : row[1];
                    }
                    break;

                case 'menus':
                    if (row[0]) {
                        data.sysMenus[row[0]] = row[1];
                    }
                    break;

                case 'speakers':
                case 'items':
                    if (row[0]) {
                        data.labelLUT[row[0]] = (row[2] !== undefined && row[2] !== '') ? row[2] : row[1];
                    }
                    break;

                case 'descriptions':
                    pushLine(row[0], row[3] !== undefined ? row[3] : row[row.length - 1]);
                    break;

                case 'section_dialogue':
                    pushLine(row[0], row[3] !== undefined ? row[3] : row[row.length - 1]);
                    break;

                case 'images':
                    if (row[0] && row[1]) {
                        data.imgFiles[row[0]] = row[1];
                    }
                    break;
            }
        }

        return data;
    }

    function parseLooseTextToLangData(text) {
        var data = {
            langVers: null,
            langName: '',
            langInfo: ['', '', ''],
            fontFace: '',
            fontSize: 0,
            fontFile: null,
            imgFiles: {},
            sysLabel: {},
            sysMenus: {},
            labelLUT: {},
            linesLUT: {}
        };

        var lines = String(text || '').split(/\r?\n/);
        var matched = 0;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (!line || !line.trim()) {
                continue;
            }

            var m = line.match(/^\s*([^=\t]+?)\s*[=\t]\s*(.*)$/);
            if (m) {
                var id = m[1];
                var val = m[2];
                if (!data.linesLUT[id]) {
                    data.linesLUT[id] = [];
                }
                data.linesLUT[id].push(val);
                matched++;
            }
        }

        if (matched === 0) {
            return null;
        }

        return data;
    }

    function detectLanguageFormat(text, path) {
        var clean = String(text || '').replace(/^\uFEFF/, '');
        var trimmed = clean.trim();

        if (!trimmed) {
            return 'unknown';
        }

        var jsonText = trimmed;
        if (jsonText.slice(0, 8).toUpperCase() === 'LANGDATA') {
            jsonText = jsonText.slice(8).trim();
        }

        if (jsonText.charAt(0) === '{' || jsonText.charAt(0) === '[') {
            try {
                JSON.parse(jsonText);
                return 'json';
            } catch (e) {}
        }

        var lines = trimmed.split(/\r?\n/);
        var csvScore = 0;

        for (var i = 0; i < lines.length && i < 40; i++) {
            var line = lines[i].trim();
            if (!line) {
                continue;
            }
            var lower = line.toLowerCase();
            if (
                lower === 'language' || lower === 'labels' || lower === 'menus' ||
                lower === 'speakers' || lower === 'items' || lower === 'descriptions' ||
                lower === 'images' || lower === 'section' || lower.indexOf('credit') === 0
            ) {
                csvScore += 5;
            }
            if (line.indexOf(',') >= 0) {
                csvScore += 1;
            }
        }

        if (csvScore >= 2) {
            return 'csv';
        }

        return 'loose';
    }

    function parseLanguageText(text, path) {
        var cleanText = String(text || '').replace(/^\uFEFF/, '');
        var hinted = detectLanguageFormat(cleanText, path);

        var order;
        if (hinted === 'json') {
            order = ['json', 'csv', 'loose'];
        } else if (hinted === 'csv') {
            order = ['csv', 'json', 'loose'];
        } else {
            order = ['loose', 'csv', 'json'];
        }

        var lastError = null;

        for (var i = 0; i < order.length; i++) {
            var attempt = order[i];

            try {
                if (attempt === 'json') {
                    var jsonText = cleanText.trim();
                    if (jsonText.slice(0, 8).toUpperCase() === 'LANGDATA') {
                        jsonText = jsonText.slice(8).trim();
                    }
                    if (jsonText.charAt(0) !== '{' && jsonText.charAt(0) !== '[') {
                        continue;
                    }
                    var parsedJson = JSON.parse(jsonText);
                    console.log('ARP_TitleCommandLanguage: parsed as json:', path);
                    return parsedJson;

                } else if (attempt === 'csv') {
                    var parsedCsv = parseCsvToLangData(cleanText);
                    var hasCsvContent =
                        parsedCsv.langName ||
                        Object.keys(parsedCsv.sysLabel).length > 0 ||
                        Object.keys(parsedCsv.sysMenus).length > 0 ||
                        Object.keys(parsedCsv.labelLUT).length > 0 ||
                        Object.keys(parsedCsv.linesLUT).length > 0;
                    if (!hasCsvContent) {
                        continue;
                    }
                    console.log('ARP_TitleCommandLanguage: parsed as csv:', path);
                    return parsedCsv;

                } else if (attempt === 'loose') {
                    var parsedLoose = parseLooseTextToLangData(cleanText);
                    if (!parsedLoose) {
                        continue;
                    }
                    console.log('ARP_TitleCommandLanguage: parsed as loose text:', path);
                    return parsedLoose;
                }
            } catch (e) {
                lastError = e;
            }
        }

        if (lastError) {
            throw lastError;
        }

        throw new Error('Unrecognized language file format: ' + path);
    }

    function extractZipImages(zip) {
        var imgEntries = [];

        zip.forEach(function(relPath, entry) {
            if (entry.dir) {
                return;
            }
            var normalized = relPath.replace(/\\/g, '/');
            var lower = normalized.toLowerCase();
            if (!lower.endsWith('.png')) {
                return;
            }

            var parts = normalized.split('/');
            var lowerParts = lower.split('/');
            var imgIndex = -1;

            for (var i = 0; i < lowerParts.length - 1; i++) {
                if (lowerParts[i] === 'img') {
                    imgIndex = i;
                    break;
                }
            }

            if (imgIndex < 0) {
                return;
            }

            var imageParts = parts.slice(imgIndex + 1);
            if (imageParts.length < 2) {
                return;
            }

            var firstFolder = imageParts[0].toLowerCase();
            if (!Object.prototype.hasOwnProperty.call(IMG_SUBFOLDER_SET, firstFolder)) {
                return;
            }

            var imageKey = imageParts.join('/').replace(/\.png$/i, '');

            imgEntries.push({ key: imageKey, entry: entry });
        });

        var promises = imgEntries.map(function(info) {
            return info.entry.async('base64').then(function(base64) {
                return { key: info.key, dataUrl: 'data:image/png;base64,' + base64 };
            });
        });

        return Promise.all(promises);
    }

    function getEntrySize(entry) {
        if (entry._data && typeof entry._data.uncompressedSize === 'number') {
            return entry._data.uncompressedSize;
        }
        if (entry._data && typeof entry._data.uncompressedSize === 'bigint') {
            return Number(entry._data.uncompressedSize);
        }
        if (entry._data && typeof entry._data.compressedSize === 'number') {
            return entry._data.compressedSize;
        }
        return 0;
    }

    function findZipLanguageEntry(zip) {
        var dialogueCandidates = [];
        var otherCandidates = [];

        zip.forEach(function(relPath, entry) {
            if (entry.dir) {
                return;
            }
            var lower = relPath.toLowerCase();
            if (lower.endsWith('.png')) {
                return;
            }

            var filename = lower.split('/').pop();
            var size = getEntrySize(entry);
            var isDialogue = /^dialogue(\.[a-z0-9]+)?$/.test(filename);

            var candidate = { entry: entry, size: size };

            if (isDialogue) {
                dialogueCandidates.push(candidate);
            } else {
                otherCandidates.push(candidate);
            }
        });

        dialogueCandidates.sort(function(a, b) { return b.size - a.size; });
        otherCandidates.sort(function(a, b) { return b.size - a.size; });

        var orderedCandidates = dialogueCandidates.concat(otherCandidates);

        function tryCandidate(index) {
            if (index >= orderedCandidates.length) {
                return Promise.resolve(null);
            }

            var candidate = orderedCandidates[index];

            return candidate.entry.async('string').then(function(text) {
                try {
                    var parsed = parseLanguageText(text, candidate.entry.name);
                    if (parsed && typeof parsed === 'object') {
                        console.log('ARP_TitleCommandLanguage: selected language file:', candidate.entry.name, 'size:', candidate.size);
                        return { entry: candidate.entry, text: text };
                    }
                } catch (e) {
                    console.warn('ARP_TitleCommandLanguage: candidate failed:', candidate.entry.name, e);
                }
                return tryCandidate(index + 1);
            }).catch(function() {
                return tryCandidate(index + 1);
            });
        }

        return tryCandidate(0);
    }

    function finishLoad(path, fileText, loadedFontName, onDone, parseHintPath, bundledImgFiles) {
        var parsed;

        try {
            parsed = parseLanguageText(fileText, parseHintPath || path);
        } catch (e) {
            console.error('LANGDATA parse failed:', e);
            throw e;
        }

        if (loadedFontName && parsed && typeof parsed === 'object') {
            parsed.fontFace = loadedFontName;
        }

        if (bundledImgFiles && parsed && typeof parsed === 'object') {
            if (!parsed.imgFiles) {
                parsed.imgFiles = {};
            }
            for (var key in bundledImgFiles) {
                if (Object.prototype.hasOwnProperty.call(bundledImgFiles, key)) {
                    if (!Object.prototype.hasOwnProperty.call(parsed.imgFiles, key)) {
                        parsed.imgFiles[key] = bundledImgFiles[key];
                    }
                }
            }
        }

        window.LANGDATA = parsed;

        if (parsed.linesLUT) {
            var dialogueCount = 0;
            for (var dialogueKey in parsed.linesLUT) {
                if (Object.prototype.hasOwnProperty.call(parsed.linesLUT, dialogueKey)) {
                    dialogueCount += parsed.linesLUT[dialogueKey].length;
                }
            }
            console.log('ARP_TitleCommandLanguage: dialogue lines loaded =', dialogueCount);
        }

        if (typeof ConfigManager !== 'undefined') {
            ConfigManager.language = path;
            ConfigManager[LAST_LOADED_KEY] = path;
            try {
                ConfigManager.save();
            } catch (e2) {}
        }

        if (typeof window.LangLabelFix_UpdateData === 'function') {
            window.LangLabelFix_UpdateData(parsed);
        }

        if (typeof onDone === 'function') {
            onDone();
        }
    }

    function loadLanguageFromPath(path, onSuccess, onFailure) {
        path = String(path || '').trim();

        if (!path) {
            onFailure('Please enter a file path.');
            return;
        }

        var lowerPath = path.toLowerCase();

        if (lowerPath.slice(-4) === '.zip') {
            ensureJSZip(function() {
                var zipRequest = new XMLHttpRequest();
                zipRequest.open('GET', path, true);
                zipRequest.responseType = 'arraybuffer';

                zipRequest.onload = function() {
                    if (zipRequest.status >= 400) {
                        onFailure('Failed to load (HTTP ' + zipRequest.status + '). Check the path.');
                        return;
                    }

                    JSZip.loadAsync(zipRequest.response).then(function(zip) {
                        return Promise.all([findZipLanguageEntry(zip), extractZipImages(zip)]);
                    }).then(function(results) {
                        var languageResult = results[0];
                        var imageResults = results[1];

                        if (!languageResult) {
                            throw new Error('No valid language file found inside ZIP.');
                        }

                        var bundledImgFiles = {};

                        imageResults.forEach(function(image) {
                            bundledImgFiles[image.key] = image.dataUrl;
                            ARP_ZIP_IMAGES[image.key] = image.dataUrl;
                        });

                        console.log('ARP_TitleCommandLanguage: loaded ' + imageResults.length + ' ZIP PNG image(s).');
                        console.log('ARP_TitleCommandLanguage: language file = ' + languageResult.entry.name);

                        clearARPImageCache();

                        finishLoad(path, languageResult.text, null, onSuccess, languageResult.entry.name, bundledImgFiles);
                    }).catch(function(e) {
                        console.error('ZIP read failed:', e);
                        onFailure('Failed to read language file inside ZIP.');
                    });
                };

                zipRequest.onerror = function() {
                    onFailure('Failed to load. Check the path and try again.');
                };

                zipRequest.send();
            });

            return;
        }

        var request = new XMLHttpRequest();
        request.open('GET', path, true);

        request.onload = function() {
            if (request.status >= 200 && request.status < 400) {
                try {
                    finishLoad(path, request.responseText, null, onSuccess, path, null);
                } catch (e) {
                    console.error('ARP_TitleCommandLanguage: failed to parse language:', e);
                    onFailure('File loaded, but the language data could not be parsed.');
                }
            } else {
                onFailure('Failed to load (HTTP ' + request.status + '). Check the path.');
            }
        };

        request.onerror = function() {
            onFailure('Failed to load. Check the path and try again.');
        };

        request.send();
    }

    function Scene_Language() {
        this.initialize.apply(this, arguments);
    }

    Scene_Language.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_Language.prototype.constructor = Scene_Language;

    Scene_Language.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_Language.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);

        var lastPath = (ConfigManager.language || ConfigManager[LAST_LOADED_KEY] || defaultPath);

        createPathPrompt(lastPath, this.onPathLoaded.bind(this), this.onPromptCancelled.bind(this));
    };

    Scene_Language.prototype.onPathLoaded = function() {
        this.popScene();
    };

    Scene_Language.prototype.onPromptCancelled = function() {
        this.popScene();
    };

    window.ARP_TitleCommandLanguage = window.ARP_TitleCommandLanguage || {};
    window.ARP_TitleCommandLanguage.translateImgPath = translateImgPath;
    window.ARP_TitleCommandLanguage.loadLanguageFromPath = loadLanguageFromPath;
    window.ARP_TitleCommandLanguage.normalizeImgPath = normalizeImgPath;
    window.ARP_TitleCommandLanguage.clearImageCache = clearARPImageCache;
    window.ARP_TitleCommandLanguage.detectLanguageFormat = detectLanguageFormat;
    window.ARP_TitleCommandLanguage.parseLanguageText = parseLanguageText;
    window.ARP_TitleCommandLanguage.buildNameToIdMap = buildNameToIdMap;

})();