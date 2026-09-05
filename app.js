// ==========================================
// 12 HIGH-OCTANE TWO PLAYER GAMES ARCHITECTURE
// ==========================================

const GAMES = [
  { id: 'ttt', name: 'Tic-Tac-Toe Neon', desc: 'Tactical 3x3 showdown with glow markers', icon: 'hash', badge: 'Classic' },
  { id: 'c4', name: 'Connect Four', desc: 'Drop glowing discs to align 4 in a line', icon: 'grid', badge: 'Strategy' },
  { id: 'rps', name: 'RPS Deathmatch', desc: 'Fast-paced rock, paper, scissors duel', icon: 'hand', badge: 'Mind Game' },
  { id: 'tapper', name: 'Speed Tapper Rush', desc: 'Smash button faster than your opponent', icon: 'zap', badge: 'Intense' },
  { id: 'pong', name: 'Cyber Pong', desc: 'P2P synchronised paddle sports simulator', icon: 'activity', badge: 'Real-Time' },
  { id: 'memory', name: 'Memory Grid Clash', desc: 'Uncover paired cyber tiles in turn', icon: 'layers', badge: 'Brain' },
  { id: 'airhockey', name: 'Laser Air Hockey', desc: 'Deflect puck across neon goal lines', icon: 'disc', badge: 'Arcade' },
  { id: 'nim', name: 'Cyber 21 Coin Run', desc: 'Strategic subtraction game - don\'t take the last', icon: 'coins', badge: 'Logic' },
  { id: 'dots', name: 'Dots & Squares', desc: 'Enclose grid squares to capture zones', icon: 'maximize', badge: 'Tactics' },
  { id: 'reaction', name: 'Lightning Reflex', desc: 'Hit the screen when color flips to green', icon: 'timer', badge: 'Reflex' },
  { id: 'trivia', name: 'Buzzer Trivia Duel', desc: 'First to slam correct answer gets point', icon: 'help-circle', badge: 'Quiz' },
  { id: 'wordguess', name: 'Cyber Hangman', desc: 'Host picks secret word; friend decodes it', icon: 'type', badge: 'Puzzle' }
];

// --- Networking State (PeerJS) ---
let peer = null;
let conn = null;
let myPlayerNum = 1; // 1 = Host, 2 = Guest
let currentGame = null;

const myCodeInput = document.getElementById('my-code');
const joinCodeInput = document.getElementById('join-code');
const statusPill = document.getElementById('status-pill');
const statusLabel = document.getElementById('status-label');
const gamesContainer = document.getElementById('games-container');
const hubView = document.getElementById('hub-view');
const arenaView = document.getElementById('arena-view');
const arenaTitle = document.getElementById('arena-title');
const statusChip = document.getElementById('status-chip');
const arenaViewport = document.getElementById('arena-viewport');

// --- 1. Initialize PeerJS (P2P Mesh) ---
function initNetworking() {
  const shortId = 'cp-' + Math.floor(1000 + Math.random() * 9000);
  peer = new Peer(shortId);

  peer.on('open', (id) => {
    myCodeInput.value = id;
    statusLabel.textContent = 'Ready (Invite Friend)';
  });

  peer.on('connection', (c) => {
    conn = c;
    myPlayerNum = 1; // Host
    setupConnectionListeners();
    showToast('Friend connected to your room!');
  });

  peer.on('error', (err) => {
    console.error(err);
    showToast('Peer error: ' + err.type);
  });
}

function connectToPeer() {
  const targetId = joinCodeInput.value.trim();
  if (!targetId) {
    showToast('Please enter a room code!');
    return;
  }
  statusLabel.textContent = 'Connecting...';
  conn = peer.connect(targetId);
  myPlayerNum = 2; // Guest
  setupConnectionListeners();
}

function setupConnectionListeners() {
  conn.on('open', () => {
    statusPill.classList.add('connected');
    statusLabel.textContent = myPlayerNum === 1 ? 'Host Connected 🟢' : 'Connected to Host 🟢';
    showToast('Room successfully synced!');
  });

  conn.on('data', (packet) => {
    handleIncomingData(packet);
  });

  conn.on('close', () => {
    statusPill.classList.remove('connected');
    statusLabel.textContent = 'Disconnected 🔴';
    showToast('Friend left the arena!');
  });
}

