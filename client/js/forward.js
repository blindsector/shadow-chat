function getForwardMessagePreview(item) {
    if (!item) return "";

    if (item.type === "file") {
        return `[file] ${item.file_name || ""}`.trim();
    }

    const decoded = decodeText(item.encoded_text || "");
    return decoded || "(празно съобщение)";
}

function getForwardTargets() {
    const items = Array.isArray(state.chatItems) ? state.chatItems : [];

    return items.filter(item => {
        if (!item) return false;

        return !(
            String(item.type) === String(state.activeChatType) &&
            String(item.id) === String(state.activeChatId)
        );
    });
}

function getForwardTargetTitle(item) {
    return item.name || "Без име";
}

function getForwardTargetSubtitle(item) {
    if (item.type === "group") {
        if (item.subtitle && item.subtitle.trim()) {
            return item.subtitle;
        }
        return "Групов чат";
    }

    if (item.subtitle && item.subtitle.trim()) {
        return item.subtitle;
    }

    return "Личен чат";
}

function getFilteredForwardTargets() {
    const term = (state.forwardSearchTerm || "").trim().toLowerCase();
    const targets = getForwardTargets();

    if (!term) {
        return targets;
    }

    return targets.filter(item => {
        const title = getForwardTargetTitle(item).toLowerCase();
        const subtitle = getForwardTargetSubtitle(item).toLowerCase();
        const typeText = item.type === "group" ? "group група" : "direct личен чат";
        return (
            title.includes(term) ||
            subtitle.includes(term) ||
            typeText.includes(term)
        );
    });
}

function ensureForwardToast() {
    let toast = document.getElementById("forwardToast");

    if (toast) {
        return toast;
    }

    toast = document.createElement("div");
    toast.id = "forwardToast";
    toast.style.position = "fixed";
    toast.style.left = "50%";
    toast.style.bottom = "22px";
    toast.style.transform = "translateX(-50%) translateY(20px)";
    toast.style.minWidth = "180px";
    toast.style.maxWidth = "calc(100vw - 32px)";
    toast.style.padding = "14px 18px";
    toast.style.borderRadius = "18px";
    toast.style.background = "rgba(12, 18, 28, 0.96)";
    toast.style.border = "1px solid rgba(255,255,255,0.08)";
    toast.style.boxShadow = "0 16px 40px rgba(0,0,0,0.35)";
    toast.style.color = "#ffffff";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "600";
    toast.style.textAlign = "center";
    toast.style.zIndex = "999999";
    toast.style.opacity = "0";
    toast.style.pointerEvents = "none";
    toast.style.transition = "opacity 0.22s ease, transform 0.22s ease";
    toast.style.backdropFilter = "blur(12px)";
    toast.style.webkitBackdropFilter = "blur(12px)";

    document.body.appendChild(toast);
    return toast;
}

function showForwardToast(message) {
    const toast = ensureForwardToast();
    toast.textContent = message;

    if (toast._hideTimer) {
        clearTimeout(toast._hideTimer);
    }

    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";

    toast._hideTimer = setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(20px)";
    }, 1800);
}

function clearForwardState() {
    state.forwardMessage = null;
    state.forwardSelectedTarget = null;
    state.forwardSearchTerm = "";

    if (forwardSearchInput) {
        forwardSearchInput.value = "";
    }

    if (forwardPreviewText) {
        forwardPreviewText.textContent = "";
    }

    if (forwardTargetsList) {
        forwardTargetsList.innerHTML = "";
    }
}

function closeForwardModal() {
    if (!forwardModal) return;

    forwardModal.classList.add("hidden");
    clearForwardState();
}

function isForwardTargetSelected(target) {
    if (!state.forwardSelectedTarget || !target) {
        return false;
    }

    return (
        String(state.forwardSelectedTarget.type) === String(target.type) &&
        String(state.forwardSelectedTarget.id) === String(target.id)
    );
}

function selectForwardTarget(target) {
    state.forwardSelectedTarget = target;
    renderForwardTargets();
}

function renderForwardTargets() {
    if (!forwardTargetsList) return;

    forwardTargetsList.innerHTML = "";

    const targets = getFilteredForwardTargets();

    if (!targets.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Няма намерени чатове.";
        forwardTargetsList.appendChild(empty);
        return;
    }

    targets.forEach(target => {
        const row = document.createElement("div");
        row.className = "chat-item";

        if (isForwardTargetSelected(target)) {
            row.classList.add("selected");
        }

        const avatar = document.createElement("div");
        avatar.className = "avatar";

        if (target.type === "group") {
            if (typeof applyGroupAvatar === "function") {
                applyGroupAvatar(avatar, target.name);
            } else {
                avatar.textContent = (target.name || "G").slice(0, 1).toUpperCase();
            }
        } else {
            if (typeof applyUserAvatar === "function") {
                applyUserAvatar(avatar, target.name);
            } else {
                avatar.textContent = (target.name || "U").slice(0, 1).toUpperCase();
            }
        }

        const main = document.createElement("div");
        main.className = "chat-item-main";

        const top = document.createElement("div");
        top.className = "chat-item-top";

        const name = document.createElement("div");
        name.className = "chat-item-name";
        name.textContent = getForwardTargetTitle(target);

        if (target.type === "group") {
            const tag = document.createElement("span");
            tag.className = "chat-item-tag";
            tag.textContent = "GROUP";
            name.appendChild(tag);
        }

        const selectedMark = document.createElement("div");
        selectedMark.className = "chat-item-time";
        selectedMark.textContent = isForwardTargetSelected(target) ? "Избрано" : "";

        top.appendChild(name);
        top.appendChild(selectedMark);

        const bottom = document.createElement("div");
        bottom.className = "chat-item-bottom";
        bottom.textContent = getForwardTargetSubtitle(target);

        main.appendChild(top);
        main.appendChild(bottom);

        row.appendChild(avatar);
        row.appendChild(main);

        row.addEventListener("click", () => {
            selectForwardTarget(target);
        });

        forwardTargetsList.appendChild(row);
    });
}

