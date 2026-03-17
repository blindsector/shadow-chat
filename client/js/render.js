function isDeletedForEveryone(item) {
    return !!item.deleted_for_everyone;
}

function getDeletedPlaceholder() {
    return "Съобщението е изтрито";
}

function createForwardLabel(item) {
    if (!item || !item.is_forwarded) return null;

    const label = document.createElement("div");
    label.className = "forward-label";
    label.textContent = "↪ Препратено";

    return label;
}

function shouldShowDecodedBubbleAvatar(item, isMe) {
    if (state.activeChatType !== "group") return false;
    if (isMe) return false;
    if (isDeletedForEveryone(item)) return false;
    return true;
}

function makeGroupIncomingAvatar(item) {
    const wrap = document.createElement("div");
    wrap.className = "bubble-sender-wrap";

    const avatar = document.createElement("div");
    avatar.className = "bubble-avatar";

    if (item.sender_username) {
        applyUserAvatar(avatar, item.sender_username);
    } else {
        avatar.textContent = initialsFromText("?");
    }

    wrap.appendChild(avatar);
    return wrap;
}

function makeDecodedAvatarHead(item, isMe) {
    if (!shouldShowDecodedBubbleAvatar(item, isMe)) {
        return null;
    }

    const head = document.createElement("div");
    head.className = "bubble-head";
    head.appendChild(makeGroupIncomingAvatar(item));
    return head;
}

function createReplyChip(item) {
    if (!item || item.type !== "text" || isDeletedForEveryone(item)) return null;

    const decodedText = decodeText(item.encoded_text || "");
    if (!decodedText.startsWith("↩ ")) return null;

    const lines = decodedText.split("\n");
    if (lines.length < 2) return null;

    const chip = document.createElement("div");
    chip.className = "reply-chip";

    const title = document.createElement("div");
    title.className = "reply-chip-title";
    title.textContent = "Reply";

    const text = document.createElement("div");
    text.className = "reply-chip-text";
    text.textContent = lines[0].replace(/^↩\s*/, "");

    chip.appendChild(title);
    chip.appendChild(text);

    return chip;
}

function getVisibleMessageText(item) {
    if (!item) return "";

    if (isDeletedForEveryone(item)) {
        return getDeletedPlaceholder();
    }

    if (item.type === "file" || item.type === "image") return "";

    const decodedText = decodeText(item.encoded_text || "");

    if (decodedText.startsWith("↩ ")) {
        const lines = decodedText.split("\n");
        return lines.slice(1).join("\n").trim();
    }

    return decodedText;
}

function getEncodedVisibleText(item) {
    if (!item) return "";

    if (isDeletedForEveryone(item)) {
        return getDeletedPlaceholder();
    }

    if (item.type === "file" || item.type === "image") {
        return "";
    }

    return item.encoded_text || "";
}

function getMessageReactions(item) {
    if (!item || isDeletedForEveryone(item)) {
        return [];
    }
    return Array.isArray(item.reactions) ? item.reactions : [];
}

function createReactionsRow(item) {
    const reactions = getMessageReactions(item);

    if (!reactions.length) {
        return null;
    }

    const row = document.createElement("div");
    row.className = "reactions-row";

    reactions.forEach(function (reaction) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "reaction-chip";
        chip.textContent = reaction.emoji + " " + reaction.count;
        chip.addEventListener("click", async function (e) {
            e.stopPropagation();
            await reactToMessage(item, reaction.emoji);
        });
        row.appendChild(chip);
    });

    return row;
}

function getReceiptSymbol(item) {
    if (item.seen_at) return "✓✓";
    if (item.delivered_at) return "✓✓";
    return "✓";
}

function findLastOwnRenderUnitId(units) {
    if (!Array.isArray(units) || !state.user) return null;

    for (let i = units.length - 1; i >= 0; i--) {
        const unit = units[i];
        if (!unit) continue;
        if (Number(unit.sender_id) !== Number(state.user.id)) continue;
        if (isDeletedForEveryone(unit.actionItem)) continue;
        return unit.id;
    }

    return null;
}