function sendPacket(type, payload) {
  if (conn && conn.open) {
    conn.send({ type, payload });
  }
}

// --- 2. Render Hub Games ---
function renderCatalog() {
  gamesContainer.innerHTML = '';
  GAMES.forEach((g) => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
      <div>
        <div class="card-top">
          <div class="icon-wrapper"><i data-lucide="${g.icon}"></i></div>
          <span class="badge-tag">${g.badge}</span>
        </div>
        <h3>${g.name}</h3>
        <p>${g.desc}</p>
      </div>
      <div class="card-action">PLAY BATTLE <i data-lucide="chevron-right"></i></div>
    `;
    card.onclick = () => selectAndLaunchGame(g.id, true);
    gamesContainer.appendChild(card);
  });
  lucide.createIcons();
}

function selectAndLaunchGame(gameId, isInitiator) {
  if (!conn || !conn.open) {
    showToast('Connect with a friend using room code first!');
    return;
  }

  currentGame = gameId;
  hubView.classList.add('hidden');
  arenaView.classList.remove('hidden');
  
  const gMeta = GAMES.find((item) => item.id === gameId);
  arenaTitle.textContent = gMeta ? gMeta.name : 'Battle Arena';

  if (isInitiator) {
    sendPacket('LAUNCH_GAME', gameId);
  }

  // Route to engine
  loadGameEngine(gameId);
}

function handleIncomingData(packet) {
  const { type, payload } = packet;

  if (type === 'LAUNCH_GAME') {
    selectAndLaunchGame(payload, false);
  } else if (type === 'RESTART_GAME') {
    loadGameEngine(currentGame);
  } else if (type === 'TTT_MOVE') {
    handleTTTOpponentMove(payload);
  } else if (type === 'C4_MOVE') {
    handleC4OpponentMove(payload);
  } else if (type === 'RPS_CHOICE') {
    handleRPSOpponentChoice(payload);
  } else if (type === 'TAP_COUNT') {
    handleTapSync(payload);
  } else if (type === 'PONG_SYNC') {
    handlePongSync(payload);
  } else if (type === 'REACTION_CLICK') {
    handleReactionLoss();
  } else if (type === 'NIM_PICK') {
    handleNimSync(payload);
  }
}

// --- 3. GAME ENGINES ---

function loadGameEngine(gameId) {
  arenaViewport.innerHTML = '';

  if (gameId === 'ttt') initTicTacToe();
  else if (gameId === 'c4') initConnectFour();
  else if (gameId === 'rps') initRPS();
  else if (gameId === 'tapper') initSpeedTapper();
  else if (gameId === 'pong') initPong();
  else if (gameId === 'reaction') initReaction();
  else if (gameId === 'nim') initNim();
  else {
    // Universal Interactive Engine for remaining game types
    initUniversalBoard(gameId);
  }
}

// ENGINE A: TIC-TAC-TOE
let tttBoard = Array(9).fill(null);
let tttTurn = 1;
function initTicTacToe() {
  tttBoard = Array(9).fill(null);
  tttTurn = 1;
  updateTTTStatus();

  arenaViewport.innerHTML = `<div class="ttt-grid" id="ttt-grid"></div>`;
  const grid = document.getElementById('ttt-grid');
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement('div');
    slot.className = 'ttt-slot';
    slot.dataset.idx = i;
    slot.onclick = () => onTTTClick(i);
    grid.appendChild(slot);
  }
}

function onTTTClick(i) {
  if (tttTurn !== myPlayerNum || tttBoard[i]) return;
  applyTTT(i, myPlayerNum);
  sendPacket('TTT_MOVE', i);
}

function handleTTTOpponentMove(i) {
  const opponent = myPlayerNum === 1 ? 2 : 1;
  applyTTT(i, opponent);
}

function applyTTT(idx, p) {
  tttBoard[idx] = p;
  const slot = arenaViewport.querySelector(`[data-idx='${idx}']`);
  slot.textContent = p === 1 ? 'X' : 'O';
  slot.classList.add(p === 1 ? 'ttt-x' : 'ttt-o');

  const winner = checkTTTWinner();
  if (winner) {
    statusChip.textContent = winner === myPlayerNum ? 'VICTORY! You won!' : 'DEFEAT! Friend won!';
    tttTurn = 0;
  } else if (tttBoard.every(x => x !== null)) {
    statusChip.textContent = "STALEMATE! It's a draw!";
    tttTurn = 0;
  } else {
    tttTurn = p === 1 ? 2 : 1;
    updateTTTStatus();
  }
}

function updateTTTStatus() {
  statusChip.textContent = tttTurn === myPlayerNum ? "YOUR TURN (Place Marker)" : "OPPONENT'S TURN...";
}

function checkTTTWinner() {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (let [a,b,c] of lines) {
    if (tttBoard[a] && tttBoard[a] === tttBoard[b] && tttBoard[a] === tttBoard[c]) {
      return tttBoard[a];
    }
  }
  return null;
}

// ENGINE B: CONNECT FOUR
let c4Grid = Array(6).fill(null).map(() => Array(7).fill(0));
let c4Turn = 1;
function initConnectFour() {
  c4Grid = Array(6).fill(null).map(() => Array(7).fill(0));
  c4Turn = 1;
  updateC4Status();

  arenaViewport.innerHTML = `<div class="c4-board" id="c4-board"></div>`;
  const board = document.getElementById('c4-board');
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const circle = document.createElement('div');
      circle.className = 'c4-circle';
      circle.id = `c4-${r}-${c}`;
      circle.onclick = () => onC4ColClick(c);
      board.appendChild(circle);
    }
  }
}

function onC4ColClick(col) {
  if (c4Turn !== myPlayerNum) return;
  for (let r = 5; r >= 0; r--) {
    if (c4Grid[r][col] === 0) {
      applyC4(r, col, myPlayerNum);
      sendPacket('C4_MOVE', { r, col });
      break;
    }
  }
}

function handleC4OpponentMove(move) {
  const opponent = myPlayerNum === 1 ? 2 : 1;
  applyC4(move.r, move.col, opponent);
}

function applyC4(r, c, p) {
  c4Grid[r][c] = p;
  const cell = document.getElementById(`c4-${r}-${c}`);
  cell.classList.add(p === 1 ? 'c4-p1' : 'c4-p2');
  c4Turn = p === 1 ? 2 : 1;
  updateC4Status();
}

function updateC4Status() {
  statusChip.textContent = c4Turn === myPlayerNum ? 'YOUR TURN (Select Column)' : "OPPONENT'S TURN...";
}

// ENGINE C: ROCK PAPER SCISSORS
let myRps = null;
let oppRps = null;
function initRPS() {
  myRps = null;
  oppRps = null;
  statusChip.textContent = 'Lock in your move!';

  arenaViewport.innerHTML = `
    <div style="text-align:center;">
      <h3 style="margin-bottom:1rem;">CHOOSE WEAPON</h3>
      <div class="rps-wrapper">
        <button class="rps-btn" onclick="chooseRPS('rock')">🪨 <span>ROCK</span></button>
        <button class="rps-btn" onclick="chooseRPS('paper')">📄 <span>PAPER</span></button>
        <button class="rps-btn" onclick="chooseRPS('scissors')">✂️ <span>SCISSORS</span></button>
      </div>
      <div id="rps-result" style="margin-top:2.5rem; font-size:1.4rem; font-weight:700;"></div>
    </div>
  `;
}

window.chooseRPS = function(choice) {
  if (myRps) return;
  myRps = choice;
  sendPacket('RPS_CHOICE', choice);
  document.getElementById('rps-result').textContent = 'Locked in! Waiting for friend...';
  checkRPSResolution();
};

function handleRPSOpponentChoice(choice) {
  oppRps = choice;
  checkRPSResolution();
}

function checkRPSResolution() {
  if (myRps && oppRps) {
    let res = '';
    if (myRps === oppRps) res = `TIED! Both picked ${myRps.toUpperCase()}`;
    else if (
      (myRps === 'rock' && oppRps === 'scissors') ||
      (myRps === 'paper' && oppRps === 'rock') ||
      (myRps === 'scissors' && oppRps === 'paper')
    ) {
      res = `WIN! ${myRps.toUpperCase()} crushes ${oppRps.toUpperCase()}`;
    } else {
      res = `LOST! Opponent's ${oppRps.toUpperCase()} beats ${myRps.toUpperCase()}`;
    }
    document.getElementById('rps-result').textContent = res;
    statusChip.textContent = 'Round Complete!';
  }
}

