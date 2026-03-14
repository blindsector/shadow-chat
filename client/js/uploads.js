function isImageFile(file) {
    if (!file) return false;

    const name = String(file.name || "").toLowerCase();
    const type = String(file.type || "").toLowerCase();

    return type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);
}

function isAudioFile(file) {
    if (!file) return false;

    const name = String(file.name || "").toLowerCase();
    const type = String(file.type || "").toLowerCase();

    return type.startsWith("audio/") || /\.(mp3|m4a|aac|wav|ogg|oga|webm)$/i.test(name);
}

function ensurePendingAttachmentState() {
    if (!state.pendingAttachment) {
        state.pendingAttachment = null;
    }
}

function clearPendingAttachment() {
    ensurePendingAttachmentState();

    if (state.pendingAttachment && state.pendingAttachment.previewUrl) {
        URL.revokeObjectURL(state.pendingAttachment.previewUrl);
    }

    state.pendingAttachment = null;
}

function hasPendingAttachmentUpload() {
    ensurePendingAttachmentState();

    return !!(
        state.pendingAttachment &&
        state.pendingAttachment.file
    );
}

function hasPendingImageAttachment() {
    ensurePendingAttachmentState();

    return !!(
        state.pendingAttachment &&
        state.pendingAttachment.kind === "image" &&
        state.pendingAttachment.file
    );
}

function queueAttachment(file) {
    const activeItem = getActiveChatItem();

    if (!activeItem) {
        alert("Избери чат.");
        return;
    }

    clearPendingAttachment();

    let kind = "file";
    if (isImageFile(file)) {
        kind = "image";
    } else if (isAudioFile(file)) {
        kind = "audio";
    }

    state.pendingAttachment = {
        kind: kind,
        file: file,
        previewUrl: URL.createObjectURL(file)
    };

    messageInput.focus();
    renderConversation(false);
}

function queueImageAttachment(file) {
    queueAttachment(file);
}

async function queueCameraAttachment(file) {
    if (!file) return;

    let prepared = file;

    if (typeof compressImageFile === "function") {
        prepared = await compressImageFile(file, {
            maxSide: 1600,
            quality: 0.82
        });
    }

    queueAttachment(prepared);
}

function queueVoiceAttachment(file) {
    if (!file) return;
    queueAttachment(file);
}

async function uploadFileToServer(file) {
    const activeItem = getActiveChatItem();

    if (!activeItem) {
        alert("Избери чат.");
        return null;
    }

    const formData = new FormData();
    formData.append("file", file);

    if (state.activeChatType === "group") {
        formData.append("group_id", state.activeChatId);
    } else {
        formData.append("receiver_id", state.activeChatId);
    }

    const token = getToken();

    const response = await fetch(`${API_BASE}/api/messages/upload`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`
        },
        body: formData
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Upload failed.");
    }

    return data;
}

async function uploadPendingAttachment() {
    if (!hasPendingAttachmentUpload()) return null;

    const file = state.pendingAttachment.file;
    const result = await uploadFileToServer(file);
    clearPendingAttachment();
    return result;
}

async function uploadPendingImageAttachment() {
    return uploadPendingAttachment();
}

async function uploadAttachment(file) {
    if (!file) return;

    queueAttachment(file);
}

function handleAvatarUpload(file) {
    if (!state.user || !file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        saveAvatar(state.user.username, e.target.result);
        renderMyHeader();
        renderChatHeader();
        renderChatList();
    };

    reader.readAsDataURL(file);
}
