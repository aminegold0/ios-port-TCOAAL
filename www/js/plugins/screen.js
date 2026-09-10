(() => {

    'use strict';

    const pluginName =
        'DisclaimerScreen';

    const parameters =
        PluginManager.parameters(pluginName);

    const bgColor =
        String(
            parameters['backgroundColor'] ||
            '#000000'
        );

    const textColor =
        String(
            parameters['textColor'] ||
            '#ffffff'
        );

    const linkColor =
        String(
            parameters['linkColor'] ||
            '#4aa3ff'
        );

    const fontSize =
        Number(
            parameters['fontSize'] ||
            28
        );

    const continueText =
        String(
            parameters['continueText'] ||
            ''
        );

    const waitForGlobalFlag =
        String(
            parameters['waitForGlobalFlag'] ||
            ''
        ).trim();

    const LAUNCH_KEY =
        'DisclaimerScreen_GameLaunches';

    const DISMISSED_KEY =
        'DisclaimerScreen_HasDismissedOnce';

    // Number of launches needed before the disclaimer shows for the very
    // first time ever (on a fresh install / first time opening the game).
    const REQUIRED_LAUNCHES_FIRST =
        1;

    // Number of launches needed before the disclaimer reappears after it
    // has already been dismissed once (same behavior as before).
    const REQUIRED_LAUNCHES_RECURRING =
        5;

    function getLaunches() {

        try {

            let value =
                parseInt(
                    localStorage.getItem(
                        LAUNCH_KEY
                    ) || '0',
                    10
                );

            if (
                isNaN(value) ||
                value < 0
            ) {

                value = 0;
            }

            return value;

        } catch (e) {

            console.warn(
                '[' + pluginName +
                '] Could not read launch counter:',
                e
            );

            return 0;
        }
    }

    function saveLaunches(value) {

        try {

            localStorage.setItem(
                LAUNCH_KEY,
                String(value)
            );

        } catch (e) {

            console.warn(
                '[' + pluginName +
                '] Could not save launch counter:',
                e
            );
        }
    }

    function getHasDismissedOnce() {

        try {

            return (
                localStorage.getItem(
                    DISMISSED_KEY
                ) === '1'
            );

        } catch (e) {

            console.warn(
                '[' + pluginName +
                '] Could not read dismissed flag:',
                e
            );

            return false;
        }
    }

    function saveHasDismissedOnce(value) {

        try {

            localStorage.setItem(
                DISMISSED_KEY,
                value ? '1' : '0'
            );

        } catch (e) {

            console.warn(
                '[' + pluginName +
                '] Could not save dismissed flag:',
                e
            );
        }
    }

    const hasDismissedOnce =
        getHasDismissedOnce();

    const REQUIRED_LAUNCHES =
        hasDismissedOnce ?
            REQUIRED_LAUNCHES_RECURRING :
            REQUIRED_LAUNCHES_FIRST;

    let launchCount =
        getLaunches();

    if (
        launchCount <
        REQUIRED_LAUNCHES
    ) {

        launchCount++;

        saveLaunches(
            launchCount
        );
    }

    console.log(
        '[' + pluginName +
        '] Launch progress:',
        launchCount + '/' +
        REQUIRED_LAUNCHES
    );

    const shouldShowDisclaimer =
        launchCount >= REQUIRED_LAUNCHES;

    window.$disclaimerScreenDone =
        !shouldShowDisclaimer;

    let overlay = null;

    let blocking = false;

    let dismissed = false;

    const hiddenElements =
        new Map();

    let hideObserver = null;

    function hideElement(element) {

        if (!element) {
            return;
        }

        if (
            element === overlay
        ) {
            return;
        }

        if (
            hiddenElements.has(
                element
            )
        ) {
            return;
        }

        hiddenElements.set(
            element,
            element.style.display
        );

        element.style.display =
            'none';
    }

    function hideEverythingElse() {

        if (!document.body) {
            return;
        }

        Array.from(
            document.body.children
        ).forEach(
            hideElement
        );

        if (
            typeof MutationObserver !==
            'undefined'
        ) {

            hideObserver =
                new MutationObserver(
                    function(mutations) {

                        if (!blocking) {
                            return;
                        }

                        mutations.forEach(
                            function(mutation) {

                                mutation.addedNodes
                                    .forEach(
                                        function(node) {

                                            if (
                                                node.nodeType !==
                                                1
                                            ) {
                                                return;
                                            }

                                            if (
                                                node ===
                                                overlay
                                            ) {
                                                return;
                                            }

                                            hideElement(
                                                node
                                            );

                                        }
                                    );

                            }
                        );

                    }
                );

            hideObserver.observe(
                document.body,
                {
                    childList: true
                }
            );
        }
    }

    function restoreEverything() {

        if (hideObserver) {

            hideObserver.disconnect();

            hideObserver = null;
        }

        hiddenElements.forEach(
            function(
                previousDisplay,
                element
            ) {

                try {

                    element.style.display =
                        previousDisplay;

                } catch (e) {}

            }
        );

        hiddenElements.clear();
    }

    function loadDisclaimerLines() {

        try {

            const xhr =
                new XMLHttpRequest();

            xhr.open(
                'GET',
                'data/map145.json',
                false
            );

            xhr.overrideMimeType(
                'application/json'
            );

            xhr.send();

            if (
                xhr.status >= 400
            ) {

                console.warn(
                    '[' + pluginName +
                    '] Could not load map145.json. HTTP ' +
                    xhr.status
                );

                return null;
            }

            if (
                !xhr.responseText
            ) {

                console.warn(
                    '[' + pluginName +
                    '] map145.json is empty.'
                );

                return null;
            }

            const data =
                JSON.parse(
                    xhr.responseText
                );

            return normalizeLines(
                data
            );

        } catch (error) {

            console.warn(
                '[' + pluginName +
                '] Could not read map145.json:',
                error
            );

            return null;
        }
    }

    function normalizeLines(data) {

        let lines = [];

        if (
            Array.isArray(data)
        ) {

            lines =
                data.map(String);

        } else if (
            typeof data === 'string'
        ) {

            lines =
                data.split('\n');

        } else if (
            data &&
            typeof data === 'object'
        ) {

            if (
                Array.isArray(
                    data.lines
                )
            ) {

                lines =
                    data.lines.map(String);

            } else if (
                typeof data.text ===
                'string'
            ) {

                lines =
                    data.text.split('\n');
            }
        }

        while (
            lines.length &&
            lines[0].trim() === ''
        ) {

            lines.shift();
        }

        while (
            lines.length &&
            lines[
                lines.length - 1
            ].trim() === ''
        ) {

            lines.pop();
        }

        return lines;
    }

    function cleanUrl(url) {

        url =
            String(
                url || ''
            ).trim();

        if (
            !/^https?:\/\//i.test(url)
        ) {

            return null;
        }

        return url;
    }

    function openExternalLink(url) {

        url =
            cleanUrl(url);

        if (!url) {

            console.warn(
                '[' + pluginName +
                '] Invalid URL blocked.'
            );

            return false;
        }

        try {

            if (
                window.cordova &&
                window.cordova.InAppBrowser &&
                typeof
                    window.cordova.InAppBrowser.open ===
                    'function'
            ) {

                window.cordova.InAppBrowser.open(
                    url,
                    '_system'
                );

                return true;
            }

        } catch (e) {

            console.warn(
                '[' + pluginName +
                '] Cordova failed:',
                e
            );
        }

        try {

            if (
                window.webkit &&
                window.webkit.messageHandlers
            ) {

                const handlers =
                    window.webkit.messageHandlers;

                const names = [
                    'openExternalURL',
                    'openExternalUrl',
                    'openURL',
                    'openUrl',
                    'externalURL'
                ];

                for (
                    let i = 0;
                    i < names.length;
                    i++
                ) {

                    const handler =
                        handlers[
                            names[i]
                        ];

                    if (
                        handler &&
                        typeof
                            handler.postMessage ===
                            'function'
                    ) {

                        handler.postMessage(
                            url
                        );

                        return true;
                    }
                }
            }

        } catch (e) {

            console.warn(
                '[' + pluginName +
                '] WKWebView bridge failed:',
                e
            );
        }

        try {

            const a =
                document.createElement(
                    'a'
                );

            a.href =
                url;

            a.target =
                '_blank';

            a.rel =
                'noopener noreferrer';

            a.style.position =
                'fixed';

            a.style.left =
                '-10000px';

            a.style.top =
                '-10000px';

            document.body.appendChild(
                a
            );

            a.click();

            setTimeout(
                function() {

                    if (
                        a.parentNode
                    ) {

                        a.parentNode
                            .removeChild(a);
                    }

                },
                1000
            );

            return true;

        } catch (e) {

            console.warn(
                '[' + pluginName +
                '] Anchor failed:',
                e
            );
        }

        try {

            window.open(
                url,
                '_blank'
            );

            return true;

        } catch (e) {

            console.warn(
                '[' + pluginName +
                '] window.open failed:',
                e
            );
        }

        return false;
    }

    function dismiss() {

        if (dismissed) {
            return;
        }

        dismissed = true;

        blocking = false;

        if (
            overlay &&
            overlay.parentNode
        ) {

            overlay.parentNode
                .removeChild(
                    overlay
                );
        }

        overlay = null;

        restoreEverything();

        window.$disclaimerScreenDone =
            true;

        document.removeEventListener(
            'keydown',
            dismiss
        );
    }

    function createLink(
        label,
        url
    ) {

        const link =
            document.createElement(
                'a'
            );

        link.textContent =
            label;

        link.href =
            url;

        link.target =
            '_blank';

        link.rel =
            'noopener noreferrer';

        link.style.color =
            linkColor;

        link.style.textDecoration =
            'underline';

        link.style.cursor =
            'pointer';

        link.style.pointerEvents =
            'auto';

        link.style.touchAction =
            'manipulation';

        link.style.userSelect =
            'none';

        link.setAttribute(
            'role',
            'link'
        );

        link.setAttribute(
            'tabindex',
            '0'
        );

        link.addEventListener(
            'click',
            function(event) {

                event.preventDefault();

                event.stopPropagation();

                console.log(
                    '[' + pluginName +
                    '] BLUE URL CLICKED.'
                );

                saveLaunches(0);

                saveHasDismissedOnce(true);

                console.log(
                    '[' + pluginName +
                    '] Disclaimer completed.'
                );

                openExternalLink(
                    url
                );

                setTimeout(
                    dismiss,
                    150
                );

            },
            false
        );

        link.addEventListener(
            'keydown',
            function(event) {

                if (
                    event.key === 'Enter' ||
                    event.key === ' '
                ) {

                    event.preventDefault();

                    event.stopPropagation();

                    console.log(
                        '[' + pluginName +
                        '] BLUE URL ACTIVATED.'
                    );

                    saveLaunches(0);

                    saveHasDismissedOnce(true);

                    openExternalLink(
                        url
                    );

                    setTimeout(
                        dismiss,
                        150
                    );
                }

            },
            false
        );

        return link;
    }

    function appendLineSegments(
        container,
        line
    ) {

        const pattern =
            /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

        let lastIndex = 0;

        let match;

        while (
            (match =
                pattern.exec(line)) !==
            null
        ) {

            const full =
                match[0];

            const label =
                match[1];

            const url =
                match[2];

            if (
                match.index >
                lastIndex
            ) {

                container.appendChild(
                    document.createTextNode(
                        line.slice(
                            lastIndex,
                            match.index
                        )
                    )
                );
            }

            container.appendChild(
                createLink(
                    label,
                    url
                )
            );

            lastIndex =
                match.index +
                full.length;
        }

        if (
            lastIndex <
            line.length
        ) {

            container.appendChild(
                document.createTextNode(
                    line.slice(
                        lastIndex
                    )
                )
            );
        }
    }

    function waitForPreviousScript(
        callback
    ) {

        if (
            !waitForGlobalFlag
        ) {

            callback();

            return;
        }

        function check() {

            if (
                window[
                    waitForGlobalFlag
                ] === true
            ) {

                callback();

            } else {

                requestAnimationFrame(
                    check
                );
            }
        }

        check();
    }

    function buildOverlay(lines) {

        try {

            overlay =
                document.createElement(
                    'div'
                );

            overlay.id =
                'disclaimerScreenOverlay';

            overlay.style.position =
                'fixed';

            overlay.style.left =
                '0';

            overlay.style.top =
                '0';

            overlay.style.right =
                '0';

            overlay.style.bottom =
                '0';

            overlay.style.width =
                '100%';

            overlay.style.height =
                '100%';

            overlay.style.backgroundColor =
                bgColor;

            overlay.style.display =
                'flex';

            overlay.style.flexDirection =
                'column';

            overlay.style.alignItems =
                'center';

            overlay.style.justifyContent =
                'center';

            overlay.style.zIndex =
                '2147483647';

            overlay.style.fontFamily =
                'sans-serif';

            overlay.style.boxSizing =
                'border-box';

            overlay.style.pointerEvents =
                'auto';

            overlay.addEventListener(
                'touchstart',
                function(event) {

                    event.stopPropagation();

                },
                true
            );

            overlay.addEventListener(
                'touchmove',
                function(event) {

                    event.stopPropagation();

                },
                true
            );

            overlay.addEventListener(
                'touchend',
                function(event) {

                    event.stopPropagation();

                },
                true
            );

            const textBlock =
                document.createElement(
                    'div'
                );

            textBlock.style.color =
                textColor;

            textBlock.style.fontSize =
                fontSize + 'px';

            textBlock.style.textAlign =
                'center';

            textBlock.style.lineHeight =
                '1.6';

            textBlock.style.padding =
                '0 40px';

            textBlock.style.maxWidth =
                '100%';

            textBlock.style.boxSizing =
                'border-box';

            textBlock.style.whiteSpace =
                'pre-wrap';

            textBlock.style.overflowWrap =
                'break-word';

            textBlock.style.pointerEvents =
                'auto';

            lines.forEach(
                function(
                    line,
                    index
                ) {

                    appendLineSegments(
                        textBlock,
                        line
                    );

                    if (
                        index <
                        lines.length - 1
                    ) {

                        textBlock.appendChild(
                            document.createElement(
                                'br'
                            )
                        );
                    }

                }
            );

            overlay.appendChild(
                textBlock
            );

            if (
                continueText
            ) {

                const prompt =
                    document.createElement(
                        'div'
                    );

                prompt.style.color =
                    textColor;

                prompt.style.opacity =
                    '0.6';

                prompt.style.fontSize =
                    Math.max(
                        12,
                        Math.round(
                            fontSize *
                            0.55
                        )
                    ) + 'px';

                prompt.style.marginTop =
                    '32px';

                prompt.textContent =
                    continueText;

                overlay.appendChild(
                    prompt
                );
            }

            document.addEventListener(
                'keydown',
                dismiss
            );

            function attach() {

                if (
                    document.body
                ) {

                    document.body.appendChild(
                        overlay
                    );

                    hideEverythingElse();

                } else {

                    setTimeout(
                        attach,
                        10
                    );
                }
            }

            attach();

        } catch (error) {

            console.warn(
                '[' + pluginName +
                '] Could not display disclaimer:',
                error
            );

            blocking = false;

            window.$disclaimerScreenDone =
                true;
        }
    }

    if (
        !shouldShowDisclaimer
    ) {

        console.log(
            '[' + pluginName +
            '] Disclaimer skipped. ' +
            'Progress: ' +
            launchCount +
            '/' +
            REQUIRED_LAUNCHES
        );

        window.$disclaimerScreenDone =
            true;

        return;
    }

    console.log(
        '[' + pluginName +
        '] REQUIRED LAUNCHES REACHED.'
    );

    console.log(
        '[' + pluginName +
        '] Disclaimer will remain active ' +
        'until the blue URL is clicked.'
    );

    const lines =
        loadDisclaimerLines();

    if (
        !lines ||
        lines.length === 0
    ) {

        console.warn(
            '[' + pluginName +
            '] No disclaimer text found.'
        );

        window.$disclaimerScreenDone =
            true;

    } else {

        waitForPreviousScript(
            function() {

                blocking = true;

                buildOverlay(
                    lines
                );

                if (
                    typeof SceneManager !==
                        'undefined' &&
                    typeof SceneManager.update ===
                        'function'
                ) {

                    const originalUpdate =
                        SceneManager.update.bind(
                            SceneManager
                        );

                    SceneManager.update =
                        function() {

                            if (
                                blocking
                            ) {

                                if (
                                    typeof this
                                        .requestUpdate ===
                                        'function'
                                ) {

                                    this.requestUpdate();

                                } else {

                                    requestAnimationFrame(
                                        function() {

                                            if (
                                                blocking
                                            ) {

                                                SceneManager.update();

                                            }

                                        }
                                    );
                                }

                                return;
                            }

                            originalUpdate();
                        };
                }

            }
        );
    }

})();