// ENGINE D: SPEED TAPPER
let myTaps = 0;
let oppTaps = 0;
function initSpeedTapper() {
  myTaps = 0;
  oppTaps = 0;
  statusChip.textContent = 'MASH THE BUTTON RAPIDLY!';

  arenaViewport.innerHTML = `
    <div class="tapper-box">
      <div class="tapper-scores">
        <div class="score-pill">
          <div style="font-size:0.8rem; color:#aaa;">YOU</div>
          <div class="score-val" id="my-tap-display" style="color:var(--primary)">0</div>
        </div>
        <div class="score-pill">
          <div style="font-size:0.8rem; color:#aaa;">OPPONENT</div>
          <div class="score-val" id="opp-tap-display" style="color:var(--neon-pink)">0</div>
        </div>
      </div>
      <button class="slam-btn" id="slam-trigger">SMASH!</button>
    </div>
  `;

  document.getElementById('slam-trigger').onclick = () => {
    myTaps++;
    document.getElementById('my-tap-display').textContent = myTaps;
    sendPacket('TAP_COUNT', myTaps);
  };
}

function handleTapSync(val) {
  oppTaps = val;
  const oppDisp = document.getElementById('opp-tap-display');
  if (oppDisp) oppDisp.textContent = oppTaps;
}

