/**
 * worker/calculator.js
 * Self-contained ETB calculator widget. No external dependencies.
 */

let display = '0', prev = null, operator = null, fresh = false;

const KEYS   = ['C','7','8','9','÷','4','5','6','×','1','2','3','−','0','.','=','+'];
const OP_KEYS = new Set(['=','+','−','×','÷']);

function updateDisplay() {
  document.getElementById('calcDisplay').textContent = display;
}

function handleKey(key) {
  if (key === 'C') {
    display = '0'; prev = null; operator = null; fresh = false;
  } else if (OP_KEYS.has(key) && key !== '=') {
    prev = Number(display); operator = key; fresh = true;
  } else if (key === '=') {
    if (prev !== null && operator) {
      const a = prev, b = Number(display);
      let result;
      switch (operator) {
        case '+': result = a + b; break;
        case '−': result = a - b; break;
        case '×': result = a * b; break;
        case '÷': result = b === 0 ? NaN : a / b; break;
        default:  result = b;
      }
      display = Number.isFinite(result) ? String(Number(result.toFixed(6))) : 'Error';
      prev = null; operator = null; fresh = true;
    }
  } else if (key === '.') {
    if (!fresh && !display.includes('.')) display += '.';
  } else if (/^\d$/.test(key)) {
    if (fresh || display === '0' || display === 'Error') { display = key; fresh = false; }
    else display += key;
  }
  updateDisplay();
}

export function initCalculator() {
  const container = document.getElementById('calcKeys');
  container.innerHTML = KEYS.map(k =>
    `<button data-key="${k}" class="${OP_KEYS.has(k) ? 'primary' : ''}">${k}</button>`
  ).join('');
  container.addEventListener('click', e => {
    const key = e.target.dataset.key;
    if (key) handleKey(key);
  });
  updateDisplay();
}
