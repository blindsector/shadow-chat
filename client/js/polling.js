const PRESENCE_ONLINE_THRESHOLD_MS = 35000;
const PRESENCE_ACTIVITY_WINDOW_MS = 120000;

let presenceActivityTrackingBound = false;
let lastPresenceInteractionAt = Date.now();

function markPresenceActivity() {
    lastPresenceInteractionAt = Date.now();
}

function shouldSendPresencePing() {
    if (!state.user) {
        return false;
    }

    if (document.hidden) {
        return false;
    }

    return (Date.now() - lastPresenceInteractionAt) <= PRESENCE_ACTIVITY_WINDOW_MS;
}

function bindPresenceActivityTracking() {
    if (presenceActivityTrackingBound) {
        return;
    }

    presenceActivityTrackingBound = true;

    const mark = function () {
        markPresenceActivity();
    };

    window.addEventListener("focus", mark);
    window.addEventListener("mousedown", mark, { passive: true });
    window.addEventListener("touchstart", mark, { passive: true });
    window.addEventListener("keydown", mark);
    window.addEventListener("scroll", mark, { passive: true });

    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) {
            markPresenceActivity();
        }
    });

    if (typeof messageInput !== "undefined" && messageInput) {
        messageInput.addEventListener("input", mark);
        messageInput.addEventListener("focus", mark);
    }
}

function startPolling() {
    stopPolling();
    stopPresenceHeartbeat();
    bindPresenceActivityTracking();

    state.pollTimer = setInterval(async function () {
        if (!state.user) return;

        await loadAllChatSources();
        checkForNewMessagesAndNotify();

        if (
    chatRoomScreen.classList.contains("active") &&
    state.activeChatType &&
    state.activeChatId &&
    !state.pendingPushOpen
) {
            if (state.activeChatType === "direct" && state.receiptsEnabled) {
                try {
                    await apiRequest(
                        "/api/messages/read",
                        "POST",
                        {
                            contact_id: state.activeChatId
                        },
                        true
                    );
                } catch (err) {
                    console.warn("read receipt failed", err);
                }
            }

            if (state.activeChatType === "group") {
                try {
                    await apiRequest(
                        "/api/groups/" + state.activeChatId + "/read",
                        "POST",
                        {},
                        true
                    );
                } catch (err) {
                    console.warn("group read failed", err);
                }
            }

await loadConversation(false);

// ===== TYPING CHECK (FIXED) =====
if (state.activeChatType === "direct" && state.activeChatId) {
    try {
        const res = await apiRequest(
            "/api/messages/typing?contact_id=" + state.activeChatId,
            "GET",
            null,
            true
        );

        if (res && res.typing) {
            state.typingUsers[state.activeChatId] = Date.now() + 3000;
        } else {
            state.typingUsers[state.activeChatId] = 0;
        }

        renderConversation(false);
    } catch (err) {}
}
        }
    }, 2000);

    startPresenceHeartbeat();
}

function stopPolling() {
    if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
    }

    stopPresenceHeartbeat();
}


/* ========= PRESENCE HEARTBEAT + LOCAL UI REFRESH ========= */

function getPresenceLastSeenMs(presence) {
    if (!presence || !presence.last_seen_at) {
        return 0;
    }

    const d = parseServerDate(presence.last_seen_at);
    if (!d) {
        return 0;
    }

    return d.getTime();
}

function computePresenceOnlineState(presence) {
    if (!presence || !presence.is_visible) {
        return false;
    }

    const lastSeenMs = getPresenceLastSeenMs(presence);

    if (!lastSeenMs) {
        return false;
    }

    return (Date.now() - lastSeenMs) <= PRESENCE_ONLINE_THRESHOLD_MS;
}

function refreshPresenceUiFromLocalClock() {
    const presence = state.activeChatPresence;

    if (!presence) {
        return;
    }

    const nextIsOnline = computePresenceOnlineState(presence);
    const changed = presence.is_online !== nextIsOnline;

    if (changed) {
        state.activeChatPresence = {
            ...presence,
            is_online: nextIsOnline
        };
    }

    if (changed || (state.activeChatType === "direct" && presence.last_seen_at)) {
        renderChatHeader();

        if (chatListScreen.classList.contains("active")) {
            renderChatList();
        }
    }
}

function startPresenceHeartbeat() {
    stopPresenceHeartbeat();

    refreshPresenceUiFromLocalClock();

    state.presenceTimer = setInterval(async function () {
        if (!state.user) return;

        refreshPresenceUiFromLocalClock();

        if (!shouldSendPresencePing()) {
            return;
        }

        try {
            await apiRequest(
                "/api/users/presence/ping",
                "POST",
                {},
                true
            );

            markPresenceActivity();
        } catch (err) {
            console.warn("presence ping failed", err);
        }
    }, 15000);
}

function stopPresenceHeartbeat() {
    if (state.presenceTimer) {
        clearInterval(state.presenceTimer);
        state.presenceTimer = null;
    }
}

let lastNotificationSignature = "";

function checkForNewMessagesAndNotify() {
    if (!state.chatItems || !state.chatItems.length) {
        return;
    }

    const latest = state.chatItems[0];
    if (!latest) {
        return;
    }

    const signature =
        String(latest.last_message_id || "") +
        "_" +
        String(latest.updated_at || "") +
        "_" +
        String(latest.last_message_preview || "");

    if (!lastNotificationSignature) {
        lastNotificationSignature = signature;
        return;
    }

    if (signature === lastNotificationSignature) {
        return;
    }

    lastNotificationSignature = signature;

    const isChatScreenVisible =
        chatRoomScreen &&
        chatRoomScreen.classList.contains("active") &&
        !document.hidden;

    const isSameChatAsLatest =
        state.activeChatType === latest.type &&
        String(state.activeChatId) === String(latest.id);

    const isSameChatOpenNow =
        isChatScreenVisible &&
        isSameChatAsLatest;

    const title = latest.name || "Ново съобщение";
    const body = latest.last_message_preview || "Имаш ново съобщение";

    if (isSameChatOpenNow) {
        return;
    }

    const shouldUseNativePush =
        !!window.AndroidBridge &&
        typeof AndroidBridge.triggerNativeNotification === "function";

    const shouldPlayLocalReceiveFeedback =
        !document.hidden && !shouldUseNativePush;

    if (
        shouldPlayLocalReceiveFeedback &&
        typeof feedback !== "undefined" &&
        feedback &&
        typeof feedback.playReceive === "function"
    ) {
        feedback.playReceive();
    }

    if (shouldUseNativePush) {
        AndroidBridge.triggerNativeNotification(title, body);
        return;
    }

    showNotification(title, body);
}