async function postEncodedMessage(encoded) {
    if (state.activeChatType === "group") {
        await apiRequest(
            `/api/groups/${state.activeChatId}/send`,
            "POST",
            { encoded_text: encoded },
            true
        );
    } else {
        await apiRequest(
            "/api/messages/send",
            "POST",
            {
                receiver_id: state.activeChatId,
                encoded_text: encoded
            },
            true
        );
    }
}

async function sendMessage() {
    const raw = messageInput.value.trim();
    const hasPendingAttachment =
        typeof hasPendingAttachmentUpload === "function" &&
        hasPendingAttachmentUpload();

    if (!raw && !hasPendingAttachment) {
        return;
    }

    const activeItem = getActiveChatItem();
    if (!activeItem) {
        alert("Избери чат.");
        return;
    }

    try {
        if (raw) {
            const text = buildOutgoingText(raw);
            const encoded = encodeText(text);
            await postEncodedMessage(encoded);
        }

        if (hasPendingAttachment) {
            await uploadPendingAttachment();
        }

        messageInput.value = "";
        messageInput.style.height = "28px";

        clearReply();

        if (typeof clearPendingAttachment === "function") {
            clearPendingAttachment();
        }

        await loadConversation(true);
        await loadAllChatSources();
        if (typeof feedback !== "undefined" && feedback && typeof feedback.playSend === "function") {
            feedback.playSend();
        }

        // keep keyboard active
        if (messageInput) {
            messageInput.focus();
        }

    } catch (error) {
        alert(error.message);
    }
}
