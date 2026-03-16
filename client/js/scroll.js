let userReadingOldMessages = false;
let unseenMessagesCount = 0;
let lastRenderedMessagesCount = 0;

let lastDecodedScrollHeight = 0;
let lastEncodedScrollHeight = 0;

const NEAR_BOTTOM_THRESHOLD = 60;
const SCROLL_BUTTON_SCREEN_THRESHOLD = 1.0;
const SMOOTH_SCROLL_MIN_MS = 420;
const SMOOTH_SCROLL_MAX_MS = 920;
const BADGE_VISIBLE_MS = 1350;
const BADGE_FADE_MS = 650;

let panelSyncLock = false;
let activeScrollAnimation = null;
let badgeHideTimer = null;
let badgeFadeTimer = null;
let lastBadgeVisible = false;
let ignoreScrollEventsUntil = 0;



function getActiveEncodedScrollContainer() {

    if (typeof encodedMessages !== "undefined" && encodedMessages) {
        return encodedMessages;
    }

    if (typeof encodedPanel !== "undefined" && encodedPanel) {
        return encodedPanel;
    }

    return decodedPanel;
}



function getDistanceFromBottom(container) {
    return container.scrollHeight - container.scrollTop - container.clientHeight;
}

function clampScrollTop(container, value) {
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    return Math.max(0, Math.min(value, maxTop));
}

function isNearBottom(container, threshold = NEAR_BOTTOM_THRESHOLD) {
    return getDistanceFromBottom(container) <= threshold;
}



function shouldAutoFollow() {
    const activeEncoded = getActiveEncodedScrollContainer();
    return isNearBottom(decodedPanel) && isNearBottom(activeEncoded);
}



function shouldShowScrollButton() {

    const activeEncoded = getActiveEncodedScrollContainer();

    const decodedDistance = getDistanceFromBottom(decodedPanel);
    const encodedDistance = getDistanceFromBottom(activeEncoded);

    const maxDistance = Math.max(decodedDistance, encodedDistance);

    const decodedThreshold = decodedPanel.clientHeight * SCROLL_BUTTON_SCREEN_THRESHOLD;
    const encodedThreshold = activeEncoded.clientHeight * SCROLL_BUTTON_SCREEN_THRESHOLD;

    const threshold = Math.max(decodedThreshold, encodedThreshold);

    return maxDistance > threshold;
}



function shouldIgnoreScrollEvent() {
    return Date.now() < ignoreScrollEventsUntil;
}

function markProgrammaticScroll(duration = 120) {
    ignoreScrollEventsUntil = Date.now() + duration;
}



function clearBadgeTimers() {

    if (badgeHideTimer) {
        clearTimeout(badgeHideTimer);
        badgeHideTimer = null;
    }

    if (badgeFadeTimer) {
        clearTimeout(badgeFadeTimer);
        badgeFadeTimer = null;
    }
}



function renderScrollButton(showBadge = false, fading = false) {

    if (!userReadingOldMessages || !shouldShowScrollButton()) {

        scrollToBottomBtn.classList.add("hidden");
        scrollToBottomBtn.innerHTML = "";
        lastBadgeVisible = false;
        return;
    }

    scrollToBottomBtn.classList.remove("hidden");

    const badgeHtml = showBadge && unseenMessagesCount > 0
        ? `<span class="scroll-btn-count">${unseenMessagesCount}</span>`
        : "";

    scrollToBottomBtn.innerHTML = `
        <span style="position:relative">
            ↓
            ${badgeHtml}
        </span>
    `;

    lastBadgeVisible = showBadge && unseenMessagesCount > 0;
}



function updateScrollButton() {

    if (!userReadingOldMessages) {

        clearBadgeTimers();
        renderScrollButton(false,false);
        return;
    }

    if (lastBadgeVisible && unseenMessagesCount > 0) {

        renderScrollButton(true,false);

    } else {

        renderScrollButton(false,false);
    }
}



function rememberPanelHeights() {

    const activeEncoded = getActiveEncodedScrollContainer();

    lastDecodedScrollHeight = decodedPanel.scrollHeight;
    lastEncodedScrollHeight = activeEncoded.scrollHeight;
}



function stopActiveScrollAnimation() {

    if (activeScrollAnimation && activeScrollAnimation.frameId) {
        cancelAnimationFrame(activeScrollAnimation.frameId);
    }

    activeScrollAnimation = null;
}



