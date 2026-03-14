async function loadContacts() {
    const data = await apiRequest("/api/users/contacts", "GET", null, true);
    state.contacts = data.contacts || [];
}

async function loadGroups() {
    const data = await apiRequest("/api/groups/", "GET", null, true);
    state.groups = data.groups || [];
}

function getDirectContactById(id) {
    return state.contacts.find(c => String(c.id) === String(id)) || null;
}

function getGroupById(id) {
    return state.groups.find(g => String(g.id) === String(id)) || null;
}

function getActiveChatItem() {
    return state.chatItems.find(
        item =>
            item.type === state.activeChatType &&
            String(item.id) === String(state.activeChatId)
    ) || null;
}

function getAttachmentPreviewLabel(item) {
    if (!item) return "";

    if (item.type === "image") {
        return "изпрати снимка";
    }

    if (item.type === "file") {
        return "изпрати файл";
    }

    return "";
}

function getEncodedPreviewFromMessage(item) {
    if (!item) return "";

    if (item.deleted_for_everyone) {
        return "Съобщението е изтрито";
    }

    if (item.type !== "text") {
        return "";
    }

    return (item.encoded_text || "").trim();
}

function buildPreviewFromLastMessage(lastMessage) {
    if (!lastMessage) return "";

    if (lastMessage.deleted_for_everyone) {
        return "Съобщението е изтрито";
    }

    if (lastMessage.type === "image" || lastMessage.type === "file") {
        return getAttachmentPreviewLabel(lastMessage);
    }

    return getEncodedPreviewFromMessage(lastMessage);
}

function buildPreviewFromMessages(messages) {
    const list = Array.isArray(messages) ? messages : [];
    if (!list.length) return "";

    const last = list[list.length - 1];
    const prev = list.length > 1 ? list[list.length - 2] : null;

    if (last && (last.type === "image" || last.type === "file")) {
        const attachmentText = getAttachmentPreviewLabel(last);
        const prevText = prev && prev.type === "text" && Number(prev.sender_id) === Number(last.sender_id)
            ? getEncodedPreviewFromMessage(prev)
            : "";

        if (attachmentText && prevText) {
            return `${attachmentText} — ${prevText}`;
        }

        return attachmentText || prevText;
    }

    return buildPreviewFromLastMessage(last);
}

function isChatItemUnread(item) {
    if (!item || !item.lastMessage || !state.user) {
        return false;
    }

    if (item.type === "direct") {
        const lastMessage = item.lastMessage;
        const isIncoming = Number(lastMessage.sender_id) !== Number(state.user.id);
        return isIncoming && !lastMessage.seen_at;
    }

    if (item.type === "group") {
        return !!item.has_unread || Number(item.unread_count || 0) > 0;
    }

    return false;
}

function getPresenceSnapshotForContact(contactId) {
    const contact = getDirectContactById(contactId);
    return contact && contact.presence ? contact.presence : null;
}

function isPresenceOnline(presence) {
    if (!presence || !presence.is_visible || !presence.last_seen_at) {
        return false;
    }

    const d = parseServerDate(presence.last_seen_at);
    if (!d) {
        return false;
    }

    return (Date.now() - d.getTime()) <= 35000;
}

function getCompactPresenceText(presence) {
    if (!presence || !presence.is_visible) {
        return "";
    }

    if (isPresenceOnline(presence)) {
        return "Online";
    }

    if (!presence.last_seen_at) {
        return "";
    }

    const text = formatLastSeen(presence.last_seen_at);

    if (text === "just now") {
        return "Inactive just now";
    }

    if (text.startsWith("yesterday")) {
        return "Inactive " + text;
    }

    if (text.startsWith("at ")) {
        return "Inactive " + text;
    }

    return "Inactive " + text;
}

function getActiveDirectPresenceText() {
    const activeItem = getActiveChatItem();

    if (!activeItem || activeItem.type !== "direct") {
        return activeItem ? activeItem.subtitle : "";
    }

    const presence = state.activeChatPresence;

    if (!presence || !presence.is_visible) {
        return activeItem.subtitle;
    }

    if (isPresenceOnline(presence)) {
        return "Online";
    }

    if (presence.last_seen_at) {
        return "Inactive since " + formatLastSeen(presence.last_seen_at);
    }

    return activeItem.subtitle;
}

