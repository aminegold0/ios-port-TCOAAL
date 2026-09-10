var Imported = Imported || {};
Imported.ContactScreen = true;

(function() {

    var parameters = PluginManager.parameters('ContactScreen');
    var folder = String(parameters['Folder'] || 'data');
    var fileName = String(parameters['File Name'] || 'contact');
    var titleText = String(parameters['Title Menu Text'] || 'Contact');
    var defaultFontSize = Number(parameters['Font Size'] || 28);

    var _contactData = null;
    var _contactLoaded = false;

    function parseContactFile(rawText) {
        var data = {
            fadeIn: 10,
            fadeOut: 10,
            ypos: 0,
            align: 'center',
            image: '',
            text: rawText
        };

        var tagMatch = rawText.match(/<block:([^>]*)>/i);
        if (tagMatch) {
            var parts = tagMatch[1].split(',');
            // parts[0] = time, parts[1] = scroll -> intentionally unused here
            if (parts[2] !== undefined && parts[2] !== '') data.fadeIn = Number(parts[2]);
            if (parts[3] !== undefined && parts[3] !== '') data.fadeOut = Number(parts[3]);
            if (parts[4] !== undefined && parts[4] !== '') {
                var y = Number(parts[4]);
                data.ypos = isNaN(y) ? 0 : y;
            }
            if (parts[5]) data.align = parts[5].toLowerCase();
            if (parts[6]) data.image = parts[6];

            var afterTag = rawText.slice(tagMatch.index + tagMatch[0].length);
            var closeMatch = afterTag.match(/<\/block>/i);
            var body = closeMatch ? afterTag.slice(0, closeMatch.index) : afterTag;
            body = body.replace(/^\r?\n/, '').replace(/\r?\n\s*$/, '');
            data.text = body;
        }

        if (data.image.toLowerCase() === 'black') data.image = '';

        return data;
    }

    function loadContactText() {
        _contactLoaded = false;
        var xhr = new XMLHttpRequest();
        var url = folder + '/' + fileName + '.txt';
        xhr.open('GET', url);
        xhr.overrideMimeType('text/plain');
        xhr.onload = function() {
            var raw = (xhr.status < 400) ? xhr.responseText : ('Could not load ' + url);
            _contactData = parseContactFile(raw);
            _contactLoaded = true;
        };
        xhr.onerror = function() {
            _contactData = parseContactFile('Could not load ' + url);
            _contactLoaded = true;
        };
        xhr.send();
    }

    //-------------------------------------------------------------------
    // Sprite_ContactBg
    //-------------------------------------------------------------------

    function Sprite_ContactBg() {
        this.initialize.apply(this, arguments);
    }

    Sprite_ContactBg.prototype = Object.create(Sprite.prototype);
    Sprite_ContactBg.prototype.constructor = Sprite_ContactBg;

    Sprite_ContactBg.prototype.initialize = function(image) {
        Sprite.prototype.initialize.call(this);
        this.bitmap = ImageManager.loadTitle1(image);
        this.opacity = 0;
        this._fading = 'in';
        this._fadeIn = 5;
        this._fadeOut = 5;
    };

    Sprite_ContactBg.prototype.setFadeSpeeds = function(fadeIn, fadeOut) {
        this._fadeIn = Math.max(fadeIn, 1);
        this._fadeOut = Math.max(fadeOut, 1);
    };

    Sprite_ContactBg.prototype.startFadeOut = function() {
        this._fading = 'out';
    };

    Sprite_ContactBg.prototype.isFadedOut = function() {
        return this._fading === 'out' && this.opacity <= 0;
    };

    Sprite_ContactBg.prototype.update = function() {
        Sprite.prototype.update.call(this);
        if (this._fading === 'in') {
            this.opacity = Math.min(this.opacity + this._fadeIn, 255);
        } else if (this._fading === 'out') {
            this.opacity = Math.max(this.opacity - this._fadeOut, 0);
        }
    };

    //-------------------------------------------------------------------
    // Scene_Contact
    //-------------------------------------------------------------------

    function Scene_Contact() {
        this.initialize.apply(this, arguments);
    }

    Scene_Contact.prototype = Object.create(Scene_Base.prototype);
    Scene_Contact.prototype.constructor = Scene_Contact;

    Scene_Contact.prototype.initialize = function() {
        Scene_Base.prototype.initialize.call(this);
        this._closing = false;
    };

    Scene_Contact.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        this.createBlackBackground();
        loadContactText();
    };

    Scene_Contact.prototype.createBlackBackground = function() {
        var bitmap = new Bitmap(Graphics.width, Graphics.height);
        bitmap.fillAll('#000000');
        this._blackBg = new Sprite(bitmap);
        this.addChild(this._blackBg);
    };

    Scene_Contact.prototype.isReady = function() {
        return Scene_Base.prototype.isReady.call(this) && _contactLoaded;
    };

    Scene_Contact.prototype.start = function() {
        Scene_Base.prototype.start.call(this);
        if (_contactData.image) {
            this._imageBg = new Sprite_ContactBg(_contactData.image);
            this._imageBg.setFadeSpeeds(_contactData.fadeIn, _contactData.fadeOut);
            this.addChild(this._imageBg);
        }
        this.createWindow();
    };

    Scene_Contact.prototype.createWindow = function() {
        this._window = new Window_Contact(_contactData, defaultFontSize);
        this.addChild(this._window);
    };

    Scene_Contact.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
        if (!this._closing) {
            if (Input.isTriggered('ok') || Input.isTriggered('cancel') || TouchInput.isTriggered()) {
                this.beginClose();
            }
        } else {
            var windowDone = !this._window || this._window.isFadedOut();
            var bgDone = !this._imageBg || this._imageBg.isFadedOut();
            if (windowDone && bgDone) {
                SceneManager.pop();
            }
        }
    };

    Scene_Contact.prototype.beginClose = function() {
        this._closing = true;
        SoundManager.playCancel();
        if (this._window) this._window.startFadeOut();
        if (this._imageBg) this._imageBg.startFadeOut();
    };

    //-------------------------------------------------------------------
    // Window_Contact
    //-------------------------------------------------------------------

    function Window_Contact() {
        this.initialize.apply(this, arguments);
    }

    Window_Contact.prototype = Object.create(Window_Base.prototype);
    Window_Contact.prototype.constructor = Window_Contact;

    Window_Contact.prototype.initialize = function(data, fontSize) {
        var width = Graphics.boxWidth;
        var height = Graphics.boxHeight;
        this._data = data;
        this._fontSize = fontSize;
        this._lines = (data.text || '').split('\n');
        this._allTextHeight = this._lines.length * this.lineHeight();
        this._fadeIn = Math.max(data.fadeIn, 1);
        this._fadeOut = Math.max(data.fadeOut, 1);
        this._fading = 'in';
        Window_Base.prototype.initialize.call(this, 0, 0, width, height);
        this.opacity = 0;
        this.contentsOpacity = 0;
        this.contents.fontSize = this._fontSize;
        this.origin.y = 0;
        this.refresh();
    };

    Window_Contact.prototype.contentsHeight = function() {
        var visible = Graphics.boxHeight - this.standardPadding() * 2;
        return Math.max(this._allTextHeight || 1, visible);
    };

    // Measures the pixel width of text (including escape codes like \C[n])
    // by "drawing" it far outside the visible canvas, so nothing is shown.
    Window_Contact.prototype.textWidthEx = function(text) {
        this.resetFontSettings();
        var textState = { index: 0, x: 0, y: -100000, left: 0 };
        textState.text = this.convertEscapeCharacters(text);
        while (textState.index < textState.text.length) {
            this.processCharacter(textState);
        }
        return textState.x;
    };

    Window_Contact.prototype.refresh = function() {
        this.contents.clear();
        this.resetFontSettings();
        this.contents.fontSize = this._fontSize;

        var lh = this.lineHeight();
        var totalHeight = this._lines.length * lh;
        var visibleHeight = this.contents.height;
        var shiftUp = Math.floor(Graphics.boxHeight * 0.3);
        var startY;
        if (totalHeight <= visibleHeight) {
            startY = Math.floor((visibleHeight - totalHeight) / 2) - shiftUp + this._data.ypos;
        } else {
            startY = this._data.ypos - shiftUp;
        }

        // Measure every line first so the whole block can be centered on
        // screen, then left/right/center only control how lines line up
        // relative to each other WITHIN that centered block.
        var widths = [];
        var maxWidth = 0;
        for (var j = 0; j < this._lines.length; j++) {
            var lw = this.textWidthEx(this._lines[j]);
            widths.push(lw);
            if (lw > maxWidth) maxWidth = lw;
        }
        var blockX = (this.contents.width - maxWidth) / 2;

        for (var i = 0; i < this._lines.length; i++) {
            var line = this._lines[i];
            var w = widths[i];
            var x = blockX;
            if (this._data.align === 'center') {
                x = blockX + (maxWidth - w) / 2;
            } else if (this._data.align === 'right') {
                x = blockX + (maxWidth - w);
            }
            this.resetFontSettings();
            this.contents.fontSize = this._fontSize;
            this.drawTextEx(line, x, startY + i * lh);
        }
    };

    Window_Contact.prototype.maxScrollY = function() {
        var visible = this.height - this.standardPadding() * 2;
        return Math.max(this._allTextHeight - visible, 0);
    };

    Window_Contact.prototype.startFadeOut = function() {
        this._fading = 'out';
    };

    Window_Contact.prototype.isFadedOut = function() {
        return this._fading === 'out' && this.contentsOpacity <= 0;
    };

    Window_Contact.prototype.update = function() {
        Window_Base.prototype.update.call(this);

        if (this._fading === 'in') {
            this.contentsOpacity = Math.min(this.contentsOpacity + this._fadeIn, 255);
        } else if (this._fading === 'out') {
            this.contentsOpacity = Math.max(this.contentsOpacity - this._fadeOut, 0);
        }

        if (this._fading !== 'out') {
            var maxY = this.maxScrollY();
            if (Input.isPressed('up')) {
                this.origin.y = Math.max(this.origin.y - 6, 0);
            } else if (Input.isPressed('down')) {
                this.origin.y = Math.min(this.origin.y + 6, maxY);
            }
        }
    };

    //-------------------------------------------------------------------
    // Title screen integration
    //-------------------------------------------------------------------

    var _Scene_Title_createCommandWindow = Scene_Title.prototype.createCommandWindow;
    Scene_Title.prototype.createCommandWindow = function() {
        _Scene_Title_createCommandWindow.call(this);
        this._commandWindow.setHandler('contact', this.commandContact.bind(this));
    };

    Scene_Title.prototype.commandContact = function() {
        this._commandWindow.close();
        SceneManager.push(Scene_Contact);
    };

    if (titleText !== '') {
        var _Window_TitleCommand_makeCommandList = Window_TitleCommand.prototype.makeCommandList;
        Window_TitleCommand.prototype.makeCommandList = function() {
            _Window_TitleCommand_makeCommandList.call(this);
            this.addCommand(titleText, 'contact');
        };
    }

    // Expose for script calls / other plugins
    window.Scene_Contact = Scene_Contact;
    window.Window_Contact = Window_Contact;

})();