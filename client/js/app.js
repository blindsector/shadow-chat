function startApp() {
    bindEvents();

    state.onlineVisibilityEnabled = loadOnlineVisibilitySetting();

    if (typeof onlineVisibilityToggle !== "undefined" && onlineVisibilityToggle) {
        onlineVisibilityToggle.checked = state.onlineVisibilityEnabled;
    }

    bootstrapSession();

    setTimeout(() => {
        if (state.user && typeof feedback !== "undefined") {
            feedback.init();
        }
    }, 500);
}

startApp();