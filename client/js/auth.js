function showLoginStatus(text, isError = false) {
    loginStatus.textContent = text || "";
    loginStatus.style.color = isError ? "#ff8f8f" : "#9fd0ff";
}

function showApp() {
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");
}

function showLogin() {
    app.classList.add("hidden");
    loginScreen.classList.remove("hidden");
}

async function login() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        showLoginStatus("Попълни username и парола.", true);
        return;
    }

    try {
        showLoginStatus("Влизане...");
        const data = await apiRequest("/api/auth/login", "POST", {
            username,
            password
        });

        setToken(data.token);
        state.user = data.user;

        receiptsToggle.checked = state.receiptsEnabled;

        renderMyHeader();
        showApp();
        showChatListScreen();

        const paired = await processPendingInviteAfterAuth();

        await loadAllChatSources();
        startPolling();

        if (paired) {
            renderChatList();
        }

        showLoginStatus("");
    } catch (error) {
        showLoginStatus(error.message, true);
    }
}

async function register() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        showLoginStatus("Попълни username и парола.", true);
        return;
    }

    try {
        showLoginStatus("Регистрация...");
        const data = await apiRequest("/api/auth/register", "POST", {
            username,
            password
        });

        setToken(data.token);
        state.user = data.user;

        receiptsToggle.checked = state.receiptsEnabled;

        renderMyHeader();
        showApp();
        showChatListScreen();

        const paired = await processPendingInviteAfterAuth();

        await loadAllChatSources();
        startPolling();

        if (paired) {
            renderChatList();
        }

        showLoginStatus("");
    } catch (error) {
        showLoginStatus(error.message, true);
    }
}

async function bootstrapSession() {
    hydratePendingInviteFromUrl();

    const token = getToken();

    if (!token) {
        showLogin();
        return;
    }

    try {
        const data = await apiRequest("/api/auth/me", "GET", null, true);
        state.user = data.user;
        receiptsToggle.checked = state.receiptsEnabled;

        renderMyHeader();
        showApp();
        showChatListScreen();

        const paired = await processPendingInviteAfterAuth();

        await loadAllChatSources();
        startPolling();

        if (paired) {
            renderChatList();
        }
    } catch (error) {
        clearToken();
        showLogin();
    }
}

function logout() {
    stopPolling();
    clearToken();
    saveActiveChat(null, null);
    clearPendingInviteCode();

    if (typeof clearInviteCodeFromUrl === "function") {
        clearInviteCodeFromUrl();
    }

    if (state.voiceRecordingSession && state.voiceRecordingSession.stream) {
        state.voiceRecordingSession.stream.getTracks().forEach(track => track.stop());
    }

    state.user = null;
    state.contacts = [];
    state.groups = [];
    state.chatItems = [];
    state.activeChatType = null;
    state.activeChatId = null;
    state.messages = [];
    state.replyTo = null;
    state.menuMessage = null;
    state.activeChatPresence = null;
    state.voiceRecordingSession = null;
    state._lastConversationKey = null;
    state._lastFetchedConversationSignature = "";
    state.lastConversationRenderSignature = "";
    state.lastLivePreviewSignature = "";

    usernameInput.value = "";
    passwordInput.value = "";
    inviteCodeInput.value = "";
    contactSearchInput.value = "";
    messageInput.value = "";
    groupNameInput.value = "";

    encodedMessages.innerHTML = "";
    chatMessages.innerHTML = "";
    chatList.innerHTML = "";
    groupMembersList.innerHTML = "";

    closeMenu();
    closeGroupModal();
    closeInviteModal();
    closeMessageMenu();
    closeComposerEmojiPicker();
    clearReply();

    showLoginStatus("");
    showLogin();

    setTimeout(function () {
        window.location.reload();
    }, 0);
}
