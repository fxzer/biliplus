$(function () {
  $('input[type=checkbox]').each(function () {
    let key = $(this).data('key');
    chrome.storage.sync.get(key, storage => {
      // 未设置过时使用默认值，带 data-default="on" 的功能默认开启
      let checked = storage[key] === undefined ? $(this).data('default') === 'on' : storage[key];
      $(this).attr('checked', checked);
    });

    $(this).change(() => {
      const key = $(this).data('key');
      let checked = $(this).is(':checked');
      const data = {};
      data[key] = checked;
      chrome.storage.sync.set(data, () => {
        console.log('配置保存成功！');
      });
    });
  });

  $('input[type=radio]').each(function () {
    let key = $(this).data('key');
    let value = $(this).val();
    chrome.storage.sync.get(key, storage => {
      // 旧版本无级倍速存的是布尔值，true 兼容视为滑块模式
      let stored = storage[key] === true ? 'slider' : storage[key];
      if (stored === undefined) {
        // 未设置过时使用默认值（带 data-default 的选项）
        stored = $(`input[type=radio][data-key="${key}"][data-default]`).val();
      }
      this.checked = stored === value;
    });

    $(this).change(() => {
      const data = {};
      data[key] = value;
      chrome.storage.sync.set(data, () => {
        console.log('配置保存成功！');
      });
    });
  });
});
