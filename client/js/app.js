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

    setTimeout(function () {
        if (
            typeof window.__consumePendingPushChat === "function" &&
            localStorage.getItem("shadow_pending_push_chat")
        ) {
            window.__consumePendingPushChat();
        }
    }, 250);
}

startApp();