function openForwardModal(item) {
    if (!forwardModal || !item) return;

    state.forwardMessage = item;
    state.forwardSelectedTarget = null;
    state.forwardSearchTerm = "";

    if (forwardPreviewText) {
        forwardPreviewText.textContent = getForwardMessagePreview(item);
    }

    if (forwardSearchInput) {
        forwardSearchInput.value = "";
    }

    renderForwardTargets();
    forwardModal.classList.remove("hidden");

    setTimeout(() => {
        if (forwardSearchInput) {
            forwardSearchInput.focus();
        }
    }, 0);
}

function getExternalShareText(item) {
    if (!item) return "";

    if (item.deleted_for_everyone) {
        return "";
    }

    if (item.type === "file") {
        return item.file_name || "Файл";
    }

    const decoded = decodeText(item.encoded_text || "");
    return decoded || "";
}

async function buildExternalShareData(item) {
    if (!item) return null;

    const text = getExternalShareText(item);

    if (item.type !== "file" || !item.file_url) {
        return {
            text: text || "Shadow Chat"
        };
    }

    const absoluteUrl = new URL(API_BASE + item.file_url, window.location.origin).toString();

    try {
        const response = await fetch(absoluteUrl);
        if (!response.ok) {
            throw new Error("share fetch failed");
        }

        const blob = await response.blob();
        const fileName = item.file_name || "shared-file";
        const fileType = blob.type || item.mime_type || "application/octet-stream";
        const shareFile = new File([blob], fileName, { type: fileType });

        if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
            const data = {
                files: [shareFile]
            };

            if (text && text !== fileName) {
                data.text = text;
            }

            return data;
        }
    } catch (error) {
        console.warn("file share fallback", error);
    }

    return {
        text: text || fileName || "Файл",
        url: absoluteUrl
    };
}

async function shareExternally(item) {
    if (!item) return;

    if (!navigator.share) {
        showForwardToast("Това устройство не поддържа външно споделяне.");
        return;
    }

    try {
        const data = await buildExternalShareData(item);
        if (!data) {
            showForwardToast("Няма какво да се сподели.");
            return;
        }

        await navigator.share(data);
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }

        console.error(error);
        showForwardToast("Неуспешно споделяне.");
    }
}

async function confirmForward() {
    const item = state.forwardMessage;
    const target = state.forwardSelectedTarget;

    if (!item) {
        showForwardToast("Няма избрано съобщение.");
        return;
    }

    if (!target) {
        showForwardToast("Избери чат или група.");
        return;
    }

    if (item.deleted_for_everyone) {
        showForwardToast("Съобщението е изтрито.");
        return;
    }

    const payload = {
        chat_type: state.activeChatType === "group" ? "group" : "direct",
        item_type: item.type === "file" ? "file" : "text",
        item_id: item.id
    };

    if (target.type === "group") {
        payload.group_id = Number(target.id);
    } else {
        payload.receiver_id = Number(target.id);
    }

    try {
        await apiRequest("/api/messages/forward", "POST", payload, true);

        closeForwardModal();
        await loadAllChatSources();

        if (
            String(state.activeChatType) === String(target.type) &&
            String(state.activeChatId) === String(target.id)
        ) {
            await loadConversation(true);
        }

        showForwardToast("Препратено");
    } catch (error) {
        console.error(error);
        showForwardToast(error.message || "Forward error");
    }
}

function bindForwardModalEvents() {
    if (window.__forwardModalBound) return;
    window.__forwardModalBound = true;

    if (cancelForwardBtn) {
        cancelForwardBtn.addEventListener("click", closeForwardModal);
    }

    if (confirmForwardBtn) {
        confirmForwardBtn.addEventListener("click", confirmForward);
    }

    if (forwardSearchInput) {
        forwardSearchInput.addEventListener("input", () => {
            state.forwardSearchTerm = forwardSearchInput.value || "";
            renderForwardTargets();
        });
    }

    if (forwardModal) {
        forwardModal.addEventListener("click", (e) => {
            if (e.target === forwardModal) {
                closeForwardModal();
            }
        });
    }
}

bindForwardModalEvents();
