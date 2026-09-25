'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#9bbdff', // J - pale blue
  '#ffb74d', // L - orange
  '#ffffff', // power-up - destroy row
  '#f06292', // Y - challenge
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8]],                                       // power-up
  [[9,0,9],[0,9,0],[0,9,0]],                  // Y - challenge
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const POWERUP_TYPE = 8;
const POWERUP_CHANCE = 0.1;
const Y_TYPE = 9;
const Y_CHANCE = 0.03;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const startRecordsBody = document.getElementById('start-records-body');
const startStatsEl = document.getElementById('start-stats');
const overlayRecordsSection = document.getElementById('overlay-records-section');
const overlayRecordsBody = document.getElementById('overlay-records-body');
const overlayStatsEl = document.getElementById('overlay-stats');
const overlaySaveSection = document.getElementById('overlay-save-section');
const overlayNameInput = document.getElementById('overlay-name-input');
const overlaySaveBtn = document.getElementById('overlay-save-btn');

const THEME_KEY = 'tetris-theme';
const RECORDS_KEY = 'tetris-records';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridLineColor, blockHighlightColor;
let combo, maxComboThisGame, gameStarted;

function updateThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  gridLineColor = styles.getPropertyValue('--grid-line').trim();
  blockHighlightColor = styles.getPropertyValue('--block-highlight').trim();
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggleBtn.textContent = theme === 'light' ? '☀️' : '🌙';
  updateThemeColors();
  if (current) draw();
}

themeToggleBtn.addEventListener('click', () => {
  const newTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, newTheme);
  applyTheme(newTheme);
});

applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return { top: [], bestCombo: 0, maxLines: 0 };
    const data = JSON.parse(raw);
    return {
      top: Array.isArray(data.top) ? data.top : [],
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0,
    };
  } catch (e) {
    return { top: [], bestCombo: 0, maxLines: 0 };
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    // localStorage no disponible; se ignora silenciosamente
  }
}

function qualifiesForTop(candidateScore) {
  const records = loadRecords();
  if (records.top.length < 5) return true;
  return candidateScore > records.top[records.top.length - 1].score;
}

function addRecord(name, recordScore, recordLines, recordCombo, date) {
  const records = loadRecords();
  const entry = { name, score: recordScore, lines: recordLines, combo: recordCombo, date };
  records.top.push(entry);
  records.top.sort((a, b) => b.score - a.score);
  records.top = records.top.slice(0, 5);
  saveRecords(records);
  return { records, entry: records.top.includes(entry) ? entry : null };
}

function updateHistoricStats(finalLines, finalCombo) {
  const records = loadRecords();
  records.bestCombo = Math.max(records.bestCombo, finalCombo);
  records.maxLines = Math.max(records.maxLines, finalLines);
  saveRecords(records);
  return records;
}

function resetRecords() {
  if (!confirm('¿Resetear records?')) return;
  try {
    localStorage.removeItem(RECORDS_KEY);
  } catch (e) {
    // ignorar
  }
  refreshAllRecordsUI();
}

function renderRecordsTable(tbody, records, highlightEntry) {
  tbody.innerHTML = '';
  if (records.top.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'Sin records aún';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  records.top.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (entry === highlightEntry) tr.classList.add('record-highlight');
    const tdPos = document.createElement('td');
    tdPos.textContent = `${i + 1}.`;
    const tdName = document.createElement('td');
    tdName.textContent = entry.name;
    const tdScore = document.createElement('td');
    tdScore.textContent = entry.score.toLocaleString();
    tr.appendChild(tdPos);
    tr.appendChild(tdName);
    tr.appendChild(tdScore);
    tbody.appendChild(tr);
  });
}

function renderStats(el, records) {
  el.textContent = `Mejor combo: ${records.bestCombo}  |  Líneas máx: ${records.maxLines}`;
}

function refreshAllRecordsUI(highlightEntry) {
  const records = loadRecords();
  renderRecordsTable(startRecordsBody, records, null);
  renderStats(startStatsEl, records);
  renderRecordsTable(overlayRecordsBody, records, highlightEntry || null);
  renderStats(overlayStatsEl, records);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const roll = Math.random();
  const type = roll < POWERUP_CHANCE ? POWERUP_TYPE
    : roll < POWERUP_CHANCE + Y_CHANCE ? Y_TYPE
    : Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function applyLineScore(cleared) {
  if (!cleared) return;
  lines += cleared;
  score += (LINE_SCORES[cleared] || 0) * level;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  updateHUD();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  applyLineScore(cleared);
  return cleared;
}

function destroyRow(r) {
  board.splice(r, 1);
  board.unshift(new Array(COLS).fill(0));
  applyLineScore(1);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  let clearedCount = 0;
  if (current.type === POWERUP_TYPE) {
    destroyRow(current.y);
    clearedCount = 1;
  } else {
    merge();
    clearedCount = clearLines();
  }
  if (clearedCount > 0) {
    combo++;
    if (combo > maxComboThisGame) maxComboThisGame = combo;
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = blockHighlightColor;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (colorIndex === POWERUP_TYPE) {
    context.fillStyle = '#e53935';
    context.font = `bold ${size * 0.7}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('✦', x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  updateHistoricStats(lines, maxComboThisGame);

  const qualifies = qualifiesForTop(score);
  refreshAllRecordsUI(null);
  overlayRecordsSection.classList.remove('hidden');

  if (qualifies) {
    overlaySaveSection.classList.remove('hidden');
    overlayNameInput.value = '';
    overlayNameInput.focus();
  } else {
    overlaySaveSection.classList.add('hidden');
  }

  overlay.classList.remove('hidden');
}

function saveCurrentScore() {
  const name = overlayNameInput.value.trim().slice(0, 20) || 'Jugador';
  const date = new Date().toISOString();
  const { records, entry } = addRecord(name, score, lines, maxComboThisGame, date);
  renderRecordsTable(overlayRecordsBody, records, entry);
  renderStats(overlayStatsEl, records);
  renderRecordsTable(startRecordsBody, records, null);
  renderStats(startStatsEl, records);
  overlaySaveSection.classList.add('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  combo = 0;
  maxComboThisGame = 0;
  gameStarted = true;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  startScreen.classList.add('hidden');
  overlay.classList.add('hidden');
  overlayRecordsSection.classList.add('hidden');
  overlaySaveSection.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!gameStarted) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

function handleRestartClick() {
  if (gameOver && !overlaySaveSection.classList.contains('hidden')) {
    if (!confirm('Tienes una puntuación que entra en el top 5 sin guardar. ¿Reiniciar sin guardar?')) return;
  }
  init();
}

restartBtn.addEventListener('click', handleRestartClick);
playBtn.addEventListener('click', init);
resetRecordsBtn.addEventListener('click', resetRecords);
overlaySaveBtn.addEventListener('click', saveCurrentScore);

gameStarted = false;
refreshAllRecordsUI();
startScreen.classList.remove('hidden');
