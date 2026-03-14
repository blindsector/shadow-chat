function renderMyHeader() {
    if (!state.user) return;

    myUsernameLabel.textContent = state.user.username;
    myInviteCodeLabel.textContent = `Invite code: ${state.user.invite_code}`;
    myInviteCodeLabel.style.cursor = "pointer";
    myInviteCodeLabel.title = "Покани приятел";
    applyUserAvatar(myAvatarBtn, state.user.username);
}
