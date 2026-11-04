import { t, onLocaleChange } from './i18n.js';

export const AI_CSV_PROMPT = `添付した写真から単語カードのデータを読み取り、次の形式のCSVをコードブロックで出力してください。
- 1行目は「表,裏」というヘッダーにする
- 1行に1枚とし、1列目を表面（単語・問題）、2列目を裏面（意味・答え）にする
- カンマ・改行・ダブルクォートを含む項目は全体を "..." で囲み、項目内の " は "" と重ねる
- 数式は $...$、化学式は \\ce{...} の形式で書く
- 読み取れない箇所は推測で埋めず、CSVの後に一覧で知らせる`;

let revertTimer = null;

export function handleCopy() {
  const button = document.getElementById('ai-prompt-copy');
  const status = document.getElementById('ai-copy-status');
  const details = document.getElementById('ai-prompt-details');

  const showFailure = () => {
    if (status) {
      status.textContent = t('ai.copyFailed');
    }
    if (details) {
      details.open = true;
    }
  };

  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    showFailure();
    return;
  }

  navigator.clipboard.writeText(t('ai.prompt')).then(
    () => {
      if (status) {
        status.textContent = '';
      }
      if (button) {
        if (revertTimer) {
          clearTimeout(revertTimer);
        }
        button.textContent = t('ai.copied');
        revertTimer = setTimeout(() => {
          button.textContent = t('ai.copy');
          revertTimer = null;
        }, 2000);
      }
    },
    () => {
      showFailure();
    }
  );
}

export function renderAiGuide() {
  const pre = document.getElementById('ai-prompt-text');
  if (pre) {
    pre.textContent = t('ai.prompt');
  }

  const button = document.getElementById('ai-prompt-copy');
  if (button && !revertTimer) {
    button.textContent = t('ai.copy');
  }
}

export function initAiGuide() {
  renderAiGuide();

  const button = document.getElementById('ai-prompt-copy');
  if (button) {
    button.addEventListener('click', handleCopy);
  }

  onLocaleChange(() => {
    renderAiGuide();
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAiGuide);
  } else {
    initAiGuide();
  }
}
