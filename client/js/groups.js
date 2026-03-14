let confirmModalResolver = null;

function openConfirmModal({
    title = "Потвърждение",
    subtitle = "Сигурен ли си?",
    text = "",
    confirmText = "Потвърди",
    danger = false
} = {}) {
    if (!confirmModal) {
        return Promise.resolve(window.confirm(text || subtitle || title));
    }

    if (confirmModalResolver) {
        confirmModalResolver(false);
        confirmModalResolver = null;
    }

    confirmModalTitle.textContent = title;
    confirmModalSubtitle.textContent = subtitle;
    confirmModalText.textContent = text;

    confirmActionBtn.textContent = confirmText;
    confirmActionBtn.classList.toggle("danger-btn", !!danger);

    confirmModal.classList.remove("hidden");

    return new Promise((resolve) => {
        confirmModalResolver = resolve;
    });
}

function closeConfirmModal(result = false) {
    if (!confirmModal) return;

    confirmModal.classList.add("hidden");

    if (confirmModalResolver) {
        const resolver = confirmModalResolver;
        confirmModalResolver = null;
        resolver(result);
    }
}

function bindConfirmModalEvents() {
    if (window.__confirmModalBound) return;
    window.__confirmModalBound = true;

    if (cancelConfirmBtn) {
        cancelConfirmBtn.addEventListener("click", () => {
            closeConfirmModal(false);
        });
    }

    if (confirmActionBtn) {
        confirmActionBtn.addEventListener("click", () => {
            closeConfirmModal(true);
        });
    }

    if (confirmModal) {
        confirmModal.addEventListener("click", (e) => {
            if (e.target === confirmModal) {
                closeConfirmModal(false);
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (!confirmModal || confirmModal.classList.contains("hidden")) {
            return;
        }

        if (e.key === "Escape") {
            closeConfirmModal(false);
        }
    });
}

bindConfirmModalEvents();

function renderGroupMembersSelector() {
    groupMembersList.innerHTML = "";

    if (!state.contacts.length) {
        groupMembersList.innerHTML = `<div class="empty-state">Нямаш контакти за група.</div>`;
        return;
    }

    state.contacts.forEach(contact => {
        const label = document.createElement("label");
        label.className = "group-member-row";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = String(contact.id);

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        applyUserAvatar(avatar, contact.username);

        const name = document.createElement("div");
        name.textContent = contact.username;

        label.appendChild(checkbox);
        label.appendChild(avatar);
        label.appendChild(name);

        groupMembersList.appendChild(label);
    });
}

async function createGroup() {
    const name = groupNameInput.value.trim();
    const selected = Array.from(
        groupMembersList.querySelectorAll('input[type="checkbox"]:checked')
    ).map(cb => Number(cb.value));

    if (!name) {
        alert("Въведи име на групата.");
        return;
    }

    if (!selected.length) {
        alert("Избери поне един участник.");
        return;
    }

    try {
        const data = await apiRequest("/api/groups/create", "POST", {
            name,
            member_ids: selected
        }, true);

        const newGroupId = String(data.group.id);

        groupNameInput.value = "";
        state.activeChatType = "group";
        state.activeChatId = newGroupId;
        saveActiveChat(newGroupId, "group");

        closeGroupModal();

        await loadAllChatSources();

        state.activeChatType = "group";
        state.activeChatId = newGroupId;
        saveActiveChat(newGroupId, "group");

        renderChatHeader();
        showChatRoomScreen();
        await loadConversation(true);
    } catch (error) {
        alert(error.message);
    }
}

async function leaveActiveGroup() {
    if (state.activeChatType !== "group" || !state.activeChatId) {
        return;
    }

    const currentGroupId = String(state.activeChatId);
    const activeGroup = typeof getActiveChatItem === "function" ? getActiveChatItem() : null;
    const groupName = activeGroup?.name || "тази група";

    const confirmed = await openConfirmModal({
        title: "Напускане на група",
        subtitle: "Ще напуснеш тази група",
        text: `Сигурен ли си, че искаш да напуснеш "${groupName}"?`,
        confirmText: "Напусни",
        danger: true
    });

    if (!confirmed) {
        return;
    }

    try {
        await apiRequest(`/api/groups/${currentGroupId}/leave`, "POST", null, true);

        if (typeof closeMessageMenu === "function") {
            closeMessageMenu();
        }

        if (state.replyTo) {
            state.replyTo = null;
        }

        await loadAllChatSources();

        const nextActiveExists = state.chatItems.some(item =>
            item.type === state.activeChatType &&
            String(item.id) === String(state.activeChatId)
        );

        if (nextActiveExists && state.activeChatType && state.activeChatId) {
            renderChatHeader();
            showChatRoomScreen();
            await loadConversation(true);
            return;
        }

        renderChatHeader();

        if (typeof encodedMessages !== "undefined" && encodedMessages) {
            encodedMessages.innerHTML = "";
        }

        if (typeof chatMessages !== "undefined" && chatMessages) {
            chatMessages.innerHTML = "";
        }

        if (typeof showChatsScreen === "function") {
            showChatsScreen();
        } else if (typeof showChatListScreen === "function") {
            showChatListScreen();
        }
    } catch (error) {
        alert(error.message);
    }
}