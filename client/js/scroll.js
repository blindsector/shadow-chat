let userReadingOldMessages = false;
let unseenMessagesCount = 0;
let lastRenderedMessagesCount = 0;

let lastDecodedScrollHeight = 0;
let lastEncodedScrollHeight = 0;

const NEAR_BOTTOM_THRESHOLD = 60;
const SCROLL_BUTTON_SCREEN_THRESHOLD = 1.0;
const SMOOTH_SCROLL_MIN_MS = 420;
const SMOOTH_SCROLL_MAX_MS = 920;
const BADGE_VISIBLE_MS = 1350;
const BADGE_FADE_MS = 650;

let panelSyncLock = false;
let activeScrollAnimation = null;
let badgeHideTimer = null;
let badgeFadeTimer = null;
let lastBadgeVisible = false;
let ignoreScrollEventsUntil = 0;

function getActiveEncodedScrollContainer() {
    if (
        typeof encodedOverlay !== "undefined" &&
        encodedOverlay &&
        !encodedOverlay.classList.contains("hidden") &&
        typeof encodedOverlayMessages !== "undefined" &&
        encodedOverlayMessages
    ) {
        return encodedOverlayMessages;
    }

    return encodedPanel;
}

function getDistanceFromBottom(container) {
    return container.scrollHeight - container.scrollTop - container.clientHeight;
}

function clampScrollTop(container, value) {
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    return Math.max(0, Math.min(value, maxTop));
}

function isNearBottom(container, threshold = NEAR_BOTTOM_THRESHOLD) {
    return getDistanceFromBottom(container) <= threshold;
}

function shouldAutoFollow() {
    const activeEncoded = getActiveEncodedScrollContainer();
    return isNearBottom(decodedPanel) && isNearBottom(activeEncoded);
}

function shouldShowScrollButton() {
    const activeEncoded = getActiveEncodedScrollContainer();

    const decodedDistance = getDistanceFromBottom(decodedPanel);
    const encodedDistance = getDistanceFromBottom(activeEncoded);
    const maxDistance = Math.max(decodedDistance, encodedDistance);

    const decodedThreshold = decodedPanel.clientHeight * SCROLL_BUTTON_SCREEN_THRESHOLD;
    const encodedThreshold = activeEncoded.clientHeight * SCROLL_BUTTON_SCREEN_THRESHOLD;
    const threshold = Math.max(decodedThreshold, encodedThreshold);

    return maxDistance > threshold;
}

function shouldIgnoreScrollEvent() {
    return Date.now() < ignoreScrollEventsUntil;
}

function markProgrammaticScroll(duration = 120) {
    ignoreScrollEventsUntil = Date.now() + duration;
}

function clearBadgeTimers() {
    if (badgeHideTimer) {
        clearTimeout(badgeHideTimer);
        badgeHideTimer = null;
    }

    if (badgeFadeTimer) {
        clearTimeout(badgeFadeTimer);
        badgeFadeTimer = null;
    }
}

function getArrowHtml() {
    return '<span class="scroll-btn-arrow">↓</span>';
}

function getCountHtml(count, fading = false) {
    return `
        <span
            class="scroll-btn-count ${fading ? "scroll-count-pop" : ""}"
            style="
                position:absolute;
                top:-5px;
                right:-6px;
                min-width:20px;
                height:20px;
                padding:0 6px;
                border-radius:999px;
                background:rgba(255,255,255,0.96);
                color:#1e3a8a;
                font-size:11px;
                font-weight:800;
                display:inline-flex;
                align-items:center;
                justify-content:center;
                line-height:1;
                box-shadow:0 8px 18px rgba(0,0,0,0.14);
                border:1px solid rgba(255,255,255,0.65);
                opacity:${fading ? "0" : "1"};
                transform:${fading ? "scale(0.82)" : "scale(1)"};
                transition:opacity ${BADGE_FADE_MS}ms ease, transform ${BADGE_FADE_MS}ms ease;
                pointer-events:none;
            "
        >${count}</span>
    `;
}

function renderScrollButton(showBadge = false, fading = false) {
    if (!userReadingOldMessages || !shouldShowScrollButton()) {
        scrollToBottomBtn.classList.add("hidden");
        scrollToBottomBtn.innerHTML = "";
        lastBadgeVisible = false;
        return;
    }

    scrollToBottomBtn.classList.remove("hidden");
    scrollToBottomBtn.style.position = "fixed";
    scrollToBottomBtn.style.overflow = "visible";
    scrollToBottomBtn.style.pointerEvents = "auto";
    scrollToBottomBtn.style.width = "46px";
    scrollToBottomBtn.style.height = "46px";
    scrollToBottomBtn.style.minWidth = "46px";
    scrollToBottomBtn.style.padding = "0";
    scrollToBottomBtn.style.border = "0";
    scrollToBottomBtn.style.borderRadius = "999px";
    scrollToBottomBtn.style.background = "linear-gradient(180deg, rgba(59,130,246,0.92), rgba(37,99,235,0.92))";
    scrollToBottomBtn.style.boxShadow = "0 10px 24px rgba(0,0,0,0.18)";
    scrollToBottomBtn.style.backdropFilter = "blur(10px)";
    scrollToBottomBtn.style.webkitBackdropFilter = "blur(10px)";
    scrollToBottomBtn.style.display = "inline-flex";
    scrollToBottomBtn.style.alignItems = "center";
    scrollToBottomBtn.style.justifyContent = "center";

    const badgeHtml = showBadge && unseenMessagesCount > 0
        ? getCountHtml(unseenMessagesCount, fading)
        : "";

    scrollToBottomBtn.innerHTML = `
        <span style="
            position:relative;
            width:100%;
            height:100%;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            pointer-events:none;
        ">
            ${getArrowHtml()}
            ${badgeHtml}
        </span>
    `;

    lastBadgeVisible = showBadge && unseenMessagesCount > 0;
}