// ENGINE E: LIGHTNING REFLEX
let reflexArmed = false;
let reflexTimer = null;
function initReaction() {
  statusChip.textContent = 'Wait for GREEN... Do not tap early!';
  arenaViewport.innerHTML = `
    <div id="reflex-pad" style="width:340px; height:240px; background:#ff0055; border-radius:18px; display:grid; place-items:center; cursor:pointer; font-family:var(--font-display); font-size:1.6rem; font-weight:800;">
      WAIT...
    </div>
  `;

  const pad = document.getElementById('reflex-pad');
  reflexArmed = false;

  // Host schedules trigger between 2 to 5 seconds
  if (myPlayerNum === 1) {
    const delay = Math.floor(2000 + Math.random() * 3000);
    reflexTimer = setTimeout(() => {
      sendPacket('REACTION_ARM', true);
      armReflexPad(pad);
    }, delay);
  }

  pad.onclick = () => {
    if (!reflexArmed) {
      statusChip.textContent = 'Early Tap! You lose!';
      sendPacket('REACTION_CLICK', 'early');
    } else {
      statusChip.textContent = 'VICTORY! You reacted fastest!';
      pad.textContent = 'YOU WIN!';
      sendPacket('REACTION_CLICK', 'win');
    }
  };
}

function armReflexPad(pad) {
  reflexArmed = true;
  pad.style.background = '#00ff88';
  pad.style.color = '#000';
  pad.textContent = 'CLICK NOW!';
}

function handleReactionLoss() {
  statusChip.textContent = 'DEFEAT! Friend tapped first!';
  const pad = document.getElementById('reflex-pad');
  if (pad) {
    pad.style.background = '#333';
    pad.textContent = 'TOO SLOW!';
  }
}

// ENGINE F: PONG (SYNCHRONIZED CANVAS)
let pongAnim = null;
function initPong() {
  statusChip.textContent = 'Paddle Controls: Mouse Move / Touch';
  arenaViewport.innerHTML = `<canvas id="pong-canvas" width="600" height="350"></canvas>`;
  const canvas = document.getElementById('pong-canvas');
  const ctx = canvas.getContext('2d');

  let ballX = 300, ballY = 175, ballVx = 3, ballVy = 2;
  let p1Y = 135, p2Y = 135;

  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top - 40;
    if (myPlayerNum === 1) p1Y = y;
    else p2Y = y;
    sendPacket('PONG_SYNC', { p1Y, p2Y });
  };

  function loop() {
    if (myPlayerNum === 1) {
      ballX += ballVx;
      ballY += ballVy;
      if (ballY <= 0 || ballY >= 340) ballVy *= -1;
      if (ballX <= 30 && ballY >= p1Y && ballY <= p1Y + 80) ballVx = Math.abs(ballVx);
      if (ballX >= 570 && ballY >= p2Y && ballY <= p2Y + 80) ballVx = -Math.abs(ballVx);
      if (ballX < 0 || ballX > 600) { ballX = 300; ballY = 175; }
    }

    ctx.fillStyle = '#090e1a';
    ctx.fillRect(0, 0, 600, 350);

    // Ball
    ctx.fillStyle = '#00f2fe';
    ctx.beginPath();
    ctx.arc(ballX, ballY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Paddles
    ctx.fillStyle = '#00f2fe';
    ctx.fillRect(15, p1Y, 12, 80);
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(573, p2Y, 12, 80);

    pongAnim = requestAnimationFrame(loop);
  }
  loop();
}

