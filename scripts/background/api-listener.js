/**
 * 监听v2请求，并且重发，判断是否有字幕
 */

function isExtensionRequest(details) {
    // 检查是否是扩展发起的请求
    return details.initiator?.startsWith('chrome-extension://') ||
           details.documentUrl?.startsWith('chrome-extension://');
}

// 缓存功能开关，避免每次请求都读 storage
let autoSubtitleEnabled = null;
chrome.storage.sync.get(['biliplus-enable', 'auto-subtitle'], storage => {
    autoSubtitleEnabled = !!(storage['biliplus-enable'] && storage['auto-subtitle']);
});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes['auto-subtitle'] || changes['biliplus-enable'])) {
        chrome.storage.sync.get(['biliplus-enable', 'auto-subtitle'], storage => {
            autoSubtitleEnabled = !!(storage['biliplus-enable'] && storage['auto-subtitle']);
        });
    }
});

chrome.webRequest.onCompleted.addListener((details) => {
    // 功能没开就不重发请求
    if (!autoSubtitleEnabled) {
        return;
    }
    // 只处理页面发起的请求
    if (isExtensionRequest(details)) {
        return;
    }

    if (details.type === 'xmlhttprequest') {
        fetch(details.url)
            .then(response => response.json())
            .then(data => {
                if (data?.data?.subtitle?.subtitles?.length > 0) {
                    // 发送消息给 content script
                    // 接收方（内容脚本）可能尚未注入或不存在（如第三方页面的内嵌播放器），失败时静默忽略
                    chrome.tabs.sendMessage(
                        details.tabId,
                        {
                            type: 'subtitle-ready',
                            exists: true
                        }
                    ).catch(() => {});
                }
            })
            .catch(error => console.error("获取字幕数据失败:", error));
    }},
    {
        urls: ["*://api.bilibili.com/x/player/wbi/v2*"],
    }
);
