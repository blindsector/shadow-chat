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
    return isNearBottom(decodedPanel) && isNearBottom(encodedPanel);
}

function shouldShowScrollButton() {
    const decodedDistance = getDistanceFromBottom(decodedPanel);
    const encodedDistance = getDistanceFromBottom(encodedPanel);
    const maxDistance = Math.max(decodedDistance, encodedDistance);

    const decodedThreshold = decodedPanel.clientHeight * SCROLL_BUTTON_SCREEN_THRESHOLD;
    const encodedThreshold = encodedPanel.clientHeight * SCROLL_BUTTON_SCREEN_THRESHOLD;
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
    return `
        <span style="
            display:inline-flex;
            align-items:center;
            justify-content:center;
            width:100%;
            height:100%;
            font-size:18px;
            font-weight:700;
            line-height:1;
            color:#ffffff;
            transform:translateY(-1px);
            pointer-events:none;
        ">↓</span>
    `;
}

function getCountHtml(count, fading = false) {
    return "";
}

function renderScrollButton(showBadge = false, fading = false) {
    if (!userReadingOldMessages || !shouldShowScrollButton()) {
        scrollToBottomBtn.classList.add("hidden");
        scrollToBottomBtn.innerHTML = "";
        lastBadgeVisible = false;
        return;
    }

    scrollToBottomBtn.classList.remove("hidden");
    scrollToBottomBtn.style.position = "";
    scrollToBottomBtn.style.overflow = "";
    scrollToBottomBtn.style.pointerEvents = "";
    scrollToBottomBtn.style.width = "";
    scrollToBottomBtn.style.height = "";
    scrollToBottomBtn.style.minWidth = "";
    scrollToBottomBtn.style.padding = "";
    scrollToBottomBtn.style.border = "";
    scrollToBottomBtn.style.borderRadius = "";
    scrollToBottomBtn.style.background = "";
    scrollToBottomBtn.style.boxShadow = "";
    scrollToBottomBtn.style.backdropFilter = "";
    scrollToBottomBtn.style.webkitBackdropFilter = "";
    scrollToBottomBtn.style.display = "";
    scrollToBottomBtn.style.alignItems = "";
    scrollToBottomBtn.style.justifyContent = "";

    scrollToBottomBtn.innerHTML = getArrowHtml();
    lastBadgeVisible = false;
}

function showBadgeBriefly() {
    renderScrollButton(false, false);
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
    lastDecodedScrollHeight = decodedPanel.scrollHeight;
    lastEncodedScrollHeight = encodedPanel.scrollHeight;
}

function stopActiveScrollAnimation() {
    if (activeScrollAnimation && activeScrollAnimation.frameId) {
        cancelAnimationFrame(activeScrollAnimation.frameId);
    }

    activeScrollAnimation = null;
}

function setBothPanelsScrollTop(decodedTop, encodedTop) {
    markProgrammaticScroll(150);
    panelSyncLock = true;
    decodedPanel.scrollTop = clampScrollTop(decodedPanel, decodedTop);
    encodedPanel.scrollTop = clampScrollTop(encodedPanel, encodedTop);
    panelSyncLock = false;
}

function syncPanelsInstantFromDecoded() {
    setBothPanelsScrollTop(decodedPanel.scrollTop, decodedPanel.scrollTop);
}

function syncPanelsInstantFromEncoded() {
    setBothPanelsScrollTop(encodedPanel.scrollTop, encodedPanel.scrollTop);
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
    stopActiveScrollAnimation();

    const startDecodedTop = decodedPanel.scrollTop;
    const startEncodedTop = encodedPanel.scrollTop;

    const targetDecodedTop = clampScrollTop(decodedPanel, decodedPanel.scrollHeight);
    const targetEncodedTop = clampScrollTop(encodedPanel, encodedPanel.scrollHeight);

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
        setBothPanelsScrollTop(decodedPanel.scrollHeight, encodedPanel.scrollHeight);
        rememberPanelHeights();
    }
}

function keepCurrentReadingPosition() {
    stopActiveScrollAnimation();
    setBothPanelsScrollTop(decodedPanel.scrollTop, encodedPanel.scrollTop);
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

scrollToBottomBtn.addEventListener("click", () => {
    scrollAllToBottom(true, true);
});

decodedPanel.addEventListener("scroll", () => {
    if (panelSyncLock || shouldIgnoreScrollEvent()) {
        return;
    }

    stopActiveScrollAnimation();
    syncPanelsInstantFromDecoded();
    syncReadingStateFromScroll();
});

encodedPanel.addEventListener("scroll", () => {
    if (panelSyncLock || shouldIgnoreScrollEvent()) {
        return;
    }

    stopActiveScrollAnimation();
    syncPanelsInstantFromEncoded();
    syncReadingStateFromScroll();
});

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