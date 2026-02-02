(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const phaseEl = document.getElementById("phase");
  const restartBtn = document.getElementById("restart");

  // =========================
  // CONTROLE DE VELOCIDADE
  // (quanto maior, mais lento)
  // =========================
  const PLAYER_SPEED = 25; // 4-5 bom para jogabilidade
  const GHOST_SPEED = 45; // mais lento que o player

  // =========================
  // MAPAS POR FASE
  // =========================
  // # barreira urbana
  // P início (Rodoviária)
  // S alvo da fase 1 (Salvador Shopping)
  // U final do jogo (UNIFACS)
  // M metrô
  // = passarela
  // H hospital
  // O hotel
  // . "pontos/experiência" (ruas/pistas menores)
  // G tráfego (fantasma)
  const MAP_FASE_1 = [
    "########################################",
    "#P....M.....##..............H..........#",
    "#.#########.##.#######################.#",
    "#.#########.##.#######################.#",
    "#....=......##........S.......OOOOOOO.#",
    "#####.##########################.######",
    "#####.##########################.######",
    "#.............####......####...........#",
    "#.###########.####.####.####.#########.#",
    "#.###########......####......#########.#",
    "#...............####......####.........#",
    "######.############################.####",
    "######.############################.####",
    "#..............##.................G....#",
    "########################################",
  ];

  const MAP_FASE_2 = [
    "########################################",
    "#....S........##........H..............#",
    "#.############.##.###################..#",
    "#.############.##.###################..#",
    "#......O......##.........=.............#",
    "#####.##########################.######",
    "#####.##########################.######",
    "#.............####......####...........#",
    "#.###########.####.####.####.#########.#",
    "#.###########......####......#########.#",
    "#...............####......####.........#",
    "######.############################.####",
    "######.############################.####",
    "#..............##.........U...........#",
    "########################################",
  ];

  const PHASES = [
    {
      id: 1,
      map: MAP_FASE_1,
      objectiveTile: "S",
      intro: "Fase 1: da Rodoviária até o Salvador Shopping.",
      lesson: "Travessias fragmentadas e infraestrutura voltada ao carro.",
    },
    {
      id: 2,
      map: MAP_FASE_2,
      objectiveTile: "U",
      intro: "Fase 2: do Salvador Shopping até a UNIFACS.",
      lesson: "Grandes avenidas viram barreiras no dia a dia do estudante.",
    },
  ];

  // =========================
  // RÓTULOS (nomes ao longo do mapa)
  // Ajustados por fase (x,y em tiles)
  // =========================
  const LABELS = {
    1: [
      { text: "Rodoviária", x: 2, y: 1 },
      { text: "Pernambués (M)", x: 12, y: 1 },
      { text: "Hospital Sarah", x: 28, y: 1 },
      { text: "Salvador Shopping", x: 22, y: 4 },
      { text: "Mercure / Boulevard", x: 22, y: 6 },
      { text: "Av. Tancredo Neves", x: 10, y: 8 },
      { text: "Hospital da Bahia", x: 24, y: 10 },
    ],
    2: [
      { text: "Salvador Shopping", x: 3, y: 1 },
      { text: "Av. Tancredo Neves", x: 10, y: 7 },
      { text: "Hospital Sarah", x: 28, y: 1 },
      { text: "Sotero Hotel", x: 5, y: 4 },
      { text: "Passarela", x: 22, y: 5 },
      { text: "UNIFACS Tancredo Neves", x: 22, y: 13 },
      { text: "Lagoa dos Dinossauros", x: 28, y: 7 },
    ],
  };

  // =========================
  // MENSAGENS EDUCATIVAS (popups curtos)
  // =========================
  const EDUCATIONAL = {
    "#": "Barreira urbana: o carro tem prioridade.",
    "=": "Passarela: conecta, mas nem sempre acolhe.",
    M: "Transporte: integra, mas exige legibilidade e segurança.",
    H: "Saúde perto — mas caminhar até aqui é confortável?",
    O: "Hotel/serviços: cidade-mercado no entorno.",
    G: "Tráfego intenso: risco e estresse no acesso.",
  };

  // =========================
  // ESTILO VISUAL
  // =========================
  const COLORS = {
    bg: "#000000",
    wall: "#1e5bd6",
    dot: "#ffe600",
    label: "rgba(240,245,255,0.95)",
    labelShadow: "rgba(0,0,0,0.65)",
    ghost: "#ff3b3b",
    overlay: "rgba(0,0,0,0.72)",
    ok: "#00c878",
    muted: "#9fb0c6",
  };

  // =========================
  // ESTADO DO JOGO
  // =========================
  let phaseIndex = 0;
  let map = [];
  let cols = 0,
    rows = 0;
  let TILE = 26; // tamanho do tile (ajusta o "zoom" do mapa)
  let player, ghost;
  let score = 0,
    lives = 3;
  let started = false;
  let state = "READY"; // READY | PLAYING | PHASE_CLEAR | WIN | GAME_OVER
  let pendingDir = null;
  let dir = null;
  let tick = 0;

  // popup educativo
  let toastText = "";
  let toastTimer = 0;

  function loadPhase(i) {
    phaseIndex = i;
    const phase = PHASES[phaseIndex];

    map = phase.map.map((r) => r.split(""));
    rows = map.length;
    cols = map[0].length;

    // Ajuste automático do tile para caber no canvas
    // (sem distorcer)
    const maxTileW = Math.floor(canvas.width / cols);
    const maxTileH = Math.floor(canvas.height / rows);
    TILE = Math.max(18, Math.min(28, Math.min(maxTileW, maxTileH)));

    // Centralizar área desenhada
    canvas._drawW = cols * TILE;
    canvas._drawH = rows * TILE;
    canvas._offX = Math.floor((canvas.width - canvas._drawW) / 2);
    canvas._offY = Math.floor((canvas.height - canvas._drawH) / 2);

    // encontrar spawns
    player = { x: 1, y: 1 };
    ghost = { x: cols - 2, y: rows - 2 };

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (map[y][x] === "P") {
          player = { x, y };
          map[y][x] = ".";
        }
        if (map[y][x] === "G") {
          ghost = { x, y };
          map[y][x] = ".";
        }
      }
    }

    // reset de controle
    dir = null;
    pendingDir = null;
    tick = 0;

    phaseEl.textContent = String(phase.id);

    // mensagem inicial da fase
    showToast(phase.intro);
  }

  function resetAll() {
    score = 0;
    lives = 3;
    scoreEl.textContent = score;
    livesEl.textContent = lives;
    started = false;
    state = "READY";
    loadPhase(0);
  }

  function showToast(msg, ms = 2400) {
    toastText = msg;
    toastTimer = ms;
  }

  function inBounds(x, y) {
    return y >= 0 && y < rows && x >= 0 && x < cols;
  }

  function isWall(x, y) {
    return map[y]?.[x] === "#";
  }

  function tileAt(x, y) {
    return map[y]?.[x] ?? "#";
  }

  function canMove(entity, dx, dy) {
    const nx = entity.x + dx;
    const ny = entity.y + dy;
    if (!inBounds(nx, ny)) return false;
    return !isWall(nx, ny);
  }

  function tryMove(entity, dx, dy) {
    if (!canMove(entity, dx, dy)) return false;
    entity.x += dx;
    entity.y += dy;
    return true;
  }

  function remainingDots() {
    // Mantemos dots como “experiência” e densidade urbana;
    // não precisa comer todos pra vencer fase.
    // (Se quiser mudar isso depois, eu ajusto.)
    return true;
  }

  function moveGhost() {
    // movimento aleatório com leve viés de aproximar do player (bem leve)
    const options = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ].filter((m) => canMove(ghost, m.dx, m.dy));

    if (options.length === 0) return;

    // viés: 60% escolhe o melhor (aproxima), 40% aleatório
    const biased = Math.random() < 0.6;
    if (biased) {
      let best = options[0],
        bestD = 1e9;
      for (const m of options) {
        const nx = ghost.x + m.dx,
          ny = ghost.y + m.dy;
        const d = Math.abs(nx - player.x) + Math.abs(ny - player.y);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      tryMove(ghost, best.dx, best.dy);
    } else {
      const pick = options[Math.floor(Math.random() * options.length)];
      tryMove(ghost, pick.dx, pick.dy);
    }
  }

  function eatAndLearn(x, y) {
    const t = tileAt(x, y);

    // Pontos (ruas/experiência)
    if (t === ".") {
      map[y][x] = " ";
      score += 1;
      scoreEl.textContent = score;
      return;
    }

    // Ícones urbanos: pontuam mais + mensagens
    const iconScore = {
      M: 10,
      "=": 8,
      H: 6,
      O: 5,
      S: 15,
      U: 25,
    };

    if (iconScore[t]) {
      score += iconScore[t];
      scoreEl.textContent = score;

      // Mostra “aula” curta (não remove S e U; remove outros ícones pra não repetir)
      if (EDUCATIONAL[t]) showToast(EDUCATIONAL[t]);

      if (t !== "S" && t !== "U") {
        map[y][x] = " ";
      }
    }
  }

  function checkObjective() {
    const phase = PHASES[phaseIndex];
    const here = tileAt(player.x, player.y);

    if (here === phase.objectiveTile) {
      if (phase.objectiveTile === "S") {
        state = "PHASE_CLEAR";
        showToast(
          "Você chegou ao Salvador Shopping. Preparando próxima fase…",
          2200,
        );
        setTimeout(() => {
          loadPhase(1);
          state = "READY";
          started = false;
        }, 1600);
      } else if (phase.objectiveTile === "U") {
        state = "WIN";
        showToast("Você chegou na UNIFACS! 🎓", 2400);
      }
    }
  }

  function collide() {
    if (player.x === ghost.x && player.y === ghost.y) {
      lives -= 1;
      livesEl.textContent = lives;

      showToast(
        "Você foi pego pelo tráfego. A cidade não prioriza o pedestre.",
        2400,
      );

      // respawn do player (Rodoviária na fase 1; Shopping na fase 2)
      if (lives > 0) {
        // encontra spawn "P" ou "S" dependendo da fase
        let spawnChar = PHASES[phaseIndex].id === 1 ? "P" : "S";
        let sx = player.x,
          sy = player.y;

        // buscar no mapa original (PHASES) uma posição para respawn
        const source = PHASES[phaseIndex].map;
        outer: for (let y = 0; y < source.length; y++) {
          for (let x = 0; x < source[0].length; x++) {
            if (source[y][x] === spawnChar) {
              sx = x;
              sy = y;
              break outer;
            }
          }
        }
        player.x = sx;
        player.y = sy;
        dir = null;
        pendingDir = null;
      } else {
        state = "GAME_OVER";
      }
    }
  }

  function tileToIcon(ch) {
    // retorna um "emoji" para renderizar por cima
    switch (ch) {
      case "M":
        return "Ⓜ️";
      case "=":
        return "🟰";
      case "H":
        return "🏥";
      case "O":
        return "🏨";
      case "S":
        return "🛍️";
      case "U":
        return "🎓";
      default:
        return "";
    }
  }

  function drawLabels() {
    const list = LABELS[PHASES[phaseIndex].id] || [];
    ctx.save();
    ctx.font = "bold 13px system-ui, Arial";
    ctx.textAlign = "left";
    for (const l of list) {
      const px = canvas._offX + l.x * TILE + 4;
      const py = canvas._offY + l.y * TILE - 6;

      // sombra
      ctx.fillStyle = COLORS.labelShadow;
      ctx.fillText(l.text, px + 1, py + 1);

      // texto
      ctx.fillStyle = COLORS.label;
      ctx.fillText(l.text, px, py);
    }
    ctx.restore();
  }

  function drawToast(dt) {
    if (toastTimer <= 0 || !toastText) return;
    toastTimer -= dt;

    ctx.save();
    ctx.globalAlpha = 0.95;

    const padX = 14,
      padY = 10;
    ctx.font = "600 14px system-ui, Arial";
    const w = ctx.measureText(toastText).width;
    const boxW = Math.min(canvas.width - 30, w + padX * 2);
    const boxH = 40;

    const x = Math.floor((canvas.width - boxW) / 2);
    const y = canvas.height - boxH - 16;

    ctx.fillStyle = "rgba(16,24,38,0.92)";
    roundRect(ctx, x, y, boxW, boxH, 12, true, false);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, x, y, boxW, boxH, 12, false, true);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(toastText, canvas.width / 2, y + 25);

    ctx.restore();

    if (toastTimer <= 0) {
      toastText = "";
      toastTimer = 0;
    }
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function drawOverlay(title, subtitle, color = "#ffffff") {
    ctx.save();
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = color;
    ctx.font = "800 36px system-ui, Arial";
    ctx.textAlign = "center";
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 30);

    ctx.fillStyle = COLORS.muted;
    ctx.font = "16px system-ui, Arial";
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 10);

    ctx.fillStyle = COLORS.ok;
    ctx.font = "14px system-ui, Arial";
    ctx.fillText(
      "Clique para continuar",
      canvas.width / 2,
      canvas.height / 2 + 42,
    );

    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // mapa (paredes e pontos)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = map[y][x];
        const px = canvas._offX + x * TILE;
        const py = canvas._offY + y * TILE;

        if (cell === "#") {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(px, py, TILE, TILE);
        } else {
          // base (ruas)
          // pastilhas: pontos de experiência
          if (cell === ".") {
            ctx.fillStyle = COLORS.dot;
            ctx.beginPath();
            ctx.arc(px + TILE / 2, py + TILE / 2, TILE / 7, 0, Math.PI * 2);
            ctx.fill();
          }

          // ícones especiais
          const icon = tileToIcon(cell);
          if (icon) {
            ctx.font = `${Math.floor(TILE * 0.7)}px system-ui, Arial`;
            ctx.textAlign = "center";
            ctx.fillText(icon, px + TILE / 2, py + TILE * 0.78);
          }
        }
      }
    }

    // rótulos (nomes de lugares)
    drawLabels();

    // player
    {
      const px = canvas._offX + player.x * TILE + TILE / 2;
      const py = canvas._offY + player.y * TILE + TILE / 2;
      ctx.fillStyle = "#ffe600";
      ctx.beginPath();
      ctx.arc(px, py, TILE / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ghost
    {
      const gx = canvas._offX + ghost.x * TILE;
      const gy = canvas._offY + ghost.y * TILE;

      ctx.fillStyle = COLORS.ghost;
      ctx.beginPath();
      ctx.arc(gx + TILE / 2, gy + TILE / 2 - 6, TILE * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(
        gx + TILE * 0.22,
        gy + TILE * 0.48,
        TILE * 0.56,
        TILE * 0.46,
      );
    }

    // overlays por estado
    if (state === "READY") {
      const phase = PHASES[phaseIndex];
      drawOverlay(`FASE ${phase.id}`, phase.lesson, "#ffe600");
    } else if (state === "GAME_OVER") {
      drawOverlay(
        "GAME OVER",
        "O entorno venceu. Pressione R para reiniciar.",
        "#ff3b3b",
      );
    } else if (state === "WIN") {
      drawOverlay(
        "VOCÊ CHEGOU NA UNIFACS!",
        "Acesso vencido — mas a cidade poderia ser mais humana.",
        "#00c878",
      );
    }

    // toast educativo
    drawToast(16);
  }

  function step() {
    if (!started) return;
    if (state !== "PLAYING") return;

    // direção pendente: vira assim que puder
    if (pendingDir && canMove(player, pendingDir.dx, pendingDir.dy)) {
      dir = pendingDir;
    }

    // mover player mais lento
    if (dir && tick % PLAYER_SPEED === 0) {
      tryMove(player, dir.dx, dir.dy);

      // comer / pontuar / mensagens
      eatAndLearn(player.x, player.y);

      // objetivo da fase
      checkObjective();
    }

    // fantasma (tráfego)
    if (tick % GHOST_SPEED === 0) {
      moveGhost();
    }

    // colisão com tráfego
    collide();
  }

  function loop() {
    tick++;
    step();
    draw();
    requestAnimationFrame(loop);
  }

  function setDir(key) {
    const d = {
      ArrowLeft: { dx: -1, dy: 0 },
      ArrowRight: { dx: 1, dy: 0 },
      ArrowUp: { dx: 0, dy: -1 },
      ArrowDown: { dx: 0, dy: 1 },
    }[key];
    if (d) pendingDir = d;
  }

  function startOrContinue() {
    if (state === "READY") {
      started = true;
      state = "PLAYING";
      return;
    }
    if (state === "PHASE_CLEAR") return;
    if (state === "WIN" || state === "GAME_OVER") return;
    // se está jogando, só garante foco
    started = true;
    state = "PLAYING";
  }

  // eventos
  canvas.addEventListener("pointerdown", () => {
    canvas.focus();
    startOrContinue();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") {
      resetAll();
      return;
    }
    setDir(e.key);

    // Enter ou espaço inicia
    if ((e.key === "Enter" || e.key === " ") && state === "READY") {
      startOrContinue();
    }
  });

  restartBtn.addEventListener("click", () => resetAll());

  // init
  resetAll();
  loop();
})();