function createReceiptMeta(item, isMe, isLastOwnMessage) {
    if (!isMe) return null;
    if (!isLastOwnMessage) return null;
    if (isDeletedForEveryone(item)) return null;
    if (state.activeChatType !== "direct") return null;

    const meta = document.createElement("div");
    meta.className = "receipt-meta";
    meta.textContent = getReceiptSymbol(item);

    meta.style.marginTop = "3px";
    meta.style.fontSize = "11px";
    meta.style.lineHeight = "1";
    meta.style.letterSpacing = "0.2px";
    meta.style.textAlign = "right";
    meta.style.alignSelf = "flex-end";
    meta.style.paddingRight = "4px";
    meta.style.userSelect = "none";

    if (item.seen_at) {
        meta.style.opacity = "1";
        meta.style.color = "#7dd3fc";
    } else if (item.delivered_at) {
        meta.style.opacity = "0.7";
        meta.style.color = "";
    } else {
        meta.style.opacity = "0.52";
        meta.style.color = "";
    }

    return meta;
}

function createDeletedTextBlock() {
    const message = document.createElement("div");
    message.className = "message-text";
    message.textContent = getDeletedPlaceholder();
    message.style.opacity = "0.74";
    message.style.fontStyle = "italic";
    return message;
}

function parseMessageTimestamp(value) {
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? 0 : ts;
}

function shouldShowTimeAbove(currentItem, prevItem) {
    if (!currentItem) return false;
    if (!prevItem) return true;

    const currentTs = parseMessageTimestamp(currentItem.created_at);
    const prevTs = parseMessageTimestamp(prevItem.created_at);

    if (!currentTs || !prevTs) return true;

    return Math.abs(currentTs - prevTs) >= 5 * 60 * 1000;
}

function ensureManualTimeState() {
    if (!state.manualTimeVisibility) {
        state.manualTimeVisibility = {};
    }
}

function getManualTimeKey(item, side) {
    return String(side) + ":" + String(item.id);
}

function isManualTimeVisible(item, side) {
    ensureManualTimeState();
    return state.manualTimeVisibility[getManualTimeKey(item, side)] === true;
}

function setManualTimeVisible(item, side, visible) {
    ensureManualTimeState();

    if (visible) {
        state.manualTimeVisibility[getManualTimeKey(item, side)] = true;
    } else {
        delete state.manualTimeVisibility[getManualTimeKey(item, side)];
    }
}

function createTimeMeta(item, visibleByDefault, side) {
    const time = document.createElement("div");
    const isVisible = visibleByDefault || isManualTimeVisible(item, side);

    time.className = "time time-above-bubble";
    time.textContent = formatTimeShort(item.created_at);
    time.dataset.pinned = isVisible ? "1" : "0";

    time.style.marginBottom = "4px";
    time.style.marginTop = "0";
    time.style.fontSize = "11px";
    time.style.lineHeight = "1.1";
    time.style.opacity = isVisible ? "0.62" : "0";
    time.style.display = isVisible ? "block" : "none";
    time.style.pointerEvents = "none";
    time.style.userSelect = "none";
    time.style.alignSelf = "center";
    time.style.width = "100%";
    time.style.textAlign = "center";
    time.style.paddingLeft = "0";
    time.style.paddingRight = "0";

    return time;
}

function attachTimeReveal(bubble, timeMeta, item, visibleByDefault, side) {
    if (!bubble || !timeMeta || !item) return;

    bubble.style.transition = "transform 120ms ease";

    bubble.addEventListener("click", function () {
        bubble.style.transform = "translateY(-3px)";
        setTimeout(function () {
            bubble.style.transform = "translateY(0px)";
        }, 120);

        const isVisible = timeMeta.style.display === "block";
        const nextVisible = !isVisible;

        if (!nextVisible && visibleByDefault) {
            timeMeta.style.display = "none";
            timeMeta.style.opacity = "0";
            timeMeta.dataset.pinned = "0";
            setManualTimeVisible(item, side, false);
            return;
        }

        if (nextVisible) {
            timeMeta.style.display = "block";
            timeMeta.style.opacity = "0.62";
            timeMeta.dataset.pinned = "1";
            setManualTimeVisible(item, side, true);
        } else {
            timeMeta.style.display = "none";
            timeMeta.style.opacity = "0";
            timeMeta.dataset.pinned = "0";
            setManualTimeVisible(item, side, false);
        }
    });
}

