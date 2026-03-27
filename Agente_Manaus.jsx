import { useState, useEffect, useRef, useCallback } from "react";

const TILE = 40;
const COLS = 15;
const ROWS = 10;
const W = COLS * TILE;
const H = ROWS * TILE;

const MAP = [
  [2,2,2,2,2,1,0,0,0,0,1,2,2,2,2],
  [2,2,2,2,2,1,0,0,0,0,1,2,2,2,2],
  [2,2,2,2,2,1,0,0,0,0,1,2,2,2,2],
  [1,1,1,1,1,1,0,0,0,0,1,1,1,1,1],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,0,0,0,0,1,3,3,3,1],
  [2,2,2,2,2,1,0,0,0,0,1,3,3,3,1],
  [2,2,2,2,2,1,0,0,0,0,1,3,3,3,1],
  [2,2,2,2,2,1,0,0,0,0,1,1,1,1,1],
  [1,1,1,1,1,1,0,0,0,0,1,1,1,1,1],
];

const TILE_COLORS = { 0:"#3e3e58", 1:"#c8b87c", 2:"#7a6abf", 3:"#4caf50" };
const BLDG_COLS = ["#7a6abf","#6a5aad","#8870cf","#5a4f9f","#9480d9","#6050be"];

const TRASH = [
  { icon:"🧴", label:"Plástico",   color:"#ff4444", pts:10 },
  { icon:"📦", label:"Papelão",    color:"#8B4513", pts:8  },
  { icon:"🥤", label:"Lata",       color:"#aaaaaa", pts:12 },
  { icon:"🍶", label:"Vidro",      color:"#44aaff", pts:15 },
  { icon:"📰", label:"Papel",      color:"#dddd44", pts:7  },
  { icon:"💻", label:"Eletrônico", color:"#44ffaa", pts:20 },
];

function rnd(a, b) { return Math.random() * (b - a) + a; }
function rndI(a, b) { return Math.floor(rnd(a, b)); }

function getCell(x, y) {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return 2;
  return MAP[cy]?.[cx] ?? 2;
}
function walkable(x, y) {
  const c = getCell(x, y);
  return c === 0 || c === 1 || c === 3;
}

function makeBldgCache() {
  const cache = {};
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (MAP[r]?.[c] === 2)
        cache[`${c},${r}`] = {
          col: BLDG_COLS[rndI(0, BLDG_COLS.length)],
          wins: Array.from({ length: 6 }, () => ({
            lit: Math.random() > 0.4,
            cx: rndI(0, 3), cy: rndI(0, 2)
          }))
        };
  return cache;
}

function spawnItems(level) {
  const count = 5 + level * 2;
  const arr = [];
  let tries = 0;
  while (arr.length < count && tries < 800) {
    tries++;
    const tx = rnd(0.6, COLS - 0.6), ty = rnd(0.6, ROWS - 0.6);
    if (walkable(tx, ty)) {
      const t = TRASH[rndI(0, TRASH.length)];
      arr.push({ ...t, x: tx, y: ty, bob: rnd(0, Math.PI * 2), collected: false, id: Math.random() });
    }
  }
  return arr;
}

