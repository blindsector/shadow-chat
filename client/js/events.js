const COMPOSER_EMOJIS = [
    "😊", "❤️", "👍", "😂", "🔥", "😍",
    "🙏", "👏", "😎", "🎉", "🤝", "😢"
];

function insertTextAtCursor(input, text) {
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const current = input.value || "";

    input.value = current.slice(0, start) + text + current.slice(end);

    const nextPos = start + text.length;
    input.setSelectionRange(nextPos, nextPos);
}

function triggerComposerInput() {
    messageInput.dispatchEvent(new Event("input"));
}

function appendComposerEmoji(emoji) {
    insertTextAtCursor(messageInput, emoji);
    triggerComposerInput();
    messageInput.focus();
}

function closeComposerEmojiPicker() {
    if (!emojiPicker) return;
    emojiPicker.classList.add("hidden");
}

function positionComposerEmojiPicker() {
    if (!emojiPicker || !openEmojiPickerBtn) return;

    const btnRect = openEmojiPickerBtn.getBoundingClientRect();

    const pickerWidth = emojiPicker.offsetWidth || 280;
    const pickerHeight = emojiPicker.offsetHeight || 64;

    let left = btnRect.left;
    let top = btnRect.top - pickerHeight - 10;

    if (left + pickerWidth > window.innerWidth - 10) {
        left = window.innerWidth - pickerWidth - 10;
    }

    if (left < 10) {
        left = 10;
    }

    if (top < 10) {
        top = btnRect.bottom + 10;
    }

    emojiPicker.style.left = left + "px";
    emojiPicker.style.top = top + "px";
}

function ensureComposerEmojiPicker() {
    if (!emojiPicker) return;
    if (emojiPicker.dataset.ready === "1") return;

    emojiPicker.innerHTML = "";

    COMPOSER_EMOJIS.forEach(function (emoji) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "emoji-btn";
        btn.textContent = emoji;

        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            appendComposerEmoji(emoji);
            closeComposerEmojiPicker();
        });

        emojiPicker.appendChild(btn);
    });

    emojiPicker.dataset.ready = "1";
}

function toggleComposerEmojiPicker() {
    if (!emojiPicker || !openEmojiPickerBtn) return;

    ensureComposerEmojiPicker();

    const willOpen = emojiPicker.classList.contains("hidden");

    if (!willOpen) {
        closeComposerEmojiPicker();
        return;
    }

    emojiPicker.classList.remove("hidden");
    positionComposerEmojiPicker();
}

function setVoiceButtonRecordingState(isRecording) {
    if (!recordVoiceBtn) return;

    recordVoiceBtn.dataset.recording = isRecording ? "1" : "0";
    recordVoiceBtn.textContent = isRecording ? "⏹" : "🎤";
    recordVoiceBtn.title = isRecording ? "Спри запис" : "Гласово";
    recordVoiceBtn.setAttribute("aria-label", isRecording ? "Спри запис" : "Гласово съобщение");
}

async function toggleVoiceRecording() {
    if (!recordVoiceBtn) return;

    if (state.voiceRecordingSession && state.voiceRecordingSession.recorder) {
        const session = state.voiceRecordingSession;
        state.voiceRecordingSession = null;
        setVoiceButtonRecordingState(false);

        try {
            const audioFile = await stopVoiceCapture(session);
            if (audioFile) {
                queueVoiceAttachment(audioFile);
            }
        } catch (error) {
            console.error(error);
            alert("Гласовият запис не успя.");
        }
        return;
    }

    try {
        const session = await startVoiceCapture();
        state.voiceRecordingSession = session;
        setVoiceButtonRecordingState(true);
    } catch (error) {
        console.error(error);
        alert("Няма достъп до микрофон.");
    }
}

