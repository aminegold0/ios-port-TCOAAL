(function() {

const _add = Game_Message.prototype.add;

Game_Message.prototype.add = function(text) {

    if (text && window.LANGDATA) {
        text = String(text);

        text = text.replace(/\(label\)\[(.*?)\]/g, function(_, key) {
            var name = (LANGDATA.labelLUT && LANGDATA.labelLUT[key]) || "";
            name = String(name || "");
            name = name.replace(/,{2,}/g, ",");
            return name;
        });

        text = text.replace(/\(lines\)\[(.*?)\]/g, function(_, key) {

            var str =
                (LANGDATA.lines && LANGDATA.lines[key]) ||
                (LANGDATA.linesLUT && LANGDATA.linesLUT[key]) ||
                (LANGDATA.dialogue && LANGDATA.dialogue[key]) ||
                (LANGDATA.text && LANGDATA.text[key]) ||
                "";

            str = String(str || "");

            str = str.replace(/^,/, "").trimStart();
            str = str.replace(/,{2,}/g, ",");

            if (/^Got a/i.test(str)) {
                str = "\n" + str;
            }

            return str;
        });

        // Vertically center short messages within the fixed-height box.
        // Use a zero-width space so "WordWarps Fix.js" doesn't drop the blank line.
        var lineCount = (text.match(/\n/g) || []).length + 1;
        var totalRows = 4; // must match your "Default Rows" YEP_MessageCore parameter
        var padTop = Math.max(0, Math.floor((totalRows - lineCount) / 2));
        if (padTop > 0) {
            text = ("\u200B\n").repeat(padTop) + text;
        }
    }

    _add.call(this, text);
};

})();