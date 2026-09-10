(function() {
    'use strict';

    var pluginName = 'ARP_TalkBalloon';
    var params = PluginManager.parameters(pluginName);
    var RANGE = Math.max(1, Number(params['Range'] || 1));
    var ROW = Math.max(1, Number(params['Balloon Row'] || 15));
    var COLUMN = Math.max(1, Number(params['Balloon Column'] || 1));
    var HIDE_AFTER_TALK = String(params['Hide After Talk'] || 'true') === 'true';

    var ICON_W = 48;
    var ICON_H = 48;

    var PLAYER_HEAD_OFFSET = 75;
    var _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    var _Scene_Map_update = Scene_Map.prototype.update;
    var _Scene_Map_terminate = Scene_Map.prototype.terminate;
    var _Game_Event_start = Game_Event.prototype.start;
    var _Game_Map_setup = Game_Map.prototype.setup;
    var _DataManager_createGameObjects = DataManager.createGameObjects;

    function ensureStore() {
        if (!$gameSystem) return;
        if (!$gameSystem._arpTalkBalloonTalked) {
            $gameSystem._arpTalkBalloonTalked = {};
        }
    }

    function eventKey(event) {
        return String($gameMap.mapId()) + ':' + String(event.eventId());
    }

    function wasTalked(event) {
        if (!HIDE_AFTER_TALK || !$gameSystem || !$gameMap) return false;
        ensureStore();
        return !!$gameSystem._arpTalkBalloonTalked[eventKey(event)];
    }

    function markTalked(event) {
        if (!HIDE_AFTER_TALK || !$gameSystem || !$gameMap) return;
        ensureStore();
        $gameSystem._arpTalkBalloonTalked[eventKey(event)] = true;
    }

    function noteHas(event, tag) {
        var data = event && event.event && event.event();
        if (!data) return false;
        return new RegExp('<\\s*' + tag + '\\s*>', 'i').test(String(data.note || ''));
    }

    function activePage(event) {
        return event && !event._erased && event.page && event.page();
    }

    function isSettled(character) {
     
        if (!character) return true;
        return character._realX === character._x && character._realY === character._y;
    }

    function isWalkablePriority(event) {
       
        var page = activePage(event);
        return !!page && page.priorityType === 0;
    }

    function requiresWalkOver(event) {
      
        if (noteHas(event, 'TalkBalloonFaceOk')) return false;
        return noteHas(event, 'TalkBalloonWalkOver') ||
               noteHas(event, 'TalkBalloonStandOn') ||
               isWalkablePriority(event);
    }

    function listHasShowText(list, visitedCommonEvents) {
        if (!list) return false;
        for (var i = 0; i < list.length; i++) {
            var cmd = list[i];
            if (!cmd) continue;
            if (cmd.code === 101) return true;
           
            if (cmd.code === 117 && cmd.parameters && cmd.parameters[0]) {
                var ceId = cmd.parameters[0];
                if (!visitedCommonEvents[ceId]) {
                    visitedCommonEvents[ceId] = true;
                    var ce = $dataCommonEvents && $dataCommonEvents[ceId];
                    if (ce && listHasShowText(ce.list, visitedCommonEvents)) return true;
                }
            }
        }
        return false;
    }

    function hasShowText(event) {
        var page = activePage(event);
        if (!page || !page.list) return false;
        return listHasShowText(page.list, {});
    }

    function isTalkable(event) {
        var page = activePage(event);
        if (!page) return false;
        if (noteHas(event, 'NoTalkBalloon')) return false;
        if (wasTalked(event) && !noteHas(event, 'ResetTalkBalloon')) return false;

        // Only Action Button events can receive the indicator.
        if (event._trigger !== 0) return false;

        if (!hasShowText(event) && !noteHas(event, 'TalkBalloon')) return false;
        return true;
    }

    function aheadDistance(event) {
        if (!$gamePlayer || !event) return -1;
        var dx = event.x - $gamePlayer.x;
        var dy = event.y - $gamePlayer.y;

        // Standing on the exact same tile/block as the event (e.g. an
        // object "below characters" priority that you can walk over -
        // a floor switch, a sleeping cat, a rug) always qualifies,
        // regardless of which way the player happens to be facing.
        // This is block-for-block: dx === 0 && dy === 0 means the
        // player's tile and the event's tile are the same block.
        if (dx === 0 && dy === 0) return 0;

        switch ($gamePlayer.direction()) {
            case 2: // down
                return (dx === 0 && dy > 0) ? dy : -1;
            case 8: // up
                return (dx === 0 && dy < 0) ? -dy : -1;
            case 6: // right
                return (dy === 0 && dx > 0) ? dx : -1;
            case 4: // left
                return (dy === 0 && dx < 0) ? -dx : -1;
            default:
                return -1;
        }
    }

    function createIcon() {
        var sprite = new Sprite(new Bitmap(ICON_W, ICON_H));
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 1.0;
        sprite.z = 10;
        sprite.visible = false;
        sprite._arpBalloonBitmap = null;
        return sprite;
    }

    function loadIcon(sprite) {
        if (!sprite || sprite._arpBalloonBitmap) return;
        var bitmap = ImageManager.loadSystem('Balloon');
        sprite._arpBalloonBitmap = bitmap;
        sprite.bitmap = bitmap;
        sprite.setFrame((COLUMN - 1) * ICON_W, (ROW - 1) * ICON_H, ICON_W, ICON_H);
    }

    function hideIcon(sprite) {
        if (!sprite) return;
        sprite.visible = false;
        sprite._arpEventId = 0;
    }

    function updateIcon(scene) {
        if (!scene || !scene._arpTalkBalloonSprite || !$gameMap || !$gamePlayer) return;
        var sprite = scene._arpTalkBalloonSprite;
        loadIcon(sprite);

        if ($gameMessage && $gameMessage.isBusy()) {
            hideIcon(sprite);
            return;
        }

        if (!isSettled($gamePlayer)) {
            hideIcon(sprite);
            return;
        }

        var events = $gameMap.events();
        var best = null;
        var bestDist = 999;

        for (var i = 0; i < events.length; i++) {
            var event = events[i];
            if (!isTalkable(event)) continue;
            // Same idea for the event's own side: if it's a wandering
            // NPC that's mid-step into the qualifying tile, wait for
            // its walking animation to finish too.
            if (!isSettled(event)) continue;

            var d = aheadDistance(event);
            if (d < 0) continue;

            if (requiresWalkOver(event)) {
                
                if (d !== 0) continue;
            }

            if (d <= RANGE && d < bestDist) {
                best = event;
                bestDist = d;
            }
        }

        if (!best) {
            hideIcon(sprite);
            return;
        }

        sprite._arpEventId = best.eventId();
        sprite.x = $gamePlayer.screenX();
        // Above the player's head, not above the target event.
        sprite.y = $gamePlayer.screenY() - PLAYER_HEAD_OFFSET;
        sprite.visible = true;
    }

    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        this._arpTalkBalloonSprite = createIcon();
        this.addChild(this._arpTalkBalloonSprite);
        loadIcon(this._arpTalkBalloonSprite);
    };

    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        updateIcon(this);
    };

    Scene_Map.prototype.terminate = function() {
        if (this._arpTalkBalloonSprite) {
            this._arpTalkBalloonSprite.visible = false;
        }
        _Scene_Map_terminate.call(this);
    };

    Game_Event.prototype.start = function() {
     
        if (this._trigger === 0 && activePage(this)) {
            markTalked(this);
        }
        _Game_Event_start.call(this);
    };

    Game_Map.prototype.setup = function(mapId) {
        _Game_Map_setup.call(this, mapId);
    };

    DataManager.createGameObjects = function() {
        _DataManager_createGameObjects.call(this);
        ensureStore();
    };

    console.log('ARP_TalkBalloon: strict directly-ahead + walk-over dialogue indicator loaded.');
})();