(function () {
  "use strict";

  var STORAGE_LAYOUT = "VGP_CurrentLayout";
  var STORAGE_PRESETS = "VGP_Presets";
  var STORAGE_PANEL_POS = "VGP_PanelPos";

  var GEAR_IDLE_MS = 2 * 60 * 1000;   // fade the gear after 2 minutes untouched
  var GEAR_IDLE_OPACITY = 0.12;       // how faint the gear gets once idle
  var BUTTONS_IDLE_MS = 20 * 1000;    // hide the pad/buttons after 20s of no screen activity
//**Keyboard Key CodesLetters: A=65 B=66 C=67 D=68 E=69 F=70 G=71 H=72 I=73 J=74 K=75 L=76 M=77 N=78 O=79 P=80 Q=81 R=82 S=83 T=84 U=85 V=86 W=87 X=88 Y=89 Z=90Numbers (top row): 0=48 1=49 2=50 3=51 4=52 5=53 6=54 7=55 8=56 9=57Numpad: 0=96 1=97 2=98 3=99 4=100 5=101 6=102 7=103 8=104 9=105Arrows: Left=37 Up=38 Right=39 Down=40Function keys: F1=112 F2=113 F3=114 F4=115 F5=116 F6=117 F7=118 F8=119 F9=120 F10=121 F11=122 F12=123Control keys:Backspace=8 Tab=9 Enter=13 Shift=16 Ctrl=17 Alt=18 Pause=19 CapsLock=20 Escape=27 Space=32 PageUp=33 PageDown=34 End=35 Home=36 Insert=45 Delete=46Punctuation:;=186 ==187 ,=188 -=189 .=190 /=191 `=192 [=219 \=220 ]=221 '=222Numpad operators:Multiply=106 Add=107 Subtract=109 Decimal=110 Divide=111Other:NumLock=144 ScrollLock=145 LeftWin/Cmd=91 RightWin/Cmd=92 ContextMenu=9**

var KEY_OPTIONS = [
  { name: "Up", code: 38 },
    { name: "Down", code: 40 },
    { name: "Left", code: 37 },
    { name: "Right", code: 39 },
    { name: "press (Z)", code: 90 },
    { name: "Enter", code: 13 },
    { name: "Cancel (X)", code: 88 },
    { name: "Menu (Esc)", code: 27 },
    { name: "Dash (Shift)", code: 16 },
    { name: "Tab", code: 9 },
    { name: "Page Up (Q)", code: 81 },
    { name: "Page Down (W)", code: 87 },
    { name: "Custom...", code: null }
  ];

  function keyName(code) {
    for (var i = 0; i < KEY_OPTIONS.length; i++) {
      if (KEY_OPTIONS[i].code === code) return KEY_OPTIONS[i].name;
    }
    return "Key " + code;
  }

  function defaultLayout() {
    return {
      opacity: 0.6499999999999999,
      visible: true,
      dpad: { x: 4, y: 58, size: 150 },
      buttons: [
        { id: "btn_1788222119973", label: "B", code: 88, code2: null, shape: "circle", x: 90.43478260869567, y: 41.86666666666666, w: 56, h: 56 },
        { id: "btn_1788222157436", label: "A", code: 16, code2: 90, shape: "circle", x: 79.38530734632683, y: 74.00000000000001, w: 56, h: 56 }
      ]
    };
  }

  function migrateLayout(data) {
    if (!data.dpad) {
      data.dpad = defaultLayout().dpad;
      data.buttons = (data.buttons || []).filter(function (b) {
        return ["up", "down", "left", "right"].indexOf(b.id) === -1;
      });
    }
    if (typeof data.opacity !== "number") data.opacity = 0.55;
    if (typeof data.visible !== "boolean") data.visible = true;
    (data.buttons || []).forEach(function (b) {
      if (typeof b.code2 === "undefined") b.code2 = null;
      if (typeof b.shape === "undefined") b.shape = "square";
    });
    return data;
  }

  function loadLayout() {
    try {
      var raw = window.localStorage.getItem(STORAGE_LAYOUT);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.buttons) return migrateLayout(data);
      }
    } catch (e) {}
    return defaultLayout();
  }

  function saveLayout(layout) {
    try {
      window.localStorage.setItem(STORAGE_LAYOUT, JSON.stringify(layout));
    } catch (e) {}
  }

  function loadPresets() {
    try {
      var raw = window.localStorage.getItem(STORAGE_PRESETS);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }

  function savePresets(presets) {
    try {
      window.localStorage.setItem(STORAGE_PRESETS, JSON.stringify(presets));
    } catch (e) {}
  }

  function loadPanelPos() {
    try {
      var raw = window.localStorage.getItem(STORAGE_PANEL_POS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function savePanelPos(pos) {
    try {
      window.localStorage.setItem(STORAGE_PANEL_POS, JSON.stringify(pos));
    } catch (e) {}
  }

  function sendKey(type, code) {
    var evt;
    try {
      evt = new KeyboardEvent(type, { bubbles: true, cancelable: true, keyCode: code, which: code });
    } catch (e) {
      evt = document.createEvent("Event");
      evt.initEvent(type, true, true);
    }
    try {
      Object.defineProperty(evt, "keyCode", { get: function () { return code; } });
      Object.defineProperty(evt, "which", { get: function () { return code; } });
    } catch (e) {}
    document.dispatchEvent(evt);
  }

  function bindTap(el, handler) {
    var lastFire = 0;
    var startX = 0, startY = 0, gestureActive = false, moved = false, firedThisGesture = false;
    var MOVE_THRESHOLD = 10;

    function fire() {
      var now = Date.now();
      if (now - lastFire < 300) return;
      lastFire = now;
      handler();
    }
    function start(x, y) {
      gestureActive = true;
      moved = false;
      firedThisGesture = false;
      startX = x;
      startY = y;
    }
    function trackMove(x, y) {
      if (!gestureActive) return;
      if (Math.abs(x - startX) > MOVE_THRESHOLD || Math.abs(y - startY) > MOVE_THRESHOLD) moved = true;
    }
    function end(e) {
      if (!gestureActive) return;
      if (moved) { gestureActive = false; return; }
      if (e && e.cancelable) e.preventDefault();
      if (!firedThisGesture) {
        firedThisGesture = true;
        fire();
      }
    }

    el.addEventListener("pointerdown", function (e) { start(e.clientX, e.clientY); });
    el.addEventListener("pointermove", function (e) { trackMove(e.clientX, e.clientY); });
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", function () { gestureActive = false; });

    el.addEventListener("touchstart", function (e) {
      var t = e.touches[0];
      if (t) start(t.clientX, t.clientY);
    }, { passive: true });
    el.addEventListener("touchmove", function (e) {
      var t = e.touches[0];
      if (t) trackMove(t.clientX, t.clientY);
    }, { passive: true });
    el.addEventListener("touchend", end, { passive: false });
  }

  var VGP = {
    layout: null,
    menuOpen: false,
    adjustMode: false,
    uiWrap: null,
    container: null,
    toolbar: null,
    menuCollapsed: false,
    dpadEl: null,
    buttonEls: {},
    activePointers: {},
    dragInfo: null,
    resizeInfo: null,
    dpadDragInfo: null,
    dpadResizeInfo: null,
    panelDragActive: false,
    gearEl: null,
    gearIdleTimer: null,
    gearFaded: false,
    buttonsIdleTimer: null,
    buttonsIdleHidden: false
  };

  function css() {
    return (
      "html,body{position:fixed;top:0;left:0;width:100%;height:100%;margin:0;padding:0;" +
      "overflow:hidden;overscroll-behavior:none;touch-action:none;color-scheme:light;}" +
      "#vgp-root{position:fixed;left:0;top:0;width:100%;height:100%;z-index:99999;pointer-events:none;font-family:sans-serif;touch-action:none;}" +
      ".vgp-btn{position:absolute;display:flex;align-items:center;justify-content:center;" +
      "border-radius:14px;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.55);" +
      "color:#fff;font-size:14px;font-weight:bold;user-select:none;pointer-events:auto;touch-action:none;" +
      "box-shadow:0 0 6px rgba(0,0,0,0.4);text-shadow:0 0 3px rgba(0,0,0,0.8);}" +
      ".vgp-btn.vgp-btn-circle{border-radius:50%;}" +
      ".vgp-btn.vgp-pressed{background:rgba(255,255,255,0.45);}" +
      ".vgp-btn.vgp-edit{border-style:dashed;}" +
      ".vgp-dpad{position:absolute;border-radius:50%;background:rgba(255,255,255,0.10);" +
      "border:2px solid rgba(255,255,255,0.5);box-shadow:0 0 6px rgba(0,0,0,0.4) inset;" +
      "pointer-events:auto;touch-action:none;}" +
      ".vgp-dpad.vgp-edit{border-style:dashed;}" +
      ".vgp-dpad-ring{position:absolute;left:50%;top:50%;width:34%;height:34%;border-radius:50%;" +
      "border:1.5px dashed rgba(255,255,255,0.3);transform:translate(-50%,-50%);pointer-events:none;}" +
      ".vgp-dpad-lines{position:absolute;width:100%;height:100%;left:0;top:0;pointer-events:none;overflow:hidden;border-radius:50%;}" +
      ".vgp-dpad-line{position:absolute;background:rgba(255,255,255,0.4);}" +
      ".vgp-dpad-line-diag{position:absolute;width:120%;height:1px;background:rgba(255,255,255,0.4);left:50%;top:50%;}" +
      ".vgp-dpad-line-diag-45{transform:translate(-50%,-50%) rotate(45deg);}" +
      ".vgp-dpad-line-diag-135{transform:translate(-50%,-50%) rotate(-45deg);}" +
      ".vgp-dpad-knob{position:absolute;left:50%;top:50%;width:34%;height:34%;border-radius:50%;" +
      "background:rgba(255,255,255,0.5);border:2px solid rgba(255,255,255,0.85);" +
      "box-shadow:0 0 6px rgba(0,0,0,0.5);pointer-events:none;" +
      "transform:translate(-50%,-50%);}" +
      ".vgp-dpad-knob.vgp-dpad-active{background:rgba(255,230,109,0.65);border-color:#ffe66d;}" +
      ".vgp-remove{position:absolute;top:-10px;right:-10px;width:22px;height:22px;border-radius:50%;" +
      "background:#c0392b;border:2px solid #fff;color:#fff;font-size:13px;line-height:18px;text-align:center;" +
      "pointer-events:auto;touch-action:none;}" +
      ".vgp-resize{position:absolute;bottom:-8px;right:-8px;width:18px;height:18px;border-radius:4px;" +
      "background:#2980b9;border:2px solid #fff;pointer-events:auto;touch-action:none;cursor:nwse-resize;}" +
      "#vgp-gear{position:fixed;top:10px;left:10px;width:34px;height:34px;border-radius:50%;" +
      "background:rgba(0,0,0,0.45);color:#fff;border:1px solid rgba(255,255,255,0.6);" +
      "display:flex;align-items:center;justify-content:center;font-size:16px;z-index:100000;" +
      "pointer-events:auto;touch-action:none;user-select:none;transition:opacity 0.4s ease;}" +
      "#vgp-menu{position:fixed;top:10px;left:50px;width:210px;max-width:75vw;background:rgba(192,192,192,0.98);" +
      "border-radius:14px;box-shadow:0 4px 18px rgba(0,0,0,0.35);z-index:100001;pointer-events:auto;" +
      "overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:none;" +
      "max-height:min(80vh,80svh);font-size:15px;}" +
      "#vgp-menu.vgp-menu-collapsed{width:auto;min-width:0;max-height:none;overflow:visible;}" +
      "#vgp-menu.vgp-menu-collapsed .vgp-menu-item{padding:8px 16px;}" +
      ".vgp-menu-item{display:flex;align-items:center;justify-content:space-between;gap:10px;" +
      "padding:13px 16px;color:#111;border-bottom:2px solid #000;cursor:pointer;" +
      "-webkit-tap-highlight-color:transparent;}" +
      ".vgp-menu-item:last-child{border-bottom:none;}" +
      ".vgp-menu-item:active{background:rgba(0,0,0,0.06);}" +
      ".vgp-menu-item.vgp-menu-danger{color:#c0392b;}" +
      ".vgp-menu-icon{opacity:0.45;font-size:15px;flex-shrink:0;}" +
      ".vgp-menu-icon-img{width:18px;height:18px;object-fit:contain;flex-shrink:0;opacity:0.85;}" +
      "#vgp-panel{position:fixed;left:50%;top:70px;transform:translateX(-50%);background:#222;color:#fff;" +
      "border:1px solid #666;border-radius:8px;padding:14px;z-index:100002;pointer-events:auto;" +
      "max-height:70svh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;" +
      "touch-action:none;width:min(340px,90%);box-sizing:border-box;font-size:13px;color-scheme:light;}" +
      "#vgp-panel.vgp-panel-positioned{transform:none;}" +
      "#vgp-panel h3{margin:0 0 8px 0;font-size:14px;cursor:move;user-select:none;" +
      "display:flex;align-items:center;justify-content:space-between;padding:2px 0;touch-action:none;}" +
      "#vgp-panel h3 .vgp-drag-hint{opacity:0.4;font-size:13px;font-weight:normal;}" +
      "#vgp-panel label{display:block;margin:8px 0 3px;}" +
      "#vgp-panel input[type=text],#vgp-panel input[type=number],#vgp-panel select{" +
      "width:100%;box-sizing:border-box;padding:6px;border-radius:4px;border:1px solid #555;" +
      "background-color:#000 !important;color:#fff !important;color-scheme:light;" +
      "-webkit-appearance:none;-moz-appearance:none;appearance:none;}" +
      "#vgp-panel select option{background-color:#000 !important;color:#fff !important;}" +
      "#vgp-panel .vgp-row{display:flex;gap:6px;margin-top:10px;}" +
      ".vgp-tbtn{padding:8px 12px;background:#34495e;color:#fff;border:1px solid #7f8c8d;border-radius:6px;" +
      "font-size:13px;cursor:pointer;text-align:center;-webkit-tap-highlight-color:transparent;}" +
      ".vgp-tbtn:active{background:#2c3e50;}" +
      ".vgp-tbtn-black{background:#000;border-color:#333;}" +
      ".vgp-tbtn-black:active{background:#111;}" +
      "#vgp-panel .vgp-row .vgp-tbtn{flex:1;}" +
      ".vgp-preset-row{display:flex;gap:6px;align-items:center;margin:4px 0;}" +
      ".vgp-preset-row span{flex:1;}" +
      ".vgp-hint{opacity:0.65;font-size:11px;margin-top:2px;}");
  }

  function injectStyle() {
    var style = document.createElement("style");
    style.id = "vgp-style";
    style.textContent = css();
    document.head.appendChild(style);
  }

  function guardUiInput(el) {
    ["mousedown", "touchstart", "pointerdown", "click"].forEach(function (type) {
      el.addEventListener(type, function (e) { e.stopPropagation(); }, false);
    });
  }

  function scheduleGearIdle() {
    if (VGP.gearIdleTimer) clearTimeout(VGP.gearIdleTimer);
    VGP.gearIdleTimer = setTimeout(function () {
      VGP.gearFaded = true;
      if (VGP.gearEl) VGP.gearEl.style.opacity = String(GEAR_IDLE_OPACITY);
    }, GEAR_IDLE_MS);
  }

  function wakeGear() {
    VGP.gearFaded = false;
    if (VGP.gearEl) VGP.gearEl.style.opacity = "1";
    scheduleGearIdle();
  }

  function computeContainerVisible() {
    if (VGP.adjustMode) return true;
    if (!VGP.layout.visible) return false;
    if (VGP.buttonsIdleHidden) return false;
    return true;
  }

  function updateContainerVisibility() {
    if (!VGP.container) return;
    VGP.container.style.display = computeContainerVisible() ? "block" : "none";
  }

  function scheduleButtonsIdle() {
    if (VGP.buttonsIdleTimer) clearTimeout(VGP.buttonsIdleTimer);
    VGP.buttonsIdleTimer = setTimeout(function () {
      VGP.buttonsIdleHidden = true;
      updateContainerVisibility();
    }, BUTTONS_IDLE_MS);
  }

  function wakeButtons() {
    if (VGP.buttonsIdleHidden) {
      VGP.buttonsIdleHidden = false;
      updateContainerVisibility();
    }
    if (!VGP.menuOpen && !VGP.adjustMode) scheduleButtonsIdle();
  }

  function build() {
    injectStyle();

    var uiWrap = document.createElement("div");
    uiWrap.id = "vgp-ui";
    uiWrap.style.touchAction = "none";
    document.body.appendChild(uiWrap);
    guardUiInput(uiWrap);
    VGP.uiWrap = uiWrap;

    var root = document.createElement("div");
    root.id = "vgp-root";
    uiWrap.appendChild(root);
    VGP.container = root;

    var gear = document.createElement("div");
    gear.id = "vgp-gear";
    var gearImg = document.createElement("img");
    gearImg.src = "img/pad/gear.png";
    gearImg.style.width = "70%";
    gearImg.style.height = "70%";
    gearImg.style.pointerEvents = "none";
    gear.appendChild(gearImg);
    bindTap(gear, function () {
      wakeGear();
      toggleMenu();
    });
    uiWrap.appendChild(gear);
    VGP.gearEl = gear;
    scheduleGearIdle();

    renderAll();
    scheduleButtonsIdle();
  }

  function clearButtons() {
    Object.keys(VGP.buttonEls).forEach(function (id) {
      var rec = VGP.buttonEls[id];
      if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
    });
    VGP.buttonEls = {};
    if (VGP.dpadEl && VGP.dpadEl.parentNode) VGP.dpadEl.parentNode.removeChild(VGP.dpadEl);
    VGP.dpadEl = null;
  }

  function renderAll() {
    clearButtons();
    VGP.container.style.display = computeContainerVisible() ? "block" : "none";
    VGP.container.style.opacity = String(VGP.layout.opacity);
    renderDpad();
    VGP.layout.buttons.forEach(function (btn) {
      renderButton(btn);
    });
  }

  function renderDpad() {
    var d = VGP.layout.dpad;
    var el = document.createElement("div");
    el.className = "vgp-dpad" + (VGP.adjustMode ? " vgp-edit" : "");
    el.style.left = d.x + "vw";
    el.style.top = d.y + "vh";
    el.style.width = d.size + "px";
    el.style.height = d.size + "px";
    
    // Create the lines container
    var linesContainer = document.createElement("div");
    linesContainer.className = "vgp-dpad-lines";
    
    // Create diagonal line 45 degrees
    var lineDiag45 = document.createElement("div");
    lineDiag45.className = "vgp-dpad-line vgp-dpad-line-diag vgp-dpad-line-diag-45";
    linesContainer.appendChild(lineDiag45);
    
    // Create diagonal line -45 degrees
    var lineDiag135 = document.createElement("div");
    lineDiag135.className = "vgp-dpad-line vgp-dpad-line-diag vgp-dpad-line-diag-135";
    linesContainer.appendChild(lineDiag135);
    
    el.appendChild(linesContainer);
    el.innerHTML += '<div class="vgp-dpad-ring"></div>' +
      '<div class="vgp-dpad-knob"></div>';
    
    VGP.container.appendChild(el);
    VGP.dpadEl = el;

    if (VGP.adjustMode) {
      attachDpadEditHandlers(d, el);
    } else {
      attachDpadPlayHandlers(el);
    }
  }

  function attachDpadPlayHandlers(el) {
    var DIR_CODE = { up: 38, down: 40, left: 37, right: 39 };
    var active = { up: false, down: false, left: false, right: false };
    var pointerId = null;
    var knob = el.querySelector(".vgp-dpad-knob");

    function setDir(dir, on) {
      if (active[dir] === on) return;
      active[dir] = on;
      sendKey(on ? "keydown" : "keyup", DIR_CODE[dir]);
      knob.classList.toggle("vgp-dpad-active", active.up || active.down || active.left || active.right);
    }

    function releaseAll() {
      Object.keys(active).forEach(function (dir) { setDir(dir, false); });
    }

    function moveKnob(kx, ky) {
      knob.style.transform = "translate(-50%,-50%) translate(" + kx + "px," + ky + "px)";
    }

    function resetKnob() {
      knob.style.transition = "transform 0.12s ease-out";
      moveKnob(0, 0);
    }

    function updateFromPoint(clientX, clientY) {
      var rect = el.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = clientX - cx;
      var dy = clientY - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var maxOffset = rect.width * 0.29;
      var clamped = Math.min(dist, maxOffset);
      var angleRad = Math.atan2(dy, dx);
      knob.style.transition = "none";
      moveKnob(Math.cos(angleRad) * clamped, Math.sin(angleRad) * clamped);

      var deadZone = rect.width * 0.12;
      if (dist < deadZone) { releaseAll(); return; }
      var angle = angleRad * 180 / Math.PI;
      // Zones are bounded exactly by the X lines (45°, 135°, -45°, -135°).
      // Only one direction is ever active - it flips the instant the
      // finger crosses a diagonal line, instead of blending into a
      // combined diagonal press.
      var dir;
      if (angle >= -45 && angle < 45) {
        dir = "right";
      } else if (angle >= 45 && angle < 135) {
        dir = "down";
      } else if (angle >= -135 && angle < -45) {
        dir = "up";
      } else {
        dir = "left";
      }
      setDir("right", dir === "right");
      setDir("down", dir === "down");
      setDir("left", dir === "left");
      setDir("up", dir === "up");
    }

    // FIX: ignore a second pointerdown while one is already active on this
    // control - previously a stray extra touch on the dpad would silently
    // overwrite `pointerId`, so the original finger's eventual lift-off no
    // longer matched and the direction could get stuck "on" or the dpad
    // would stop responding until reload. This is what caused dpad+other
    // button interactions to intermittently break.
    el.addEventListener("pointerdown", function (e) {
      if (pointerId !== null) return;
      e.preventDefault();
      pointerId = e.pointerId;
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      updateFromPoint(e.clientX, e.clientY);
      wakeButtons();
    });
    el.addEventListener("pointermove", function (e) {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      updateFromPoint(e.clientX, e.clientY);
    });
    function end(e) {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      if (e && e.cancelable) e.preventDefault();
      pointerId = null;
      releaseAll();
      resetKnob();
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    el.addEventListener("touchstart", function (e) { e.preventDefault(); }, { passive: false });
    el.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
  }

  function attachDpadEditHandlers(d, el) {
    var resizeHandle = document.createElement("div");
    resizeHandle.className = "vgp-resize";
    resizeHandle.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      e.preventDefault();
      resizeHandle.setPointerCapture && resizeHandle.setPointerCapture(e.pointerId);
      VGP.dpadResizeInfo = { startX: e.clientX, startY: e.clientY, startSize: d.size };
    });
    el.appendChild(resizeHandle);

    el.addEventListener("pointerdown", function (e) {
      if (e.target !== el) return;
      e.preventDefault();
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      VGP.dpadDragInfo = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: d.x,
        startY: d.y,
        vw: window.innerWidth,
        vh: window.innerHeight
      };
    });
  }

  function renderButton(btn) {
    var el = document.createElement("div");
    el.className = "vgp-btn" +
      (btn.shape === "circle" ? " vgp-btn-circle" : "") +
      (VGP.adjustMode ? " vgp-edit" : "");
    el.style.left = btn.x + "vw";
    el.style.top = btn.y + "vh";
    el.style.width = btn.w + "px";
    el.style.height = btn.h + "px";
    el.textContent = btn.label;
    VGP.container.appendChild(el);
    VGP.buttonEls[btn.id] = { el: el, data: btn };

    if (VGP.adjustMode) {
      attachEditHandlers(btn, el);
    } else {
      attachPlayHandlers(btn, el);
    }
  }

  function attachPlayHandlers(btn, el) {
    var pointerId = null;

    function press(e) {
      if (pointerId !== null) return;
      e.preventDefault();
      pointerId = e.pointerId;
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      el.classList.add("vgp-pressed");
      sendKey("keydown", btn.code);
      if (btn.code2 != null) sendKey("keydown", btn.code2);
      wakeButtons();
    }

    function release(e) {
      if (e.pointerId !== pointerId) return;
      if (e && e.cancelable) e.preventDefault();
      pointerId = null;
      el.classList.remove("vgp-pressed");
      sendKey("keyup", btn.code);
      if (btn.code2 != null) sendKey("keyup", btn.code2);
    }

    el.addEventListener("pointerdown", press);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    el.addEventListener("touchstart", function (e) { e.preventDefault(); }, { passive: false });
    el.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
  }

  function attachEditHandlers(btn, el) {
    var removeBadge = document.createElement("div");
    removeBadge.className = "vgp-remove";
    removeBadge.textContent = "×";
    removeBadge.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      e.preventDefault();
      VGP.layout.buttons = VGP.layout.buttons.filter(function (b) { return b.id !== btn.id; });
      saveLayout(VGP.layout);
      renderAll();
    });
    el.appendChild(removeBadge);

    var resizeHandle = document.createElement("div");
    resizeHandle.className = "vgp-resize";
    resizeHandle.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      e.preventDefault();
      resizeHandle.setPointerCapture && resizeHandle.setPointerCapture(e.pointerId);
      VGP.resizeInfo = { id: btn.id, startX: e.clientX, startY: e.clientY, startW: btn.w, startH: btn.h };
    });
    el.appendChild(resizeHandle);

    el.addEventListener("pointerdown", function (e) {
      if (e.target !== el) return;
      e.preventDefault();
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      var rect = { w: window.innerWidth, h: window.innerHeight };
      VGP.dragInfo = {
        id: btn.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: btn.x,
        startY: btn.y,
        vw: rect.w,
        vh: rect.h
      };
    });
  }

  function onPointerMove(e) {
    if (VGP.dragInfo && VGP.dragInfo.id) {
      var d = VGP.dragInfo;
      var btn = findButton(d.id);
      if (btn) {
        var dxPct = ((e.clientX - d.startClientX) / d.vw) * 100;
        var dyPct = ((e.clientY - d.startClientY) / d.vh) * 100;
        btn.x = clamp(d.startX + dxPct, 0, 96);
        btn.y = clamp(d.startY + dyPct, 0, 96);
        var rec = VGP.buttonEls[d.id];
        if (rec) {
          rec.el.style.left = btn.x + "vw";
          rec.el.style.top = btn.y + "vh";
        }
      }
    } else if (VGP.resizeInfo && VGP.resizeInfo.id) {
      var r = VGP.resizeInfo;
      var b2 = findButton(r.id);
      if (b2) {
        b2.w = clamp(r.startW + (e.clientX - r.startX), 30, 160);
        b2.h = clamp(r.startH + (e.clientY - r.startY), 30, 160);
        var rec2 = VGP.buttonEls[r.id];
        if (rec2) {
          rec2.el.style.width = b2.w + "px";
          rec2.el.style.height = b2.h + "px";
        }
      }
    } else if (VGP.dpadDragInfo) {
      var dd = VGP.dpadDragInfo;
      var dxPct2 = ((e.clientX - dd.startClientX) / dd.vw) * 100;
      var dyPct2 = ((e.clientY - dd.startClientY) / dd.vh) * 100;
      VGP.layout.dpad.x = clamp(dd.startX + dxPct2, 0, 96);
      VGP.layout.dpad.y = clamp(dd.startY + dyPct2, 0, 96);
      if (VGP.dpadEl) {
        VGP.dpadEl.style.left = VGP.layout.dpad.x + "vw";
        VGP.dpadEl.style.top = VGP.layout.dpad.y + "vh";
      }
    } else if (VGP.dpadResizeInfo) {
      var dr = VGP.dpadResizeInfo;
      VGP.layout.dpad.size = clamp(dr.startSize + (e.clientX - dr.startX), 80, 260);
      if (VGP.dpadEl) {
        VGP.dpadEl.style.width = VGP.layout.dpad.size + "px";
        VGP.dpadEl.style.height = VGP.layout.dpad.size + "px";
        VGP.dpadEl.style.fontSize = Math.round(VGP.layout.dpad.size * 0.26) + "px";
      }
    }
  }

  function onPointerUp() {
    if (VGP.dragInfo || VGP.resizeInfo || VGP.dpadDragInfo || VGP.dpadResizeInfo) {
      VGP.dragInfo = null;
      VGP.resizeInfo = null;
      VGP.dpadDragInfo = null;
      VGP.dpadResizeInfo = null;
      saveLayout(VGP.layout);
    }
  }

  function isInsideScrollableUi(target) {
    return !!(target && target.closest && (target.closest("#vgp-panel") || target.closest("#vgp-menu")));
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function attachManualScroll(el) {
    var THRESHOLD = 6;
    var startY = 0, startScrollTop = 0, dragging = false, pointerId = null;

    function start(y) {
      startY = y;
      startScrollTop = el.scrollTop;
      dragging = false;
    }
    function move(y, e) {
      var dy = startY - y;
      if (!dragging) {
        if (Math.abs(dy) < THRESHOLD) return;
        dragging = true;
      }
      if (e && e.cancelable) e.preventDefault();
      var max = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollTop = clamp(startScrollTop + dy, 0, max);
    }
    function end() {
      dragging = false;
      pointerId = null;
    }

    el.addEventListener("pointerdown", function (e) {
      pointerId = e.pointerId;
      start(e.clientY);
    });
    el.addEventListener("pointermove", function (e) {
      if (e.pointerId !== pointerId) return;
      move(e.clientY, e);
    });
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);

    el.addEventListener("touchstart", function (e) {
      var t = e.touches[0];
      if (t) start(t.clientY);
    }, { passive: true });
    el.addEventListener("touchmove", function (e) {
      var t = e.touches[0];
      if (t) move(t.clientY, e);
    }, { passive: false });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", end, { passive: true });
  }

  function findButton(id) {
    for (var i = 0; i < VGP.layout.buttons.length; i++) {
      if (VGP.layout.buttons[i].id === id) return VGP.layout.buttons[i];
    }
    return null;
  }

  function toggleMenu() {
    VGP.menuOpen = !VGP.menuOpen;
    if (VGP.menuOpen) {
      VGP.menuCollapsed = false;
      VGP.adjustMode = false;
      if (VGP.buttonsIdleTimer) clearTimeout(VGP.buttonsIdleTimer);
      VGP.buttonsIdleHidden = false;
      buildToolbar();
    } else {
      VGP.menuCollapsed = false;
      VGP.adjustMode = false;
      removeToolbar();
      removePanel();
      VGP.buttonsIdleHidden = false;
      scheduleButtonsIdle();
    }
    renderAll();
  }

  function menuRow(label, icon, onClick, danger) {
    var row = document.createElement("div");
    row.className = "vgp-menu-item" + (danger ? " vgp-menu-danger" : "");
    var span = document.createElement("span");
    span.textContent = label;
    row.appendChild(span);

    var iconEl;
    if (typeof icon === "string" && /\.(png|jpe?g|gif|svg)$/i.test(icon)) {
      iconEl = document.createElement("img");
      iconEl.className = "vgp-menu-icon-img";
      iconEl.src = icon;
      iconEl.alt = "";
    } else {
      iconEl = document.createElement("span");
      iconEl.className = "vgp-menu-icon";
      iconEl.textContent = icon;
    }
    row.appendChild(iconEl);

    bindTap(row, onClick);
    return row;
  }

  function finishEditing() {
    VGP.menuCollapsed = false;
    VGP.adjustMode = false;
    toggleMenu();
  }

  function buildToolbar() {
    removeToolbar();
    var menu = document.createElement("div");
    menu.id = "vgp-menu";

    if (VGP.menuCollapsed) {
      menu.classList.add("vgp-menu-collapsed");
      menu.appendChild(menuRow("Done", "✓", finishEditing));
    } else {
      var visibilityIcon = VGP.layout.visible ? "img/pad/noeye.png" : "img/pad/eye.png";
      menu.appendChild(menuRow(VGP.layout.visible ? "Hide Virtual Pad" : "Show Virtual Pad", visibilityIcon, function () {
        VGP.layout.visible = !VGP.layout.visible;
        saveLayout(VGP.layout);
        renderAll();
        buildToolbar();
      }));
      menu.appendChild(menuRow("Add Button", "›", showAddPanel));
      menu.appendChild(menuRow("Backup", "›", showPresetPanel));

      var transparencyPlusIcon = "img/pad/plus.png";
      var transparencyMinusIcon = "img/pad/minus.png";

      menu.appendChild(menuRow("Transparency", transparencyPlusIcon, function () { changeOpacity(0.1); }));
      menu.appendChild(menuRow("Transparency", transparencyMinusIcon, function () { changeOpacity(-0.1); }));
      menu.appendChild(menuRow("Adjust Buttons", "⤢", function () {
        VGP.menuCollapsed = true;
        VGP.adjustMode = true;
        buildToolbar();
        renderAll();
      }));
      menu.appendChild(menuRow("Reset Buttons", "↺", function () {
        VGP.layout = defaultLayout();
        saveLayout(VGP.layout);
        renderAll();
      }, true));
      menu.appendChild(menuRow("Done", "✓", finishEditing));
    }

    attachManualScroll(menu);
    VGP.uiWrap.appendChild(menu);
    VGP.toolbar = menu;
  }

  function removeToolbar() {
    if (VGP.toolbar && VGP.toolbar.parentNode) VGP.toolbar.parentNode.removeChild(VGP.toolbar);
    VGP.toolbar = null;
  }

  function tbtn(label, onClick) {
    var b = document.createElement("div");
    b.className = "vgp-tbtn";
    b.textContent = label;
    bindTap(b, onClick);
    return b;
  }

  function changeOpacity(delta) {
    VGP.layout.opacity = clamp(VGP.layout.opacity + delta, 0.15, 1);
    saveLayout(VGP.layout);
    VGP.container.style.opacity = String(VGP.layout.opacity);
  }

  function removePanel() {
    var p = document.getElementById("vgp-panel");
    if (p && p.parentNode) p.parentNode.removeChild(p);
  }

  function makePanel(title) {
    removePanel();
    var p = document.createElement("div");
    p.id = "vgp-panel";
    VGP.uiWrap.appendChild(p);

    if (!document.getElementById("vgp-drag-hint-style")) {
      var style = document.createElement("style");
      style.id = "vgp-drag-hint-style";
      style.textContent = ".vgp-drag-hint { display: inline-block; width: 16px; height: 16px; background-size: contain; background-repeat: no-repeat; background-position: center; }";
      document.head.appendChild(style);
    }

    var h = document.createElement("h3");
    var titleSpan = document.createElement("span");
    titleSpan.textContent = title;
    var hint = document.createElement("span");
    hint.className = "vgp-drag-hint";
    var drag = "img/pad/drag.png";
    hint.style.backgroundImage = "url('" + drag + "')";
    h.appendChild(titleSpan);
    h.appendChild(hint);
    p.appendChild(h);

    var savedPos = loadPanelPos();
    if (savedPos) {
      p.classList.add("vgp-panel-positioned");
      p.style.left = clamp(savedPos.x, 0, Math.max(0, window.innerWidth - 40)) + "px";
      p.style.top = clamp(savedPos.y, 0, Math.max(0, window.innerHeight - 40)) + "px";
    }

    attachPanelDragHandlers(p, h);
    attachManualScroll(p);
    return p;
  }

  function attachPanelDragHandlers(panel, handle) {
    var dragInfo = null;

    function startDrag(pointerId, clientX, clientY) {
      var rect = panel.getBoundingClientRect();
      dragInfo = {
        pointerId: pointerId,
        startClientX: clientX,
        startClientY: clientY,
        startLeft: rect.left,
        startTop: rect.top,
        w: rect.width,
        h: rect.height
      };
      VGP.panelDragActive = true;
    }

    function moveDrag(clientX, clientY) {
      if (!dragInfo) return;
      var dx = clientX - dragInfo.startClientX;
      var dy = clientY - dragInfo.startClientY;
      var newLeft = clamp(dragInfo.startLeft + dx, 0, Math.max(0, window.innerWidth - dragInfo.w));
      var newTop = clamp(dragInfo.startTop + dy, 0, Math.max(0, window.innerHeight - dragInfo.h));
      panel.classList.add("vgp-panel-positioned");
      panel.style.left = newLeft + "px";
      panel.style.top = newTop + "px";
    }

    function endDrag() {
      if (!dragInfo) return;
      dragInfo = null;
      VGP.panelDragActive = false;
      var rect = panel.getBoundingClientRect();
      savePanelPos({ x: rect.left, y: rect.top });
    }

    handle.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      e.preventDefault();
      handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
      startDrag(e.pointerId, e.clientX, e.clientY);
    });
    handle.addEventListener("pointermove", function (e) {
      if (!dragInfo || e.pointerId !== dragInfo.pointerId) return;
      e.preventDefault();
      moveDrag(e.clientX, e.clientY);
    });
    handle.addEventListener("pointerup", function (e) {
      if (!dragInfo || e.pointerId !== dragInfo.pointerId) return;
      endDrag();
    });
    handle.addEventListener("pointercancel", function (e) {
      if (!dragInfo || e.pointerId !== dragInfo.pointerId) return;
      endDrag();
    });

    handle.addEventListener("touchstart", function (e) {
      e.stopPropagation();
      e.preventDefault();
      var t = e.touches[0];
      if (t) startDrag("touch", t.clientX, t.clientY);
    }, { passive: false, capture: true });
    handle.addEventListener("touchmove", function (e) {
      if (!dragInfo) return;
      e.stopPropagation();
      e.preventDefault();
      var t = e.touches[0];
      if (t) moveDrag(t.clientX, t.clientY);
    }, { passive: false, capture: true });
    handle.addEventListener("touchend", function (e) {
      if (!dragInfo) return;
      e.preventDefault();
      endDrag();
    }, { passive: false });
    handle.addEventListener("touchcancel", function () {
      endDrag();
    }, { passive: true });

    panel._vgpEndDrag = endDrag;
  }

  function showAddPanel() {
    var p = makePanel("Add Button");

    var labelLbl = document.createElement("label");
    labelLbl.textContent = "Name";
    p.appendChild(labelLbl);
    var labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.value = "A";
    labelInput.maxLength = 6;
    p.appendChild(labelInput);

    var shapeLbl = document.createElement("label");
    shapeLbl.textContent = "Shape";
    p.appendChild(shapeLbl);
    var shapeSelect = document.createElement("select");
    [["circle", "Circle"], ["square", "Square"]].forEach(function (pair) {
      var o = document.createElement("option");
      o.value = pair[0];
      o.textContent = pair[1];
      shapeSelect.appendChild(o);
    });
    p.appendChild(shapeSelect);

    var keyLbl = document.createElement("label");
    keyLbl.textContent = "Key 1";
    p.appendChild(keyLbl);
    var select = document.createElement("select");
    KEY_OPTIONS.forEach(function (opt, i) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = opt.name;
      select.appendChild(o);
    });
    p.appendChild(select);

    var customWrap = document.createElement("div");
    var customLbl = document.createElement("label");
    customLbl.textContent = "Custom code for Key 1";
    customWrap.appendChild(customLbl);
    var customInput = document.createElement("input");
    customInput.type = "number";
    customInput.placeholder = "e.g. 65 for 'A'";
    customWrap.appendChild(customInput);
    p.appendChild(customWrap);
    function syncCustomVisibility() {
      var opt = KEY_OPTIONS[Number(select.value)];
      customWrap.style.display = opt && opt.code === null ? "block" : "none";
    }
    select.addEventListener("change", syncCustomVisibility);
    syncCustomVisibility();

    var key2Lbl = document.createElement("label");
    key2Lbl.textContent = "Key 2 (optional — combo)";
    p.appendChild(key2Lbl);
    var select2 = document.createElement("select");
    var noneOpt = document.createElement("option");
    noneOpt.value = "none";
    noneOpt.textContent = "None (single key)";
    select2.appendChild(noneOpt);
    KEY_OPTIONS.forEach(function (opt, i) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = opt.name;
      select2.appendChild(o);
    });
    p.appendChild(select2);
    var hint = document.createElement("div");
    hint.className = "vgp-hint";
    hint.textContent = "When set, one tap presses Key 1 and Key 2 together.";
    p.appendChild(hint);

    var custom2Wrap = document.createElement("div");
    var custom2Lbl = document.createElement("label");
    custom2Lbl.textContent = "Custom code for Key 2";
    custom2Wrap.appendChild(custom2Lbl);
    var custom2Input = document.createElement("input");
    custom2Input.type = "number";
    custom2Input.placeholder = "e.g. 65 for 'A'";
    custom2Wrap.appendChild(custom2Input);
    p.appendChild(custom2Wrap);
    function syncCustom2Visibility() {
      if (select2.value === "none") { custom2Wrap.style.display = "none"; return; }
      var opt2 = KEY_OPTIONS[Number(select2.value)];
      custom2Wrap.style.display = opt2 && opt2.code === null ? "block" : "none";
    }
    select2.addEventListener("change", syncCustom2Visibility);
    syncCustom2Visibility();

    var row = document.createElement("div");
    row.className = "vgp-row";

    var createBtn = tbtn("Create", function () {
      var opt = KEY_OPTIONS[Number(select.value)];
      var code = opt.code;
      if (code === null) {
        var n = parseInt(customInput.value, 10);
        if (isNaN(n)) { return; }
        code = n;
      }
      var code2 = null;
      if (select2.value !== "none") {
        var opt2 = KEY_OPTIONS[Number(select2.value)];
        code2 = opt2.code;
        if (code2 === null) {
          var n2 = parseInt(custom2Input.value, 10);
          code2 = isNaN(n2) ? null : n2;
        }
      }
      var id = "btn_" + Date.now();

      var existingCount = VGP.layout.buttons.length;
      var offset = (existingCount % 6) * 10;

      VGP.layout.buttons.push({
        id: id,
        label: labelInput.value.slice(0, 6) || "?",
        code: code,
        code2: code2,
        shape: shapeSelect.value === "circle" ? "circle" : "square",
        x: clamp(40 + offset, 0, 90),
        y: clamp(40 + offset, 0, 90),
        w: 56, h: 56
      });
      saveLayout(VGP.layout);
      removePanel();
      renderAll();
    });
    createBtn.classList.add("vgp-tbtn-blue");

    var cancelBtn = tbtn("Cancel", removePanel);
    cancelBtn.classList.add("vgp-tbtn-black");

    row.appendChild(cancelBtn);
    row.appendChild(createBtn);
    p.appendChild(row);
  }

  function showPresetPanel() {
    var p = makePanel("Backup");

    var presets = loadPresets();
    var names = Object.keys(presets);
    if (names.length === 0) {
      var none = document.createElement("div");
      none.textContent = "No saved presets yet.";
      p.appendChild(none);
    } else {
      names.forEach(function (name) {
        var row = document.createElement("div");
        row.className = "vgp-preset-row";
        var span = document.createElement("span");
        span.textContent = name;
        row.appendChild(span);
        row.appendChild(tbtn("Load", function () {
          VGP.layout = migrateLayout(JSON.parse(JSON.stringify(presets[name])));
          saveLayout(VGP.layout);
          removePanel();
          renderAll();
        }));
        row.appendChild(tbtn("Delete", function () {
          delete presets[name];
          savePresets(presets);
          showPresetPanel();
        }));
        p.appendChild(row);
      });
    }

    var saveLbl = document.createElement("label");
    saveLbl.textContent = "Save current layout as...";
    p.appendChild(saveLbl);
    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Preset name";
    p.appendChild(nameInput);

    var row2 = document.createElement("div");
    row2.className = "vgp-row";
    var saveBtn = tbtn("Save", function () {
      var name = nameInput.value.trim();
      if (!name) return;
      presets[name] = JSON.parse(JSON.stringify(VGP.layout));
      savePresets(presets);
      showPresetPanel();
    });
    row2.appendChild(tbtn("Close", removePanel));
    row2.appendChild(saveBtn);
    p.appendChild(row2);
  }

  function init() {
    VGP.layout = loadLayout();
    build();
    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerUp, { passive: false });
    document.addEventListener("pointercancel", onPointerUp, { passive: false });

    document.addEventListener("pointerup", function () {
      var p = document.getElementById("vgp-panel");
      if (p && p._vgpEndDrag) p._vgpEndDrag();
    }, { passive: true });
    document.addEventListener("touchend", function () {
      var p = document.getElementById("vgp-panel");
      if (p && p._vgpEndDrag) p._vgpEndDrag();
    }, { passive: true });
    document.addEventListener("touchcancel", function () {
      var p = document.getElementById("vgp-panel");
      if (p && p._vgpEndDrag) p._vgpEndDrag();
    }, { passive: true });

    document.addEventListener("touchmove", function (e) {
      if (VGP.panelDragActive) { e.preventDefault(); return; }
      if (isInsideScrollableUi(e.target)) return;
      e.preventDefault();
    }, { passive: false });
    document.addEventListener("gesturestart", function (e) { e.preventDefault(); }, { passive: false });

    // Any tap/click on the screen counts as activity and un-hides the
    // pad/buttons if they had faded out from inactivity.
    document.addEventListener("pointerdown", wakeButtons, { passive: true });
    document.addEventListener("touchstart", wakeButtons, { passive: true });
  }

  function waitForBody() {
    if (document.body) {
      init();
    } else {
      setTimeout(waitForBody, 20);
    }
  }
  waitForBody();
})();