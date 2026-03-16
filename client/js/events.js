const COMPOSER_EMOJIS = [
    "😊", "❤️", "👍", "😂", "🔥", "😍",
    "🙏", "👏", "😎", "🎉", "🤝", "😢"
];

const hiddenVoiceInput = document.createElement("input");
hiddenVoiceInput.type = "file";
hiddenVoiceInput.accept = "audio/*";
hiddenVoiceInput.capture = "user";
hiddenVoiceInput.style.display = "none";
document.body.appendChild(hiddenVoiceInput);

function isAndroidDevice() {
    return /Android/i.test(navigator.userAgent || "");
}

function shouldUseNativeVoiceCapture() {
    return isAndroidDevice();
}

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

function closeComposerToolsMenu() {
    if (!composerToolsMenu) return;
    composerToolsMenu.classList.add("hidden");
}

function toggleComposerToolsMenu() {
    if (!composerToolsMenu || !composerMoreBtn) return;

    const willOpen = composerToolsMenu.classList.contains("hidden");

    if (!willOpen) {
        closeComposerToolsMenu();
        return;
    }

    closeComposerEmojiPicker();
    composerToolsMenu.classList.remove("hidden");
}

function syncComposerToolsVisibility() {
    if (!composerBox || !messageInput) return;

    const hasText = !!messageInput.value.trim();
    composerBox.classList.toggle("composer-has-text", hasText);
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

    closeComposerToolsMenu();
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

function openNativeVoicePicker() {
    hiddenVoiceInput.click();
}

async function toggleVoiceRecording() {
    if (!recordVoiceBtn) return;

    if (shouldUseNativeVoiceCapture()) {
        openNativeVoicePicker();
        return;
    }

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

        if (error && error.code === "BROWSER_VOICE_UNSUPPORTED" && isAndroidDevice()) {
            openNativeVoicePicker();
            return;
        }

        alert("Няма достъп до микрофон.");
    }
}

let overlayDragState = null;

function getEncodedOverlayElement() {
    return document.getElementById("encodedOverlay");
}

function clampEncodedOverlayPosition(left, top, overlay) {
    const rect = overlay.getBoundingClientRect();

    const minLeft = 8;
    const minTop = 8;
    const maxLeft = Math.max(minLeft, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(minTop, window.innerHeight - rect.height - 8);

    return {
        left: Math.min(maxLeft, Math.max(minLeft, left)),
        top: Math.min(maxTop, Math.max(minTop, top))
    };
}

function moveEncodedOverlayToPosition(left, top) {
    const overlay = getEncodedOverlayElement();
    if (!overlay) return;

    const pos = clampEncodedOverlayPosition(left, top, overlay);

    overlay.style.left = pos.left + "px";
    overlay.style.top = pos.top + "px";
    overlay.style.bottom = "auto";
}

function startEncodedOverlayDrag(e) {
    const overlay = getEncodedOverlayElement();
    if (!overlay) return;

    const interactiveTarget = e.target.closest(
        "button, textarea, input, a, .composer-tools-menu, .emoji-picker, .message-menu"
    );

    if (interactiveTarget) return;

    const rect = overlay.getBoundingClientRect();

    overlayDragState = {
        pointerId: e.pointerId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top
    };

    overlay.classList.add("move-armed");

    if (typeof overlay.setPointerCapture === "function") {
        try {
            overlay.setPointerCapture(e.pointerId);
        } catch (_) {}
    }

    e.preventDefault();
    e.stopPropagation();
}

function handleEncodedOverlayDragMove(e) {
    const overlay = getEncodedOverlayElement();
    if (!overlay || !overlayDragState) return;

    const nextLeft = e.clientX - overlayDragState.offsetX;
    const nextTop = e.clientY - overlayDragState.offsetY;

    moveEncodedOverlayToPosition(nextLeft, nextTop);

    e.preventDefault();
    e.stopPropagation();
}

function stopEncodedOverlayDrag(e) {
    const overlay = getEncodedOverlayElement();
    if (!overlay || !overlayDragState) return;
    if (e.pointerId !== overlayDragState.pointerId) return;

    if (typeof overlay.releasePointerCapture === "function") {
        try {
            overlay.releasePointerCapture(e.pointerId);
        } catch (_) {}
    }

    overlay.classList.remove("move-armed");
    overlayDragState = null;

    e.preventDefault();
    e.stopPropagation();
}

function bindEncodedOverlayTapMove() {
    const overlay = getEncodedOverlayElement();
    if (!overlay || overlay.dataset.moveBound === "1") return;

    overlay.dataset.moveBound = "1";

    overlay.addEventListener("pointerdown", startEncodedOverlayDrag);
    window.addEventListener("pointermove", handleEncodedOverlayDragMove, { passive: false });
    window.addEventListener("pointerup", stopEncodedOverlayDrag, { passive: false });
    window.addEventListener("pointercancel", stopEncodedOverlayDrag, { passive: false });

    window.addEventListener("resize", function () {
        const currentOverlay = getEncodedOverlayElement();
        if (!currentOverlay) return;

        const rect = currentOverlay.getBoundingClientRect();
        moveEncodedOverlayToPosition(rect.left, rect.top);

        currentOverlay.classList.remove("move-armed");
        overlayDragState = null;
    });
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

        if (
            composerToolsMenu &&
            !composerToolsMenu.classList.contains("hidden") &&
            !composerToolsMenu.contains(e.target) &&
            e.target !== composerMoreBtn
        ) {
            closeComposerToolsMenu();
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

    if (composerMoreBtn) {
        composerMoreBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            toggleComposerToolsMenu();
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

    hiddenVoiceInput.addEventListener("change", function () {
        if (this.files && this.files[0]) {
            queueVoiceAttachment(this.files[0]);
        }
        this.value = "";
    });

    if (recordVoiceBtn) {
        recordVoiceBtn.addEventListener("click", async () => {
            closeComposerEmojiPicker();
            closeComposerToolsMenu();
            await toggleVoiceRecording();
        });
    }

    attachCameraBtn.addEventListener("click", () => {
        closeComposerEmojiPicker();
        closeComposerToolsMenu();
        hiddenCameraInput.click();
    });

    attachImageBtn.addEventListener("click", () => {
        closeComposerEmojiPicker();
        closeComposerToolsMenu();
        hiddenImageInput.click();
    });

    attachFileBtn.addEventListener("click", () => {
        closeComposerEmojiPicker();
        closeComposerToolsMenu();
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

        syncComposerToolsVisibility();
        renderConversation(false);

        if (typeof shouldAutoFollow === "function" && shouldAutoFollow()) {
            scrollAllToBottom(true, false);
        } else if (typeof updateScrollButton === "function") {
            updateScrollButton();
        }
    });

    messageInput.addEventListener("focus", function () {
        syncComposerToolsVisibility();
    });

    messageInput.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            closeComposerEmojiPicker();
            closeComposerToolsMenu();
        }

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            closeComposerEmojiPicker();
            closeComposerToolsMenu();
            sendMessage();
        }
    });

    sendBtn.addEventListener("mousedown", function (e) {
        e.preventDefault();
    });

    sendBtn.addEventListener("touchend", function (e) {
        e.preventDefault();
        closeComposerEmojiPicker();
        closeComposerToolsMenu();
        sendMessage();
    }, { passive: false });

    sendBtn.addEventListener("click", function () {
        closeComposerEmojiPicker();
        closeComposerToolsMenu();
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

    bindEncodedOverlayTapMove();
    syncComposerToolsVisibility();
}
