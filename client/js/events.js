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
let overlayHeaderTapTime = 0;
const OVERLAY_DRAG_THRESHOLD = 8;
const OVERLAY_DOUBLE_TAP_MS = 280;

let overlayHideSwipeState = null;
let overlayRevealSwipeState = null;

const OVERLAY_HIDE_SWIPE_THRESHOLD = 56;
const OVERLAY_EDGE_REVEAL_ZONE = 120;
const OVERLAY_REVEAL_SWIPE_THRESHOLD = 56;

function hideEncodedOverlayTemporarily() {
    const overlay = getEncodedOverlayElement();
    if (!overlay) return;

    state.overlayHidden = true;
    overlay.classList.add("overlay-hidden-left");

    if (overlayRevealZone) {
        overlayRevealZone.style.pointerEvents = "auto";
    }
}

function showEncodedOverlayTemporarily() {
    const overlay = getEncodedOverlayElement();
    if (!overlay) return;

    state.overlayHidden = false;
    overlay.classList.remove("overlay-hidden-left");

    if (overlayRevealZone) {
        overlayRevealZone.style.pointerEvents = "none";
    }
}

function startOverlayHideSwipe(e) {
    const overlay = getEncodedOverlayElement();
    const header = getEncodedOverlayHeader();

    if (!overlay || state.overlayHidden) return;
    if (!overlay.contains(e.target)) return;
    if (header && header.contains(e.target)) return;

    overlayHideSwipeState = {
        pointerId: typeof e.pointerId === "number" ? e.pointerId : null,
        startX: e.clientX,
        startY: e.clientY,
        moved: false
    };
}

function handleOverlayHideSwipeMove(e) {
    if (!overlayHideSwipeState) return;
    if (overlayHideSwipeState.pointerId !== null && e.pointerId !== overlayHideSwipeState.pointerId) return;

    const dx = e.clientX - overlayHideSwipeState.startX;
    const dy = e.clientY - overlayHideSwipeState.startY;

    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        return;
    }

    if (Math.abs(dx) <= Math.abs(dy)) {
        return;
    }

    overlayHideSwipeState.moved = true;

    if (dx <= -OVERLAY_HIDE_SWIPE_THRESHOLD) {
        hideEncodedOverlayTemporarily();
        overlayHideSwipeState = null;
    }
}

function stopOverlayHideSwipe(e) {
    if (!overlayHideSwipeState) return;
    if (overlayHideSwipeState.pointerId !== null && e.pointerId !== overlayHideSwipeState.pointerId) return;

    overlayHideSwipeState = null;
}

function startOverlayRevealSwipe(e) {
    const zone = overlayRevealZone;
    if (!zone) return;
    if (!state.overlayHidden) return;
    if (!zone.contains(e.target)) return;

    overlayRevealSwipeState = {
        pointerId: typeof e.pointerId === "number" ? e.pointerId : null,
        startX: e.clientX,
        startY: e.clientY
    };
}

function handleOverlayRevealSwipeMove(e) {
    if (!overlayRevealSwipeState) return;
    if (overlayRevealSwipeState.pointerId !== null && e.pointerId !== overlayRevealSwipeState.pointerId) return;

    const dx = e.clientX - overlayRevealSwipeState.startX;
    const dy = e.clientY - overlayRevealSwipeState.startY;

    if (Math.abs(dx) <= Math.abs(dy)) {
        return;
    }

    if (dx >= OVERLAY_REVEAL_SWIPE_THRESHOLD) {
        showEncodedOverlayTemporarily();
        overlayRevealSwipeState = null;
    }
}

function stopOverlayRevealSwipe(e) {
    if (!overlayRevealSwipeState) return;
    if (overlayRevealSwipeState.pointerId !== null && e.pointerId !== overlayRevealSwipeState.pointerId) return;

    overlayRevealSwipeState = null;
}

function bindOverlayHideRevealGestures() {
    const overlay = getEncodedOverlayElement();
    if (!overlay || overlay.dataset.hideRevealBound === "1") return;

    overlay.dataset.hideRevealBound = "1";

    overlay.addEventListener("pointerdown", startOverlayHideSwipe, { passive: true });
    window.addEventListener("pointermove", handleOverlayHideSwipeMove, { passive: true });
    window.addEventListener("pointerup", stopOverlayHideSwipe, { passive: true });
    window.addEventListener("pointercancel", stopOverlayHideSwipe, { passive: true });

    if (overlayRevealZone) {
    overlayRevealZone.addEventListener("pointerdown", startOverlayRevealSwipe, { passive: true });
}
    window.addEventListener("pointermove", handleOverlayRevealSwipeMove, { passive: true });
    window.addEventListener("pointerup", stopOverlayRevealSwipe, { passive: true });
    window.addEventListener("pointercancel", stopOverlayRevealSwipe, { passive: true });
}

