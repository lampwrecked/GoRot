import React, { useState, useEffect, useRef } from "react";

const API_KEY = "cpi_live_d5f453d6be82d02451f78cec7507763caea413d5ff902cd5";
const BASE_URL = "https://cpi.brainrot.works/v1";
const IMG_BASE = "https://cpi.brainrot.works";
const DECK_SIZE = 56;
const SET_THRESHOLD = 3;
const TOTAL_ROUNDS = 10;

async function cpi(path) {
  const r = await fetch(`${BASE_URL}${path}`, {
    headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/json" }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function getAttr(t, type) { return t?.attributes?.find(a => a.trait_type === type)?.value || null; }
function getBase(t) { return getAttr(t, "Base") || getAttr(t, "Category") || "?"; }
function fixImg(url) {
  if (!url) return null;
  if (url.startsWith("/")) return `${IMG_BASE}${url}`;
  return url;
}

function computeSets(hand) {
  const groups = {};
  hand.forEach(t => { const b = getBase(t); if (!groups[b]) groups[b] = []; groups[b].push(t); });
  const newSets = []; let remaining = [...hand];
  Object.entries(groups).forEach(([base, tokens]) => {
    if (tokens.length < SET_THRESHOLD) return;
    let bonus = 0; const bonusDesc = [];
    const pairs = fn => { const g = {}; tokens.forEach(t => { const v = fn(t); if (v && v !== "None") g[v] = (g[v] || 0) + 1; }); return Object.values(g).filter(c => c >= 2).reduce((a, b) => a + b, 0); };
    const hb = pairs(t => getAttr(t, "Hat")); if (hb) { bonus += hb; bonusDesc.push(`+${hb} Hat`); }
    const eb = pairs(t => getAttr(t, "Expression")); if (eb) { bonus += eb; bonusDesc.push(`+${eb} Expr`); }
    const ab = pairs(t => getAttr(t, "Archetype")); if (ab) { bonus += ab; bonusDesc.push(`+${ab} Arch`); }
    const rare = new Set(["Legendary", "Epic", "Rare"]);
    if (tokens.every(t => { const r = getAttr(t, "Rarity Tier"); return r && rare.has(r); })) { bonus += 3; bonusDesc.push("+3 Rare"); }
    newSets.push({ base, tokens, bonus, bonusDesc, score: tokens.length + bonus });
    remaining = remaining.filter(t => !tokens.find(x => x.id === t.id));
  });
  return { newSets, remaining };
}

const C = { void: "#0A0A0F", corrupt: "#1A0F2E", acid: "#39FF14", mag: "#FF2D78", chalk: "#F0EDE8", muted: "#6B6880", card: "#13101F", border: "#2E2550" };
const imp = "Impact,'Arial Black',sans-serif";
const mono = "'Courier New',monospace";

// ── ROT CARD PICKER ───────────────────────────────────────────────────────
// Picks a random card from the full collection pool that isn't currently
// in anyone's hand or the draw pile — i.e. a "rotting" unused card to show
// on the GO ROT! popup. Cycles through without repeats until exhausted.
let usedRotIds = new Set();
function pickRotToken(allTokens, inPlayIds) {
  const unused = allTokens.filter(t => !inPlayIds.has(t.id));
  const pool = unused.length > 0 ? unused : allTokens; // fallback if everything is in play
  const notShown = pool.filter(t => !usedRotIds.has(t.id));
  const source = notShown.length > 0 ? notShown : pool;
  if (notShown.length === 0) usedRotIds = new Set();
  const token = source[Math.floor(Math.random() * source.length)];
  if (token) usedRotIds.add(token.id);
  return token || null;
}

// ── NFT CARD ──────────────────────────────────────────────────────────────
function NFTCard({ token, size = 80, fluid = false }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgUrl = fixImg(token?.image_url);
  const w = fluid ? "100%" : size;
  const fontSize = fluid ? 10 : Math.max(8, size * 0.1);
  const subSize = fluid ? 8 : Math.max(7, size * 0.09);
  const errSize = fluid ? "1.8em" : `${size * 0.2}px`;

  return (
    <div style={{ width: w, flexShrink: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
      <div style={{ width: "100%", aspectRatio: "1", background: C.corrupt, position: "relative", overflow: "hidden" }}>
        {imgUrl && !errored && (
          <img src={imgUrl} alt={token.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: loaded ? "block" : "none", position: "absolute", inset: 0 }}
            onLoad={() => setLoaded(true)} onError={() => setErrored(true)} />
        )}
        {!loaded && !errored && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTopColor: C.acid, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}
        {errored && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
            <div style={{ fontFamily: imp, fontSize: errSize, color: C.acid, lineHeight: 1 }}>{getBase(token).slice(0, 3).toUpperCase()}</div>
            <div style={{ fontSize: 8, color: C.muted }}>#{token.id}</div>
          </div>
        )}
      </div>
      <div style={{ padding: "4px 5px 6px", height: 44, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
        <div style={{ fontSize, color: C.acid, fontWeight: 700, fontFamily: imp, letterSpacing: 0.5, lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{getBase(token)}</div>
        <div style={{ fontSize: subSize, color: C.muted }}>#{token.id}</div>
      </div>
    </div>
  );
}

function CardBack({ size = 28 }) {
  return (
    <div style={{ width: size, height: size * 1.35, flexShrink: 0, background: `repeating-linear-gradient(135deg,${C.corrupt},${C.corrupt} 4px,#0D0820 4px,#0D0820 8px)`, border: `1px solid ${C.border}`, borderRadius: 4 }} />
  );
}

// ── LOADING ───────────────────────────────────────────────────────────────
function Loader({ msg, progress = 0 }) {
  return (
    <div style={{ background: C.void, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24, fontFamily: mono }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes sl{0%{transform:translateX(-200%)}100%{transform:translateX(500%)}}@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes fadein{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}@keyframes cardpop{from{opacity:0;transform:translateY(14px) scale(0.9)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      <h1 style={{ fontFamily: imp, fontSize: 64, lineHeight: 1, margin: 0, textAlign: "center" }}>
        <span style={{ color: C.acid }}>GO</span> <span style={{ color: C.mag }}>ROT</span>
      </h1>

      {/* Progress bar */}
      <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ width: "100%", height: 4, background: C.corrupt, borderRadius: 2, overflow: "hidden" }}>
          {progress > 0 ? (
            <div style={{ width: `${progress}%`, height: "100%", background: C.acid, borderRadius: 2, transition: "width 0.4s ease" }} />
          ) : (
            <div style={{ width: "40%", height: "100%", background: C.acid, borderRadius: 2, animation: "sl 1.3s ease-in-out infinite" }} />
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <p style={{ color: C.muted, fontSize: 10, margin: 0, lineHeight: 1.6, flex: 1 }}>{msg}</p>
          {progress > 0 && (
            <p style={{ color: C.acid, fontSize: 10, margin: 0, fontFamily: imp }}>{progress}%</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── GO ROT MODAL ───────────────────────────────────────────────────────────
function RotModal({ asker, target, base, rotToken, pileCount, onDraw, autoPlay }) {
  const [drawn, setDrawn] = useState(false);
  const rotBase = rotToken ? getBase(rotToken) : null;

  function handleTap() {
    if (drawn) return;
    setDrawn(true);
    setTimeout(onDraw, 950); // let the reveal animation play before advancing
  }

  // Bot auto-taps the pile after a short beat
  useEffect(() => {
    if (!autoPlay || drawn) return;
    const t = setTimeout(handleTap, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.mag}`, borderRadius: 16, padding: "24px 20px", maxWidth: 300, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 16, animation: "fadein 0.25s ease", boxShadow: "0 0 28px rgba(255,45,120,0.2)" }}>
        <h2 style={{ fontFamily: imp, fontSize: 52, color: C.mag, margin: 0, lineHeight: 1, letterSpacing: 3 }}>GO ROT!</h2>

        <p style={{ color: C.chalk, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          <b style={{ color: C.acid }}>{target}</b> had no <b style={{ color: C.chalk }}>{base}</b>.
        </p>

        {!drawn ? (
          <>
            <div onClick={handleTap} style={{ display: "flex", justifyContent: "center", cursor: "pointer" }}>
              <div style={{
                width: 140, height: 140 * 1.35,
                background: `repeating-linear-gradient(135deg, ${C.corrupt}, ${C.corrupt} 6px, #0D0820 6px, #0D0820 12px)`,
                border: `2px solid ${C.mag}`, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: "pulseTap 1.1s ease-in-out infinite",
                boxShadow: "0 0 20px rgba(255,45,120,0.25)",
              }}>
                <div style={{ fontSize: 36, opacity: 0.6 }}>🧠</div>
              </div>
            </div>
            <p style={{ color: C.mag, fontSize: 13, fontFamily: imp, letterSpacing: 1, margin: 0 }}>
              {autoPlay ? "DRAWING…" : "TAP THE PILE TO DRAW"}
            </p>
            <p style={{ color: C.muted, fontSize: 10, margin: 0 }}>{pileCount} card{pileCount !== 1 ? "s" : ""} remaining</p>
          </>
        ) : autoPlay ? (
          // Bot draw — keep it face-down, never reveal what it picked up.
          <>
            <div style={{ display: "flex", justifyContent: "center", animation: "flipIn 0.5s ease both" }}>
              <div style={{
                width: 140, height: 140 * 1.35,
                background: `repeating-linear-gradient(135deg, ${C.corrupt}, ${C.corrupt} 6px, #0D0820 6px, #0D0820 12px)`,
                border: `2px solid ${C.border}`, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ fontSize: 36, opacity: 0.35 }}>🧠</div>
              </div>
            </div>
            <p style={{ color: C.muted, fontSize: 11, margin: 0 }}>{asker} adds a card to its hand, face-down.</p>
          </>
        ) : (
          // Human draw — show the real NFT they picked up.
          <>
            <div style={{ display: "flex", justifyContent: "center", animation: "flipIn 0.5s ease both" }}>
              {rotToken
                ? <NFTCard token={rotToken} size={140} />
                : <div style={{ width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 12 }}>Pile empty</div>
              }
            </div>
            {rotBase && (
              <p style={{ color: C.acid, fontSize: 11, margin: 0, letterSpacing: 1, textTransform: "uppercase", fontFamily: imp }}>
                {rotBase} #{rotToken.id}
              </p>
            )}
            <p style={{ color: C.muted, fontSize: 11, margin: 0 }}>{asker} adds it to their hand…</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── MATCH MODAL ───────────────────────────────────────────────────────────
function MatchModal({ asker, target, base, cards, score, bonusDesc, onDismiss }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflow: "auto" }}>
      <div style={{ background: C.card, border: `2px solid ${C.acid}`, borderRadius: 16, padding: "24px 20px", maxWidth: 360, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 18, animation: "fadein 0.2s ease", boxShadow: "0 0 32px rgba(57,255,20,0.25)" }}>
        {/* Header */}
        <div>
          <h2 style={{ fontFamily: imp, fontSize: 40, color: C.acid, margin: 0, lineHeight: 1, letterSpacing: 2 }}>
            MATCH!
          </h2>
          <p style={{ color: C.muted, fontSize: 11, margin: "6px 0 0" }}>
            <b style={{ color: C.chalk }}>{asker}</b> snagged <b style={{ color: C.acid }}>{cards.length}× {base}</b> from <b style={{ color: C.mag }}>{target}</b>
          </p>
        </div>

        {/* Cards — 4 per row, wrapping */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, justifyItems: "center" }}>
          {cards.map((card, i) => (
            <div key={card.id} style={{ animation: `cardpop 0.25s ease ${i * 0.07}s both` }}>
              <NFTCard token={card} size={64} />
            </div>
          ))}
        </div>

        {/* Score breakdown */}
        <div style={{ background: C.corrupt, borderRadius: 8, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.muted, fontSize: 11 }}>{cards.length} cards</span>
            <span style={{ color: C.chalk, fontSize: 13, fontWeight: 700 }}>+{cards.length} pts</span>
          </div>
          {bonusDesc.map((b, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: C.muted, fontSize: 11 }}>{b.replace(/^\+\d+ /, "")} combo</span>
              <span style={{ color: "#FFD700", fontSize: 13, fontWeight: 700 }}>{b.startsWith("+") ? b.split(" ")[0] : ""} pts</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.acid, fontSize: 12, fontWeight: 700 }}>Total</span>
            <span style={{ fontFamily: imp, fontSize: 24, color: C.acid }}>+{score} pts</span>
          </div>
        </div>

        <button onClick={onDismiss}
          style={{ background: C.acid, border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 20, letterSpacing: 1, padding: 13, cursor: "pointer" }}>
          GO AGAIN!
        </button>
      </div>
    </div>
  );
}

// ── SET COMPLETE MODAL ────────────────────────────────────────────────────
function SetModal({ player, set, onDismiss }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflow: "auto" }}>
      <div style={{ background: C.card, border: `2px solid #FFD700`, borderRadius: 16, padding: "24px 20px", maxWidth: 360, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 18, animation: "fadein 0.2s ease", boxShadow: "0 0 32px rgba(255,215,0,0.2)" }}>
        <div>
          <div style={{ fontSize: 36 }}>🏆</div>
          <h2 style={{ fontFamily: imp, fontSize: 32, color: "#FFD700", margin: "4px 0 0", lineHeight: 1 }}>SET COMPLETE!</h2>
          <p style={{ color: C.muted, fontSize: 11, margin: "6px 0 0" }}>
            <b style={{ color: C.chalk }}>{player}</b> collected <b style={{ color: C.acid }}>{set.tokens.length}× {set.base}</b>
          </p>
        </div>

        {/* Cards — 4 per row, wrapping */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, justifyItems: "center" }}>
          {set.tokens.map((card, i) => (
            <div key={card.id} style={{ animation: `cardpop 0.25s ease ${i * 0.07}s both` }}>
              <NFTCard token={card} size={64} />
            </div>
          ))}
        </div>

        <div style={{ background: C.corrupt, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ fontFamily: imp, fontSize: 28, color: "#FFD700" }}>+{set.score} pts</div>
          {set.bonusDesc.length > 0 && <div style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>{set.bonusDesc.join("  ")}</div>}
        </div>

        <button onClick={onDismiss}
          style={{ background: "#FFD700", border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 20, letterSpacing: 1, padding: 13, cursor: "pointer" }}>
          SWEET!
        </button>
      </div>
    </div>
  );
}

// ── MODE SELECT ────────────────────────────────────────────────────────────
function ModeSelect({ onPick }) {
  const modes = [
    {
      id: "local",
      title: "PASS & PLAY",
      sub: "Local Multiplayer",
      desc: "2–6 players, one device. Pass it around the table.",
      icon: "👥",
      color: C.acid,
    },
    {
      id: "bot",
      title: "VS. ROTTINGTON",
      sub: "Single Player",
      desc: "You against Rottington, the resident AI brainrot. No passing required.",
      icon: "🤖",
      color: C.mag,
    },
    {
      id: "invite",
      title: "INVITE A FRIEND",
      sub: "Remote Multiplayer",
      desc: "Generate a link to send. (Needs a backend — coming soon.)",
      icon: "🔗",
      color: "#00D4FF",
    },
  ];

  return (
    <div style={{ background: C.void, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "28px 16px", fontFamily: mono }}>
      <div style={{ textAlign: "center" }}>

        <h1 style={{ fontFamily: imp, fontSize: "min(64px,16vw)", lineHeight: 0.9, margin: 0 }}>
          <span style={{ color: C.acid }}>GO</span> <span style={{ color: C.mag }}>ROT</span>
        </h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 380 }}>
        {modes.map(m => (
          <button key={m.id} onClick={() => onPick(m.id)}
            style={{
              background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 12,
              padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
              cursor: "pointer", textAlign: "left", width: "100%",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = m.color}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          >
            <div style={{ fontSize: 30, flexShrink: 0, width: 44, textAlign: "center" }}>{m.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: imp, fontSize: 19, color: m.color, letterSpacing: 0.5, lineHeight: 1.1 }}>{m.title}</div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", margin: "2px 0 4px" }}>{m.sub}</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{m.desc}</div>
            </div>
            <div style={{ color: m.color, fontSize: 20, flexShrink: 0 }}>›</div>
          </button>
        ))}
      </div>

      <p style={{ color: C.muted, fontSize: 9, textAlign: "center", lineHeight: 1.8, margin: 0, maxWidth: 320 }}>
        Created by{" "}
        <a href="https://lampwrecked.art" target="_blank" rel="noopener noreferrer" style={{ color: C.chalk, textDecoration: "none", borderBottom: `1px solid ${C.muted}` }}>Lampwrecked</a>
        {" "}· Based on the NFT collection{" "}
        <a href="https://brainrot.works" target="_blank" rel="noopener noreferrer" style={{ color: C.acid, textDecoration: "none", borderBottom: `1px solid ${C.acid}` }}>BRAINROT</a>
        {" "}by <span style={{ color: C.chalk }}>Nuclear Samurai</span>
      </p>
    </div>
  );
}

// ── INVITE SCREEN ─────────────────────────────────────────────────────────
function InviteScreen({ onBack, onPlayLocalInstead }) {
  const [copied, setCopied] = useState(false);
  const fakeLink = typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname}?join=${Math.random().toString(36).slice(2, 8)}`
    : "https://brainrot-gorot.app/join/xyz123";

  function copyLink() {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(fakeLink).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  }

  return (
    <div style={{ background: C.void, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "24px 16px", fontFamily: mono }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, maxWidth: 380, width: "100%", display: "flex", flexDirection: "column", gap: 18, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 36 }}>🔗</div>
          <h2 style={{ fontFamily: imp, fontSize: 28, color: "#00D4FF", margin: "8px 0 0" }}>INVITE A FRIEND</h2>
        </div>

        <div style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.3)", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ color: "#FFB800", fontSize: 11, lineHeight: 1.7, margin: 0 }}>
            ⚠ Remote play needs a live backend to sync moves between devices. This artifact runs client-side only, so the link below is a preview — opening it on another device won't connect to this game yet.
          </p>
        </div>

        <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 11, color: C.muted, wordBreak: "break-all", textAlign: "left" }}>
          {fakeLink}
        </div>

        <button onClick={copyLink}
          style={{ background: copied ? C.acid : "#00D4FF", border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 16, letterSpacing: 1, padding: 12, cursor: "pointer" }}>
          {copied ? "COPIED!" : "COPY LINK"}
        </button>

        <p style={{ color: C.muted, fontSize: 10, lineHeight: 1.6, margin: 0 }}>
          Want this working for real? Deploy with a small WebSocket relay (Partykit, Socket.io) and the game state already syncs cleanly.
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onBack}
            style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontFamily: mono, fontSize: 12, padding: 12, cursor: "pointer" }}>
            ← Back
          </button>
          <button onClick={onPlayLocalInstead}
            style={{ flex: 1, background: C.acid, border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 14, letterSpacing: 0.5, padding: 12, cursor: "pointer" }}>
            Play Pass & Play
          </button>
        </div>
      </div>
    </div>
  );
}


function Lobby({ onStart, ready, progress, mode, onBack }) {
  const isBot = mode === "bot";
  const [names, setNames] = useState(isBot ? ["Player 1", "Rottington 🤖"] : ["Player 1", "Player 2"]);
  const [err, setErr] = useState("");
  const upd = (i, v) => { const n = [...names]; n[i] = v; setNames(n); };
  const start = () => {
    const v = names.map(n => n.trim()).filter(Boolean);
    if ([...new Set(v)].length < 2) { setErr("Need 2+ unique names."); return; }
    setErr(""); onStart(v);
  };
  return (
    <div style={{ background: C.void, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "24px 16px", fontFamily: mono }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontFamily: imp, fontSize: "min(72px,18vw)", lineHeight: 0.9, margin: 0 }}>
          <span style={{ color: C.acid }}>GO</span> <span style={{ color: C.mag }}>ROT</span>
        </h1>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ color: C.acid, fontFamily: imp, fontSize: 13, letterSpacing: 1, margin: 0 }}>PLAYERS</p>
          <span style={{ fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: "uppercase" }}>
            {isBot ? "VS. ROTTINGTON" : "PASS & PLAY"}
          </span>
        </div>
        {names.map((n, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: C.muted, fontFamily: imp, fontSize: 16, minWidth: 16 }}>{i + 1}</span>
            <input value={n} onChange={e => upd(i, e.target.value)} placeholder="Name"
              disabled={isBot && i === 1}
              style={{ flex: 1, background: C.void, border: `1px solid ${C.border}`, borderRadius: 6, color: isBot && i === 1 ? C.mag : C.chalk, fontFamily: mono, fontSize: 14, padding: "10px 12px", outline: "none", opacity: isBot && i === 1 ? 0.85 : 1 }} />
            {!isBot && i >= 2 && <button onClick={() => setNames(names.filter((_, j) => j !== i))}
              style={{ background: "none", border: `1px solid ${C.mag}`, borderRadius: 6, color: C.mag, fontFamily: mono, fontSize: 11, padding: "9px 10px", cursor: "pointer" }}>✕</button>}
          </div>
        ))}
        {!isBot && names.length < 6 && (
          <button onClick={() => setNames([...names, `Player ${names.length + 1}`])}
            style={{ background: "none", border: `1px dashed ${C.border}`, borderRadius: 6, color: C.muted, fontFamily: mono, fontSize: 11, padding: 10, cursor: "pointer" }}>
            + Add Player
          </button>
        )}
        {err && <p style={{ color: C.mag, fontSize: 11, margin: 0, textAlign: "center" }}>{err}</p>}

        {!ready ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ width: "100%", height: 6, background: C.corrupt, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: C.acid, borderRadius: 3, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ color: C.muted, fontSize: 10, margin: 0 }}>Loading cards from the collection…</p>
              <p style={{ color: C.acid, fontSize: 10, margin: 0, fontFamily: imp }}>{progress}%</p>
            </div>
            <button disabled style={{ background: C.corrupt, border: "none", borderRadius: 8, color: C.muted, fontFamily: imp, fontSize: 20, letterSpacing: 1, padding: 14, cursor: "default", opacity: 0.5 }}>
              DEAL THE CARDS
            </button>
          </div>
        ) : (
          <button onClick={start}
            style={{ background: C.acid, border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 20, letterSpacing: 1, padding: 14, cursor: "pointer" }}>
            DEAL THE CARDS
          </button>
        )}
        <p style={{ color: C.muted, fontSize: 9, textAlign: "center", lineHeight: 1.7, margin: 0 }}>
          {isBot ? "Rottington plays automatically on its turn." : "Pass-and-play"} · 3+ same Base = set · Trait combos = bonus pts
        </p>
        <button onClick={onBack}
          style={{ background: "none", border: "none", color: C.muted, fontFamily: mono, fontSize: 10, padding: 4, cursor: "pointer", textDecoration: "underline" }}>
          ← Choose a different mode
        </button>
      </div>
    </div>
  );
}

// ── PASS SCREEN ───────────────────────────────────────────────────────────
function PassScreen({ player, onReady }) {
  const sum = {};
  player.hand.forEach(t => { const b = getBase(t); sum[b] = (sum[b] || 0) + 1; });
  return (
    <div style={{ background: C.void, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: mono }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, maxWidth: 340, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <p style={{ color: C.muted, fontSize: 9, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 8px" }}>Pass to</p>
          <h2 style={{ fontFamily: imp, fontSize: 48, color: C.acid, margin: 0, lineHeight: 1 }}>{player.name}</h2>
        </div>
        <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.7, margin: 0 }}>
          You have <b style={{ color: C.chalk }}>{player.hand.length} cards</b>. Tap ready to reveal.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {Object.entries(sum).map(([b, c]) => (
            <span key={b} style={{ background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.3)", borderRadius: 4, padding: "4px 9px", fontSize: 11, color: C.acid }}>{c}× {b}</span>
          ))}
        </div>
        <button onClick={onReady}
          style={{ background: C.acid, border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 20, letterSpacing: 1, padding: 14, cursor: "pointer" }}>
          I'M READY
        </button>
      </div>
    </div>
  );
}

// ── CARD VIEWER ───────────────────────────────────────────────────────────
function CardViewer({ token, onClose }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgUrl = fixImg(token?.image_url);
  const base = getBase(token);
  const attrs = token?.attributes?.filter(a => a.value && a.value !== "None") || [];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.96)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadein 0.18s ease" }}
      onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 14 }}
        onClick={e => e.stopPropagation()}>

        {/* Card image */}
        <div style={{ width: "100%", aspectRatio: "1", background: C.corrupt, borderRadius: 14, overflow: "hidden", position: "relative", boxShadow: "0 0 40px rgba(57,255,20,0.15)" }}>
          {imgUrl && !errored && (
            <img src={imgUrl} alt={token.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: loaded ? "block" : "none" }}
              onLoad={() => setLoaded(true)} onError={() => setErrored(true)} />
          )}
          {!loaded && !errored && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.acid, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          )}
          {errored && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontFamily: imp, fontSize: 48, color: C.acid }}>{base.slice(0, 3).toUpperCase()}</div>
            </div>
          )}
        </div>

        {/* Card details */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontFamily: imp, fontSize: 22, color: C.acid, letterSpacing: 1 }}>{token.name || `#${token.id}`}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Token #{token.id}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {attrs.map((a, i) => (
              <div key={i} style={{ background: C.corrupt, border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 8px" }}>
                <div style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{a.trait_type}</div>
                <div style={{ fontSize: 11, color: C.chalk, fontWeight: 700 }}>{a.value}</div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onClose}
          style={{ background: C.acid, border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 18, letterSpacing: 1, padding: 13, cursor: "pointer" }}>
          CLOSE
        </button>
      </div>
    </div>
  );
}

// ── HAND OVER MODAL ───────────────────────────────────────────────────────
// Shown when Rottington asks and the human has matching cards.
// The human must tap each card to hand it over.
function HandOverModal({ asker, base, cards, onConfirm }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.mag}`, borderRadius: 16, padding: "24px 20px", maxWidth: 360, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 16, animation: "fadein 0.2s ease", boxShadow: "0 0 28px rgba(255,45,120,0.2)" }}>
        <div>
          <p style={{ color: C.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 6px" }}>Rottington asks</p>
          <h2 style={{ fontFamily: imp, fontSize: 32, color: C.mag, margin: 0, lineHeight: 1 }}>Do you have any <span style={{ color: C.chalk }}>{base}</span>?</h2>
        </div>
        <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, margin: 0 }}>
          You do! Hand over your <b style={{ color: C.acid }}>{cards.length}× {base}</b> to Rottington.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          {cards.map((card, i) => (
            <div key={card.id} style={{ animation: `cardpop 0.25s ease ${i * 0.07}s both` }}>
              <NFTCard token={card} fluid />
            </div>
          ))}
        </div>
        <button onClick={onConfirm}
          style={{ background: C.mag, border: "none", borderRadius: 8, color: "white", fontFamily: imp, fontSize: 20, letterSpacing: 1, padding: 13, cursor: "pointer" }}>
          HAND OVER
        </button>
      </div>
    </div>
  );
}

// ── GAME END MODAL ────────────────────────────────────────────────────────
function GameEndModal({ players, round, totalRounds, onNext, onEnd }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const leader = sorted[0];
  const isLastRound = round >= totalRounds;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.card, border: `2px solid ${C.acid}`, borderRadius: 16, padding: "28px 20px", maxWidth: 320, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 16, animation: "fadein 0.2s ease", boxShadow: "0 0 32px rgba(57,255,20,0.2)" }}>
        <div>
          <p style={{ color: C.muted, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 6px" }}>
            Round {round} of {totalRounds} complete
          </p>
          <h2 style={{ fontFamily: imp, fontSize: 32, color: C.acid, margin: 0, lineHeight: 1 }}>{leader.name}</h2>
          <p style={{ fontFamily: imp, fontSize: 16, color: C.chalk, margin: "4px 0 0", letterSpacing: 1 }}>
            {isLastRound ? "WINS!" : "IS LEADING"}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((p, i) => (
            <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderRadius: 6, background: i === 0 ? "rgba(57,255,20,0.08)" : C.corrupt, border: `1px solid ${i === 0 ? C.acid : C.border}` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? C.acid : C.chalk }}>{p.name}</span>
              <span style={{ fontFamily: imp, fontSize: 20, color: C.acid }}>{p.score}</span>
            </div>
          ))}
        </div>
        {isLastRound ? (
          <button onClick={onEnd} style={{ background: C.acid, border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 20, letterSpacing: 1, padding: 13, cursor: "pointer" }}>
            SEE FINAL SCORES
          </button>
        ) : (
          <button onClick={onNext} style={{ background: C.acid, border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 20, letterSpacing: 1, padding: 13, cursor: "pointer" }}>
            NEXT ROUND →
          </button>
        )}
      </div>
    </div>
  );
}

// ── GAME ──────────────────────────────────────────────────────────────────
function GameScreen({ players: init, pile: initPile, allTokens, isBotMode, onEnd }) {
  const [players, setPlayers] = useState(init);
  const [pile, setPile] = useState(initPile);
  const [round, setRound] = useState(1);
  const [cur, setCur] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selBase, setSelBase] = useState(null);
  const [targetIdx, setTargetIdx] = useState(init.length > 1 ? 1 : 0);
  const [log, setLog] = useState([]);
  const [askErr, setAskErr] = useState("");
  const [showScores, setShowScores] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [viewedCard, setViewedCard] = useState(null);

  const BOT_IDX = init.length - 1;
  const isBotTurn = isBotMode && cur === BOT_IDX;

  const [modal, setModal] = useState(null);
  const modalQueue = useRef([]);

  const addLog = h => setLog(l => [h, ...l.slice(0, 20)]);

  function startNewRound(currentPlayers, nextRound) {
    // Redeal from the full token pool, preserving cumulative scores
    const shuffled = shuffle([...allTokens]);
    const handSize = Math.min(7, Math.floor(shuffled.length / currentPlayers.length));
    const newPlayers = currentPlayers.map((p, i) => ({
      ...p,
      hand: shuffled.slice(i * handSize, (i + 1) * handSize),
      sets: [], // clear sets for the new round (scores carry over)
    }));
    const newPile = shuffled.slice(currentPlayers.length * handSize);
    setPlayers(newPlayers);
    setPile(newPile);
    setRound(nextRound);
    setCur(0);
    setRevealed(false);
    setSelBase(null);
    setModal(null);
    modalQueue.current = [];
    addLog(`── Round ${nextRound} begins ──`);
  }

  function showNext() {
    if (modalQueue.current.length > 0) {
      setModal(modalQueue.current.shift());
    } else {
      setModal(null);
    }
  }

  function applyCheck(ps, idx, newSetsOut) {
    const p = ps[idx];
    const { newSets, remaining } = computeSets(p.hand);
    if (!newSets.length) return ps;
    newSets.forEach(s => newSetsOut.push({ player: p.name, set: s }));
    return ps.map((pl, i) => i !== idx ? pl : {
      ...pl, hand: remaining,
      sets: [...pl.sets, ...newSets],
      score: pl.score + newSets.reduce((a, s) => a + s.score, 0)
    });
  }

  function ask(overrideBase, overrideTarget) {
    const useBase = overrideBase ?? selBase;
    const useTarget = overrideTarget ?? targetIdx;
    if (!useBase) { setAskErr("Pick a Base first."); return; }
    const me = players[cur]; const them = players[useTarget];
    if (!me.hand.some(t => getBase(t) === useBase)) { setAskErr(`You have no ${useBase}.`); return; }
    setAskErr("");

    const matching = them.hand.filter(t => getBase(t) === useBase);
    const pendingModals = [];
    const newSetsFound = [];

    if (matching.length > 0) {
      const matchedSnapshot = matching.map(t => ({ ...t }));

      // When Rottington is asking and the human has cards, pause and ask
      // the human to physically hand them over rather than auto-transferring.
      if (isBotMode && cur === BOT_IDX) {
        setModal({ type: "handover", asker: me.name, base: useBase, cards: matchedSnapshot, useTarget });
        return;
      }

      // Human-asks-human or human-asks-bot: transfer immediately
      let ps = players.map((p, i) => {
        if (i === useTarget) return { ...p, hand: p.hand.filter(t => !matching.find(m => m.id === t.id)) };
        if (i === cur) return { ...p, hand: [...p.hand, ...matching] };
        return p;
      });
      ps = applyCheck(ps, cur, newSetsFound);
      addLog(`${me.name} got ${matching.length}× ${useBase} from ${them.name}`);

      const matchScore = matching.length;
      pendingModals.push({
        type: "match",
        asker: me.name, target: them.name, base: useBase,
        cards: matchedSnapshot, score: matchScore, bonusDesc: [],
      });

      newSetsFound.forEach(({ player, set }) => {
        addLog(`${player} SET: ${set.tokens.length}× ${set.base} = ${set.score}pts`);
        pendingModals.push({ type: "set", player, set });
      });

      setPlayers(ps); setSelBase(null);

      // Only end if pile was already empty before this turn started —
      // a match doesn't consume the pile, so check pile (not p2).
      // The real end trigger is performDraw when p2 becomes empty.
      // We check here only for the edge case where pile hit 0 from a
      // previous draw and a match happens on the following go-again turn.
      if (pile.length === 0) {
        // Score all remaining hands before ending
        let finalPs = ps;
        const finalSets = [];
        finalPs.forEach((_, i) => { finalPs = applyCheck(finalPs, i, finalSets); });
        setPlayers(finalPs);
        finalSets.forEach(({ player, set }) => {
          addLog(`${player} SET: ${set.tokens.length}× ${set.base} = ${set.score}pts`);
          pendingModals.push({ type: "set", player, set });
        });
        pendingModals.push({ type: "gameend", players: finalPs });
      }

      modalQueue.current = pendingModals;
      showNext();
    } else {
      // Don't draw yet — show the Go Rot modal with a tap-the-pile prompt.
      // The actual draw happens when the player physically taps the pile.
      addLog(`${me.name} asked for ${useBase} — GO ROT!`);
      setPlayers(players); setSelBase(null);

      // Only compute a reveal card for human turns — the bot's draw stays
      // hidden, so there's no need to consume a slot from the unused pool.
      let rotToken = null;
      if (!(isBotMode && cur === BOT_IDX)) {
        const inPlayIds = new Set([
          ...players.flatMap(p => p.hand.map(t => t.id)),
          ...pile.map(t => t.id),
        ]);
        rotToken = pickRotToken(allTokens, inPlayIds);
      }

      const rotModal = { type: "rot", asker: me.name, target: them.name, base: useBase, rotToken, needsDraw: true };
      modalQueue.current = pendingModals; // any sets from a prior match this turn (rare on a miss) still queue after
      setModal(rotModal);
    }
  }

  // Called when human taps "HAND OVER" after Rottington asks them
  function confirmHandOver() {
    const { base, cards, useTarget } = modal;
    const me = players[cur]; // Rottington
    setModal(null);

    const matching = cards;
    const pendingModals = [];
    const newSetsFound = [];

    let ps = players.map((p, i) => {
      if (i === useTarget) return { ...p, hand: p.hand.filter(t => !matching.find(m => m.id === t.id)) };
      if (i === cur) return { ...p, hand: [...p.hand, ...matching] };
      return p;
    });
    ps = applyCheck(ps, cur, newSetsFound);
    addLog(`${me.name} got ${matching.length}× ${base} from ${players[useTarget].name}`);

    pendingModals.push({
      type: "match",
      asker: me.name, target: players[useTarget].name, base,
      cards: matching, score: matching.length, bonusDesc: [],
    });

    newSetsFound.forEach(({ player, set }) => {
      addLog(`${player} SET: ${set.tokens.length}× ${set.base} = ${set.score}pts`);
      pendingModals.push({ type: "set", player, set });
    });

    setPlayers(ps); setSelBase(null);

    if (pile.length === 0) {
      let finalPs = ps;
      const finalSets = [];
      finalPs.forEach((_, i) => { finalPs = applyCheck(finalPs, i, finalSets); });
      setPlayers(finalPs);
      finalSets.forEach(({ player, set }) => pendingModals.push({ type: "set", player, set }));
      pendingModals.push({ type: "gameend", players: finalPs });
    }

    modalQueue.current = pendingModals;
    showNext();
  }

  // Called when the player taps the draw pile during a Go Rot modal
  function performDraw() {
    let ps = [...players]; let p2 = [...pile];
    const newSetsFound = [];

    if (p2.length > 0) {
      const drawn = p2.pop();
      ps = ps.map((p, i) => i === cur ? { ...p, hand: [...p.hand, drawn] } : p);
      addLog(`${me.name} drew: ${getBase(drawn)}`);
      ps = applyCheck(ps, cur, newSetsFound);
      setPile(p2);
    } else {
      addLog(`${me.name} — pile was already empty.`);
    }

    const setModals = [];
    newSetsFound.forEach(({ player, set }) => {
      addLog(`${player} SET: ${set.tokens.length}× ${set.base} = ${set.score}pts`);
      setModals.push({ type: "set", player, set });
    });

    setPlayers(ps);
    setModal(null);

    if (p2.length === 0) {
      // Score any remaining sets in all hands before ending
      let finalPs = ps;
      const finalSets = [];
      finalPs.forEach((_, i) => {
        const before = finalPs;
        finalPs = applyCheck(finalPs, i, finalSets);
      });
      setPlayers(finalPs);
      const endModals = finalSets.map(({ player, set }) => ({ type: "set", player, set }));
      endModals.push({ type: "gameend", players: finalPs });
      modalQueue.current = endModals;
      showNext();
      return;
    }

    if (setModals.length > 0) {
      modalQueue.current = setModals;
      showNext();
    } else {
      const next = (cur + 1) % ps.length;
      setCur(next); setTargetIdx((next + 1) % ps.length);
      setRevealed(isBotMode && next === BOT_IDX);
      setSelBase(null);
    }
  }

  function dismissModal() {
    if (modal?.type === "gameend") {
      if (round >= TOTAL_ROUNDS) {
        onEnd(modal.players);
      } else {
        startNewRound(modal.players, round + 1);
      }
      return;
    }
    if (modal?.type === "match" && modalQueue.current.length === 0) {
      setModal(null);
    } else {
      showNext();
    }
  }

  // ── BOT AUTO-PLAY ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isBotTurn || modal || botThinking) return;
    const bot = players[BOT_IDX];
    if (!bot || bot.hand.length === 0) return; // nothing to ask with yet

    setBotThinking(true);
    const t = setTimeout(() => {
      const botBases = [...new Set(bot.hand.map(t => getBase(t)))];
      const chosenBase = botBases[Math.floor(Math.random() * botBases.length)];
      // pick a random human target (anyone but itself)
      const candidates = players.map((_, i) => i).filter(i => i !== BOT_IDX);
      const chosenTarget = candidates[Math.floor(Math.random() * candidates.length)];
      ask(chosenBase, chosenTarget);
      setBotThinking(false);
    }, 1100);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBotTurn, modal, players, cur]);

  const me = players[cur];
  const basesInHand = [...new Set(me.hand.map(t => getBase(t)))].sort();

  if (!revealed && !(isBotMode && cur === BOT_IDX)) {
    return <PassScreen player={me} onReady={() => setRevealed(true)} />;
  }

  return (
    <div style={{ background: C.void, minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: mono, color: C.chalk, overflowY: "auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes fadein{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}@keyframes cardpop{from{opacity:0;transform:translateY(14px) scale(0.9)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes pulseTap{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}@keyframes flipIn{from{opacity:0;transform:rotateY(90deg) scale(0.8)}to{opacity:1;transform:rotateY(0) scale(1)}}`}</style>

      {viewedCard && <CardViewer token={viewedCard} onClose={() => setViewedCard(null)} />}

      {modal?.type === "handover" && (
        <HandOverModal asker={modal.asker} base={modal.base} cards={modal.cards} onConfirm={confirmHandOver} />
      )}
      {modal?.type === "gameend" && (
        <GameEndModal
          players={modal.players}
          round={round}
          totalRounds={TOTAL_ROUNDS}
          onNext={() => startNewRound(modal.players, round + 1)}
          onEnd={() => onEnd(modal.players)}
        />
      )}
      {modal?.type === "rot" && (
        <RotModal
          asker={modal.asker} target={modal.target} base={modal.base}
          rotToken={modal.rotToken} pileCount={pile.length}
          onDraw={performDraw}
          autoPlay={isBotMode && cur === BOT_IDX}
        />
      )}
      {modal?.type === "match" && (
        <MatchModal asker={modal.asker} target={modal.target} base={modal.base} cards={modal.cards} score={modal.score} bonusDesc={modal.bonusDesc} onDismiss={dismissModal} />
      )}
      {modal?.type === "set" && (
        <SetModal player={modal.player} set={modal.set} onDismiss={dismissModal} />
      )}

      {/* Top bar */}
      <div style={{ background: C.corrupt, borderBottom: `1px solid ${C.border}`, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: imp, fontSize: 15, letterSpacing: 1 }}>
            <span style={{ color: C.acid }}>GO</span> <span style={{ color: C.mag }}>ROT</span>
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>
            Round {round}/{TOTAL_ROUNDS} · Pile: {pile.length} · {isBotTurn ? <span style={{ color: C.mag }}>🤖 Rottington is thinking…</span> : `${me.name}'s turn`}
          </div>
        </div>
        <button onClick={() => setShowScores(s => !s)}
          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: C.chalk, fontFamily: mono, fontSize: 11, padding: "6px 10px", cursor: "pointer" }}>
          Scores {showScores ? "▴" : "▾"}
        </button>
      </div>

      {showScores && (
        <div style={{ background: C.corrupt, borderBottom: `1px solid ${C.border}`, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {players.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 6, background: i === cur ? "rgba(57,255,20,0.1)" : C.void, border: `1px solid ${i === cur ? "rgba(57,255,20,0.3)" : C.border}` }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: i === cur ? C.acid : C.chalk }}>{p.name}</span>
                {p.sets.length > 0 && <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{p.sets.map(s => `${s.tokens.length}× ${s.base}`).join(", ")}</div>}
              </div>
              <span style={{ fontFamily: imp, fontSize: 22, color: C.acid }}>{p.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* Other hands */}
      <div style={{ padding: "10px 14px 6px", flexShrink: 0 }}>
        <p style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: C.muted, margin: "0 0 6px" }}>Other Hands</p>
        {players.filter((_, i) => i !== cur).map(p => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <span style={{ color: C.mag, fontSize: 10, fontWeight: 700, minWidth: 58, flexShrink: 0 }}>{p.name}</span>
            <div style={{ display: "flex", gap: 2, overflow: "hidden" }}>
              {p.hand.slice(0, 12).map((_, i) => <CardBack key={i} size={20} />)}
              {p.hand.length > 12 && <span style={{ color: C.muted, fontSize: 9, alignSelf: "center", marginLeft: 2 }}>+{p.hand.length - 12}</span>}
            </div>
            <span style={{ color: C.muted, fontSize: 9, flexShrink: 0 }}>({p.hand.length})</span>
          </div>
        ))}
      </div>

      {/* Ask panel — hidden during bot's turn, replaced with a status card */}
      <div style={{ padding: "0 14px", flexShrink: 0 }}>
        {isBotTurn ? (
          <div style={{ background: C.card, border: `1px solid ${C.mag}`, borderRadius: 10, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 26, animation: "bob 1.2s ease-in-out infinite" }}>🤖</div>
            <p style={{ color: C.mag, fontFamily: imp, fontSize: 14, letterSpacing: 1, margin: "6px 0 0" }}>ROTTINGTON IS PLAYING…</p>
          </div>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontFamily: imp, fontSize: 13, color: C.chalk, margin: 0 }}>
              <span style={{ color: C.acid }}>{me.name}</span> — ask for a Base:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 5 }}>
              {basesInHand.map(base => {
                const count = me.hand.filter(t => getBase(t) === base).length;
                const sel = selBase === base;
                return (
                  <button key={base} onClick={() => { setSelBase(sel ? null : base); setAskErr(""); }}
                    style={{ background: sel ? "rgba(57,255,20,0.18)" : C.void, border: `1.5px solid ${sel ? C.acid : C.border}`, borderRadius: 6, color: sel ? C.acid : C.chalk, fontFamily: mono, fontSize: 10, padding: "8px 4px", cursor: "pointer", lineHeight: 1.4, textAlign: "center" }}>
                    <div style={{ fontWeight: 700 }}>{base}</div>
                    <div style={{ color: sel ? "rgba(57,255,20,0.6)" : C.muted, fontSize: 9 }}>{count} held</div>
                  </button>
                );
              })}
              {basesInHand.length === 0 && <p style={{ color: C.muted, fontSize: 11, gridColumn: "1/-1", margin: 0 }}>No cards in hand.</p>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={targetIdx} onChange={e => setTargetIdx(Number(e.target.value))}
                style={{ flex: 1, background: C.void, border: `1px solid ${C.border}`, borderRadius: 6, color: C.chalk, fontFamily: mono, fontSize: 13, padding: "9px 10px", outline: "none" }}>
                {players.map((p, i) => i !== cur && <option key={i} value={i}>{p.name}</option>)}
              </select>
              <button onClick={() => ask()}
                style={{ background: C.acid, border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 18, letterSpacing: 1, padding: "9px 20px", cursor: "pointer", flexShrink: 0 }}>
                ASK
              </button>
            </div>
            {askErr && <p style={{ color: C.mag, fontSize: 10, margin: 0 }}>{askErr}</p>}
          </div>
        )}
      </div>

      {/* Hand — hidden during bot's turn (bot's cards stay secret) */}
      <div style={{ padding: "10px 14px 0", flexShrink: 0 }}>
        {isBotTurn ? (
          <p style={{ color: C.muted, fontSize: 11, textAlign: "center", padding: "16px 0" }}>The bot's hand is hidden.</p>
        ) : (
          <>
            <p style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: C.muted, margin: "0 0 8px" }}>
              {me.name}'s Hand ({me.hand.length})
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              {me.hand.length === 0
                ? <p style={{ color: C.muted, fontSize: 11, margin: 0, padding: "8px 0", gridColumn: "1/-1" }}>No cards.</p>
                : me.hand.map(t => (
                    <div key={t.id} onClick={() => setViewedCard(t)} style={{ cursor: "pointer" }}>
                      <NFTCard token={t} fluid />
                    </div>
                  ))
              }
            </div>
          </>
        )}
      </div>

      {/* Log */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "6px 14px 8px", flexShrink: 0, maxHeight: 55, overflowY: "auto" }}>
        {log.slice(0, 3).map((e, i) => (
          <div key={i} style={{ fontSize: 9, color: i === 0 ? C.chalk : C.muted, lineHeight: 1.6 }}>{e}</div>
        ))}
      </div>

      <div style={{ padding: "4px 14px 12px", flexShrink: 0 }}>
        <button onClick={() => onEnd(players)}
          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontFamily: mono, fontSize: 10, padding: "6px 12px", cursor: "pointer" }}>
          End Game Early
        </button>
      </div>
    </div>
  );
}

