function buildMessageIdentitySignature(messages) {
    const list = Array.isArray(messages) ? messages : [];

    return list.map(function (item) {
        return [
            item.id || "",
            item.type || "",
            item.created_at || "",
            item.sender_id || "",
            item.receiver_id || "",
            item.group_id || "",
            item.encoded_text || "",
            item.file_url || "",
            item.file_name || "",
            item.mime_type || "",
            item.delivered_at || "",
            item.seen_at || "",
            item.deleted_for_everyone ? "1" : "0",
            JSON.stringify(item.reactions || [])
        ].join("|");
    }).join("||");
}

async function loadConversation(forceScroll = false) {
    const activeItem = getActiveChatItem();

    if (!activeItem) {
        state.messages = [];
        state.activeChatPresence = null;
        state._lastConversationKey = null;
        state._lastFetchedConversationSignature = "";
        renderConversation(true);
        return;
    }

    const activeKey = String(state.activeChatType) + ":" + String(state.activeChatId);
    const isChatSwitch = state._lastConversationKey !== activeKey;

    const beforeLastId = state.messages.length
        ? state.messages[state.messages.length - 1].id
        : 0;

    const userWasNearBottom = isChatSwitch ? true : isNearBottom(decodedPanel);

    try {
        let data;

        if (state.activeChatType === "group") {
            state.activeChatPresence = null;

            data = await apiRequest(
                `/api/groups/${state.activeChatId}/messages`,
                "GET",
                null,
                true
            );
        } else {
            data = await apiRequest(
                `/api/messages/conversation?contact_id=${state.activeChatId}`,
                "GET",
                null,
                true
            );

            try {
                const presenceData = await apiRequest(
                    `/api/users/presence/${state.activeChatId}`,
                    "GET",
                    null,
                    true
                );

                state.activeChatPresence = presenceData.presence || null;
            } catch (presenceError) {
                console.warn("presence load failed", presenceError);
                state.activeChatPresence = null;
            }
        }

        const nextMessages = data.messages || [];
        const nextSignature = buildMessageIdentitySignature(nextMessages);
        const sameConversationData =
            !isChatSwitch &&
            state._lastFetchedConversationSignature === nextSignature;

        state._lastConversationKey = activeKey;

        if (!sameConversationData || forceScroll || isChatSwitch) {
            state.messages = nextMessages;
            state._lastFetchedConversationSignature = nextSignature;
            renderConversation(forceScroll || isChatSwitch || userWasNearBottom);
        }

        const afterLastId = nextMessages.length
            ? nextMessages[nextMessages.length - 1].id
            : 0;

        if (!isChatSwitch && !userWasNearBottom && afterLastId > beforeLastId) {
            scrollToBottomBtn.classList.remove("hidden");
        }
    } catch (error) {
        console.error(error);
    }
}
