function getToken() {
    return localStorage.getItem("shadow_token");
}

function setToken(token) {
    localStorage.setItem("shadow_token", token);
}

function clearToken() {
    localStorage.removeItem("shadow_token");
}

function saveActiveChat(id, type) {
    localStorage.setItem("shadow_active_chat_id", String(id));
    localStorage.setItem("shadow_active_chat_type", String(type));
}

function loadActiveChat() {
    const id = localStorage.getItem("shadow_active_chat_id");
    const type = localStorage.getItem("shadow_active_chat_type");

    return { id, type };
}

function getReceiptsStorageKey(userId) {
    if (userId === undefined || userId === null || userId === "") {
        return "shadow_receipts";
    }

    return "shadow_receipts_" + String(userId);
}

function loadReceiptsSetting(userId) {
    const val = localStorage.getItem(getReceiptsStorageKey(userId));

    if (val === null) {
        return true;
    }

    return val === "true";
}

function saveReceiptsSetting(value, userId) {
    localStorage.setItem(getReceiptsStorageKey(userId), String(!!value));
}


/* ========= ONLINE VISIBILITY STORAGE ========= */

function getOnlineVisibilityStorageKey(userId) {
    if (userId === undefined || userId === null || userId === "") {
        return "shadow_online_visibility";
    }

    return "shadow_online_visibility_" + String(userId);
}

function loadOnlineVisibilitySetting(userId) {
    const val = localStorage.getItem(getOnlineVisibilityStorageKey(userId));

    if (val === null) {
        return true;
    }

    return val === "true";
}

function saveOnlineVisibilitySetting(value, userId) {
    localStorage.setItem(getOnlineVisibilityStorageKey(userId), String(!!value));
}

/* ========= NOTIFICATIONS STORAGE ========= */

function getNotificationsStorageKey(userId) {
    if (!userId) return "shadow_notifications";
    return "shadow_notifications_" + String(userId);
}

function loadNotificationsSetting(userId) {
    const val = localStorage.getItem(getNotificationsStorageKey(userId));
    if (val === null) return true; // по default включени
    return val === "true";
}

function saveNotificationsSetting(value, userId) {
    localStorage.setItem(
        getNotificationsStorageKey(userId),
        String(!!value)
    );
}