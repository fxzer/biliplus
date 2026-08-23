/**
 * 视频倍速控制
 * 三种模式：
 *   none     无，不做任何修改，保持B站原生倍速按钮
 *   slider   滑块无级变速，用滑块在 0.5x - 5.0x 之间无级调速
 *   dropdown 下拉选择变速，用下拉菜单选择预设倍速（档位比B站原生更全，最高 5.0x）
 * 兼容旧版本的布尔值开关：true 视为 slider
 */

let videoRate = 1.0;

// 下拉模式的预设倍速档位，比B站原生的 0.5x - 2.0x 更全；展示时快的在上、慢的在下
const RATE_OPTIONS = [5.0, 4.0, 3.0, 2.5, 2.0, 1.75, 1.5, 1.25, 1.0, 0.75, 0.5];

chrome.storage.sync.get(['biliplus-enable', 'stepless-video-rate'], storage => {
  if (!storage['biliplus-enable']) {
    return;
  }
  const mode = storage['stepless-video-rate'] === true ? 'slider' : storage['stepless-video-rate'];
  if (mode === 'slider') {
    initRateButton(buildSliderButton());
  } else if (mode === 'dropdown') {
    initRateButton(buildDropdownButton());
  }
});

/**
 * 等待播放器控制栏就绪后，把自定义倍速按钮插到B站原生倍速按钮前面
 */
function initRateButton(rateButtonHTML) {
  document.body.classList.add('biliplus-stepless-video-rate');

  const disconnect = _UTILS.observe(document.body, () => {
    if (document.querySelector('.bpx-player-ctrl-btn.bpx-player-ctrl-playbackrate') == null) {
      return;
    }
    if (document.querySelector('.stepless-video-rate-btn') == null) {
      const playerControl = document.querySelector('.bpx-player-control-bottom-right');
      const oldRateButton = document.querySelector('.bpx-player-ctrl-btn.bpx-player-ctrl-playbackrate');

      const newRateButton = document.createElement('div');
      playerControl.insertBefore(newRateButton, oldRateButton);
      newRateButton.outerHTML = rateButtonHTML;
      bindRateButtonEvents();
    } else {
      disconnect();
    }
  });
}

/**
 * 滑块模式的按钮结构
 */
