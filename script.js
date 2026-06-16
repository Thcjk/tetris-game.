const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const highscoreEl = document.getElementById("highscore");

const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

let board;
let currentPiece;
let nextPiece;

let score = 0;
let level = 1;
let lines = 0;
let highscore = Number(localStorage.getItem("tetrisHighscore")) || 0;

let dropInterval = 1000;
let lastTime = 0;
let dropCounter = 0;

let gameOver = false;
let paused = false;

const COLORS = {
  I: "#00f0f0",
  O: "#f0f000",
  T: "#a000f0",
  S: "#00f000",
  Z: "#f00000",
  J: "#0000f0",
  L: "#f0a000"
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ]
};

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const names = Object.keys(SHAPES);
  const name = names[Math.floor(Math.random() * names.length)];

  return {
    name,
    shape: SHAPES[name],
    color: COLORS[name],
    x: Math.floor(COLS / 2) - 2,
    y: 0
  };
}

function drawBlock(context, x, y, color, size = BLOCK) {
  context.fillStyle = color;
  context.fillRect(x * size, y * size, size, size);

  context.strokeStyle = "#020617";
  context.lineWidth = 2;
  context.strokeRect(x * size, y * size, size, size);
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) {
        drawBlock(ctx, x, y, board[y][x]);
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
      }
    }
  }
}

function drawPiece(piece) {
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawBlock(ctx, piece.x + x, piece.y + y, piece.color);
      }
    });
  });
}

function drawNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);

  const size = 24;
  const offsetX = 1;
  const offsetY = 1;

  nextPiece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawBlock(nextCtx, x + offsetX, y + offsetY, nextPiece.color, size);
      }
    });
  });
}

function collision(piece, offsetX = 0, offsetY = 0, shape = piece.shape) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;

      const newX = piece.x + x + offsetX;
      const newY = piece.y + y + offsetY;

      if (newX < 0 || newX >= COLS || newY >= ROWS) {
        return true;
      }

      if (newY >= 0 && board[newY][newX]) {
        return true;
      }
    }
  }

  return false;
}

function mergePiece() {
  currentPiece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const boardY = currentPiece.y + y;
        const boardX = currentPiece.x + x;

        if (boardY >= 0) {
          board[boardY][boardX] = currentPiece.color;
        }
      }
    });
  });
}

function rotateMatrix(matrix) {
  const size = matrix.length;
  const rotated = [];

  for (let y = 0; y < size; y++) {
    rotated[y] = [];
    for (let x = 0; x < size; x++) {
      rotated[y][x] = matrix[size - 1 - x][y];
    }
  }

  return rotated;
}

function rotatePiece() {
  if (paused || gameOver) return;
  if (currentPiece.name === "O") return;

  const rotated = rotateMatrix(currentPiece.shape);

  if (!collision(currentPiece, 0, 0, rotated)) {
    currentPiece.shape = rotated;
  }
}

function movePiece(direction) {
  if (paused || gameOver) return;

  if (!collision(currentPiece, direction, 0)) {
    currentPiece.x += direction;
  }
}

function dropPiece() {
  if (paused || gameOver) return;

  if (!collision(currentPiece, 0, 1)) {
    currentPiece.y++;
  } else {
    mergePiece();
    clearLines();
    spawnPiece();
  }

  dropCounter = 0;
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== null)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++;
      y++;
    }
  }

  if (cleared > 0) {
    lines += cleared;

    const points = [0, 100, 300, 500, 800];
    score += points[cleared] * level;

    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(120, 1000 - (level - 1) * 90);

    updateUI();
  }
}

function spawnPiece() {
  currentPiece = nextPiece;
  nextPiece = randomPiece();

  currentPiece.x = Math.floor(COLS / 2) - 2;
  currentPiece.y = 0;

  drawNextPiece();

  if (collision(currentPiece)) {
    gameOver = true;
    saveHighscore();
  }
}

function updateUI() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
  highscoreEl.textContent = highscore;
}

function saveHighscore() {
  if (score > highscore) {
    highscore = score;
    localStorage.setItem("tetrisHighscore", highscore);
  }

  updateUI();
}

function togglePause() {
  if (gameOver) return;

  paused = !paused;
  pauseBtn.textContent = paused ? "Fortsetzen" : "Pause";
}

function restartGame() {
  board = createBoard();
  score = 0;
  level = 1;
  lines = 0;
  dropInterval = 1000;
  dropCounter = 0;
  gameOver = false;
  paused = false;

  pauseBtn.textContent = "Pause";

  currentPiece = randomPiece();
  nextPiece = randomPiece();

  updateUI();
  drawNextPiece();
}

function drawOverlay(text) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, canvas.height / 2 - 60, canvas.width, 120);

  ctx.fillStyle = "white";
  ctx.font = "34px Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 12);
}

function draw() {
  drawBoard();
  drawPiece(currentPiece);

  if (paused) {
    drawOverlay("PAUSE");
  }

  if (gameOver) {
    drawOverlay("GAME OVER");
  }
}

function gameLoop(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  if (!paused && !gameOver) {
    dropCounter += deltaTime;

    if (dropCounter > dropInterval) {
      dropPiece();
    }
  }

  draw();
  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    movePiece(-1);
  }

  if (event.key === "ArrowRight") {
    movePiece(1);
  }

  if (event.key === "ArrowDown") {
    dropPiece();
  }

  if (event.key === "ArrowUp") {
    rotatePiece();
  }

  if (event.key === "Escape") {
    togglePause();
  }

  if (event.key.toLowerCase() === "r") {
    restartGame();
  }
});

pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", restartGame);

restartGame();
gameLoop();
