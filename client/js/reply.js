function getMessagePlainText(item) {
    if (item.type === "file") {
        return `[file] ${item.file_name || ""}`.trim();
    }

    return decodeText(item.encoded_text || "");
}

function getReplySenderText(item) {
    if (!item) return "Reply";

    if (state.activeChatType === "group") {
        return item.sender_id === state.user.id ? "Аз" : (item.sender_username || "Участник");
    }

    return item.sender_id === state.user.id ? "Аз" : "Ти";
}

function setReply(item) {
    state.replyTo = {
        id: item.id,
        type: item.type || "text",
        senderText: getReplySenderText(item),
        previewText: getMessagePlainText(item)
    };

    replyPreviewText.textContent = `${state.replyTo.senderText}: ${state.replyTo.previewText}`;
    replyBar.classList.remove("hidden");

    if (typeof closeMessageMenu === "function") {
        closeMessageMenu();
    } else if (typeof closeMessageMenuFallback === "function") {
        closeMessageMenuFallback();
    }

    if (typeof closeEmojiPicker === "function") {
        closeEmojiPicker();
    } else if (typeof closeEmojiPickerFallback === "function") {
        closeEmojiPickerFallback();
    }

    messageInput.focus();
}

function clearReply() {
    state.replyTo = null;
    replyPreviewText.textContent = "";
    replyBar.classList.add("hidden");
}

function buildOutgoingText(rawText) {
    const text = rawText.trim();

    if (!state.replyTo) {
        return text;
    }

    return `↩ ${state.replyTo.senderText}: ${state.replyTo.previewText}\n${text}`;
}