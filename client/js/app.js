async function startApp() {
    bindEvents();

    state.onlineVisibilityEnabled = loadOnlineVisibilitySetting();

    if (typeof onlineVisibilityToggle !== "undefined" && onlineVisibilityToggle) {
        onlineVisibilityToggle.checked = state.onlineVisibilityEnabled;
    }

    if (typeof feedback !== "undefined" && feedback && typeof feedback.init === "function") {
        feedback.init();
    }

    try {
        await bootstrapSession();
    } catch (e) {
        console.warn("bootstrapSession failed", e);
    }
}

startApp();