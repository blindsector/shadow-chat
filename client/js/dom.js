const loginScreen = document.getElementById("loginScreen");
const app = document.getElementById("app");

const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const loginStatus = document.getElementById("loginStatus");

const chatListScreen = document.getElementById("chatListScreen");
const chatRoomScreen = document.getElementById("chatRoomScreen");

const myAvatarBtn = document.getElementById("myAvatarBtn");
const myUsernameLabel = document.getElementById("myUsernameLabel");
const myInviteCodeLabel = document.getElementById("myInviteCodeLabel");

const openMenuBtn = document.getElementById("openMenuBtn");
const sideMenu = document.getElementById("sideMenu");
const avatarFileInput = document.getElementById("avatarFileInput");
const openInviteModalBtn = document.getElementById("openInviteModalBtn");
const createGroupBtn = document.getElementById("createGroupBtn");
const receiptsToggle = document.getElementById("receiptsToggle");
const onlineVisibilityToggle = document.getElementById("onlineVisibilityToggle");
const logoutBtn = document.getElementById("logoutBtn");

const contactSearchInput = document.getElementById("contactSearchInput");
const inviteCodeInput = document.getElementById("inviteCodeInput");
const addContactBtn = document.getElementById("addContactBtn");
const chatList = document.getElementById("chatList");

const backBtn = document.getElementById("backBtn");
const activeAvatar = document.getElementById("activeAvatar");
const activeContactName = document.getElementById("activeContactName");
const activeContactSub = document.getElementById("activeContactSub");
const refreshChatBtn = document.getElementById("refreshChatBtn");

const encodedPanel = document.getElementById("encodedPanel");
const decodedPanel = document.getElementById("decodedPanel");
const encodedMessages = document.getElementById("encodedMessages");
const chatMessages = document.getElementById("chatMessages");
const scrollToBottomBtn = document.getElementById("scrollToBottomBtn");

const composerBox = document.getElementById("composerBox");
const openEmojiPickerBtn = document.getElementById("openEmojiPickerBtn");
const quickEmojiBtns = document.querySelectorAll(".quick-emoji-btn");
const composerToolsContainer = document.getElementById("composerToolsContainer");
const composerMoreBtn = document.getElementById("composerMoreBtn");
const composerToolsMenu = document.getElementById("composerToolsMenu");
const recordVoiceBtn = document.getElementById("recordVoiceBtn");
const attachCameraBtn = document.getElementById("attachCameraBtn");
const attachImageBtn = document.getElementById("attachImageBtn");
const attachFileBtn = document.getElementById("attachFileBtn");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const groupModal = document.getElementById("groupModal");
const groupNameInput = document.getElementById("groupNameInput");
const groupMembersList = document.getElementById("groupMembersList");
const cancelGroupBtn = document.getElementById("cancelGroupBtn");
const confirmGroupBtn = document.getElementById("confirmGroupBtn");

const inviteModal = document.getElementById("inviteModal");
const inviteQrImage = document.getElementById("inviteQrImage");
const inviteLinkText = document.getElementById("inviteLinkText");
const inviteCodeText = document.getElementById("inviteCodeText");
const copyInviteBtn = document.getElementById("copyInviteBtn");
const shareInviteBtn = document.getElementById("shareInviteBtn");
const closeInviteBtn = document.getElementById("closeInviteBtn");

const replyBar = document.getElementById("replyBar");
const replyPreviewText = document.getElementById("replyPreviewText");
const clearReplyBtn = document.getElementById("clearReplyBtn");

const forwardModal = document.getElementById("forwardModal");
const forwardPreviewText = document.getElementById("forwardPreviewText");
const forwardSearchInput = document.getElementById("forwardSearchInput");
const forwardTargetsList = document.getElementById("forwardTargetsList");
const cancelForwardBtn = document.getElementById("cancelForwardBtn");
const confirmForwardBtn = document.getElementById("confirmForwardBtn");

const confirmModal = document.getElementById("confirmModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalSubtitle = document.getElementById("confirmModalSubtitle");
const confirmModalText = document.getElementById("confirmModalText");
const cancelConfirmBtn = document.getElementById("cancelConfirmBtn");
const confirmActionBtn = document.getElementById("confirmActionBtn");

const imageViewer = document.getElementById("imageViewer");
const imageViewerImg = document.getElementById("imageViewerImg");
const closeImageViewerBtn = document.getElementById("closeImageViewerBtn");

const messageMenu = document.getElementById("messageMenu");
const menuReactBtn = document.getElementById("menuReactBtn");
const menuReplyBtn = document.getElementById("menuReplyBtn");
const menuForwardBtn = document.getElementById("menuForwardBtn");
const menuDeleteBtn = document.getElementById("menuDeleteBtn");

const emojiPicker = document.getElementById("emojiPicker");
const encodedOverlay = document.getElementById("encodedOverlay");
const encodedOverlayMessages = document.getElementById("encodedOverlayMessages");
const swapChatsBtn = document.getElementById("swapChatsBtn");
const overlayRevealZone = document.getElementById("overlayRevealZone");



const hiddenCameraInput = document.createElement("input");
hiddenCameraInput.type = "file";
hiddenCameraInput.accept = "image/*";
hiddenCameraInput.capture = "environment";
hiddenCameraInput.style.display = "none";
document.body.appendChild(hiddenCameraInput);

const hiddenImageInput = document.createElement("input");
hiddenImageInput.type = "file";
hiddenImageInput.accept = "image/*";
hiddenImageInput.style.display = "none";
document.body.appendChild(hiddenImageInput);

const hiddenFileInput = document.createElement("input");
hiddenFileInput.type = "file";
hiddenFileInput.style.display = "none";
document.body.appendChild(hiddenFileInput);
