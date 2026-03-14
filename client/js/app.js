function startApp() {
    bindEvents();

    state.onlineVisibilityEnabled = loadOnlineVisibilitySetting();

    if (typeof onlineVisibilityToggle !== "undefined" && onlineVisibilityToggle) {
        onlineVisibilityToggle.checked = state.onlineVisibilityEnabled;
    }

    bootstrapSession();
}

startApp();