/**
 * 自动打开AI字幕
 * 需求背景：Issue #95 b站的学习视频里，切换分P后，每次都要重新再手动打开字幕，很麻烦
 * 解决方案：不单纯的看字幕按钮是否存在，因为分p场景里切换还是会有问题，所以需要看看请求里是否包含字幕
 *
 * 实现说明（B站播放器的真实行为，2026-08 实测）：
 *  1. 字幕语言面板靠悬停展开：对字幕按钮派发 mouseenter/mouseover 即可，单纯派发 click 是无效的
 *  2. 面板展开后点击语言项（优先中文）即可开启字幕
 *  3. 开启状态以字幕按钮上的 bpx-state-show 类为准，B站字幕是自绘DOM，不走原生 textTracks
 */

const SUBTITLE_ON_SELECTOR = '.bpx-player-ctrl-btn.bpx-player-ctrl-subtitle.bpx-state-show';
// 语言偏好：优先AI中文字幕，其次各中文变体，都没有时兜底第一个可见项
const PREFERRED_LANGUAGE_SELECTORS = ['[data-lan="ai-zh"]', '[data-lan="zh-CN"]', '[data-lan="zh-Hans"]', '[data-lan="zh-Hant"]', '[data-lan="zh"]'];

chrome.storage.sync.get(['biliplus-enable', 'auto-subtitle'], storage => {
    if (storage['biliplus-enable'] !== false && storage['auto-subtitle']) { // 总开关未设置视为开启
        let disconnectObserver = null;
        let fallbackTimeout = null;
        let triedItems = null;

        const cleanup = () => {
            if (disconnectObserver) {
                disconnectObserver();
                disconnectObserver = null;
            }
            if (fallbackTimeout) {
                clearTimeout(fallbackTimeout);
                fallbackTimeout = null;
            }
        };

        // B站控件需要完整的 pointer+mouse 事件序列才会响应（实测单一事件无效）
        const dispatchClick = el => {
            el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        };

        // 先让播放器感知鼠标存在（控制层唤醒），再悬停字幕按钮展开语言面板
        const hoverSubtitleButton = () => {
            const playerArea = document.querySelector('.bpx-player-video-area') || document.querySelector('.bpx-player-container') || document.body;
            playerArea.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
            playerArea.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
            setTimeout(() => {
                const subtitleBtn = document.querySelector('.bpx-player-ctrl-btn.bpx-player-ctrl-subtitle');
                if (!subtitleBtn) return;
                subtitleBtn.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
                subtitleBtn.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
                subtitleBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
                subtitleBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
            }, 200);
        };

        // 监听请求消息，使用mutation observer配合监听页面变化
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'subtitle-ready' && message.exists) {
                // 分P切换会重复收到消息，先清掉上一个观察器，避免多个观察器叠加扫描
                cleanup();
                triedItems = new Set();
                // 收到消息立即悬停展开面板——静止的页面没有DOM变动，不能等观察器来触发第一步
                hoverSubtitleButton();
                // 观察范围缩小到播放器容器，负责后续：确认开启状态、点击语言项
                const scope = document.querySelector('.bpx-player-container') || document.body;
                disconnectObserver = _UTILS.observe(scope, () => {
                    const subtitleBtn = document.querySelector('.bpx-player-ctrl-btn.bpx-player-ctrl-subtitle');
                    if (!subtitleBtn) return;

                    // 字幕已开启，完成
                    if (document.querySelector(SUBTITLE_ON_SELECTOR)) {
                        cleanup();
                        return;
                    }

                    // 点击首选语言项开启字幕，没开起来就换下一个候选（每个只点一次，避免点击循环）
                    const items = [...document.querySelectorAll('.bpx-player-ctrl-subtitle-major-content .bpx-player-ctrl-subtitle-language-item')];
                    const candidates = [];
                    for (const selector of PREFERRED_LANGUAGE_SELECTORS) {
                        const found = document.querySelector('.bpx-player-ctrl-subtitle-major-content ' + selector);
                        if (found) candidates.push(found);
                    }
                    const firstVisible = items.find(item => item.offsetWidth > 0);
                    if (firstVisible && !candidates.includes(firstVisible)) {
                        candidates.push(firstVisible);
                    }
                    for (const item of candidates) {
                        if (item.offsetWidth === 0 || triedItems.has(item)) continue;
                        triedItems.add(item);
                        dispatchClick(item);
                        return; // 等开启状态确认；没开启的话下一轮换候选
                    }
                });
                // 一直开不起来时 15 秒兜底断开，避免无限扫描
                fallbackTimeout = setTimeout(cleanup, 15 * 1000);
            }
        });
    }
  });