function getEncodedOverlayElement() {
    return document.getElementById("encodedOverlay");
}

function getEncodedOverlayHeader() {
    const overlay = getEncodedOverlayElement();
    return overlay ? overlay.querySelector(".encoded-overlay-header") : null;
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

function toggleEncodedOverlayExpanded() {
    const overlay = getEncodedOverlayElement();
    if (!overlay) return;

    overlay.classList.toggle("is-expanded");

    requestAnimationFrame(function () {
        const rect = overlay.getBoundingClientRect();
        moveEncodedOverlayToPosition(rect.left, rect.top);
    });
}

function startEncodedOverlayDrag(e) {
    const overlay = getEncodedOverlayElement();
    const header = getEncodedOverlayHeader();
    if (!overlay || !header) return;
    if (!header.contains(e.target)) return;

    const now = Date.now();

    overlayDragState = {
        pointerId: typeof e.pointerId === "number" ? e.pointerId : null,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - overlay.getBoundingClientRect().left,
        offsetY: e.clientY - overlay.getBoundingClientRect().top,
        startedAt: now,
        moved: false
    };

    overlay.classList.add("move-armed");

    if (header.setPointerCapture && typeof e.pointerId === "number") {
        try {
            header.setPointerCapture(e.pointerId);
        } catch (err) {}
    }
}

function handleEncodedOverlayDragMove(e) {
    const overlay = getEncodedOverlayElement();
    if (!overlay || !overlayDragState) return;
    if (overlayDragState.pointerId !== null && e.pointerId !== overlayDragState.pointerId) return;

    const dx = e.clientX - overlayDragState.startX;
    const dy = e.clientY - overlayDragState.startY;

    if (!overlayDragState.moved) {
        const distance = Math.hypot(dx, dy);
        if (distance < OVERLAY_DRAG_THRESHOLD) {
            return;
        }
        overlayDragState.moved = true;
    }

    const nextLeft = e.clientX - overlayDragState.offsetX;
    const nextTop = e.clientY - overlayDragState.offsetY;

    moveEncodedOverlayToPosition(nextLeft, nextTop);

    e.preventDefault();
}

function stopEncodedOverlayDrag(e) {
    const overlay = getEncodedOverlayElement();
    const header = getEncodedOverlayHeader();
    if (!overlay || !overlayDragState) return;
    if (overlayDragState.pointerId !== null && e.pointerId !== overlayDragState.pointerId) return;

    const wasMove = overlayDragState.moved;
    const now = Date.now();

    overlay.classList.remove("move-armed");

    if (!wasMove) {
        if (now - overlayHeaderTapTime < OVERLAY_DOUBLE_TAP_MS) {
            overlayHeaderTapTime = 0;
            toggleEncodedOverlayExpanded();
            e.preventDefault();
        } else {
            overlayHeaderTapTime = now;
        }
    }

    if (header && header.releasePointerCapture && typeof e.pointerId === "number") {
        try {
            header.releasePointerCapture(e.pointerId);
        } catch (err) {}
    }

    overlayDragState = null;
}

function bindEncodedOverlayTapMove() {
    const overlay = getEncodedOverlayElement();
    const header = getEncodedOverlayHeader();
    if (!overlay || !header || overlay.dataset.moveBound === "1") return;

    overlay.dataset.moveBound = "1";

    header.addEventListener("pointerdown", startEncodedOverlayDrag, { passive: true });
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
    if (openSettingsBtn) {
    openSettingsBtn.addEventListener("click", () => {
        closeMenu();
        settingsModal.classList.remove("hidden");

        const userId = state.user?.id;

        settingsNotificationsToggle.checked = loadNotificationsSetting(userId);
        feedback.soundEnabled = loadSoundSetting(userId);
        feedback.vibrationEnabled = loadVibrationSetting(userId);
        settingsSoundToggle.checked = loadSoundSetting(userId);
        settingsVibrationToggle.checked = loadVibrationSetting(userId);
        settingsReceiptsToggle.checked = loadReceiptsSetting(userId);
        settingsOnlineToggle.checked = loadOnlineVisibilitySetting(userId);
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

    if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener("click", () => {
        settingsModal.classList.add("hidden");
    });
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

    settingsNotificationsToggle.addEventListener("change", function () {
    state.notificationsEnabled = this.checked;
    saveNotificationsSetting(this.checked, state.user?.id);
});

settingsSoundToggle.addEventListener("change", function () {
    saveSoundSetting(this.checked, state.user?.id);

    if (typeof feedback !== "undefined" && feedback) {
        feedback.soundEnabled = this.checked;
    }
});

settingsVibrationToggle.addEventListener("change", function () {
    saveVibrationSetting(this.checked, state.user?.id);

    if (typeof feedback !== "undefined" && feedback) {
        feedback.vibrationEnabled = this.checked;
    }
});

settingsReceiptsToggle.addEventListener("change", function () {
    state.receiptsEnabled = this.checked;
    saveReceiptsSetting(this.checked, state.user?.id);
    renderConversation(false);
});

settingsOnlineToggle.addEventListener("change", async function () {
    state.onlineVisibilityEnabled = this.checked;
    saveOnlineVisibilitySetting(this.checked, state.user?.id);

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
    
    if (typeof notificationsToggle !== "undefined" && notificationsToggle) {
        notificationsToggle.addEventListener("change", function () {
            state.notificationsEnabled = notificationsToggle.checked;
            saveNotificationsSetting(state.notificationsEnabled, state.user.id);
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
        scrollAllToBottom(true);
    } else if (typeof updateScrollButton === "function") {
        updateScrollButton();
    }

    // ===== TYPING PING =====
    if (state.activeChatType === "direct" && state.activeChatId) {
        apiRequest(
            "/api/messages/typing",
            "POST",
            {
                contact_id: state.activeChatId
            },
            true
        ).catch(() => {});
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

    if (swapChatsBtn) {
        swapChatsBtn.addEventListener("click", function (e) {
            e.stopPropagation();

            if (typeof handleSwapChats === "function") {
                handleSwapChats();
            }
        });
    }

    

    bindEncodedOverlayTapMove();
    bindOverlayHideRevealGestures();
    bindPanicTrigger();
    syncComposerToolsVisibility();
}

function activatePanicMode() {
    state.panicMode = true;
    state.isSwapped = true;
    state.overlayHidden = true;

    renderConversation(true);
}

async function deactivatePanicMode() {

    // ако сме на телефон → първо биометрия
    if (window.AndroidBridge && AndroidBridge.triggerBiometric) {
        AndroidBridge.triggerBiometric();
        return;
    }

    const password = prompt("Парола:");

    if (!password) return;

    if (!state.unlockPassword || password !== state.unlockPassword) {
        alert("Грешна парола");
        return;
    }

    state.panicMode = false;
    state.overlayHidden = false;

    renderConversation(true);
}

let panicTapCount = 0;
let panicTapTimer = null;

function bindPanicTrigger() {
    const header = document.querySelector(".chat-header");
    if (!header || header.dataset.panicBound === "1") return;

    header.dataset.panicBound = "1";

    header.addEventListener("click", function () {
        panicTapCount++;

        clearTimeout(panicTapTimer);

        panicTapTimer = setTimeout(function () {
            panicTapCount = 0;
        }, 600);

        if (panicTapCount >= 3) {
            panicTapCount = 0;

            if (state.panicMode) {
                deactivatePanicMode();
            } else {
                activatePanicMode();
            }
        }
    });
}

// ===== ANDROID BRIDGE =====

window.__panicTriggerFromNative = function () {
    activatePanicMode();

    if (window.AndroidBridge && AndroidBridge.triggerVibration) {
        AndroidBridge.triggerVibration();
    }
};

window.__panicUnlockFromNative = function () {
    state.panicMode = false;
    state.overlayHidden = false;

    renderConversation(true);
};

window.__panicBiometricFailed = function () {
    // fallback към парола
    deactivatePanicMode();
};

function showNotification(title, body) {
    if (!state.notificationsEnabled) return;

    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        new Notification(title, {
            body: body || "Ново съобщение"
        });
        return;
    }

    if (Notification.permission !== "denied") {
        Notification.requestPermission().then(function (permission) {
            if (permission === "granted") {
                new Notification(title, {
                    body: body || "Ново съобщение"
                });
            }
        });
    }
}