function isAttachmentMessage(item) {
    return !!item && (item.type === "file" || item.type === "image");
}

function canMergeTextWithAttachment(textItem, attachmentItem) {
    if (!textItem || !attachmentItem) return false;
    if (textItem.type !== "text") return false;
    if (!isAttachmentMessage(attachmentItem)) return false;
    if (Number(textItem.sender_id) !== Number(attachmentItem.sender_id)) return false;
    if (isDeletedForEveryone(textItem) || isDeletedForEveryone(attachmentItem)) return false;

    const textVisible = getVisibleMessageText(textItem);
    if (!textVisible) return false;

    const textTs = parseMessageTimestamp(textItem.created_at);
    const attachmentTs = parseMessageTimestamp(attachmentItem.created_at);

    if (!textTs || !attachmentTs) return false;

    return Math.abs(attachmentTs - textTs) <= 60 * 1000;
}

function buildRenderUnits(messages) {
    const units = [];
    const list = Array.isArray(messages) ? messages : [];
    let i = 0;

    while (i < list.length) {
        const current = list[i];
        const next = list[i + 1];

        if (canMergeTextWithAttachment(current, next)) {
            units.push({
                id: String(next.id),
                sender_id: next.sender_id,
                created_at: next.created_at,
                actionItem: next,
                textItem: current,
                displayItem: next,
                sourceItems: [current, next]
            });
            i += 2;
            continue;
        }

        units.push({
            id: String(current.id),
            sender_id: current.sender_id,
            created_at: current.created_at,
            actionItem: current,
            textItem: null,
            displayItem: current,
            sourceItems: [current]
        });
        i += 1;
    }

    return units;
}

function buildConversationRenderSignature(messages) {
    const list = Array.isArray(messages) ? messages : [];
    const base = list.map(function (item) {
        return [
            item.id,
            item.type,
            item.created_at,
            item.sender_id,
            item.receiver_id,
            item.group_id,
            item.encoded_text || "",
            item.file_url || "",
            item.file_name || "",
            item.mime_type || "",
            item.delivered_at || "",
            item.seen_at || "",
            item.deleted_for_everyone ? 1 : 0,
            JSON.stringify(item.reactions || [])
        ].join("|");
    }).join("||");

    return [
        state.activeChatType || "",
        state.activeChatId || "",
        state.receiptsEnabled ? "1" : "0",
        base
    ].join("###");
}

function buildLivePreviewSignature() {
    const raw = messageInput && typeof messageInput.value === "string"
        ? messageInput.value.trim()
        : "";

    const pending = state.pendingAttachment || null;

    return JSON.stringify({
        raw: raw,
        kind: pending ? pending.kind : "",
        fileName: pending && pending.file ? pending.file.name : "",
        previewUrl: pending ? (pending.previewUrl || "") : ""
    });
}

function captureAudioPlaybackState() {
    const map = {};

    document.querySelectorAll("audio[data-audio-key]").forEach(function (audio) {
        const key = audio.dataset.audioKey;
        if (!key) return;

        map[key] = {
            currentTime: audio.currentTime || 0,
            paused: audio.paused,
            volume: audio.volume,
            playbackRate: audio.playbackRate || 1
        };
    });

    return map;
}

function restoreAudioPlaybackState(stateMap) {
    if (!stateMap) return;

    document.querySelectorAll("audio[data-audio-key]").forEach(function (audio) {
        const key = audio.dataset.audioKey;
        const saved = key ? stateMap[key] : null;
        if (!saved) return;

        const applyState = function () {
            try {
                if (Number.isFinite(saved.currentTime) && saved.currentTime > 0) {
                    audio.currentTime = saved.currentTime;
                }
            } catch (error) {
                console.warn("audio currentTime restore failed", error);
            }

            try {
                audio.volume = typeof saved.volume === "number" ? saved.volume : 1;
                audio.playbackRate = typeof saved.playbackRate === "number" ? saved.playbackRate : 1;
            } catch (error) {
                console.warn("audio settings restore failed", error);
            }

            if (saved.paused === false) {
                const playPromise = audio.play();
                if (playPromise && typeof playPromise.catch === "function") {
                    playPromise.catch(function () {});
                }
            }
        };

        if (audio.readyState >= 1) {
            applyState();
        } else {
            audio.addEventListener("loadedmetadata", applyState, { once: true });
        }
    });
}