function bindEvents() {
    loginBtn.addEventListener("click", login);
    registerBtn.addEventListener("click", register);
    logoutBtn.addEventListener("click", logout);

    usernameInput.addEventListener("keydown", e => {
        if (e.key === "Enter") login();
    });

    passwordInput.addEventListener("keydown", e => {
        if (e.key === "Enter") login();
    });

    openMenuBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleMenu();
    });

    document.addEventListener("click", function (e) {
        if (!sideMenu.contains(e.target) && e.target !== openMenuBtn) {
            closeMenu();
        }

        if (
            emojiPicker &&
            !emojiPicker.classList.contains("hidden") &&
            !emojiPicker.contains(e.target) &&
            e.target !== openEmojiPickerBtn
        ) {
            closeComposerEmojiPicker();
        }
    });

    myAvatarBtn.addEventListener("click", () => {
        avatarFileInput.click();
    });

    if (openInviteModalBtn) {
        openInviteModalBtn.addEventListener("click", () => {
            closeMenu();
            openInviteModal();
        });
    }

    if (myInviteCodeLabel) {
        myInviteCodeLabel.addEventListener("click", () => {
            openInviteModal();
        });
    }

    if (copyInviteBtn) {
        copyInviteBtn.addEventListener("click", async () => {
            await copyInviteLink();
        });
    }

    if (shareInviteBtn) {
        shareInviteBtn.addEventListener("click", async () => {
            await shareInviteLink();
        });
    }

    if (closeInviteBtn) {
        closeInviteBtn.addEventListener("click", closeInviteModal);
    }

    if (inviteModal) {
        inviteModal.addEventListener("click", function (e) {
            if (e.target === inviteModal) {
                closeInviteModal();
            }
        });
    }

    avatarFileInput.addEventListener("change", function () {
        if (this.files && this.files[0]) {
            handleAvatarUpload(this.files[0]);
        }
    });

    createGroupBtn.addEventListener("click", openGroupModal);
    cancelGroupBtn.addEventListener("click", closeGroupModal);
    confirmGroupBtn.addEventListener("click", createGroup);

    groupModal.addEventListener("click", function (e) {
        if (e.target === groupModal) {
            closeGroupModal();
        }
    });

    receiptsToggle.addEventListener("change", function () {
        state.receiptsEnabled = this.checked;
        saveReceiptsSetting(state.receiptsEnabled);
        renderConversation(false);
    });

    if (typeof onlineVisibilityToggle !== "undefined" && onlineVisibilityToggle) {
        onlineVisibilityToggle.addEventListener("change", async function () {
            state.onlineVisibilityEnabled = this.checked;
            saveOnlineVisibilitySetting(state.onlineVisibilityEnabled);

            try {
                await apiRequest(
                    "/api/users/presence/visibility",
                    "POST",
                    {
                        show_online_status: state.onlineVisibilityEnabled
                    },
                    true
                );
            } catch (err) {
                console.warn("presence visibility update failed", err);
            }
        });
    }

    contactSearchInput.addEventListener("input", renderChatList);
    addContactBtn.addEventListener("click", addContact);

    backBtn.addEventListener("click", showChatListScreen);
    refreshChatBtn.addEventListener("click", async () => {
        await loadAllChatSources();
        await loadConversation(false);
    });

    if (openEmojiPickerBtn) {
        openEmojiPickerBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            toggleComposerEmojiPicker();
        });
    }

    quickEmojiBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            appendComposerEmoji(btn.dataset.emoji || "");
        });
    });

    hiddenCameraInput.addEventListener("change", async function () {
        if (this.files && this.files[0]) {
            await queueCameraAttachment(this.files[0]);
        }
        this.value = "";
    });

    hiddenImageInput.addEventListener("change", async function () {
        if (this.files && this.files[0]) {
            const file = typeof compressImageFile === "function"
                ? await compressImageFile(this.files[0], { maxSide: 1600, quality: 0.82 })
                : this.files[0];
            queueImageAttachment(file);
        }
        this.value = "";
    });

    hiddenFileInput.addEventListener("change", function () {
        if (this.files && this.files[0]) {
            uploadAttachment(this.files[0]);
        }
        this.value = "";
    });

    if (recordVoiceBtn) {
        recordVoiceBtn.addEventListener("click", async () => {
            closeComposerEmojiPicker();
            await toggleVoiceRecording();
        });
    }

    attachCameraBtn.addEventListener("click", () => {
        closeComposerEmojiPicker();
        hiddenCameraInput.click();
    });

    attachImageBtn.addEventListener("click", () => {
        closeComposerEmojiPicker();
        hiddenImageInput.click();
    });

    attachFileBtn.addEventListener("click", () => {
        closeComposerEmojiPicker();
        hiddenFileInput.click();
    });

    clearReplyBtn.addEventListener("click", clearReply);

    if (menuReplyBtn) {
        menuReplyBtn.addEventListener("click", () => {
            if (!state.menuMessage) return;
            setReply(state.menuMessage);
        });
    }

    if (menuForwardBtn) {
        menuForwardBtn.addEventListener("click", () => {
            forwardCurrentMessage();
        });
    }

    closeImageViewerBtn.addEventListener("click", closeImagePreview);
    imageViewer.addEventListener("click", function (e) {
        if (e.target === imageViewer) {
            closeImagePreview();
        }
    });

    messageInput.addEventListener("input", function () {
        this.style.height = "28px";
        this.style.height = Math.min(this.scrollHeight, 110) + "px";

        scrollAllToBottom(true);
        renderConversation(false);
    });

    messageInput.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            closeComposerEmojiPicker();
        }

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            closeComposerEmojiPicker();
            sendMessage();
        }
    });

    sendBtn.addEventListener("click", function () {
        closeComposerEmojiPicker();
        sendMessage();
    });

    window.addEventListener("beforeunload", function () {
        if (state.voiceRecordingSession && state.voiceRecordingSession.stream) {
            state.voiceRecordingSession.stream.getTracks().forEach(track => track.stop());
        }
    });

    window.addEventListener("resize", function () {
        if (emojiPicker && !emojiPicker.classList.contains("hidden")) {
            positionComposerEmojiPicker();
        }
    });

    window.addEventListener("scroll", function () {
        if (emojiPicker && !emojiPicker.classList.contains("hidden")) {
            positionComposerEmojiPicker();
        }
    }, true);
}
