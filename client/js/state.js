const state = {
    user: null,
    contacts: [],
    groups: [],
    chatItems: [],
    chatListSignature: null,
    activeChatType: null,
    activeChatId: null,
    messages: [],
    pollTimer: null,
    presenceTimer: null,
    receiptsEnabled: loadReceiptsSetting(),
    onlineVisibilityEnabled: true,
    activeChatPresence: null,
    replyTo: null,
    menuMessage: null,
    longPressTimer: null,

    forwardMessage: null,
    forwardSelectedTarget: null,
    forwardSearchTerm: "",
    isSwapped: false,
    overlayHidden: false,

    bubbleAvatarCache: {}
};