let userReadingOldMessages = false;
let unseenMessagesCount = 0;
let lastRenderedMessagesCount = 0;

const NEAR_BOTTOM_THRESHOLD = 60;

let panelSyncLock = false;
let currentEncodedScrollTarget = null;

/*
    FIX 1:
    ВИНАГИ използваме encodedMessages като scroll контейнер,
    защото той реално се мести в балона.
*/
function getEncodedScrollContainer() {

    if (typeof encodedMessages !== "undefined" && encodedMessages) {
        return encodedMessages;
    }

    if (typeof encodedPanel !== "undefined" && encodedPanel) {
        return encodedPanel;
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

/*
    FIX 2:
    Force bottom когато клавиатура / preview / нови съобщения
*/
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

    const encoded = getEncodedScrollContainer();
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

    if (isNearBottom(decodedPanel)) {
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

    const encoded = getEncodedScrollContainer();

    if (encoded && isNearBottom(encoded)) {
        userReadingOldMessages = false;
        unseenMessagesCount = 0;
    } else {
        userReadingOldMessages = true;
    }

    updateScrollButton();
}

/*
    FIX 3:
    ВИНАГИ stick to bottom ако си долу
*/
function afterConversationRender() {

    const encoded = getEncodedScrollContainer();
    const currentCount = Array.isArray(state.messages) ? state.messages.length : 0;
    const newMessages = currentCount - lastRenderedMessagesCount;

    bindEncodedScrollTarget();

    const stayAtBottom = shouldAutoFollow();

    if (newMessages > 0) {

        if (stayAtBottom) {

            requestAnimationFrame(forceStickToBottom);

        } else {

            unseenMessagesCount += newMessages;
            userReadingOldMessages = true;
            updateScrollButton();
        }

    } else {

        if (stayAtBottom) {

            requestAnimationFrame(forceStickToBottom);

            userReadingOldMessages = false;
            unseenMessagesCount = 0;
        }

        updateScrollButton();
    }

    lastRenderedMessagesCount = currentCount;
}

/*
    FIX 4:
    винаги слушаме encodedMessages
*/
function bindEncodedScrollTarget() {

    const encoded = getEncodedScrollContainer();
    if (!encoded) return;

    if (currentEncodedScrollTarget && currentEncodedScrollTarget !== encoded) {
        currentEncodedScrollTarget.removeEventListener("scroll", handleEncodedScroll);
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

/*
    FIX 5:
    клавиатура / resize → винаги долу
*/
window.addEventListener("resize", function () {

    bindEncodedScrollTarget();

    if (shouldAutoFollow()) {
        setTimeout(forceStickToBottom, 50);
    }
});