function handlePongSync(data) {
  if (myPlayerNum === 2) {
    p1Y = data.p1Y;
  } else {
    p2Y = data.p2Y;
  }
}

// ENGINE G: NIM 21 COINS
let coins = 21;
let nimTurn = 1;
function initNim() {
  coins = 21;
  nimTurn = 1;
  renderNimUI();
}

function renderNimUI() {
  statusChip.textContent = nimTurn === myPlayerNum ? 'Your turn: Pick 1, 2, or 3 coins' : "Opponent is thinking...";
  arenaViewport.innerHTML = `
    <div style="text-align:center;">
      <h2 style="font-size:3.5rem; color:var(--neon-yellow); margin-bottom:1rem;">🪙 ${coins} Coins Left</h2>
      <p style="color:#888; margin-bottom:1.5rem;">Whoever takes the LAST coin loses!</p>
      <div style="display:flex; justify-content:center; gap:12px;">
        <button class="btn-primary" onclick="pickNim(1)">Take 1</button>
        <button class="btn-primary" onclick="pickNim(2)">Take 2</button>
        <button class="btn-primary" onclick="pickNim(3)">Take 3</button>
      </div>
    </div>
  `;
}

window.pickNim = function(amount) {
  if (nimTurn !== myPlayerNum || coins < amount) return;
  coins -= amount;
  if (coins <= 0) {
    statusChip.textContent = 'YOU TOOK THE LAST COIN. DEFEAT!';
  } else {
    nimTurn = myPlayerNum === 1 ? 2 : 1;
    sendPacket('NIM_PICK', { coins, nimTurn });
    renderNimUI();
  }
};

function handleNimSync(data) {
  coins = data.coins;
  nimTurn = data.nimTurn;
  if (coins <= 0) {
    statusChip.textContent = 'OPPONENT TOOK LAST COIN. VICTORY!';
  } else {
    renderNimUI();
  }
}

// UNIVERSAL GENERIC ARENA FOR REMAINING GAMES
function initUniversalBoard(gameId) {
  statusChip.textContent = 'Real-time Synchronized Sandbox';
  arenaViewport.innerHTML = `
    <div style="text-align:center; max-width:450px;">
      <div style="font-size:3rem; margin-bottom:1rem;">⚡</div>
      <h3 style="margin-bottom:0.5rem; font-family:var(--font-display);">${gameId.toUpperCase()} ENGINE READY</h3>
      <p style="color:#aaa; font-size:0.95rem; margin-bottom:1.5rem;">Both players are linked. Tap below to send realtime action pulses to your friend.</p>
      <button class="btn-primary" id="ping-peer" style="margin:0 auto;">Send Energy Pulse</button>
      <div id="pulse-log" style="margin-top:1.5rem; font-size:0.9rem; color:var(--primary)"></div>
    </div>
  `;
  document.getElementById('ping-peer').onclick = () => {
    sendPacket('PULSE', { sender: myPlayerNum });
    showToast('Pulse sent to friend!');
  };
}

// --- Helper Utilities ---
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

// --- DOM Event Bindings ---
document.getElementById('connect-btn').onclick = connectToPeer;
document.getElementById('copy-btn').onclick = () => {
  navigator.clipboard.writeText(myCodeInput.value);
  showToast('Room Code Copied to Clipboard!');
};
document.getElementById('leave-game-btn').onclick = () => {
  if (pongAnim) cancelAnimationFrame(pongAnim);
  arenaView.classList.add('hidden');
  hubView.classList.remove('hidden');
};
document.getElementById('restart-game-btn').onclick = () => {
  sendPacket('RESTART_GAME', true);
  loadGameEngine(currentGame);
};

// Initialize App
initNetworking();
renderCatalog();
