const DEFAULT_MESSAGE_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "👎"];
const LONG_PRESS_DELAY = 500;
const MOVE_CANCEL_THRESHOLD = 14;

let activeReactionMenuAnchor = null;
let longPressTimer = null;
let longPressTriggered = false;
let longPressStartX = 0;
let longPressStartY = 0;
let suppressClicksUntil = 0;

function getReactionItemType(item) {
    return item.type === "file" ? "file" : "text";
}

function canDeleteForEveryone(item) {
    return item && !item.deleted_for_everyone && Number(item.sender_id) === Number(state.user.id);
}

function preserveScrollAfterRender(wasNearBottom, decodedTop, encodedTop) {
    requestAnimationFrame(() => {
        if (wasNearBottom) {
            scrollAllToBottom(true, false);
            return;
        }

        if (typeof setBothPanelsScrollTop === "function") {
            setBothPanelsScrollTop(decodedTop, encodedTop);
        } else {
            decodedPanel.scrollTop = decodedTop;
            encodedPanel.scrollTop = encodedTop;
        }

        if (typeof rememberPanelHeights === "function") {
            rememberPanelHeights();
        }
    });
}

function getScrollSnapshot() {
    const wasNearBottom = typeof shouldAutoFollow === "function"
        ? shouldAutoFollow()
        : (isNearBottom(decodedPanel) && isNearBottom(encodedPanel));

    return {
        wasNearBottom,
        decodedTop: decodedPanel.scrollTop,
        encodedTop: encodedPanel.scrollTop
    };
}

async function reactToMessage(item, emoji) {
    if (!item || !emoji || item.deleted_for_everyone) {
        return;
    }

    const snapshot = getScrollSnapshot();

    try {
        const data = await apiRequest("/api/messages/react", "POST", {
            chat_type: state.activeChatType === "group" ? "group" : "direct",
            item_type: getReactionItemType(item),
            item_id: item.id,
            emoji
        }, true);

        if (!data || !data.ok) {
            return;
        }

        const targetMessage = state.messages.find(msg =>
            String(msg.id) === String(item.id) &&
            getReactionItemType(msg) === getReactionItemType(item)
        );

        if (targetMessage) {
            targetMessage.reactions = Array.isArray(data.reactions) ? data.reactions : [];
        }

        closeMessageMenu();
        renderConversation(false);
        preserveScrollAfterRender(snapshot.wasNearBottom, snapshot.decodedTop, snapshot.encodedTop);
    } catch (error) {
        console.error(error);
    }
}

async function deleteMessageItem(item, mode) {
    if (!item || !mode) {
        return;
    }

    const confirmed = await openConfirmModal({
        title: mode === "for_everyone" ? "Изтриване за всички" : "Изтриване за теб",
        subtitle: mode === "for_everyone"
            ? "Съобщението ще бъде премахнато за всички"
            : "Съобщението ще бъде скрито само за теб",
        text: mode === "for_everyone"
            ? "Потвърди изтриването на това съобщение за всички участници."
            : "Потвърди изтриването на това съобщение само за теб.",
        confirmText: mode === "for_everyone" ? "Изтрий за всички" : "Изтрий",
        danger: true
    });

    if (!confirmed) {
        return;
    }

    const snapshot = getScrollSnapshot();

    try {
        const data = await apiRequest("/api/messages/delete", "POST", {
            chat_type: state.activeChatType === "group" ? "group" : "direct",
            item_type: getReactionItemType(item),
            item_id: item.id,
            mode
        }, true);

        if (!data || !data.ok) {
            return;
        }

        if (mode === "for_me") {
            state.messages = state.messages.filter(msg =>
                !(String(msg.id) === String(item.id) && getReactionItemType(msg) === getReactionItemType(item))
            );
        } else {
            const targetMessage = state.messages.find(msg =>
                String(msg.id) === String(item.id) &&
                getReactionItemType(msg) === getReactionItemType(item)
            );

            if (targetMessage) {
                targetMessage.deleted_for_everyone = true;
                targetMessage.reactions = [];
                if (getReactionItemType(targetMessage) === "text") {
                    targetMessage.encoded_text = "";
                } else {
                    targetMessage.file_name = "";
                    targetMessage.file_url = null;
                }
            }
        }

        closeMessageMenu();
        renderConversation(false);
        preserveScrollAfterRender(snapshot.wasNearBottom, snapshot.decodedTop, snapshot.encodedTop);
    } catch (error) {
        console.error(error);
    }
}

function closeMessageMenu() {
    if (!messageMenu) {
        return;
    }

    activeReactionMenuAnchor = null;
    messageMenu.classList.add("hidden");
    messageMenu.innerHTML = "";

    if (state) {
        state.menuMessage = null;
        state.menuSourceSide = null;
    }
}

