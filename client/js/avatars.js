function avatarStorageKey(username) {
    return `shadow_avatar_${username}`;
}

function getAvatar(username) {
    return localStorage.getItem(avatarStorageKey(username)) || "";
}

function saveAvatar(username, dataUrl) {
    localStorage.setItem(avatarStorageKey(username), dataUrl);
}

function applyUserAvatar(element, username) {
    const avatar = getAvatar(username);
    element.classList.remove("group-avatar");

    if (avatar) {
        element.style.backgroundImage = `url("${avatar}")`;
        element.style.backgroundColor = "transparent";
        element.style.backgroundSize = "cover";
        element.style.backgroundPosition = "center";
        element.style.backgroundRepeat = "no-repeat";
        element.textContent = "";
    } else {
        element.style.backgroundImage = "";
        element.style.backgroundColor = "";
        element.style.backgroundSize = "";
        element.style.backgroundPosition = "";
        element.style.backgroundRepeat = "";
        element.textContent = initialsFromText(username);
    }
}

function applyGroupAvatar(element, groupName) {
    element.style.backgroundImage = "";
    element.style.backgroundColor = "";
    element.style.backgroundSize = "";
    element.style.backgroundPosition = "";
    element.style.backgroundRepeat = "";
    element.textContent = initialsFromText(groupName);
    element.classList.add("group-avatar");
}