async function buildChatListItems() {
    const items = [];

    for (const contact of state.contacts) {
        try {
            const conv = await apiRequest(
                `/api/messages/conversation?contact_id=${contact.id}`,
                "GET",
                null,
                true
            );

            const messages = conv.messages || [];
            const lastMessage = messages.length ? messages[messages.length - 1] : null;

            items.push({
                type: "direct",
                id: String(contact.id),
                name: contact.username,
                subtitle: "Личен чат",
                member_count: 2,
                presence: contact.presence || null,
                lastMessage,
                previewText: buildPreviewFromMessages(messages),
                has_unread: !!(lastMessage && Number(lastMessage.sender_id) !== Number(state.user.id) && !lastMessage.seen_at),
                unread_count: !!(lastMessage && Number(lastMessage.sender_id) !== Number(state.user.id) && !lastMessage.seen_at) ? 1 : 0
            });
        } catch (error) {
            items.push({
                type: "direct",
                id: String(contact.id),
                name: contact.username,
                subtitle: "Личен чат",
                member_count: 2,
                presence: contact.presence || null,
                lastMessage: null,
                previewText: "",
                has_unread: false,
                unread_count: 0
            });
        }
    }

    for (const group of state.groups) {
        items.push({
            type: "group",
            id: String(group.id),
            name: group.name,
            subtitle: `${group.member_count} участници`,
            member_count: group.member_count,
            presence: null,
            lastMessage: group.last_message || null,
            previewText: buildPreviewFromLastMessage(group.last_message || null),
            has_unread: !!group.has_unread,
            unread_count: Number(group.unread_count || 0)
        });
    }

    items.sort((a, b) => {
        const aTime = a.lastMessage ? (parseServerDate(a.lastMessage.created_at)?.getTime() || 0) : 0;
        const bTime = b.lastMessage ? (parseServerDate(b.lastMessage.created_at)?.getTime() || 0) : 0;
        return bTime - aTime;
    });

    const signature = JSON.stringify(
        items.map(i => ({
            id: i.id,
            type: i.type,
            lastCreatedAt: i.lastMessage ? i.lastMessage.created_at : null,
            unreadCount: Number(i.unread_count || 0),
            hasUnread: !!i.has_unread,
            previewText: i.previewText || "",
            presenceVisible: !!(i.presence && i.presence.is_visible),
            presenceOnline: !!(i.presence && isPresenceOnline(i.presence)),
            presenceLastSeen: i.presence ? i.presence.last_seen_at : null
        }))
    );

    const changed = signature !== state.chatListSignature;

    state.chatListSignature = signature;
    state.chatItems = items;

    return changed;
}

function renderChatList() {
    const term = contactSearchInput.value.trim().toLowerCase();
    chatList.innerHTML = "";

    const filtered = state.chatItems.filter(item => item.name.toLowerCase().includes(term));

    if (!filtered.length) {
        chatList.innerHTML = `<div class="empty-state">Няма чатове.</div>`;
        return;
    }

    filtered.forEach(item => {
        const unread = isChatItemUnread(item);

        const row = document.createElement("div");
        row.className = "chat-item";

        if (unread) {
            row.style.boxShadow = "inset 3px 0 0 rgba(139, 92, 246, 0.98)";
            row.style.background = "linear-gradient(90deg, rgba(139, 92, 246, 0.14), rgba(255,255,255,0.02))";
        }

        const avatar = document.createElement("div");
        avatar.className = "avatar";

        if (item.type === "group") {
            applyGroupAvatar(avatar, item.name);
        } else {
            applyUserAvatar(avatar, item.name);
        }

        if (item.type === "direct" && item.presence && isPresenceOnline(item.presence)) {
            avatar.classList.add("online-now");
        } else {
            avatar.classList.remove("online-now");
        }

        const main = document.createElement("div");
        main.className = "chat-item-main";

        const top = document.createElement("div");
        top.className = "chat-item-top";

        const nameWrap = document.createElement("div");
        nameWrap.style.display = "flex";
        nameWrap.style.alignItems = "center";
        nameWrap.style.gap = "6px";
        nameWrap.style.minWidth = "0";

        const name = document.createElement("div");
        name.className = "chat-item-name";
        name.textContent = item.name;

        if (unread) {
            name.style.fontWeight = "800";
            name.style.color = "#f5f3ff";
        }

        nameWrap.appendChild(name);

        if (item.type === "group") {
            const tag = document.createElement("span");
            tag.className = "chat-item-tag";
            tag.textContent = "GROUP";
            nameWrap.appendChild(tag);
        }

        top.appendChild(nameWrap);

        const presenceText = document.createElement("div");
        presenceText.style.fontSize = "11px";
        presenceText.style.marginTop = "3px";
        presenceText.style.minHeight = "14px";
        presenceText.style.opacity = "0.82";

        if (item.type === "direct") {
            const compactPresence = getCompactPresenceText(item.presence);

            if (compactPresence) {
                presenceText.textContent = compactPresence;
                presenceText.style.color = isPresenceOnline(item.presence) ? "#86efac" : "rgba(255,255,255,0.62)";
                presenceText.style.fontWeight = isPresenceOnline(item.presence) ? "700" : "500";
            } else {
                presenceText.textContent = "";
            }
        }

        const bottom = document.createElement("div");
        bottom.className = "chat-item-bottom";
        bottom.style.display = "flex";
        bottom.style.alignItems = "center";
        bottom.style.justifyContent = "space-between";
        bottom.style.gap = "10px";
        bottom.style.width = "100%";

        const preview = document.createElement("div");
        preview.style.flex = "1";
        preview.style.minWidth = "0";
        preview.style.overflow = "hidden";
        preview.style.textOverflow = "ellipsis";
        preview.style.whiteSpace = "nowrap";

        const time = document.createElement("div");
        time.className = "chat-item-time";
        time.style.flexShrink = "0";
        time.style.fontSize = "11px";
        time.style.opacity = "0.42";
        time.style.fontWeight = "500";
        time.style.marginLeft = "8px";
        time.textContent = item.lastMessage ? formatTimeShort(item.lastMessage.created_at) : "";

        if (item.lastMessage) {
            const previewText = item.previewText || buildPreviewFromLastMessage(item.lastMessage);

            if (item.type === "group") {
                const isMe = Number(item.lastMessage.sender_id) === Number(state.user.id);
                const prefix = isMe ? "Аз: " : `${item.lastMessage.sender_username || "Участник"}: `;
                preview.textContent = `${prefix}${previewText}`;
            } else {
                const isMe = Number(item.lastMessage.sender_id) === Number(state.user.id);
                preview.textContent = `${isMe ? "Аз: " : ""}${previewText}`;
            }
        } else {
            preview.textContent = item.type === "group" ? "Няма съобщения в групата" : "Няма съобщения";
        }

        if (unread) {
            preview.style.fontWeight = "800";
            preview.style.opacity = "1";
            preview.style.color = "#f5f3ff";
            time.style.opacity = "0.68";
            time.style.fontWeight = "700";
            time.style.color = "#e9ddff";
        }

        main.appendChild(top);
        main.appendChild(presenceText);
        bottom.appendChild(preview);
        bottom.appendChild(time);
        main.appendChild(bottom);

        row.appendChild(avatar);
        row.appendChild(main);

        row.addEventListener("click", async () => {
            state.activeChatType = item.type;
            state.activeChatId = String(item.id);
            saveActiveChat(String(item.id), item.type);
            renderChatHeader();
            showChatRoomScreen();
            await loadConversation(true);
        });

        chatList.appendChild(row);
    });
}