function createReactionButton(item, emoji) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = emoji;
    btn.style.width = "42px";
    btn.style.height = "42px";
    btn.style.border = "none";
    btn.style.borderRadius = "14px";
    btn.style.background = "rgba(255,255,255,0.08)";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "22px";
    btn.style.lineHeight = "1";
    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.transition = "transform 0.14s ease, background 0.18s ease";

    const existing = Array.isArray(item.reactions)
        ? item.reactions.find((reaction) => reaction.emoji === emoji && reaction.me)
        : null;

    if (existing) {
        btn.style.background = "rgba(255,255,255,0.18)";
        btn.style.boxShadow = "0 8px 22px rgba(0,0,0,0.18)";
    }

    btn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await reactToMessage(item, emoji);
    });

    return btn;
}

function createMessageMenuAction(label, onClick, isDanger = false) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "message-menu-item";
    btn.textContent = label;

    if (isDanger) {
        btn.style.color = "#ffb4b4";
    }

    btn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await onClick();
    });

    return btn;
}

function positionMessageMenu(anchorEl) {
    if (!messageMenu || !anchorEl) {
        return;
    }

    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = Math.min(320, window.innerWidth - 20);

    messageMenu.style.position = "fixed";
    messageMenu.style.width = `${menuWidth}px`;
    messageMenu.style.maxWidth = "calc(100vw - 20px)";
    messageMenu.style.padding = "8px";
    messageMenu.style.borderRadius = "18px";
    messageMenu.style.background = "rgba(10, 14, 22, 0.98)";
    messageMenu.style.border = "1px solid rgba(255,255,255,0.08)";
    messageMenu.style.boxShadow = "0 18px 44px rgba(0,0,0,0.38)";
    messageMenu.style.backdropFilter = "blur(14px)";
    messageMenu.style.webkitBackdropFilter = "blur(14px)";
    messageMenu.style.zIndex = "1200";

    const left = Math.max(10, Math.min(rect.left, window.innerWidth - menuWidth - 10));
    const estimatedHeight = 320;

    let top = rect.top - estimatedHeight - 10;
    if (top < 10) {
        top = Math.min(window.innerHeight - estimatedHeight - 10, rect.bottom + 10);
    }

    messageMenu.style.left = `${left}px`;
    messageMenu.style.top = `${Math.max(10, top)}px`;
}

function getMessageCopyValue(item, sourceSide) {
    if (!item || item.deleted_for_everyone) {
        return "";
    }

    if (item.type === "file" || item.type === "image") {
        return item.file_url ? (API_BASE + item.file_url) : "";
    }

    if (sourceSide === "encoded") {
        return item.encoded_text || "";
    }

    const decodedText = decodeText(item.encoded_text || "");

    if (decodedText.startsWith("↩ ")) {
        const lines = decodedText.split("\n");
        return lines.slice(1).join("\n").trim();
    }

    return decodedText;
}

async function copyMessageFromMenu(item, sourceSide) {
    const text = getMessageCopyValue(item, sourceSide);

    if (!text) {
        closeMessageMenu();
        return;
    }

    await copyText(text);
    closeMessageMenu();
}

function openMessageMenu(item, anchorEl, sourceSide) {
    if (!messageMenu || !item || !anchorEl) {
        return;
    }

    clearLongPressTimer();
    activeReactionMenuAnchor = anchorEl;
    state.menuMessage = item;
    state.menuSourceSide = sourceSide === "encoded" ? "encoded" : "decoded";
    messageMenu.innerHTML = "";

    if (!item.deleted_for_everyone) {
        const reactionRow = document.createElement("div");
        reactionRow.style.display = "grid";
        reactionRow.style.gridTemplateColumns = "repeat(6, minmax(0, 1fr))";
        reactionRow.style.gap = "8px";
        reactionRow.style.marginBottom = "8px";

        DEFAULT_MESSAGE_REACTIONS.forEach((emoji) => {
            reactionRow.appendChild(createReactionButton(item, emoji));
        });

        messageMenu.appendChild(reactionRow);
    }

    const actionWrap = document.createElement("div");
    actionWrap.style.display = "flex";
    actionWrap.style.flexDirection = "column";
    actionWrap.style.gap = "4px";

    if (!item.deleted_for_everyone) {
        actionWrap.appendChild(createMessageMenuAction("↩ Reply", async () => {
            if (typeof setReply === "function") {
                setReply(item);
                renderConversation(false);
                messageInput.focus();
            }
            closeMessageMenu();
        }));

        actionWrap.appendChild(createMessageMenuAction("↗ Share", async () => {
            closeMessageMenu();

            if (typeof shareExternally === "function") {
                await shareExternally(item);
            }
        }));

        actionWrap.appendChild(createMessageMenuAction("➜ Forward", async () => {
            closeMessageMenu();
            openForwardModal(item);
        }));

        actionWrap.appendChild(createMessageMenuAction("⧉ Copy", async () => {
            await copyMessageFromMenu(item, state.menuSourceSide || "decoded");
        }));
    }

    if (state.activeChatType === "group" && typeof leaveActiveGroup === "function") {
        actionWrap.appendChild(createMessageMenuAction("🚪 Leave group", async () => {
            closeMessageMenu();
            await leaveActiveGroup();
        }, true));
    }

    actionWrap.appendChild(createMessageMenuAction("🗑 Delete for me", async () => {
        await deleteMessageItem(item, "for_me");
    }, true));

    if (canDeleteForEveryone(item)) {
        actionWrap.appendChild(createMessageMenuAction("🚫 Delete for everyone", async () => {
            await deleteMessageItem(item, "for_everyone");
        }, true));
    }

    messageMenu.appendChild(actionWrap);
    messageMenu.classList.remove("hidden");

    positionMessageMenu(anchorEl);
}

