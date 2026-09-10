(function() {

    const _Window_Base_convertEscapeCharacters = Window_Base.prototype.convertEscapeCharacters;
    Window_Base.prototype.convertEscapeCharacters = function(text) {
        text = _Window_Base_convertEscapeCharacters.call(this, text);
        if (this.skipSafeWordWrap && this.skipSafeWordWrap()) return text;
        return this.safeWordWrap(text);
    };

    // Name box sizes itself around its own text — wrapping it before that
    // measurement happens is what corrupts/shrinks the name.
    if (typeof Window_NameBox !== "undefined") {
        Window_NameBox.prototype.skipSafeWordWrap = function() { return true; };
    }

    Window_Base.prototype.safeWordWrap = function(text) {
        if (!text) return text;
        const maxWidth = this.contentsWidth();
        const lines = [];
        const paragraphs = text.split('\n');
        paragraphs.forEach(paragraph => {
            let line = '';
            const words = paragraph.split(/(\s+)/);
            words.forEach(word => {
                let testLine = line + word;
                let width = this.textWidth(testLine);
                if (width > maxWidth) {
                    if (line) lines.push(line);
                    if (this.textWidth(word) > maxWidth) {
                        let splitWord = '';
                        for (let char of word) {
                            const testWord = splitWord + char;
                            if (this.textWidth(testWord) > maxWidth) {
                                if (splitWord) lines.push(splitWord);
                                splitWord = char;
                            } else {
                                splitWord = testWord;
                            }
                        }
                        line = splitWord;
                    } else {
                        line = word.trimStart();
                    }
                } else {
                    line = testLine;
                }
            });
            lines.push(line); // was `if (line) lines.push(line)` — that silently dropped blank lines
        });
        return lines.join('\n');
    };

})();