function createBubbleShell(bubble, item, isEncodedSide) {
    const shell = document.createElement("div");
    shell.className = "bubble-shell " + (isEncodedSide ? "encoded-shell" : "decoded-shell");
    shell.dataset.messageId = item.id;
    shell.dataset.itemType = item.type || "text";
    shell.appendChild(bubble);
    return shell;
}

function appendTextPartToBubble(bubble, textItem, isEncodedSide) {
    if (!bubble || !textItem) return;

    const textValue = isEncodedSide
        ? getEncodedVisibleText(textItem)
        : getVisibleMessageText(textItem);

    if (!textValue) return;

    const message = document.createElement("div");
    message.className = "message-text";
    message.textContent = textValue;
    message.style.marginTop = "10px";
    bubble.appendChild(message);
}

function createDecodedBubble(unit, prevUnit, lastOwnUnitId) {
    const item = unit.actionItem;
    const isMe = Number(unit.sender_id) === Number(state.user.id);
    const prevItem = prevUnit ? prevUnit.actionItem : null;
    const showTimeAbove = shouldShowTimeAbove(item, prevItem);
    const isLastOwnMessage = isMe && unit.id === lastOwnUnitId;

    const stack = document.createElement("div");
    stack.className = "message-stack " + (isMe ? "stack-me" : "stack-him");
    stack.dataset.messageId = unit.id;
    stack.dataset.itemType = item.type || "text";

    const timeMeta = createTimeMeta(item, showTimeAbove, "decoded");
    stack.appendChild(timeMeta);

    const bubble = document.createElement("div");
    bubble.className = "bubble " + (isMe ? "me" : "him");

    const avatarHead = makeDecodedAvatarHead(item, isMe);
    if (avatarHead) {
        bubble.appendChild(avatarHead);
    }

    const forwardLabel = createForwardLabel(unit.textItem || item);
    if (forwardLabel) {
        bubble.appendChild(forwardLabel);
    }

    const replyChip = createReplyChip(unit.textItem || item);
    if (replyChip) {
        bubble.appendChild(replyChip);
    }

    if (isDeletedForEveryone(item)) {
        bubble.appendChild(createDeletedTextBlock());
    } else if (isAttachmentMessage(item)) {
        bubble.appendChild(makeFileCard(item));
        appendTextPartToBubble(bubble, unit.textItem, false);
    } else {
        const message = document.createElement("div");
        message.className = "message-text";
        message.textContent = getVisibleMessageText(item);
        bubble.appendChild(message);
    }

    const reactionsRow = createReactionsRow(item);
    if (reactionsRow) {
        bubble.appendChild(reactionsRow);
    }

    attachLongPressMenu(bubble, item, "decoded");
    attachTimeReveal(bubble, timeMeta, item, showTimeAbove, "decoded");

    const shell = createBubbleShell(bubble, item, false);
    stack.appendChild(shell);

    const receiptMeta = createReceiptMeta(item, isMe, isLastOwnMessage);
    if (receiptMeta) {
        stack.appendChild(receiptMeta);
    }

    return stack;
}

