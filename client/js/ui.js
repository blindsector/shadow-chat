function showChatListScreen() {
    chatListScreen.classList.add("active");
    chatRoomScreen.classList.remove("active");
}

function showChatRoomScreen() {
    chatRoomScreen.classList.add("active");
    chatListScreen.classList.remove("active");
}

function closeMenu() {
    sideMenu.classList.add("hidden");
}

function toggleMenu() {
    sideMenu.classList.toggle("hidden");
}

function openGroupModal() {
    renderGroupMembersSelector();
    groupModal.classList.remove("hidden");
    closeMenu();
}

function closeGroupModal() {
    groupModal.classList.add("hidden");
}