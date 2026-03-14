const EMOJI_GROUPS = [
    {
        title: "Последни",
        key: "recent"
    },
    {
        title: "Усмивки",
        key: "smileys",
        items: ["😀", "😄", "😁", "😂", "🤣", "😊", "🙂", "😉", "😍", "😘", "😎", "🤩", "🥳", "😴", "🤔", "🙃"]
    },
    {
        title: "Сърца",
        key: "hearts",
        items: ["❤️", "🩷", "🧡", "💛", "💚", "🩵", "💙", "💜", "🤍", "🖤", "💔", "❤️‍🔥"]
    },
    {
        title: "Жестове",
        key: "hands",
        items: ["👍", "👎", "👌", "✌️", "🤝", "👏", "🙌", "🙏", "👊", "🤟", "🫶", "💪"]
    },
    {
        title: "Реакции",
        key: "moods",
        items: ["🔥", "💯", "🎉", "✨", "😮", "😢", "😭", "🤯", "😡", "🤮", "😅", "🤦"]
    },
    {
        title: "Още",
        key: "extra",
        items: ["🌹", "🌞", "🌙", "⭐", "☕", "🍕", "🎵", "🎬", "⚽", "🏆", "🎁", "📌"]
    }
];

const EMOJI_RECENT_KEY = "shadow_recent_emojis";
const EMOJI_RECENT_LIMIT = 18;

function getRecentEmojis() {
    try {
        const raw = localStorage.getItem(EMOJI_RECENT_KEY);
        const parsed = JSON.parse(raw || "[]");
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
        return [];
    }
}

function saveRecentEmoji(emoji) {
    const current = getRecentEmojis().filter(item => item !== emoji);
    current.unshift(emoji);
    localStorage.setItem(
        EMOJI_RECENT_KEY,
        JSON.stringify(current.slice(0, EMOJI_RECENT_LIMIT))
    );
}

function insertEmojiIntoInput(emoji) {
    if (!messageInput) {
        return;
    }

    const start = messageInput.selectionStart ?? messageInput.value.length;
    const end = messageInput.selectionEnd ?? messageInput.value.length;

    messageInput.focus();
    messageInput.setRangeText(emoji, start, end, "end");
    saveRecentEmoji(emoji);
    messageInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function closeComposerEmojiPicker() {
    if (!emojiPicker) {
        return;
    }

    emojiPicker.classList.add("hidden");
}

function isComposerEmojiPickerOpen() {
    return emojiPicker && !emojiPicker.classList.contains("hidden");
}

function positionComposerEmojiPicker() {
    if (!emojiPicker || !openEmojiPickerBtn) {
        return;
    }

    const btnRect = openEmojiPickerBtn.getBoundingClientRect();
    const pickerWidth = Math.min(window.innerWidth - 20, 320);
    const left = Math.max(10, Math.min(btnRect.left, window.innerWidth - pickerWidth - 10));
    const bottomGap = window.innerHeight - btnRect.top + 10;

    emojiPicker.style.position = "fixed";
    emojiPicker.style.left = `${left}px`;
    emojiPicker.style.bottom = `${bottomGap}px`;
    emojiPicker.style.width = `${pickerWidth}px`;
    emojiPicker.style.maxWidth = "calc(100vw - 20px)";
    emojiPicker.style.maxHeight = "320px";
    emojiPicker.style.overflowY = "auto";
    emojiPicker.style.display = "block";
    emojiPicker.style.padding = "10px";
    emojiPicker.style.borderRadius = "18px";
    emojiPicker.style.background = "rgba(10, 14, 22, 0.98)";
    emojiPicker.style.border = "1px solid rgba(255,255,255,0.08)";
    emojiPicker.style.boxShadow = "0 18px 44px rgba(0,0,0,0.38)";
    emojiPicker.style.backdropFilter = "blur(14px)";
    emojiPicker.style.webkitBackdropFilter = "blur(14px)";
}

function makeEmojiSection(title, emojis) {
    const section = document.createElement("div");
    section.style.display = "flex";
    section.style.flexDirection = "column";
    section.style.gap = "8px";
    section.style.marginBottom = "12px";

    const label = document.createElement("div");
    label.textContent = title;
    label.style.fontSize = "11px";
    label.style.fontWeight = "700";
    label.style.letterSpacing = "0.06em";
    label.style.textTransform = "uppercase";
    label.style.color = "rgba(255,255,255,0.52)";
    label.style.padding = "0 4px";

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(6, minmax(0, 1fr))";
    grid.style.gap = "8px";

    emojis.forEach((emoji) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "emoji-btn";
        btn.textContent = emoji;
        btn.style.width = "100%";
        btn.style.height = "44px";
        btn.style.border = "none";
        btn.style.borderRadius = "14px";
        btn.style.background = "rgba(255,255,255,0.08)";
        btn.style.cursor = "pointer";
        btn.style.fontSize = "24px";
        btn.style.lineHeight = "1";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.transition = "transform 0.14s ease, background 0.18s ease";

        btn.addEventListener("mouseenter", () => {
            btn.style.background = "rgba(255,255,255,0.16)";
            btn.style.transform = "translateY(-1px)";
        });

        btn.addEventListener("mouseleave", () => {
            btn.style.background = "rgba(255,255,255,0.08)";
            btn.style.transform = "translateY(0)";
        });

        btn.addEventListener("click", (event) => {
            event.stopPropagation();
            insertEmojiIntoInput(emoji);
            closeComposerEmojiPicker();
        });

        grid.appendChild(btn);
    });

    section.appendChild(label);
    section.appendChild(grid);

    return section;
}

function renderComposerEmojiPicker() {
    if (!emojiPicker) {
        return;
    }

    const recent = getRecentEmojis();
    emojiPicker.innerHTML = "";

    EMOJI_GROUPS.forEach((group) => {
        const emojis = group.key === "recent" ? recent : group.items;

        if (!emojis || !emojis.length) {
            return;
        }

        emojiPicker.appendChild(makeEmojiSection(group.title, emojis));
    });
}

function toggleComposerEmojiPicker() {
    if (!emojiPicker) {
        return;
    }

    if (isComposerEmojiPickerOpen()) {
        closeComposerEmojiPicker();
        return;
    }

    renderComposerEmojiPicker();
    emojiPicker.classList.remove("hidden");
    positionComposerEmojiPicker();
}

function bindComposerEmojiPicker() {
    if (window.__composerEmojiPickerBound) {
        return;
    }

    window.__composerEmojiPickerBound = true;

    if (openEmojiPickerBtn) {
        openEmojiPickerBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleComposerEmojiPicker();
        });
    }

    quickEmojiBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const emoji = btn.dataset.emoji || btn.textContent || "";
            if (!emoji) {
                return;
            }

            insertEmojiIntoInput(emoji);
        });
    });

    document.addEventListener("click", (event) => {
        if (!isComposerEmojiPickerOpen()) {
            return;
        }

        if (emojiPicker.contains(event.target)) {
            return;
        }

        if (openEmojiPickerBtn && openEmojiPickerBtn.contains(event.target)) {
            return;
        }

        closeComposerEmojiPicker();
    });

    window.addEventListener("resize", () => {
        if (isComposerEmojiPickerOpen()) {
            positionComposerEmojiPicker();
        }
    });

    window.addEventListener("scroll", () => {
        if (isComposerEmojiPickerOpen()) {
            positionComposerEmojiPicker();
        }
    }, true);

    if (messageInput) {
        messageInput.addEventListener("focus", () => {
            closeComposerEmojiPicker();
        });
    }
}

bindComposerEmojiPicker();
setTimeout(bindComposerEmojiPicker, 0);