function createEncodedBubble(unit, prevUnit) {
    const item = unit.actionItem;
    const isMe = Number(unit.sender_id) === Number(state.user.id);
    const prevItem = prevUnit ? prevUnit.actionItem : null;
    const showTimeAbove = shouldShowTimeAbove(item, prevItem);

    const stack = document.createElement("div");
    stack.className = "message-stack";
    stack.dataset.messageId = unit.id;
    stack.dataset.itemType = item.type || "text";
    stack.style.alignItems = isMe ? "flex-end" : "flex-start";

    const timeMeta = createTimeMeta(item, showTimeAbove, "encoded");
    stack.appendChild(timeMeta);

    const bubble = document.createElement("div");
    bubble.className = "encoded-bubble " + (isMe ? "encoded-me" : "encoded-her");
    bubble.dataset.messageId = unit.id;
    bubble.dataset.itemType = item.type || "text";
    bubble.style.alignSelf = isMe ? "flex-end" : "flex-start";

    const forwardLabel = createForwardLabel(unit.textItem || item);
    if (forwardLabel) {
        bubble.appendChild(forwardLabel);
    }

    if (isDeletedForEveryone(item)) {
        const deleted = document.createElement("div");
        deleted.className = "message-text";
        deleted.textContent = getDeletedPlaceholder();
        deleted.style.opacity = "0.74";
        deleted.style.fontStyle = "italic";
        bubble.appendChild(deleted);
    } else if (isAttachmentMessage(item)) {
        bubble.appendChild(makeFileCard(item));
        appendTextPartToBubble(bubble, unit.textItem, true);
    } else {
        const message = document.createElement("div");
        message.className = "message-text";
        message.textContent = getEncodedVisibleText(item);
        bubble.appendChild(message);
    }

    const reactionsRow = createReactionsRow(item);
    if (reactionsRow) {
        bubble.appendChild(reactionsRow);
    }

    attachLongPressMenu(bubble, item, "encoded");
    attachTimeReveal(bubble, timeMeta, item, showTimeAbove, "encoded");

    stack.appendChild(createBubbleShell(bubble, item, true));
    return stack;
}

function createPendingAttachmentPreviewItem() {
    if (!state.pendingAttachment || !state.pendingAttachment.file) {
        return null;
    }

    const pendingFile = state.pendingAttachment.file;

    return {
        type: state.pendingAttachment.kind === "image" ? "image" : "file",
        file_url: state.pendingAttachment.previewUrl || "",
        file_name: pendingFile.name || "file",
        filename: pendingFile.name || "file",
        mime_type: pendingFile.type || ""
    };
}

function getEncodedViewportScrollContainer() {
    if (
        typeof encodedOverlay !== "undefined" &&
        encodedOverlay &&
        !encodedOverlay.classList.contains("hidden") &&
        typeof encodedOverlayMessages !== "undefined" &&
        encodedOverlayMessages &&
        typeof encodedMessages !== "undefined" &&
        encodedMessages &&
        encodedOverlayMessages.contains(encodedMessages)
    ) {
        return encodedOverlayMessages;
    }

    if (typeof encodedMessages !== "undefined" && encodedMessages) {
        return encodedMessages;
    }

    if (typeof encodedPanel !== "undefined" && encodedPanel) {
        return encodedPanel;
    }

    return null;
}

function keepEncodedPreviewPinnedToBottom() {
    const target = getEncodedViewportScrollContainer();
    if (!target) return;

    requestAnimationFrame(function () {
        target.scrollTop = target.scrollHeight;
    });
}

function renderLivePreview() {
    const raw = messageInput.value.trim();
    const hasPendingAttachment =
        typeof hasPendingAttachmentUpload === "function" &&
        hasPendingAttachmentUpload();

    if (!raw && !hasPendingAttachment) {
        keepEncodedPreviewPinnedToBottom();
        return;
    }

    const encodedStack = document.createElement("div");
    encodedStack.className = "message-stack stack-me";
    encodedStack.dataset.preview = "1";
    encodedStack.style.alignItems = "flex-end";

    const encodedPreview = document.createElement("div");
    encodedPreview.className = "encoded-bubble encoded-me preview-bubble";
    encodedPreview.dataset.preview = "1";
    encodedPreview.style.alignSelf = "flex-end";

    if (hasPendingAttachment) {
        const pendingItem = createPendingAttachmentPreviewItem();
        if (pendingItem) {
            encodedPreview.appendChild(makeFileCard(pendingItem));
        }
    }

    if (raw) {
        const encText = document.createElement("div");
        encText.className = "message-text";
        encText.textContent = encodeText(buildOutgoingText(raw));
        encText.style.marginTop = hasPendingAttachment ? "10px" : "0";
        encodedPreview.appendChild(encText);
    }

    const encShell = document.createElement("div");
    encShell.className = "bubble-shell encoded-shell preview-shell";
    encShell.appendChild(encodedPreview);

    encodedStack.appendChild(encShell);
    encodedMessages.appendChild(encodedStack);

    if (hasPendingAttachment) {
        const decodedStack = document.createElement("div");
        decodedStack.className = "message-stack stack-me";
        decodedStack.dataset.preview = "1";

        const decodedPreview = document.createElement("div");
        decodedPreview.className = "bubble me preview-bubble";
        decodedPreview.dataset.preview = "1";

        const pendingItem = createPendingAttachmentPreviewItem();
        if (pendingItem) {
            decodedPreview.appendChild(makeFileCard(pendingItem));
        }

        if (raw) {
            const msg = document.createElement("div");
            msg.className = "message-text";
            msg.textContent = raw;
            msg.style.marginTop = "10px";
            decodedPreview.appendChild(msg);
        }

        const decShell = document.createElement("div");
        decShell.className = "bubble-shell decoded-shell preview-shell";
        decShell.appendChild(decodedPreview);

        decodedStack.appendChild(decShell);
        chatMessages.appendChild(decodedStack);
    }

    keepEncodedPreviewPinnedToBottom();
}

