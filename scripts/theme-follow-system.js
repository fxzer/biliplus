/**
 * 主题跟随系统深浅色自动切换
 * 需求背景：B站虽然有夜间模式和亮色模式，但不会跟随系统的深浅色设置自动切换
 * 解决方案：监听系统 prefers-color-scheme 变化，同步切换 B站的夜间模式
 * 说明：
 *  1. B站的深色样式是初始化时按 theme_style 存储决定加载的，运行时切类名对亮色初始化
 *     的页面无效，所以系统主题变化时会保存现场（滚动位置、视频进度）后自动刷新页面，
 *     让B站以新主题重新初始化
 *  2. B站的夜间状态存在多套标记（night-mode / bili_dark / dark 类名，theme_style 存储），
 *     不同页面与账号版本使用的组合不同，因此全部一起同步
 */

chrome.storage.sync.get(['biliplus-enable', 'theme-follow-system'], storage => {
  // 总开关与功能均默认开启：只要没有显式关闭过就生效
  if (storage['biliplus-enable'] !== false && storage['theme-follow-system'] !== false) {
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const syncBiliThemeStorage = isDark => {
      const theme = isDark ? 'dark' : 'light';
      if (!document.cookie.includes(`theme_style=${theme}`)) {
        document.cookie = `theme_style=${theme}; domain=.bilibili.com; path=/; max-age=${365 * 24 * 60 * 60}`;
      }
      try {
        if (localStorage.getItem('theme_style') !== theme) {
          localStorage.setItem('theme_style', theme);
        }
      } catch (e) {}
    };

    const applyTheme = () => {
      const isDark = darkQuery.matches;
      syncBiliThemeStorage(isDark);
      // 新旧几套夜间模式的类名一起切换（对深色样式已随页面加载的页面即时生效）
      ['night-mode', 'bili_dark', 'dark'].forEach(className => {
        document.documentElement.classList.toggle(className, isDark);
      });
    };

    // 保存现场后刷新页面，让B站按新主题重新初始化
    const reloadWithTheme = () => {
      // 记录滚动位置用于刷新后恢复（仅本标签页、30 秒内有效）
      try {
        sessionStorage.setItem(
          'biliplus-theme-reload',
          JSON.stringify({ x: window.scrollX, y: window.scrollY, t: Date.now() })
        );
      } catch (e) {}
      // 视频页带上进度参数，刷新后从当前时间继续播放
      const url = new URL(location.href);
      const video = document.querySelector('video');
      if (video && video.currentTime > 5 && /\/(video|bangumi|list)\//.test(url.pathname)) {
        url.searchParams.set('t', Math.floor(video.currentTime));
      }
      location.replace(url.toString());
    };

    // 刷新后恢复滚动位置
    const restoreScroll = () => {
      try {
        const saved = JSON.parse(sessionStorage.getItem('biliplus-theme-reload'));
        sessionStorage.removeItem('biliplus-theme-reload');
        if (saved && Date.now() - saved.t < 30 * 1000) {
          window.scrollTo(saved.x, saved.y);
        }
      } catch (e) {}
    };

    const start = () => {
      applyTheme();

      // 系统深浅色切换：先尝试运行时切类名，若页面出生主题与新主题不一致则需要刷新才能生效
      let bornDark = darkQuery.matches;
      darkQuery.addEventListener('change', () => {
        const nowDark = darkQuery.matches;
        if (nowDark === bornDark) {
          return;
        }
        bornDark = nowDark;
        // 先写好存储再刷新（B站可能服务端就读取），让页面以新主题重新初始化
        syncBiliThemeStorage(nowDark);
        reloadWithTheme();
      });

      // B站自己的脚本会按它记录的偏好改回类名（包括手动点击切换时），发现不一致立即校正回来
      new MutationObserver(applyTheme).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });

      if (document.readyState === 'complete') {
        restoreScroll();
      } else {
        window.addEventListener('load', restoreScroll, { once: true });
      }
    };

    // 正常 document_start 时根元素已存在，个别环境兜底到 DOMContentLoaded
    if (document.documentElement) {
      start();
    } else {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    }
  }
});