function showBadgeBriefly() {
    clearBadgeTimers();

    if (!userReadingOldMessages || unseenMessagesCount <= 0) {
        renderScrollButton(false, false);
        return;
    }

    renderScrollButton(true, false);

    badgeHideTimer = setTimeout(() => {
        renderScrollButton(true, true);

        badgeFadeTimer = setTimeout(() => {
            renderScrollButton(false, false);
        }, BADGE_FADE_MS);
    }, BADGE_VISIBLE_MS);
}

function updateScrollButton() {
    if (!userReadingOldMessages) {
        clearBadgeTimers();
        renderScrollButton(false, false);
        return;
    }

    if (lastBadgeVisible && unseenMessagesCount > 0) {
        renderScrollButton(true, false);
    } else {
        renderScrollButton(false, false);
    }
}

function rememberPanelHeights() {
    const activeEncoded = getActiveEncodedScrollContainer();
    lastDecodedScrollHeight = decodedPanel.scrollHeight;
    lastEncodedScrollHeight = activeEncoded.scrollHeight;
}

function stopActiveScrollAnimation() {
    if (activeScrollAnimation && activeScrollAnimation.frameId) {
        cancelAnimationFrame(activeScrollAnimation.frameId);
    }

    activeScrollAnimation = null;
}

function setBothPanelsScrollTop(decodedTop, encodedTop) {
    const activeEncoded = getActiveEncodedScrollContainer();

    markProgrammaticScroll(150);
    panelSyncLock = true;
    decodedPanel.scrollTop = clampScrollTop(decodedPanel, decodedTop);
    activeEncoded.scrollTop = clampScrollTop(activeEncoded, encodedTop);
    panelSyncLock = false;
}

function syncPanelsInstantFromDecoded() {
    const activeEncoded = getActiveEncodedScrollContainer();
    const ratio = decodedPanel.scrollHeight > decodedPanel.clientHeight
        ? decodedPanel.scrollTop / Math.max(1, decodedPanel.scrollHeight - decodedPanel.clientHeight)
        : 1;

    const encodedMax = Math.max(0, activeEncoded.scrollHeight - activeEncoded.clientHeight);
    setBothPanelsScrollTop(decodedPanel.scrollTop, encodedMax * ratio);
}

function syncPanelsInstantFromEncoded() {
    const activeEncoded = getActiveEncodedScrollContainer();
    const ratio = activeEncoded.scrollHeight > activeEncoded.clientHeight
        ? activeEncoded.scrollTop / Math.max(1, activeEncoded.scrollHeight - activeEncoded.clientHeight)
        : 1;

    const decodedMax = Math.max(0, decodedPanel.scrollHeight - decodedPanel.clientHeight);
    setBothPanelsScrollTop(decodedMax * ratio, activeEncoded.scrollTop);
}

function getSmoothDuration(distance) {
    const normalized = Math.min(1, Math.abs(distance) / 1400);
    return Math.round(
        SMOOTH_SCROLL_MIN_MS + (SMOOTH_SCROLL_MAX_MS - SMOOTH_SCROLL_MIN_MS) * normalized
    );
}