function clearLongPressTimer() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

function shouldIgnoreLongPressTarget(target) {
    return !!target.closest("button, a, input, textarea, .reactions-row, .bubble-actions");
}

function getPointFromEvent(event) {
    if (event.touches && event.touches.length) {
        return event.touches[0];
    }
    if (event.changedTouches && event.changedTouches.length) {
        return event.changedTouches[0];
    }
    if (typeof event.clientX === "number" && typeof event.clientY === "number") {
        return event;
    }
    return null;
}

function startLongPress(event, item, anchorEl, sourceSide) {
    if (!item || !anchorEl) {
        return;
    }

    const point = getPointFromEvent(event);
    if (!point) {
        return;
    }

    longPressTriggered = false;
    longPressStartX = point.clientX;
    longPressStartY = point.clientY;

    clearLongPressTimer();

    longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        suppressClicksUntil = Date.now() + 700;
        openMessageMenu(item, anchorEl, sourceSide);
    }, LONG_PRESS_DELAY);
}

function moveLongPress(event) {
    if (!longPressTimer) {
        return;
    }

    const point = getPointFromEvent(event);
    if (!point) {
        return;
    }

    const dx = Math.abs(point.clientX - longPressStartX);
    const dy = Math.abs(point.clientY - longPressStartY);

    if (dx > MOVE_CANCEL_THRESHOLD || dy > MOVE_CANCEL_THRESHOLD) {
        clearLongPressTimer();
    }
}

function endLongPress() {
    clearLongPressTimer();
}

function attachLongPressMenu(bubble, item, sourceSideOrButton) {
    if (!bubble || !item) {
        return;
    }

    const sourceSide = sourceSideOrButton === "encoded" ? "encoded" : "decoded";
    const moreBtn = sourceSideOrButton && typeof sourceSideOrButton.addEventListener === "function"
        ? sourceSideOrButton
        : null;

    bubble.addEventListener("touchstart", (event) => {
        if (shouldIgnoreLongPressTarget(event.target)) {
            return;
        }
        startLongPress(event, item, bubble, sourceSide);
    }, { passive: true });

    bubble.addEventListener("touchmove", (event) => {
        moveLongPress(event);
    }, { passive: true });

    bubble.addEventListener("touchend", () => {
        endLongPress();
    }, { passive: true });

    bubble.addEventListener("touchcancel", () => {
        endLongPress();
    }, { passive: true });

    bubble.addEventListener("mousedown", (event) => {
        if (event.button !== 0) {
            return;
        }

        if (shouldIgnoreLongPressTarget(event.target)) {
            return;
        }

        startLongPress(event, item, bubble, sourceSide);
    });

    bubble.addEventListener("mousemove", (event) => {
        moveLongPress(event);
    });

    bubble.addEventListener("mouseup", () => {
        endLongPress();
    });

    bubble.addEventListener("mouseleave", () => {
        endLongPress();
    });

    bubble.addEventListener("dragstart", () => {
        endLongPress();
    });

    bubble.addEventListener("click", (event) => {
        if (Date.now() < suppressClicksUntil || longPressTriggered) {
            event.preventDefault();
            event.stopPropagation();
            longPressTriggered = false;
        }
    }, true);

    bubble.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openMessageMenu(item, bubble, sourceSide);
    });

    if (moreBtn) {
        moreBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openMessageMenu(item, moreBtn, sourceSide);
        });
    }
}

function bindReactionMenuGlobalEvents() {
    if (window.__reactionMenuBound) {
        return;
    }

    window.__reactionMenuBound = true;

    document.addEventListener("mouseup", () => {
        endLongPress();
    });

    document.addEventListener("touchend", () => {
        endLongPress();
    }, { passive: true });

    document.addEventListener("touchcancel", () => {
        endLongPress();
    }, { passive: true });

    document.addEventListener("click", (event) => {
        if (Date.now() < suppressClicksUntil) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        if (!messageMenu || messageMenu.classList.contains("hidden")) {
            return;
        }

        if (messageMenu.contains(event.target)) {
            return;
        }

        closeMessageMenu();
    }, true);

    window.addEventListener("resize", () => {
        if (!messageMenu || messageMenu.classList.contains("hidden") || !activeReactionMenuAnchor) {
            return;
        }

        positionMessageMenu(activeReactionMenuAnchor);
    });

    window.addEventListener("scroll", () => {
        if (!messageMenu || messageMenu.classList.contains("hidden") || !activeReactionMenuAnchor) {
            return;
        }

        positionMessageMenu(activeReactionMenuAnchor);
    }, true);
}

bindReactionMenuGlobalEvents();
setTimeout(bindReactionMenuGlobalEvents, 0);
