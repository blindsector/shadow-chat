function startApp() {
    bindEvents();

    state.onlineVisibilityEnabled = loadOnlineVisibilitySetting();

    if (typeof onlineVisibilityToggle !== "undefined" && onlineVisibilityToggle) {
        onlineVisibilityToggle.checked = state.onlineVisibilityEnabled;
    }

    bootstrapSession();
}

function startApp() {
    bindEvents();

    state.onlineVisibilityEnabled = loadOnlineVisibilitySetting();

    if (typeof onlineVisibilityToggle !== "undefined" && onlineVisibilityToggle) {
        onlineVisibilityToggle.checked = state.onlineVisibilityEnabled;
    }

    bootstrapSession();

    setTimeout(() => {
        if (state.user) {
            feedback.init();
        }
    }, 500);
}