function easeInOutQuint(t) {
    return t < 0.5
        ? 16 * t * t * t * t * t
        : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

function animatePanelsToBottom() {
    const activeEncoded = getActiveEncodedScrollContainer();

    stopActiveScrollAnimation();

    const startDecodedTop = decodedPanel.scrollTop;
    const startEncodedTop = activeEncoded.scrollTop;

    const targetDecodedTop = clampScrollTop(decodedPanel, decodedPanel.scrollHeight);
    const targetEncodedTop = clampScrollTop(activeEncoded, activeEncoded.scrollHeight);

    const decodedDistance = targetDecodedTop - startDecodedTop;
    const encodedDistance = targetEncodedTop - startEncodedTop;
    const maxDistance = Math.max(Math.abs(decodedDistance), Math.abs(encodedDistance));

    if (maxDistance < 2) {
        setBothPanelsScrollTop(targetDecodedTop, targetEncodedTop);
        rememberPanelHeights();
        return;
    }

    const duration = getSmoothDuration(maxDistance);
    const startTime = performance.now();

    activeScrollAnimation = {
        frameId: 0
    };

    function step(now) {
        if (!activeScrollAnimation) {
            return;
        }

        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const eased = easeInOutQuint(progress);

        const nextDecodedTop = startDecodedTop + decodedDistance * eased;
        const nextEncodedTop = startEncodedTop + encodedDistance * eased;

        markProgrammaticScroll(170);
        setBothPanelsScrollTop(nextDecodedTop, nextEncodedTop);

        if (progress < 1) {
            activeScrollAnimation.frameId = requestAnimationFrame(step);
            return;
        }

        setBothPanelsScrollTop(targetDecodedTop, targetEncodedTop);
        activeScrollAnimation = null;
        rememberPanelHeights();
    }

    activeScrollAnimation.frameId = requestAnimationFrame(step);
}

function scrollAllToBottom(force = false, smooth = true) {
    const activeEncoded = getActiveEncodedScrollContainer();

    if (!force && userReadingOldMessages) {
        updateScrollButton();
        return;
    }

    clearBadgeTimers();
    userReadingOldMessages = false;
    unseenMessagesCount = 0;
    renderScrollButton(false, false);

    if (smooth) {
        animatePanelsToBottom();
    } else {
        stopActiveScrollAnimation();
        setBothPanelsScrollTop(decodedPanel.scrollHeight, activeEncoded.scrollHeight);
        rememberPanelHeights();
    }
}

function keepCurrentReadingPosition() {
    const activeEncoded = getActiveEncodedScrollContainer();
    stopActiveScrollAnimation();
    setBothPanelsScrollTop(decodedPanel.scrollTop, activeEncoded.scrollTop);
}

function syncReadingStateFromScroll() {
    const wasReadingOldMessages = userReadingOldMessages;

    if (shouldAutoFollow()) {
        userReadingOldMessages = false;
        unseenMessagesCount = 0;
        clearBadgeTimers();
        renderScrollButton(false, false);
    } else {
        userReadingOldMessages = true;

        if (!wasReadingOldMessages) {
            renderScrollButton(false, false);
        } else {
            updateScrollButton();
        }
    }
}

function afterConversationRender() {
    const currentCount = Array.isArray(state.messages) ? state.messages.length : 0;
    const hadNewMessages = currentCount > lastRenderedMessagesCount;
    const shouldStayLiveAtBottom = !userReadingOldMessages;

    if (hadNewMessages) {
        if (shouldStayLiveAtBottom || shouldAutoFollow()) {
            scrollAllToBottom(true, false);
        } else {
            keepCurrentReadingPosition();
            userReadingOldMessages = true;
            unseenMessagesCount += currentCount - lastRenderedMessagesCount;
            renderScrollButton(true, false);
            showBadgeBriefly();
            rememberPanelHeights();
        }
    } else {
        if (shouldAutoFollow()) {
            userReadingOldMessages = false;
            unseenMessagesCount = 0;
            clearBadgeTimers();
            renderScrollButton(false, false);
        } else {
            userReadingOldMessages = true;
            updateScrollButton();
        }

        rememberPanelHeights();
    }

    lastRenderedMessagesCount = currentCount;
}

function bindComposerAutoScroll() {
    if (!messageInput || messageInput.dataset.scrollBound === "1") {
        return;
    }

    messageInput.dataset.scrollBound = "1";

    messageInput.addEventListener("focus", () => {
        scrollAllToBottom(true, true);
    });

    messageInput.addEventListener("pointerdown", () => {
        scrollAllToBottom(true, true);
    });

    sendBtn.addEventListener("mousedown", () => {
        scrollAllToBottom(true, true);
    });

    sendBtn.addEventListener("touchstart", () => {
        scrollAllToBottom(true, true);
    }, { passive: true });
}

function handleDecodedPanelScroll() {
    if (panelSyncLock || shouldIgnoreScrollEvent()) {
        return;
    }

    stopActiveScrollAnimation();
    syncPanelsInstantFromDecoded();
    syncReadingStateFromScroll();
}

function handleEncodedPanelScroll() {
    if (panelSyncLock || shouldIgnoreScrollEvent()) {
        return;
    }

    stopActiveScrollAnimation();
    syncPanelsInstantFromEncoded();
    syncReadingStateFromScroll();
}

scrollToBottomBtn.addEventListener("click", () => {
    scrollAllToBottom(true, true);
});

decodedPanel.addEventListener("scroll", handleDecodedPanelScroll);
encodedPanel.addEventListener("scroll", handleEncodedPanelScroll);

if (typeof encodedMessages !== "undefined" && encodedMessages) {
    encodedMessages.addEventListener("scroll", handleEncodedPanelScroll);
}

window.addEventListener("resize", () => {
    if (shouldAutoFollow()) {
        scrollAllToBottom(true, false);
    } else {
        rememberPanelHeights();
        syncReadingStateFromScroll();
    }
});

bindComposerAutoScroll();
setTimeout(bindComposerAutoScroll, 0);
