function positionFloatingBox(box, anchorRect, width = 220) {
    if (!box || !anchorRect) {
        return;
    }

    const gap = 8;
    let left = anchorRect.left + window.scrollX;
    let top = anchorRect.bottom + window.scrollY + gap;

    if (left + width > window.innerWidth - 10) {
        left = window.innerWidth - width - 10;
    }

    if (top + 260 > window.innerHeight + window.scrollY) {
        top = anchorRect.top + window.scrollY - 260 - gap;
    }

    box.style.left = `${Math.max(10, left)}px`;
    box.style.top = `${Math.max(10, top)}px`;
    box.style.zIndex = "999999";
}

function closeEmojiPickerFallback() {
    if (!emojiPicker) {
        return;
    }

    emojiPicker.classList.add("hidden");
    emojiPicker.innerHTML = "";
}

function safeCloseEmojiPicker() {
    if (typeof closeEmojiPicker === "function") {
        closeEmojiPicker();
    } else {
        closeEmojiPickerFallback();
    }
}

function bindLegacyMessageMenuSafely() {
    if (!messageMenu || !emojiPicker) {
        return;
    }

    messageMenu.addEventListener("click", function (e) {
        e.stopPropagation();
    });

    emojiPicker.addEventListener("click", function (e) {
        e.stopPropagation();
    });

    document.addEventListener("click", function () {
        if (typeof closeMessageMenu === "function") {
            closeMessageMenu();
        }
        safeCloseEmojiPicker();
    });
}

bindLegacyMessageMenuSafely();