function renderConversation(forceScroll) {
    if (typeof forceScroll === "undefined") {
        forceScroll = false;
    }

    const nextConversationSignature = buildConversationRenderSignature(state.messages);
    const nextPreviewSignature = buildLivePreviewSignature();

    if (
        !forceScroll &&
        state.lastConversationRenderSignature === nextConversationSignature &&
        state.lastLivePreviewSignature === nextPreviewSignature
    ) {
        return;
    }

    const audioState = captureAudioPlaybackState();

    encodedMessages.innerHTML = "";
    chatMessages.innerHTML = "";

    const units = buildRenderUnits(state.messages);
    const lastOwnUnitId = findLastOwnRenderUnitId(units);

    units.forEach(function (unit, index) {
        const prevUnit = index > 0 ? units[index - 1] : null;
        encodedMessages.appendChild(createEncodedBubble(unit, prevUnit));
        chatMessages.appendChild(createDecodedBubble(unit, prevUnit, lastOwnUnitId));
    });

    renderLivePreview();
    renderEncodedOverlay();

    state.lastConversationRenderSignature = nextConversationSignature;
    state.lastLivePreviewSignature = nextPreviewSignature;

    requestAnimationFrame(function () {
        restoreAudioPlaybackState(audioState);

        if (forceScroll) {
            scrollAllToBottom(true);
        } else {
            afterConversationRender();
        }

        keepEncodedPreviewPinnedToBottom();
    });
}

function getOverlayElements() {
    return {
        overlay: document.getElementById("encodedOverlay"),
        messages: document.getElementById("encodedOverlayMessages")
    };
}

function applyEncodedOverlayViewportLayout(viewport) {
    if (!viewport || !encodedMessages) return;

    viewport.style.display = "flex";
    viewport.style.flexDirection = "column";
    viewport.style.justifyContent = "flex-end";
    viewport.style.overflowY = "auto";
    viewport.style.overflowX = "hidden";
    viewport.style.minHeight = "0";
    viewport.style.height = "100%";
    viewport.style.webkitOverflowScrolling = "touch";
    viewport.style.overscrollBehavior = "contain";
    viewport.style.padding = "10px";
    viewport.style.gap = "8px";

    encodedMessages.style.display = "flex";
    encodedMessages.style.flexDirection = "column";
    encodedMessages.style.justifyContent = "flex-end";
    encodedMessages.style.gap = "8px";
    encodedMessages.style.flex = "1 0 auto";
    encodedMessages.style.minHeight = "100%";
    encodedMessages.style.height = "auto";
    encodedMessages.style.maxHeight = "none";
    encodedMessages.style.overflowY = "visible";
    encodedMessages.style.overflowX = "visible";
    encodedMessages.style.webkitOverflowScrolling = "auto";
    encodedMessages.style.paddingBottom = "2px";
}

function renderEncodedOverlay() {
    const overlay = document.getElementById("encodedOverlay");
    const viewport = document.getElementById("encodedOverlayMessages");

    if (!overlay || !viewport || !encodedMessages) return;

    const isChatVisible =
        !!chatRoomScreen &&
        chatRoomScreen.classList.contains("active") &&
        !!state.activeChatId;

    if (!isChatVisible) {
        overlay.classList.add("hidden");
        return;
    }

    if (!viewport.contains(encodedMessages)) {
        viewport.appendChild(encodedMessages);
    }

    applyEncodedOverlayViewportLayout(viewport);

    overlay.classList.remove("hidden");

    keepEncodedPreviewPinnedToBottom();
}