function buildSliderButton() {
  return `
    <div class="stepless-video-rate-btn" role="button" aria-label="无级倍速" tabindex="0">
      <div class="stepless-video-rate-btn-result">无级倍速</div>
      <div class="stepless-video-rate-box">
        <div class="stepless-video-rate-number">1.0</div>
        <div class="stepless-video-rate-progress bui bui-slider">
          <div class="bui-area">
            <div class="bui-track bui-track-vertical" style="">
              <div class="bui-bar-wrap">
                <div class="bui-bar bui-bar-normal" role="progressbar" style="transform: scaleY(0.2);"></div>
              </div>
              <div class="bui-thumb" style="left: -5px; transform: translateY(-10px);">
                <div class="bui-thumb-dot" style=""></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 下拉模式的按钮结构
 */
function buildDropdownButton() {
  const options = RATE_OPTIONS.map(
    rate => `<div class="stepless-video-rate-option${rate === 1.0 ? ' active' : ''}" data-rate="${rate}">${rate}x</div>`
  ).join('');
  return `
    <div class="stepless-video-rate-btn stepless-video-rate-dropdown" role="button" aria-label="倍速选择" tabindex="0">
      <div class="stepless-video-rate-btn-result">倍速</div>
      <div class="stepless-video-rate-menu">
        ${options}
      </div>
    </div>
  `;
}

/**
 * 按当前按钮类型绑定对应事件
 */
function bindRateButtonEvents() {
  if (document.querySelector('.stepless-video-rate-dropdown') != null) {
    bindDropdownEvents();
  } else {
    bindSliderEvents();
  }
}

function bindDropdownEvents() {
  const container = document.querySelector('.stepless-video-rate-dropdown');
  const menu = container.querySelector('.stepless-video-rate-menu');
  const result = container.querySelector('.stepless-video-rate-btn-result');
  let hideMenuTimeout = null;

  // 悬停展开菜单；移出后延迟 400ms 收起，保证鼠标能从容移进菜单选项里
  container.addEventListener('mouseenter', () => {
    if (hideMenuTimeout != null) {
      clearTimeout(hideMenuTimeout);
    }
    menu.classList.add('display');
  });
  container.addEventListener('mouseleave', () => {
    hideMenuTimeout = setTimeout(() => {
      menu.classList.remove('display');
    }, 400);
  });

  document.querySelectorAll('.stepless-video-rate-option').forEach(option => {
    option.addEventListener('click', () => {
      videoRate = option.dataset.rate;
      document.querySelector('video').playbackRate = videoRate;
      result.innerText = `${option.dataset.rate}x`;
      document.querySelectorAll('.stepless-video-rate-option').forEach(o => o.classList.remove('active'));
      option.classList.add('active');
      // 选中后收起菜单
      menu.classList.remove('display');
    });
  });
}

function bindSliderEvents() {
  let hideBoxTimeout = null;
  var mousePositionY = 0;
  var initialPositionY = -10;

  const box = document.querySelector('.stepless-video-rate-box');
  const dot = document.querySelector('.stepless-video-rate-box .bui-thumb');
  const bar = document.querySelector('.stepless-video-rate-box .bui-bar');
  const rate = document.querySelector('.stepless-video-rate-box .stepless-video-rate-number');

  // 进入 btn 就显示 box
  document.querySelector('#bilibili-player').addEventListener('mouseover', e => {
    const target = e.target;
    if (target.nodeName === 'DIV' && target.parentElement.classList.contains('stepless-video-rate-btn')) {
      showBox();
      if (hideBoxTimeout != null) {
        clearTimeout(hideBoxTimeout);
      }
    }
  });

  // 离开 btn 就消失 box
  document.querySelector('.stepless-video-rate-btn').addEventListener('mouseleave', e => {
    // 防抖 400 ms
    hideBoxTimeout = setTimeout(() => {
      hideBox();
      box.removeEventListener('mousemove', mouseMove);
    }, 400);
  });

  // 进度条逻辑
  let tempPositionY = 0;
  function mouseDown(event) {
    mousePositionY = event.clientY;
    tempPositionY = initialPositionY;
    box.addEventListener('mousemove', mouseMove);
  }

  function mouseMove(event) {
    let deltaY = event.clientY - mousePositionY;

    if (tempPositionY + deltaY < -48 || tempPositionY + deltaY > 0) {
      return;
    }

    initialPositionY = tempPositionY + deltaY;
    dot.style.transform = `translateY(${initialPositionY}px)`;
    bar.style.transform = `scaleY(${Math.abs(initialPositionY) / 48})`;
    videoRate = ((Math.abs(initialPositionY) / 48) * 5).toFixed(1);
    rate.innerText = videoRate;
    document.querySelector('video').playbackRate = videoRate;
  }

  function mouseUp() {
    box.removeEventListener('mousemove', mouseMove);
  }

  dot.addEventListener('mousedown', mouseDown);
  box.addEventListener('mouseup', mouseUp);

  const steplessBtn = document.querySelector('.stepless-video-rate-btn-result');

  // 双击一键回到 1.0x
  steplessBtn.addEventListener('dblclick', () => {
    document.querySelector('video').playbackRate = 1.0;
    videoRate = 1.0;
    document.querySelector('.stepless-video-rate-number').innerText = '1.0';
    document.querySelector('.stepless-video-rate-box .bui-thumb').style.transform = 'translateY(-10px)';
    document.querySelector('.stepless-video-rate-box .bui-bar').style.transform = 'scaleY(0.2)';
    mousePositionY = 0;
    initialPositionY = -10;
  });
}

function showBox() {
  const rateBox = document.querySelector('.stepless-video-rate-box');
  if (rateBox.classList.contains('display')) {
    return;
  }
  rateBox.classList.add('display');
}

function hideBox() {
  const rateBox = document.querySelector('.stepless-video-rate-box');
  if (rateBox.classList.contains('display')) {
    rateBox.classList.remove('display');
  }
}