export default function Agente_Manaus() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    player: { x: 7.5, y: 4.5, dir: 0, moving: false },
    items: [],
    collectAnims: [],
    keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false },
    score: 0,
    timeLeft: 60,
    level: 1,
    timerAcc: 0,
    gameOver: false,
    bldgCache: makeBldgCache(),
    msg: "",
    msgUntil: 0,
  });

  const [ui, setUi] = useState({ score: 0, timeLeft: 60, level: 1, gameOver: false, msg: "" });
  const rafRef = useRef(null);
  const lastRef = useRef(null);

  // Init items
  useEffect(() => {
    stateRef.current.items = spawnItems(1);
    stateRef.current.msg = "♻️ Colete todo o lixo reciclável!";
    stateRef.current.msgUntil = performance.now() + 2200;
  }, []);

  // Input
  useEffect(() => {
    const onDown = (e) => {
      if (stateRef.current.keys.hasOwnProperty(e.key)) {
        stateRef.current.keys[e.key] = true;
        e.preventDefault();
      }
    };
    const onUp = (e) => {
      if (stateRef.current.keys.hasOwnProperty(e.key)) stateRef.current.keys[e.key] = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  // Game loop
  const loop = useCallback((ts) => {
    if (!lastRef.current) lastRef.current = ts;
    const dt = Math.min((ts - lastRef.current) / 1000, 0.05);
    lastRef.current = ts;
    const t = ts / 1000;
    const s = stateRef.current;

    if (!s.gameOver) {
      // Timer
      s.timerAcc += dt;
      if (s.timerAcc >= 1) {
        s.timerAcc -= 1;
        s.timeLeft--;
        if (s.timeLeft <= 0) {
          s.timeLeft = 0;
          s.gameOver = true;
          s.msg = `🏁 FIM! ${s.score} pontos! Recarregue para jogar.`;
          s.msgUntil = Infinity;
        }
      }

      // Move
      let dx = 0, dy = 0;
      if (s.keys.ArrowLeft)  { dx = -1; s.player.dir = 2; }
      if (s.keys.ArrowRight) { dx =  1; s.player.dir = 3; }
      if (s.keys.ArrowUp)    { dy = -1; s.player.dir = 1; }
      if (s.keys.ArrowDown)  { dy =  1; s.player.dir = 0; }
      const len = Math.sqrt(dx*dx + dy*dy);
      s.player.moving = len > 0;
      if (s.player.moving) {
        const spd = 3.8;
        const nx = s.player.x + dx / len * spd * dt;
        const ny = s.player.y + dy / len * spd * dt;
        if (walkable(nx, s.player.y)) s.player.x = nx;
        if (walkable(s.player.x, ny)) s.player.y = ny;
        s.player.x = Math.max(0.5, Math.min(COLS - 0.5, s.player.x));
        s.player.y = Math.max(0.5, Math.min(ROWS - 0.5, s.player.y));
      }

      // Collect
      s.items.forEach(it => {
        if (it.collected) return;
        const ddx = s.player.x - it.x, ddy = s.player.y - it.y;
        if (Math.sqrt(ddx*ddx + ddy*ddy) < 0.9) {
          it.collected = true;
          s.score += it.pts;
          s.collectAnims.push({ ...it, start: t });
          s.msg = `${it.icon} ${it.label}! +${it.pts}pts`;
          s.msgUntil = ts + 900;
          if (s.items.every(i => i.collected)) {
            s.level++;
            s.timeLeft = Math.min(s.timeLeft + 15, 90);
            s.msg = `🎉 NÍVEL ${s.level}! +15s`;
            s.msgUntil = ts + 1600;
            setTimeout(() => { s.items = spawnItems(s.level); }, 600);
          }
        }
      });
      s.collectAnims = s.collectAnims.filter(a => t - a.start < 0.85);
    }

    // Render
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = requestAnimationFrame(loop); return; }
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // MAP
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = MAP[r]?.[c] ?? 2;
        ctx.fillStyle = TILE_COLORS[cell] || "#555";
        ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
        if (cell === 2) {
          const k = `${c},${r}`;
          const bd = s.bldgCache[k];
          if (bd) {
            ctx.fillStyle = bd.col;
            ctx.fillRect(c*TILE+2, r*TILE+2, TILE-4, TILE-4);
            bd.wins.forEach(w => {
              ctx.fillStyle = w.lit ? "#fffde7" : "#33334a";
              ctx.fillRect(c*TILE+5+w.cx*11, r*TILE+5+w.cy*14, 8, 9);
            });
          }
        } else if (cell === 0) {
          ctx.save();
          ctx.setLineDash([6,6]);
          ctx.strokeStyle = "rgba(255,255,200,0.12)";
          ctx.lineWidth = 1.5;
          if (r === 4 || r === 9) {
            ctx.beginPath(); ctx.moveTo(c*TILE, r*TILE+TILE/2); ctx.lineTo((c+1)*TILE, r*TILE+TILE/2); ctx.stroke();
          }
          if (c >= 6 && c <= 9) {
            ctx.beginPath(); ctx.moveTo(c*TILE+TILE/2, r*TILE); ctx.lineTo(c*TILE+TILE/2, (r+1)*TILE); ctx.stroke();
          }
          ctx.restore();
        } else if (cell === 3) {
          ctx.font = "22px serif";
          ctx.fillText("🌳", c*TILE+8, r*TILE+30);
        } else if (cell === 1) {
          ctx.strokeStyle = "rgba(0,0,0,0.1)";
          ctx.lineWidth = 0.5;
          for (let i = 1; i < 4; i++) {
            ctx.beginPath(); ctx.moveTo(c*TILE, r*TILE+i*10); ctx.lineTo((c+1)*TILE, r*TILE+i*10); ctx.stroke();
          }
        }
      }
    }

    // Items
    s.items.forEach(it => {
      if (it.collected) return;
      const bob = Math.sin(t*3 + it.bob)*3;
      const sx = it.x*TILE-12, sy = it.y*TILE-14+bob;
      ctx.save();
      ctx.shadowBlur = 18; ctx.shadowColor = it.color;
      ctx.font = "22px serif";
      ctx.fillText(it.icon, sx, sy+18);
      ctx.restore();
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.beginPath(); ctx.roundRect(sx+2, sy+18, 24, 13, 4); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`+${it.pts}`, sx+4, sy+29);
    });

    // Collect anims
    s.collectAnims.forEach(a => {
      const p = (t - a.start) / 0.85;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.font = `${20+p*8}px serif`;
      ctx.fillText(a.icon, a.x*TILE-12, a.y*TILE-22-p*32);
      ctx.fillStyle = "#ffd700";
      ctx.font = `bold ${13+p*4}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(`+${a.pts}`, a.x*TILE+6, a.y*TILE-22-p*32);
      ctx.restore();
    });

    // Player
    const px = s.player.x * TILE, py = s.player.y * TILE;
    const legSwing = s.player.moving ? Math.sin(t*10)*5 : 0;
    ctx.save();
    ctx.translate(px, py);
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath(); ctx.ellipse(0,15,10,4,0,0,Math.PI*2); ctx.fill();
    // Legs
    ctx.fillStyle = "#e65c00";
    ctx.fillRect(-6,4,5,11+legSwing); ctx.fillRect(1,4,5,11-legSwing);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-7,13,7,5); ctx.fillRect(0,13,7,5);
    // Body
    const g = ctx.createLinearGradient(-9,-8,9,8);
    g.addColorStop(0,"#ff8c00"); g.addColorStop(1,"#ff5500");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(-9,-8,18,16,3); ctx.fill();
    // Stripes
    ctx.fillStyle = "rgba(255,255,150,0.88)";
    ctx.fillRect(-8,-1,16,3); ctx.fillRect(-8,5,16,3);
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.font = "bold 4px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("MANAUS", 0, 3);
    // Arms & gloves
    ctx.fillStyle = "#e65c00";
    ctx.fillRect(-14,-5,6,4); ctx.fillRect(8,-5,6,4);
    ctx.fillStyle = "#ffd700";
    ctx.beginPath(); ctx.arc(-14,-3,4,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(14,-3,4,0,Math.PI*2); ctx.fill();
    // Bag
    ctx.fillStyle = "#222";
    ctx.beginPath(); ctx.roundRect(7,-1,8,12,2); ctx.fill();
    ctx.fillStyle = "#4caf50"; ctx.font = "8px serif";
    ctx.fillText("♻",8,9);
    // Head
    ctx.fillStyle = "#c68642";
    ctx.beginPath(); ctx.arc(0,-15,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#1a0a00";
    ctx.beginPath(); ctx.arc(0,-20,7,Math.PI,0); ctx.fill();
    ctx.fillStyle = "#ff5500";
    ctx.beginPath(); ctx.arc(0,-20,7.5,Math.PI,0); ctx.fill();
    ctx.fillRect(-8,-20,17,3);
    ctx.fillStyle = "#fff"; ctx.font = "bold 5px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("♻", 0, -18);
    if (s.player.dir !== 1) {
      ctx.fillStyle = "#111";
      ctx.beginPath(); ctx.arc(-3,-15,1.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(3,-15,1.5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0,-13,3,0.1,Math.PI-0.1); ctx.stroke();
    }
    ctx.restore();

    // Arrow HUD (Makey Makey feedback)
    const hx = W - 52, hy = H - 52;
    [
      { key:"ArrowUp",    label:"▲", ox:0,   oy:-18 },
      { key:"ArrowDown",  label:"▼", ox:0,   oy:18  },
      { key:"ArrowLeft",  label:"◀", ox:-18, oy:0   },
      { key:"ArrowRight", label:"▶", ox:18,  oy:0   },
    ].forEach(d => {
      ctx.fillStyle = s.keys[d.key] ? "rgba(255,107,0,0.95)" : "rgba(255,255,255,0.14)";
      ctx.beginPath(); ctx.arc(hx+d.ox, hy+d.oy, 10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = s.keys[d.key] ? "#fff" : "rgba(255,255,255,0.5)";
      ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(d.label, hx+d.ox, hy+d.oy+4);
    });

    // Low time flash
    if (s.timeLeft <= 10 && !s.gameOver) {
      ctx.fillStyle = `rgba(255,0,0,${0.1+0.08*Math.sin(t*8)})`;
      ctx.fillRect(0,0,W,H);
    }

    // Sync UI
    setUi({ score: s.score, timeLeft: s.timeLeft, level: s.level, gameOver: s.gameOver,
      msg: ts < s.msgUntil ? s.msg : "" });

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  // D-pad helpers
  const dpadPress = (key) => { stateRef.current.keys[key] = true; };
  const dpadRelease = (key) => { stateRef.current.keys[key] = false; };

  const DBtn = ({ dir, label, key }) => (
    <button
      style={{
        width:44, height:44, borderRadius:10, fontSize:18, cursor:"pointer",
        background: "rgba(255,107,0,0.18)", border:"2px solid #ff6b00",
        color:"#ff8c00", display:"flex", alignItems:"center", justifyContent:"center",
        touchAction:"none", WebkitTapHighlightColor:"transparent",
        transition:"background 0.1s",
      }}
      onMouseDown={() => dpadPress(key)}
      onMouseUp={() => dpadRelease(key)}
      onMouseLeave={() => dpadRelease(key)}
      onTouchStart={(e) => { dpadPress(key); e.preventDefault(); }}
      onTouchEnd={() => dpadRelease(key)}
    >{label}</button>
  );

  return (
    <div style={{
      minHeight:"100vh", background:"#12122a",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Nunito', 'Segoe UI', sans-serif",
    }}>
      {/* HUD */}
      <div style={{
        width:W, display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"8px 16px",
        background:"linear-gradient(90deg,#ff6b00,#ff8c00)",
        borderRadius:"12px 12px 0 0", border:"3px solid #ff4500", borderBottom:"none",
      }}>
        <span style={{ fontFamily:"'Bangers','Impact',cursive", fontSize:22, color:"#fff",
          letterSpacing:2, textShadow:"2px 2px 0 #cc3300" }}>
          ♻️ AGENTE MANAUS
        </span>
        <div style={{ display:"flex", gap:10 }}>
          {[
            { icon:"📦", val: ui.score },
            { icon:"⏱️", val: `${ui.timeLeft}s` },
            { icon:"🏆", val: `Nv.${ui.level}` },
          ].map(s => (
            <div key={s.icon} style={{
              background:"rgba(0,0,0,0.25)", padding:"4px 10px",
              borderRadius:20, color:"#fff", fontWeight:900, fontSize:13,
              display:"flex", alignItems:"center", gap:5
            }}>
              {s.icon} {s.val}
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position:"relative" }}>
        <canvas ref={canvasRef} width={W} height={H}
          style={{ border:"3px solid #ff4500", borderTop:"none",
            borderRadius:"0 0 12px 12px", display:"block", imageRendering:"pixelated" }} />

        {/* Message overlay */}
        {ui.msg && (
          <div style={{
            position:"absolute", top:"42%", left:"50%", transform:"translate(-50%,-50%)",
            background:"rgba(255,107,0,0.97)", color:"#fff",
            fontFamily:"'Bangers','Impact',cursive", fontSize:26,
            padding:"12px 28px", borderRadius:16, border:"3px solid #fff",
            pointerEvents:"none", textShadow:"2px 2px 0 #cc3300",
            whiteSpace:"nowrap", zIndex:10,
          }}>
            {ui.msg}
          </div>
        )}
      </div>

      {/* D-Pad + Info */}
      <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:24 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,44px)", gridTemplateRows:"repeat(3,44px)", gap:4 }}>
          <div/><DBtn key="up"    label="▲" keyName="ArrowUp"    onClick={() => {}} onMouseDown={() => dpadPress("ArrowUp")}    onMouseUp={() => dpadRelease("ArrowUp")}    onTouchStart={(e) => { dpadPress("ArrowUp"); e.preventDefault(); }}    onTouchEnd={() => dpadRelease("ArrowUp")} />
          <div/>
          <DBtn key="left"  label="◀" keyName="ArrowLeft"  onClick={() => {}} onMouseDown={() => dpadPress("ArrowLeft")}  onMouseUp={() => dpadRelease("ArrowLeft")}  onTouchStart={(e) => { dpadPress("ArrowLeft"); e.preventDefault(); }}  onTouchEnd={() => dpadRelease("ArrowLeft")} />
          <div/>
          <DBtn key="right" label="▶" keyName="ArrowRight" onClick={() => {}} onMouseDown={() => dpadPress("ArrowRight")} onMouseUp={() => dpadRelease("ArrowRight")} onTouchStart={(e) => { dpadPress("ArrowRight"); e.preventDefault(); }} onTouchEnd={() => dpadRelease("ArrowRight")} />
          <div/>
          <DBtn key="down"  label="▼" keyName="ArrowDown"  onClick={() => {}} onMouseDown={() => dpadPress("ArrowDown")}  onMouseUp={() => dpadRelease("ArrowDown")}  onTouchStart={(e) => { dpadPress("ArrowDown"); e.preventDefault(); }}  onTouchEnd={() => dpadRelease("ArrowDown")} />
          <div/>
        </div>
        <div style={{ color:"#888", fontSize:12, fontWeight:700, letterSpacing:1, lineHeight:1.8 }}>
          🎮 <span style={{ color:"#ff8c00" }}>Makey Makey:</span> conecte nas setas ↑↓←→<br/>
          🖥️ Teclado: setas direcionais<br/>
          📱 Toque: use os botões ao lado
        </div>
      </div>
    </div>
  );
}
