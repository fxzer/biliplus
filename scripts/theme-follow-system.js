/**
 * 主题跟随系统深浅色自动切换
 * 需求背景：B站虽然有夜间模式和亮色模式，但不会跟随系统的深浅色设置自动切换
 * 解决方案：监听系统 prefers-color-scheme 变化，实时切换 B站的夜间模式
 * 说明：B站的夜间状态存在多套标记（night-mode / bili_dark / dark 类名，theme_style 存储），
 *       不同页面与账号版本使用的组合不同，因此全部一起同步，保证处处生效
 */

chrome.storage.sync.get(['biliplus-enable', 'theme-follow-system'], storage => {
  // 默认开启：只要没有显式关闭过就生效
  if (storage['biliplus-enable'] && storage['theme-follow-system'] !== false) {
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = darkQuery.matches;
      const theme = isDark ? 'dark' : 'light';

      // 同步 B站自己的主题存储，让它的脚本初始化时读到的就是系统主题，避免加载后被改回去
      if (!document.cookie.includes(`theme_style=${theme}`)) {
        document.cookie = `theme_style=${theme}; domain=.bilibili.com; path=/; max-age=${365 * 24 * 60 * 60}`;
      }
      try {
        if (localStorage.getItem('theme_style') !== theme) {
          localStorage.setItem('theme_style', theme);
        }
      } catch (e) {}

      // 新旧几套夜间模式的类名一起切换
      ['night-mode', 'bili_dark', 'dark'].forEach(className => {
        document.documentElement.classList.toggle(className, isDark);
      });
    };

    const start = () => {
      applyTheme();

      // 系统深浅色切换时免刷新实时跟随
      darkQuery.addEventListener('change', applyTheme);

      // B站自己的脚本会按它记录的偏好改回类名（包括手动点击切换时），发现不一致立即校正回来
      new MutationObserver(applyTheme).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });
    };

    // 正常 document_start 时根元素已存在，个别环境兜底到 DOMContentLoaded
    if (document.documentElement) {
      start();
    } else {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    }
  }
});
