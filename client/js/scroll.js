let userReadingOldMessages = false;
let unseenMessagesCount = 0;
let lastRenderedMessagesCount = 0;

const NEAR_BOTTOM_THRESHOLD = 60;

let panelSyncLock = false;
let currentEncodedScrollTarget = null;

function getEncodedScrollContainer() {
    if (
        typeof encodedOverlay !== "undefined" &&
        encodedOverlay &&
        !encodedOverlay.classList.contains("hidden") &&
        typeof encodedOverlayMessages !== "undefined" &&
        encodedOverlayMessages &&
        typeof encodedMessages !== "undefined" &&
        encodedMessages &&
        encodedOverlayMessages.contains(encodedMessages)
    ) {
        return encodedOverlayMessages;
    }

    if (typeof encodedPanel !== "undefined" && encodedPanel && encodedPanel.offsetParent !== null) {
        return encodedPanel;
    }

    if (typeof encodedMessages !== "undefined" && encodedMessages) {
        return encodedMessages;
    }

    return null;
}

function getDistanceFromBottom(container) {
    if (!container) return 0;
    return container.scrollHeight - container.scrollTop - container.clientHeight;
}

function isNearBottom(container) {
    return getDistanceFromBottom(container) <= NEAR_BOTTOM_THRESHOLD;
}

function shouldAutoFollow() {
    const encoded = getEncodedScrollContainer();

    if (!decodedPanel) return true;
    if (!encoded) return isNearBottom(decodedPanel);

    return isNearBottom(decodedPanel) && isNearBottom(encoded);
}

function syncFromDecoded() {
    const encoded = getEncodedScrollContainer();
    if (!decodedPanel || !encoded) return;

    const decodedMax = decodedPanel.scrollHeight - decodedPanel.clientHeight;
    const encodedMax = encoded.scrollHeight - encoded.clientHeight;

    if (decodedMax <= 0 || encodedMax <= 0) return;

    const ratio = decodedPanel.scrollTop / decodedMax;

    panelSyncLock = true;
    encoded.scrollTop = encodedMax * ratio;
    panelSyncLock = false;
}

function syncFromEncoded() {
    const encoded = getEncodedScrollContainer();
    if (!decodedPanel || !encoded) return;

    const decodedMax = decodedPanel.scrollHeight - decodedPanel.clientHeight;
    const encodedMax = encoded.scrollHeight - encoded.clientHeight;

    if (decodedMax <= 0 || encodedMax <= 0) return;

    const ratio = encoded.scrollTop / encodedMax;

    panelSyncLock = true;
    decodedPanel.scrollTop = decodedMax * ratio;
    panelSyncLock = false;
}

function forceStickToBottom() {
    const encoded = getEncodedScrollContainer();

    if (decodedPanel) {
        decodedPanel.scrollTop = decodedPanel.scrollHeight;
    }

    if (encoded) {
        encoded.scrollTop = encoded.scrollHeight;
    }
}

function scrollAllToBottom(force = false) {
    if (!decodedPanel) return;

    bindEncodedScrollTarget();

    if (!force && userReadingOldMessages) return;

    panelSyncLock = true;
    forceStickToBottom();
    panelSyncLock = false;

    userReadingOldMessages = false;
    unseenMessagesCount = 0;
    updateScrollButton();
}

function updateScrollButton() {
    if (!scrollToBottomBtn) return;

    if (!userReadingOldMessages) {
        scrollToBottomBtn.classList.add("hidden");
        return;
    }

    scrollToBottomBtn.classList.remove("hidden");
    scrollToBottomBtn.textContent = unseenMessagesCount > 0 ? "↓ " + unseenMessagesCount : "↓";
}

function handleDecodedScroll() {
    if (panelSyncLock) return;

    syncFromDecoded();

    if (shouldAutoFollow()) {
        userReadingOldMessages = false;
        unseenMessagesCount = 0;
    } else {
        userReadingOldMessages = true;
    }

    updateScrollButton();
}

function handleEncodedScroll() {
    if (panelSyncLock) return;

    syncFromEncoded();

    if (shouldAutoFollow()) {
        userReadingOldMessages = false;
        unseenMessagesCount = 0;
    } else {
        userReadingOldMessages = true;
    }

    updateScrollButton();
}

function afterConversationRender() {
    const currentCount = Array.isArray(state.messages) ? state.messages.length : 0;
    const newMessages = currentCount - lastRenderedMessagesCount;

    bindEncodedScrollTarget();

    if (newMessages > 0) {
        if (shouldAutoFollow()) {
            requestAnimationFrame(function () {
                forceStickToBottom();
            });
        } else {
            unseenMessagesCount += newMessages;
            userReadingOldMessages = true;
            updateScrollButton();
        }
    } else if (shouldAutoFollow()) {
        requestAnimationFrame(function () {
            forceStickToBottom();
        });
        userReadingOldMessages = false;
        unseenMessagesCount = 0;
        updateScrollButton();
    }

    lastRenderedMessagesCount = currentCount;
}

function bindEncodedScrollTarget() {
    const encoded = getEncodedScrollContainer();
    if (!encoded) return;

    if (currentEncodedScrollTarget && currentEncodedScrollTarget !== encoded) {
        currentEncodedScrollTarget.removeEventListener("scroll", handleEncodedScroll);
        delete currentEncodedScrollTarget.dataset.scrollBound;
    }

    currentEncodedScrollTarget = encoded;

    if (encoded.dataset.scrollBound === "1") return;

    encoded.dataset.scrollBound = "1";
    encoded.addEventListener("scroll", handleEncodedScroll, { passive: true });
}

scrollToBottomBtn.addEventListener("click", function () {
    scrollAllToBottom(true);
});

decodedPanel.addEventListener("scroll", handleDecodedScroll, { passive: true });

bindEncodedScrollTarget();

window.addEventListener("resize", function () {
    bindEncodedScrollTarget();

    if (shouldAutoFollow()) {
        setTimeout(function () {
            forceStickToBottom();
        }, 50);
    }
});