let userReadingOldMessages = false;
let unseenMessagesCount = 0;
let lastRenderedMessagesCount = 0;

const NEAR_BOTTOM_THRESHOLD = 60;

let panelSyncLock = false;

function getEncodedScrollContainer() {

    if (typeof encodedPanel !== "undefined" && encodedPanel) {
        return encodedPanel;
    }

    if (typeof encodedMessages !== "undefined" && encodedMessages) {
        return encodedMessages;
    }

    return null;
}

function getDistanceFromBottom(container) {
    return container.scrollHeight - container.scrollTop - container.clientHeight;
}

function isNearBottom(container) {
    return getDistanceFromBottom(container) <= NEAR_BOTTOM_THRESHOLD;
}

function shouldAutoFollow() {

    const encoded = getEncodedScrollContainer();

    if (!encoded) return true;

    return isNearBottom(decodedPanel) && isNearBottom(encoded);
}

function syncFromDecoded() {

    const encoded = getEncodedScrollContainer();
    if (!encoded) return;

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
    if (!encoded) return;

    const decodedMax = decodedPanel.scrollHeight - decodedPanel.clientHeight;
    const encodedMax = encoded.scrollHeight - encoded.clientHeight;

    if (decodedMax <= 0 || encodedMax <= 0) return;

    const ratio = encoded.scrollTop / encodedMax;

    panelSyncLock = true;

    decodedPanel.scrollTop = decodedMax * ratio;

    panelSyncLock = false;
}

function scrollAllToBottom(force = false) {

    const encoded = getEncodedScrollContainer();
    if (!encoded) return;

    if (!force && userReadingOldMessages) return;

    panelSyncLock = true;

    decodedPanel.scrollTop = decodedPanel.scrollHeight;
    encoded.scrollTop = encoded.scrollHeight;

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

    if (unseenMessagesCount > 0) {
        scrollToBottomBtn.textContent = "↓ " + unseenMessagesCount;
    } else {
        scrollToBottomBtn.textContent = "↓";
    }
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

    const encoded = getEncodedScrollContainer();
    if (!encoded) return;

    const currentCount = Array.isArray(state.messages)
        ? state.messages.length
        : 0;

    const newMessages = currentCount - lastRenderedMessagesCount;

    if (newMessages > 0) {

        if (shouldAutoFollow()) {

            scrollAllToBottom(true);

        } else {

            unseenMessagesCount += newMessages;
            userReadingOldMessages = true;

            updateScrollButton();
        }
    }

    lastRenderedMessagesCount = currentCount;
}

scrollToBottomBtn.addEventListener("click", function () {
    scrollAllToBottom(true);
});

decodedPanel.addEventListener("scroll", handleDecodedScroll);

const encodedContainer = getEncodedScrollContainer();

if (encodedContainer) {
    encodedContainer.addEventListener("scroll", handleEncodedScroll);
}

window.addEventListener("resize", function () {

    if (shouldAutoFollow()) {
        scrollAllToBottom(true);
    }
});