function renderChatHeader() {
    const activeItem = getActiveChatItem();

    if (!activeItem) {
        activeContactName.textContent = "Няма чат";
        activeContactSub.textContent = "Избери чат";
        activeAvatar.textContent = "?";
        activeAvatar.style.backgroundImage = "";
        activeAvatar.style.backgroundColor = "";
        activeAvatar.style.backgroundSize = "";
        activeAvatar.style.backgroundPosition = "";
        activeAvatar.style.backgroundRepeat = "";
        activeAvatar.classList.remove("group-avatar");
        activeAvatar.classList.remove("online-now");
        return;
    }

    activeContactName.textContent = activeItem.name;
    activeContactSub.textContent = activeItem.type === "direct"
        ? getActiveDirectPresenceText()
        : activeItem.subtitle;

    if (activeItem.type === "group") {
        applyGroupAvatar(activeAvatar, activeItem.name);
        activeAvatar.classList.remove("online-now");
    } else {
        applyUserAvatar(activeAvatar, activeItem.name);

        if (state.activeChatPresence && isPresenceOnline(state.activeChatPresence)) {
            activeAvatar.classList.add("online-now");
        } else {
            activeAvatar.classList.remove("online-now");
        }
    }
}

async function loadAllChatSources() {
    await loadContacts();
    await loadGroups();
    const changed = await buildChatListItems();

    const saved = loadActiveChat();

    const exists = state.chatItems.some(
        item =>
            item.type === saved.type &&
            String(item.id) === String(saved.id)
    );

    if (exists) {
        state.activeChatType = saved.type;
        state.activeChatId = String(saved.id);
    } else if (state.chatItems.length) {
        state.activeChatType = state.chatItems[0].type;
        state.activeChatId = String(state.chatItems[0].id);
    } else {
        state.activeChatType = null;
        state.activeChatId = null;
    }

    if (state.activeChatType && state.activeChatId) {
        saveActiveChat(String(state.activeChatId), state.activeChatType);
    }

    if (changed) {
        renderChatList();
        renderChatHeader();
    }
}

async function addContact() {
    const inviteCode = inviteCodeInput.value.trim().toUpperCase();

    if (!inviteCode) {
        alert("Въведи invite code.");
        return;
    }

    try {
        await apiRequest("/api/users/contacts/add", "POST", {
            invite_code: inviteCode
        }, true);

        inviteCodeInput.value = "";
        await loadAllChatSources();
    } catch (error) {
        alert(error.message);
    }
}