function setBothPanelsScrollTop(decodedTop, encodedTop) {

    const activeEncoded = getActiveEncodedScrollContainer();

    markProgrammaticScroll(150);

    panelSyncLock = true;

    decodedPanel.scrollTop = clampScrollTop(decodedPanel, decodedTop);
    activeEncoded.scrollTop = clampScrollTop(activeEncoded, encodedTop);

    panelSyncLock = false;
}



function syncPanelsInstantFromDecoded() {

    const activeEncoded = getActiveEncodedScrollContainer();

    const ratio =
        decodedPanel.scrollHeight > decodedPanel.clientHeight
        ? decodedPanel.scrollTop /
          Math.max(1, decodedPanel.scrollHeight - decodedPanel.clientHeight)
        : 1;

    const encodedMax = Math.max(
        0,
        activeEncoded.scrollHeight - activeEncoded.clientHeight
    );

    setBothPanelsScrollTop(decodedPanel.scrollTop, encodedMax * ratio);
}



function syncPanelsInstantFromEncoded() {

    const activeEncoded = getActiveEncodedScrollContainer();

    const ratio =
        activeEncoded.scrollHeight > activeEncoded.clientHeight
        ? activeEncoded.scrollTop /
          Math.max(1, activeEncoded.scrollHeight - activeEncoded.clientHeight)
        : 1;

    const decodedMax = Math.max(
        0,
        decodedPanel.scrollHeight - decodedPanel.clientHeight
    );

    setBothPanelsScrollTop(decodedMax * ratio, activeEncoded.scrollTop);
}



function scrollAllToBottom(force=false,smooth=true){

    const activeEncoded = getActiveEncodedScrollContainer();

    if(!force && userReadingOldMessages){

        updateScrollButton();
        return;
    }

    clearBadgeTimers();

    userReadingOldMessages=false;
    unseenMessagesCount=0;

    renderScrollButton(false,false);

    stopActiveScrollAnimation();

    setBothPanelsScrollTop(
        decodedPanel.scrollHeight,
        activeEncoded.scrollHeight
    );

    rememberPanelHeights();
}



function keepCurrentReadingPosition(){

    const activeEncoded=getActiveEncodedScrollContainer();

    stopActiveScrollAnimation();

    setBothPanelsScrollTop(
        decodedPanel.scrollTop,
        activeEncoded.scrollTop
    );
}



function syncReadingStateFromScroll(){

    const wasReading=userReadingOldMessages;

    if(shouldAutoFollow()){

        userReadingOldMessages=false;
        unseenMessagesCount=0;

        clearBadgeTimers();

        renderScrollButton(false,false);

    }else{

        userReadingOldMessages=true;

        if(!wasReading){

            renderScrollButton(false,false);

        }else{

            updateScrollButton();
        }
    }
}



function afterConversationRender(){

    const currentCount=Array.isArray(state.messages)
        ?state.messages.length
        :0;

    const hadNewMessages=currentCount>lastRenderedMessagesCount;

    const shouldStayLive=!userReadingOldMessages;

    if(hadNewMessages){

        if(shouldStayLive || shouldAutoFollow()){

            scrollAllToBottom(true,false);

        }else{

            keepCurrentReadingPosition();

            userReadingOldMessages=true;

            unseenMessagesCount+=currentCount-lastRenderedMessagesCount;

            renderScrollButton(true,false);

            rememberPanelHeights();
        }

    }else{

        if(shouldAutoFollow()){

            userReadingOldMessages=false;

            unseenMessagesCount=0;

            clearBadgeTimers();

            renderScrollButton(false,false);

        }else{

            userReadingOldMessages=true;

            updateScrollButton();
        }

        rememberPanelHeights();
    }

    lastRenderedMessagesCount=currentCount;
}



function handleDecodedPanelScroll(){

    if(panelSyncLock || shouldIgnoreScrollEvent()) return;

    stopActiveScrollAnimation();

    syncPanelsInstantFromDecoded();

    syncReadingStateFromScroll();
}



function handleEncodedPanelScroll(){

    if(panelSyncLock || shouldIgnoreScrollEvent()) return;

    stopActiveScrollAnimation();

    syncPanelsInstantFromEncoded();

    syncReadingStateFromScroll();
}



scrollToBottomBtn.addEventListener("click",()=>{

    scrollAllToBottom(true,true);
});



decodedPanel.addEventListener("scroll",handleDecodedPanelScroll);



if(typeof encodedMessages!=="undefined" && encodedMessages){

    encodedMessages.addEventListener("scroll",handleEncodedPanelScroll);
}



window.addEventListener("resize",()=>{

    if(shouldAutoFollow()){

        scrollAllToBottom(true,false);

    }else{

        rememberPanelHeights();
        syncReadingStateFromScroll();
    }
});