/* ===========================
   Ludo – Modern Local Build
   Features:
   - Login Gate (code 808580)
   - Themes + Smooth Pawn Animation + Glow
   - 3D-feel Dice with vibration
   - Scoreboard (cuts + home) + team totals
   - Single mode (4 colors) OR Team mode (R+Y vs G+B)
   - Local only (no backend)
   =========================== */

(function(){
  // ---------- DOM ----------
  const $ = (q, ctx=document) => ctx.querySelector(q);
  const $$ = (q, ctx=document) => Array.from(ctx.querySelectorAll(q));

  const gate = $('#login-gate');
  const gateInput = $('#gate-code');
  const gateBtn = $('#gate-btn');
  const gateErr = $('#gate-err');

  const themeSelect = $('#theme-select');
  const modeSelect = $('#mode-select');
  const playersSelect = $('#players-select');
  const newGameBtn = $('#new-game');
  const resetScoresBtn = $('#reset-scores');
  const fullscreenBtn = $('#fullscreen');
  const soundToggle = $('#sound-toggle');

  const boardEl = $('#board');
  const diceWrap = $('#dice-wrap');
  const diceEl = $('#dice');
  const rollBtn = $('#roll');
  const rollHint = $('#roll-hint');
  const turnName = $('#turn-name');
  const modePill = $('#mode-pill');

  // Scores elements
  const scoreEl = {
    R: $('#scr-R'), G: $('#scr-G'), Y: $('#scr-Y'), B: $('#scr-B'),
    cutR: $('#cut-R'), cutG: $('#cut-G'), cutY: $('#cut-Y'), cutB: $('#cut-B'),
    homeR: $('#home-R'), homeG: $('#home-G'), homeY: $('#home-Y'), homeB: $('#home-B'),
    teamRY: $('#scr-RY'), teamGB: $('#scr-GB')
  };

  // ---------- State ----------
  const ACCESS_CODE = '808580';
  const COLORS = ['R','G','Y','B'];
  const COLOR_NAME = { R:'Red', G:'Green', Y:'Yellow', B:'Blue' };
  const COLOR_CLASS = { R:'red', G:'green', Y:'yellow', B:'blue' };
  let SOUND = true;

  // Board model (simple linear track for demo; replaceable with your existing path if needed)
  const TRACK_SIZE = 52; // classic ludo perimeter (simplified)
  const HOME_STEPS = 6;

  // Per-player state
  const makePlayer = (id) => ({
    id, name: COLOR_NAME[id], class: COLOR_CLASS[id],
    pawns: [
      { pos: -1, home:false, el:null },
      { pos: -1, home:false, el:null },
      { pos: -1, home:false, el:null },
      { pos: -1, home:false, el:null }
    ],
    entry: entryIndex(id), // starting index on global track
    homeIndex: null, // handled with 'home steps' in a side lane (abstracted)
    score: 0, cuts:0, homes:0, active:false
  });

  // Game state root
  const State = {
    theme: localStorage.getItem('ludo:theme') || 'neon',
    mode: localStorage.getItem('ludo:mode') || 'single', // 'single' | 'team'
    playersCount: +(localStorage.getItem('ludo:players') || 4),
    players: [],
    turnIdx: 0,
    rolled: null,
    cells: [], // DOM refs for cells
    track: [], // indexes for simple track (0..TRACK_SIZE-1)
    safeCells: new Set([1,9,14,22,27,35,40,48]), // sample safe cells
  };

  // ---------- Login Gate ----------
  function unlockIfValid(){
    const v = (gateInput.value || '').trim();
    if(v === ACCESS_CODE){
      gate.classList.remove('show');
      localStorage.setItem('ludo:access','yes');
    } else {
      gateErr.textContent = 'Wrong code';
      shake(gate);
    }
  }
  gateBtn.addEventListener('click', unlockIfValid);
  gateInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') unlockIfValid();
  });

  // Gate autounlock if previously ok
  if(localStorage.getItem('ludo:access') === 'yes'){
    gate.classList.remove('show');
  }

  // ---------- Theme ----------
  function applyTheme(name){
    document.body.classList.remove('theme-classic','theme-wood','theme-dark');
    if(name === 'classic') document.body.classList.add('theme-classic');
    else if(name === 'wood') document.body.classList.add('theme-wood');
    else if(name === 'dark') document.body.classList.add('theme-dark');
    else document.body.classList.remove('theme-classic','theme-wood','theme-dark'); // neon default
  }
  themeSelect.value = State.theme;
  applyTheme(State.theme);
  themeSelect.addEventListener('change', ()=>{
    State.theme = themeSelect.value;
    localStorage.setItem('ludo:theme', State.theme);
    applyTheme(State.theme);
  });

  // ---------- Mode / Players ----------
  modeSelect.value = State.mode;
  modePill.textContent = State.mode === 'team' ? 'Teams' : 'Single';
  modeSelect.addEventListener('change', ()=>{
    State.mode = modeSelect.value;
    modePill.textContent = State.mode === 'team' ? 'Teams' : 'Single';
    localStorage.setItem('ludo:mode', State.mode);
  });

  playersSelect.value = String(State.playersCount);
  playersSelect.addEventListener('change', ()=>{
    State.playersCount = +playersSelect.value;
    localStorage.setItem('ludo:players', String(State.playersCount));
  });

  // ---------- Fullscreen / Sound ----------
  fullscreenBtn.addEventListener('click', ()=>{
    if(!document.fullscreenElement){
      document.documentElement.requestFullscreen?.();
    }else{
      document.exitFullscreen?.();
    }
  });
  soundToggle.addEventListener('click', ()=>{
    SOUND = !SOUND;
    soundToggle.textContent = SOUND ? '🔈' : '🔇';
  });

  // ---------- New Game ----------
  newGameBtn.addEventListener('click', ()=>startNewGame());
  resetScoresBtn.addEventListener('click', ()=>{
    for(const p of State.players){
      p.score = 0; p.cuts=0; p.homes=0;
    }
    updateScoreUI();
  });

  // ---------- Board Build ----------
  function buildBoard(){
    boardEl.innerHTML = '';
    State.cells = [];
    State.track = [];
    // Create a 13x13 grid (with margins defined in CSS grid-template); we will only build playable ring cells
    // For simplicity here we build 52 sequential cells as inline grid children
    const grid = document.createDocumentFragment();
    for(let i=0;i<TRACK_SIZE;i++){
      const c = document.createElement('div');
      c.className = 'cell' + (State.safeCells.has(i) ? ' safe' : '');
      c.dataset.idx = i;
      grid.appendChild(c);
      State.cells.push(c);
      State.track.push(i);
    }
    boardEl.appendChild(grid);
  }

  // ---------- Players & Pawns ----------
  function createPlayers(){
    State.players = [];
    const use = COLORS.slice(0, State.playersCount);
    for(const id of use){
      const p = makePlayer(id);
      State.players.push(p);
    }
    // Render pawns at base (-1) visually near each color cluster (we place them on top-left off-board positions)
    for(const p of State.players){
      for(let i=0;i<4;i++){
        const el = document.createElement('div');
        el.className = `pawn ${p.class}`;
        el.dataset.player = p.id;
        el.dataset.idx = String(i);
        el.style.transform = baseTransform(p.id, i);
        boardEl.appendChild(el);
        p.pawns[i].el = el;

        el.addEventListener('click', ()=> onPawnClick(p.id, i));
      }
    }
  }

  function baseTransform(id, i){
    // place near corners as a visual base; (not exact board homes; for UI only)
    const pad = 10 + i*6;
    if(id==='R') return `translate(${pad}px, ${pad}px)`;
    if(id==='G') return `translate(calc(100% - ${60+pad}px), ${pad}px)`;
    if(id==='Y') return `translate(${pad}px, calc(100% - ${60+pad}px))`;
    if(id==='B') return `translate(calc(100% - ${60+pad}px), calc(100% - ${60+pad}px))`;
    return 'translate(0,0)';
  }

  // ---------- Turn Handling ----------
  function startNewGame(){
    buildBoard();
    createPlayers();
    State.turnIdx = 0;
    State.rolled = null;
    setTurnUI();
    rollHint.textContent = 'Tap Roll';
  }

  function setTurnUI(){
    const p = current();
    turnName.textContent = p.name;
    // Highlight all pawns of current player
    $$('.pawn').forEach(x=>x.classList.remove('active'));
    p.pawns.forEach(x=> x.el.classList.add('active'));
  }

  function current(){ return State.players[State.turnIdx]; }
  function nextTurn(extra=false){
    if(extra) return; // On 6 you can keep the turn; basic rule
    State.turnIdx = (State.turnIdx + 1) % State.players.length;
    setTurnUI();
  }

  // ---------- Dice ----------
  function rollDice(){
    const value = 1 + Math.floor(Math.random()*6);
    // 3D orientation mapping
    const rots = {
      1: 'rotateX(0deg) rotateY(0deg)',
      2: 'rotateX(0deg) rotateY(-90deg)',
      3: 'rotateX(0deg) rotateY(180deg)',
      4: 'rotateX(0deg) rotateY(90deg)',
      5: 'rotateX(-90deg) rotateY(0deg)',
      6: 'rotateX(90deg) rotateY(0deg)'
    };
    diceEl.style.transform = rots[value];
    if(navigator.vibrate) navigator.vibrate([18,30,12]);
    playSfx('roll');
    State.rolled = value;
    rollHint.textContent = `Rolled: ${value}`;
    return value;
  }

  rollBtn.addEventListener('click', ()=>{
    if(gate.classList.contains('show')) return; // locked
    const v = rollDice();
    // If no move possible, immediately go next (simple fallback)
    // In real logic, you should check movable pawns. Here we allow click on a pawn to move.
    // Auto-extra on 6 will be handled in onPawnClick.
  });

  function playSfx(type){
    if(!SOUND) return;
    // You can attach real files to audio tags in HTML for roll/move/cut/home
    // Here we just do nothing if not provided
  }

  // ---------- Pawn Movement (Simplified Engine)
  function onPawnClick(playerId, pawnIdx){
    const p = current();
    if(p.id !== playerId) return; // only current player's pawns
    const die = State.rolled;
    if(!die) { shake(rollBtn); return; }

    const pawn = p.pawns[pawnIdx];

    // Opening rule: need 6 to leave base
    if(pawn.pos < 0){
      if(die !== 6){ rollHint.textContent = `Need 6 to open`; shake(diceWrap); return; }
      pawn.pos = p.entry; // enter at start
      updatePawnPosition(p, pawnIdx);
      playSfx('move');
      State.rolled = null;
      // After opening on 6, player gets extra turn
      checkCutOrHome(p, pawnIdx); // cut check on first entry is harmless
      updateScoreUI();
      return; // same turn (extra)
    }

    // Move forward
    let next = (pawn.pos + die) % TRACK_SIZE;
    // (Home lane simplified): if close to entry - in real Ludo, you enter your colored home lane
    // Here we simulate 'home' if a pawn completes a full loop and re-crosses its entry with exact roll
    const wrapped = (pawn.pos < p.entry) && (next >= p.entry);
    if(wrapped){
      // If exact landing at entry again -> mark home
      if(next === p.entry){
        pawn.pos = -2; // home code
        pawn.home = true;
        pawn.el.style.transform = homeTransform(p.id);
        addHomeScore(p.id);
        playSfx('home');
        State.rolled = null;
        updateScoreUI();
        nextTurn(die===6); // six already consumed
        return;
      }
    }

    pawn.pos = next;
    updatePawnPosition(p, pawnIdx);
    playSfx('move');

    // Check cut
    checkCutOrHome(p, pawnIdx);

    // Turn logic
    const extra = (die === 6);
    State.rolled = null;
    updateScoreUI();
    nextTurn(extra);
  }

  function updatePawnPosition(player, idx){
    const pawn = player.pawns[idx];
    if(pawn.pos < 0) { // base or home
      pawn.el.style.transform = pawn.home ? homeTransform(player.id) : baseTransform(player.id, idx);
      return;
    }
    // place on track cell center
    const cell = State.cells[pawn.pos];
    if(!cell) return;
    const rect = cell.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();
    const x = (rect.left - boardRect.left) + rect.width/2;
    const y = (rect.top - boardRect.top) + rect.height/2;
    pawn.el.style.transform = `translate(${x- (pawn.el.offsetWidth/2)}px, ${y- (pawn.el.offsetHeight/2)}px)`;
  }

  function homeTransform(id){
    // park homes near center stripe for the color
    if(id==='R') return `translate(45%, 40%)`;
    if(id==='G') return `translate(45%, 20%)`;
    if(id==='Y') return `translate(20%, 45%)`;
    if(id==='B') return `translate(65%, 45%)`;
    return 'translate(50%,50%)';
  }

  function checkCutOrHome(player, pawnIdx){
    const pawn = player.pawns[pawnIdx];
    if(pawn.pos < 0 || pawn.home) return;
    const here = pawn.pos;

    // Find opponent pawns on same cell (and not safe)
    if(State.safeCells.has(here)) return;

    for(const op of State.players){
      if(op.id === player.id) continue;
      for(const [i,opPawn] of op.pawns.entries()){
        if(opPawn.pos === here){
          // Cut opponent: send to base
          opPawn.pos = -1;
          opPawn.home = false;
          updatePawnPosition(op, i);
          addCutScore(player.id);
          playSfx('cut');
          // After cut, current player gets an extra immediate bonus of +1 score already added
        }
      }
    }
  }

  // ---------- Score ----------
  const Score = {
    R: { score:0, cuts:0, homes:0 },
    G: { score:0, cuts:0, homes:0 },
    Y: { score:0, cuts:0, homes:0 },
    B: { score:0, cuts:0, homes:0 },
  };

  function addCutScore(id){
    Score[id].cuts += 1;
    Score[id].score += 1; // +1 per cut
  }
  function addHomeScore(id){
    Score[id].homes += 1;
    Score[id].score += 5; // +5 per home
  }

  function updateScoreUI(){
    scoreEl.R.textContent = Score.R.score;
    scoreEl.G.textContent = Score.G.score;
    scoreEl.Y.textContent = Score.Y.score;
    scoreEl.B.textContent = Score.B.score;

    scoreEl.cutR.textContent = Score.R.cuts;
    scoreEl.cutG.textContent = Score.G.cuts;
    scoreEl.cutY.textContent = Score.Y.cuts;
    scoreEl.cutB.textContent = Score.B.cuts;

    scoreEl.homeR.textContent = Score.R.homes;
    scoreEl.homeG.textContent = Score.G.homes;
    scoreEl.homeY.textContent = Score.Y.homes;
    scoreEl.homeB.textContent = Score.B.homes;

    // Team sums
    const ry = Score.R.score + Score.Y.score;
    const gb = Score.G.score + Score.B.score;
    scoreEl.teamRY.textContent = ry;
    scoreEl.teamGB.textContent = gb;
  }

  // ---------- Helpers ----------
  function shake(el){
    el.style.transform += ' translateX(0)'; // ensure property exists
    el.classList.add('shake');
    setTimeout(()=> el.classList.remove('shake'), 320);
  }

  // Simple CSS helper for shake
  const style = document.createElement('style');
  style.textContent = `
  .shake{animation:shake .32s}
  @keyframes shake{
    0%{transform:translateX(0)}
    25%{transform:translateX(-4px)}
    50%{transform:translateX(4px)}
    75%{transform:translateX(-2px)}
    100%{transform:translateX(0)}
  }`;
  document.head.appendChild(style);

  // Starting index per color (simplified distinct offsets)
  function entryIndex(id){
    if(id==='R') return 0;
    if(id==='G') return 13;
    if(id==='Y') return 26;
    if(id==='B') return 39;
    return 0;
  }

  // ---------- Resize observer to keep pawns centered on cells after layout changes ----------
  const ro = new ResizeObserver(()=>{
    // Recompute displayed positions for all pawns on track
    for(const p of State.players){
      for(let i=0;i<4;i++){
        const pawn = p.pawns[i];
        if(pawn.pos >= 0) updatePawnPosition(p, i);
        else {
          pawn.el.style.transform = pawn.home ? homeTransform(p.id) : baseTransform(p.id, i);
        }
      }
    }
  });
  ro.observe(boardEl);

  // ---------- Init ----------
  startNewGame();

  // ---------- Team Mode behavior ----------
  // For team mode we keep normal turn order but you can visually see team sums on the scoreboard.
  modeSelect.addEventListener('change', ()=>{
    // No special turn logic change; team sums already computed in updateScoreUI.
  });

})();
