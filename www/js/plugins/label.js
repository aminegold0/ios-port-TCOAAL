//=============================================================================
// LangLabelFix.js
//=============================================================================
/*:
 * @plugindesc Resolves (label)[XXXX] / (lines)[XXXX] placeholders in VN choice
 * buttons using window.LANGDATA, so real text shows instead of raw codes.
 * @author Claude
 *
 * @help
 * Some choice/VN button text is stored as placeholder codes like:
 *   (label)[F6lrtcXf]
 * The real text lives in window.LANGDATA (labelLUT for single labels,
 * linesLUT for multi-part lines). This plugin resolves those placeholders
 * in choice button text before it's drawn, so buttons show the actual text
 * instead of the raw code.
 *
 * If you're using ARP_TitleCommandLanguage to load language zips dynamically,
 * this plugin automatically syncs with the freshly-loaded LANGDATA.
 *
 * No plugin commands. Just place this .js file in your project's
 * js/plugins folder and enable it in the Plugin Manager. Load it AFTER
 * ARP_TitleCommandLanguage.js (if you have that plugin).
 */
(() => {
  'use strict';

  const LANG_PREFIX = 'LANGDATA';
  const LANG_URL = 'data/LANGDATA';

  let labelLUT = {};
  let linesLUT = {};
  let englishLabelLUT = {}; // Fallback English labels
  let englishLinesLUT = {};  // Fallback English lines
  let langLoaded = false;

  const LABEL_REF = /\(label\)\[([^\]]+)\]/g;
  const LINES_REF = /\(lines\)\[([^\]]+)\]/g;

  function resolveLangText(str) {
    if (typeof str !== 'string' || str.length === 0) return str;

    let result = str;

    result = result.replace(LABEL_REF, (whole, key) => {
      // Try current language first
      if (Object.prototype.hasOwnProperty.call(labelLUT, key)) {
        return labelLUT[key];
      }
      // Fall back to English if available
      if (Object.prototype.hasOwnProperty.call(englishLabelLUT, key)) {
        return englishLabelLUT[key];
      }
      // If nothing found, return raw text (don't show placeholder code)
      return whole;
    });

    result = result.replace(LINES_REF, (whole, key) => {
      // Try current language first
      if (Object.prototype.hasOwnProperty.call(linesLUT, key)) {
        const parts = linesLUT[key];
        return Array.isArray(parts) ? parts.join('') : String(parts);
      }
      // Fall back to English if available
      if (Object.prototype.hasOwnProperty.call(englishLinesLUT, key)) {
        const parts = englishLinesLUT[key];
        return Array.isArray(parts) ? parts.join('') : String(parts);
      }
      // If nothing found, return raw text (don't show placeholder code)
      return whole;
    });

    return result;
  }

  // NEW: Public hook for ARP_TitleCommandLanguage to call when a new language loads
  window.LangLabelFix_UpdateData = function(langData) {
    if (langData && typeof langData === 'object') {
      // If no English fallback saved yet, save this as English (first load = English)
      if (Object.keys(englishLabelLUT).length === 0 && Object.keys(englishLinesLUT).length === 0) {
        englishLabelLUT = langData.labelLUT || {};
        englishLinesLUT = langData.linesLUT || {};
        console.log('LangLabelFix: saved English fallback (' + Object.keys(englishLabelLUT).length + ' labels, ' + Object.keys(englishLinesLUT).length + ' line entries)');
      }
      
      // Update current language tables
      labelLUT = langData.labelLUT || {};
      linesLUT = langData.linesLUT || {};
      langLoaded = true;
      console.log('LangLabelFix: synced with new LANGDATA (' + Object.keys(labelLUT).length + ' labels, ' + Object.keys(linesLUT).length + ' line entries)');
    }
  };

  function loadLangData() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', LANG_URL, true);
    xhr.overrideMimeType('application/json');
    xhr.onload = () => {
      if (xhr.status >= 400) {
        console.warn('LangLabelFix: static data/LANGDATA not found (status ' + xhr.status + ') — will use dynamically loaded LANGDATA from ARP_TitleCommandLanguage');
        return;
      }
      let raw = xhr.responseText;
      if (raw.startsWith(LANG_PREFIX)) {
        raw = raw.slice(LANG_PREFIX.length);
      }
      try {
        const data = JSON.parse(raw);
        // Static load at boot = save as English fallback
        englishLabelLUT = data.labelLUT || {};
        englishLinesLUT = data.linesLUT || {};
        labelLUT = data.labelLUT || {};
        linesLUT = data.linesLUT || {};
        langLoaded = true;
        console.log('LangLabelFix: loaded static LANGDATA (' + Object.keys(labelLUT).length + ' labels, ' + Object.keys(linesLUT).length + ' line entries)');
      } catch (e) {
        console.error('LangLabelFix: could not parse static LANGDATA as JSON: ' + e.message);
      }
    };
    xhr.onerror = () => {
      console.warn('LangLabelFix: could not load static data/LANGDATA — will use dynamically loaded LANGDATA from ARP_TitleCommandLanguage');
    };
    xhr.send();
  }

  loadLangData();

  //--------------------------------------------------------------------------
  // Window_ChoiceList — the standard "show choices" event command window.
  //--------------------------------------------------------------------------
  if (typeof Window_ChoiceList !== 'undefined') {
    const _WCL_makeCommandList = Window_ChoiceList.prototype.makeCommandList;
    Window_ChoiceList.prototype.makeCommandList = function () {
      _WCL_makeCommandList.call(this);
      for (const cmd of this._list) {
        if (cmd && typeof cmd.name === 'string') {
          cmd.name = resolveLangText(cmd.name);
        }
      }
    };
  }

  //--------------------------------------------------------------------------
  // Generic command window text (covers most "VN button" style windows,
  // since RPG Maker MV command windows draw via drawItem -> commandName).
  //--------------------------------------------------------------------------
  if (typeof Window_Command !== 'undefined') {
    const _WC_commandName = Window_Command.prototype.commandName;
    Window_Command.prototype.commandName = function (index) {
      const name = _WC_commandName.call(this, index);
      return resolveLangText(name);
    };
  }

  //--------------------------------------------------------------------------
  // Generic escape-character text conversion — catches any other window
  // that draws text directly (dialogue, item lists, etc.) via drawTextEx,
  // in case labels ever show up outside choice buttons too.
  //--------------------------------------------------------------------------
  if (typeof Window_Base !== 'undefined') {
    const _WB_convertEscapeCharacters = Window_Base.prototype.convertEscapeCharacters;
    Window_Base.prototype.convertEscapeCharacters = function (text) {
      text = resolveLangText(text);
      return _WB_convertEscapeCharacters.call(this, text);
    };
  }
})();