// ── END ───────────────────────────────────────────────────────────────────
function EndScreen({ players, onRestart }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div style={{ background: C.void, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 20, fontFamily: mono }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: imp, fontSize: 18, color: C.mag, letterSpacing: 2, margin: 0 }}>GAME OVER</p>
        <h1 style={{ fontFamily: imp, fontSize: "min(58px,14vw)", color: C.acid, margin: "4px 0", lineHeight: 1 }}>{sorted[0].name}</h1>
        <p style={{ fontFamily: imp, fontSize: 22, color: C.chalk, letterSpacing: 2, margin: 0 }}>WINS</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 340 }}>
        {sorted.map((p, i) => (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: i === 0 ? "rgba(57,255,20,0.07)" : C.card, border: `1px solid ${i === 0 ? C.acid : C.border}`, borderRadius: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
              <div style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>{p.sets.length ? p.sets.map(s => `${s.tokens.length}× ${s.base}`).join(", ") : "No sets"}</div>
            </div>
            <div style={{ fontFamily: imp, fontSize: 28, color: C.acid }}>{p.score}</div>
          </div>
        ))}
      </div>
      <button onClick={onRestart}
        style={{ background: C.acid, border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 20, padding: "13px 32px", cursor: "pointer", width: "100%", maxWidth: 260 }}>
        PLAY AGAIN
      </button>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState("loading");
  const [status, setStatus] = useState("Connecting to the collection…");
  const [progress, setProgress] = useState(0);
  const [cardsReady, setCardsReady] = useState(false);
  const [basePools, setBasePools] = useState([]);
  const [mode, setMode] = useState(null); // "local" | "bot" | "invite"
  const [gamePlayers, setGamePlayers] = useState([]);
  const [gamePile, setGamePile] = useState([]);
  const [gameAllTokens, setGameAllTokens] = useState([]);
  const [endPlayers, setEndPlayers] = useState([]);

  const [tokenCache, setTokenCache] = useState([]);

  useEffect(() => {
    async function load(attempt = 1) {
      try {
        setProgress(2);
        setStatus(attempt > 1 ? `Retrying… (${attempt})` : "Fetching card catalog…");
        const td = await cpi("/traits?type=Base");
        const bases = td?.data?.[0]?.values || [];
        if (!bases.length) throw new Error("No bases found");
        const playable = bases.filter(b => b.count >= 4);
        setProgress(10);
        setStatus(`${playable.length} Base types found…`);

        // Fetch token ID pools per base (counts as 10→30% of progress)
        const pools = [];
        const take = Math.min(playable.length, 18);
        for (let i = 0; i < take; i++) {
          const b = playable[i];
          try {
            const d = await cpi(`/traits/tokens?type=Base&value=${encodeURIComponent(b.value)}&limit=100`);
            const ids = d?.data?.token_ids || [];
            if (ids.length >= 3) pools.push({ base: b.value, tokenIds: ids });
          } catch { /* skip */ }
          setProgress(10 + Math.round(((i + 1) / take) * 20));
          if ((i + 1) % 3 === 0) setStatus(`Loading pools… ${i + 1}/${take}`);
        }
        if (!pools.length) throw new Error("No pools found");
        setBasePools(pools);
        setProgress(30);

        // Prefetch card metadata (30→100% of progress)
        const perBase = 8;
        const maxBases = Math.min(pools.length, 20);
        const allIds = [];
        shuffle(pools).slice(0, maxBases).forEach(b =>
          allIds.push(...shuffle(b.tokenIds).slice(0, perBase))
        );
        const uniqueIds = [...new Set(allIds)];

        const cached = [];
        const CHUNK = 20;
        for (let i = 0; i < uniqueIds.length; i += CHUNK) {
          const chunk = uniqueIds.slice(i, i + CHUNK);
          const results = await Promise.all(
            chunk.map(id => cpi(`/tokens/${id}/metadata`).then(d => d?.data || null).catch(() => null))
          );
          results.forEach(m => { if (m) cached.push(m); });
          const pct = 30 + Math.round(((i + CHUNK) / uniqueIds.length) * 70);
          setProgress(Math.min(pct, 99));
          setStatus(`Loading cards… ${Math.min(i + CHUNK, uniqueIds.length)}/${uniqueIds.length}`);
        }

        setTokenCache(cached);
        setProgress(100);
        setCardsReady(true);
        setStatus(`${cached.length} cards ready.`);
        // Small delay so React flushes the cache state before transitioning
        await new Promise(r => setTimeout(r, 100));
        setPhase("mode-select");
      } catch (e) {
        console.warn(`Load attempt ${attempt} failed:`, e.message);
        const delay = Math.min(1200 * attempt, 8000);
        setStatus(`Connecting… retrying in ${Math.round(delay / 1000)}s`);
        setProgress(0);
        await new Promise(r => setTimeout(r, delay));
        return load(attempt + 1); // retry forever — never fall back to mock
      }
    }
    load();
  }, []);

  async function buildDeck(playerNames) {
    if (!cardsReady || tokenCache.length < 2) return;
    usedRotIds = new Set();
    try {
      const tokens = shuffle([...tokenCache]);
      const shuffled = shuffle(tokens);
      const handSize = Math.min(7, Math.floor(shuffled.length / playerNames.length));
      const players = playerNames.map((name, i) => ({ name, hand: shuffled.slice(i * handSize, (i + 1) * handSize), sets: [], score: 0 }));
      setGamePlayers(players);
      setGamePile(shuffled.slice(playerNames.length * handSize));
      setGameAllTokens(tokens);
      setPhase("game");
    } catch (e) {
      console.error("buildDeck error:", e);
    }
  }

  if (phase === "loading") return <Loader msg={status} progress={progress} />;
  if (phase === "mode-select") return <ModeSelect onPick={(m) => {
    setMode(m);
    if (m === "invite") setPhase("invite");
    else setPhase("lobby");
  }} />;
  if (phase === "invite") return (
    <InviteScreen
      onBack={() => setPhase("mode-select")}
      onPlayLocalInstead={() => { setMode("local"); setPhase("lobby"); }}
    />
  );
  if (phase === "lobby") return (
    <Lobby
      onStart={buildDeck}
      ready={cardsReady}
      progress={progress}
      mode={mode}
      onBack={() => setPhase("mode-select")}
    />
  );
  if (phase === "game") return (
    <GameScreen
      players={gamePlayers}
      pile={gamePile}
      allTokens={gameAllTokens}
      isBotMode={mode === "bot"}
      onEnd={ps => { setEndPlayers(ps); setPhase("end"); }}
    />
  );
  if (phase === "end") return <EndScreen players={endPlayers} onRestart={() => setPhase("mode-select")} />;
  return null;
}
