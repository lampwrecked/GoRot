import React, { useState, useEffect, useRef } from "react";

const API_KEY = "cpi_live_d5f453d6be82d02451f78cec7507763caea413d5ff902cd5";
const BASE_URL = "https://cpi.brainrot.works/v1";
const IMG_BASE = "https://cpi.brainrot.works";
const DECK_SIZE = 30; // smaller deck = faster rounds (~16 card pile for 2 players)
const SET_THRESHOLD = 3;
const TURNS_PER_PLAYER = 10;

// Module-level store — completely outside React, no closure issues ever
let TOKEN_STORE = [];
let usedRotIds = new Set();


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
function Loader({ msg, progress = 0, previewCards = [] }) {
  return (
    <div style={{ background: C.void, minHeight: "100vh", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24, fontFamily: mono, overflow: "hidden" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes sl{0%{transform:translateX(-200%)}100%{transform:translateX(500%)}}@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes fadein{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}@keyframes cardpop{from{opacity:0;transform:translateY(14px) scale(0.9)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes cardfade{from{opacity:0;transform:scale(0.9)}to{opacity:0.3;transform:scale(1)}}`}</style>

      {/* Background card grid */}
      <div style={{
        position: "absolute", inset: 0,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 6, padding: 6,
        zIndex: 0, pointerEvents: "none",
        alignContent: "start",
      }}>
        {previewCards.slice(0, 30).map((token, i) => (
          <div key={token.id} style={{
            borderRadius: 8, overflow: "hidden",
            background: C.corrupt,
            border: `1px solid ${C.border}`,
            opacity: 0,
            animation: `cardfade 0.5s ease ${(i % 6) * 0.05}s forwards`,
          }}>
            {token.image_url && (
              <img src={fixImg(token.image_url)} alt=""
                style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
            )}
          </div>
        ))}
      </div>

      {/* Dark vignette so foreground text is readable */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(10,10,15,0.75) 30%, rgba(10,10,15,0.4) 100%)", zIndex: 1, pointerEvents: "none" }} />

      {/* Foreground */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <h1 style={{ fontFamily: imp, fontSize: 64, lineHeight: 1, margin: 0, textAlign: "center" }}>
          <span style={{ color: C.acid }}>GO</span> <span style={{ color: C.mag }}>ROT</span>
        </h1>
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
    // For bot: auto-advance after animation. For human: wait for GOT IT button.
    if (autoPlay) setTimeout(onDraw, 950);
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
          // Human draw — show the real NFT they picked up with a GOT IT button
          <>
            <div style={{ display: "flex", justifyContent: "center", animation: "flipIn 0.5s ease both" }}>
              {rotToken
                ? <NFTCard token={rotToken} size={140} />
                : <div style={{ width: 140, height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 12 }}>Pile empty</div>
              }
            </div>
            {rotBase && (
              <p style={{ color: C.acid, fontSize: 11, margin: 0, letterSpacing: 1, textTransform: "uppercase", fontFamily: imp }}>
                {rotBase} #{rotToken.id} — added to your hand
              </p>
            )}
            <button onClick={onDraw}
              style={{ background: C.mag, border: "none", borderRadius: 8, color: "white", fontFamily: imp, fontSize: 18, letterSpacing: 1, padding: 13, cursor: "pointer" }}>
              GOT IT
            </button>
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
function SetModal({ player, set, isBot, onDismiss }) {
  const accent = isBot ? C.mag : "#FFD700";
  const btnText = isBot ? "NOTED" : "SWEET!";
  const icon = isBot ? "🤖" : "🏆";
  const headline = isBot ? "ROTTINGTON SET!" : "SET COMPLETE!";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflow: "auto" }}>
      <div style={{ background: C.card, border: `2px solid ${accent}`, borderRadius: 16, padding: "24px 20px", maxWidth: 360, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 18, animation: "fadein 0.2s ease", boxShadow: `0 0 32px ${accent}33` }}>
        <div>
          <div style={{ fontSize: 36 }}>{icon}</div>
          <h2 style={{ fontFamily: imp, fontSize: 32, color: accent, margin: "4px 0 0", lineHeight: 1 }}>{headline}</h2>
          <p style={{ color: C.muted, fontSize: 11, margin: "6px 0 0" }}>
            <b style={{ color: isBot ? C.mag : C.chalk }}>{player}</b> collected <b style={{ color: C.acid }}>{set.tokens.length}× {set.base}</b>
          </p>
          {isBot && (
            <p style={{ color: C.mag, fontSize: 10, margin: "6px 0 0", fontStyle: "italic" }}>
              Rottington's hand — not yours
            </p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, justifyItems: "center" }}>
          {set.tokens.map((card, i) => (
            <div key={card.id} style={{ animation: `cardpop 0.25s ease ${i * 0.07}s both`, opacity: isBot ? 0.7 : 1 }}>
              <NFTCard token={card} size={64} />
            </div>
          ))}
        </div>

        <div style={{ background: C.corrupt, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ fontFamily: imp, fontSize: 28, color: accent }}>+{set.score} pts</div>
          {set.bonusDesc.length > 0 && <div style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>{set.bonusDesc.join("  ")}</div>}
          {isBot && <div style={{ color: C.mag, fontSize: 10, marginTop: 4 }}>Rottington scores these points</div>}
        </div>

        <button onClick={onDismiss}
          style={{ background: accent, border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 20, letterSpacing: 1, padding: 13, cursor: "pointer" }}>
          {btnText}
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
    const v = names.map(n => n.trim()).filter(n => n.length > 0);
    if (v.length < 2) { setErr("Need at least 2 player names."); return; }
    if (TOKEN_STORE.length < 2) { setErr(`Cards not ready yet (${TOKEN_STORE.length} loaded). Please wait.`); return; }
    setErr("");
    onStart(v);
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

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {progress < 100 && (
            <>
              <div style={{ width: "100%", height: 6, background: C.corrupt, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: C.acid, borderRadius: 3, transition: "width 0.4s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ color: C.muted, fontSize: 10, margin: 0 }}>Loading cards…</p>
                <p style={{ color: C.acid, fontSize: 10, margin: 0, fontFamily: imp }}>{progress}%</p>
              </div>
            </>
          )}
          <button onClick={start} disabled={!ready}
            style={{
              background: ready ? C.acid : C.corrupt,
              border: "none", borderRadius: 8,
              color: ready ? C.void : C.muted,
              fontFamily: imp, fontSize: 20, letterSpacing: 1, padding: 14,
              cursor: ready ? "pointer" : "default",
              opacity: ready ? 1 : 0.5,
              transition: "all 0.3s ease"
            }}>
            {ready ? "DEAL THE CARDS" : `LOADING… ${progress}%`}
          </button>
        </div>
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
function GameEndModal({ players, turnsLeft, onEnd }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const leader = sorted[0];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.card, border: `2px solid ${C.acid}`, borderRadius: 16, padding: "28px 20px", maxWidth: 320, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 16, animation: "fadein 0.2s ease", boxShadow: "0 0 32px rgba(57,255,20,0.2)" }}>
        <div>
          <p style={{ color: C.muted, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 6px" }}>Game Over</p>
          <h2 style={{ fontFamily: imp, fontSize: 36, color: C.acid, margin: 0, lineHeight: 1 }}>{leader.name}</h2>
          <p style={{ fontFamily: imp, fontSize: 18, color: C.chalk, margin: "4px 0 0", letterSpacing: 1 }}>WINS!</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((p, i) => (
            <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderRadius: 6, background: i === 0 ? "rgba(57,255,20,0.08)" : C.corrupt, border: `1px solid ${i === 0 ? C.acid : C.border}` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? C.acid : C.chalk }}>{p.name}</span>
              <span style={{ fontFamily: imp, fontSize: 20, color: C.acid }}>{p.score}</span>
            </div>
          ))}
        </div>
        <button onClick={onEnd} style={{ background: C.acid, border: "none", borderRadius: 8, color: C.void, fontFamily: imp, fontSize: 20, letterSpacing: 1, padding: 13, cursor: "pointer" }}>
          SEE FINAL SCORES
        </button>
      </div>
    </div>
  );
}

// ── GAME ──────────────────────────────────────────────────────────────────
function GameScreen({ players: init, pile: initPile, allTokens, isBotMode, onEnd }) {
  const [players, setPlayers] = useState(init);
  const [pile, setPile] = useState(initPile);
  const [turnCounts, setTurnCounts] = useState({}); // playerIdx -> number of asks taken
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
  const playersRef = useRef(init);
  const pileRef = useRef(initPile);

  const addLog = h => setLog(l => [h, ...l.slice(0, 20)]);

  // Keep refs in sync with state
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { pileRef.current = pile; }, [pile]);

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
    const isBot = isBotMode && idx === BOT_IDX;
    newSets.forEach(s => newSetsOut.push({ player: p.name, set: s, isBot }));
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
    const currentPlayers = playersRef.current;
    const currentPile = pileRef.current;
    const me = currentPlayers[cur]; const them = currentPlayers[useTarget];
    if (!me.hand.some(t => getBase(t) === useBase)) { setAskErr(`You have no ${useBase}.`); return; }
    setAskErr("");

    // Count this as one of the current player's turns
    const newTurnCounts = { ...turnCounts, [cur]: (turnCounts[cur] || 0) + 1 };
    setTurnCounts(newTurnCounts);

    // Check if all players have used all their turns
    const allDone = currentPlayers.every((_, i) => (newTurnCounts[i] || 0) >= TURNS_PER_PLAYER);

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
      let ps = currentPlayers.map((p, i) => {
        if (i === useTarget) return { ...p, hand: p.hand.filter(t => !matching.find(m => m.id === t.id)) };
        if (i === cur) return { ...p, hand: [...p.hand, ...matching] };
        return p;
      });
      ps = applyCheck(ps, cur, newSetsFound);
      addLog(`${me.name} got ${matching.length}× ${useBase} from ${them.name}`);

      pendingModals.push({
        type: "match",
        asker: me.name, target: them.name, base: useBase,
        cards: matchedSnapshot, score: matching.length, bonusDesc: [],
      });

      newSetsFound.forEach(({ player, set, isBot }) => {
        pendingModals.push({ type: "set", player, set, isBot });
      });

      setPlayers(ps); setSelBase(null);

      if (allDone) {
        let finalPs = ps;
        const finalSets = [];
        finalPs.forEach((_, i) => { finalPs = applyCheck(finalPs, i, finalSets); });
        setPlayers(finalPs);
        finalSets.forEach(({ player, set, isBot }) => pendingModals.push({ type: "set", player, set, isBot }));
        pendingModals.push({ type: "gameend", players: finalPs });
      }

      modalQueue.current = pendingModals;
      showNext();
    } else {
      addLog(`${me.name} asked for ${useBase} — GO ROT!`);
      setSelBase(null);

      let rotToken = null;
      if (!(isBotMode && cur === BOT_IDX)) {
        const inPlayIds = new Set([
          ...currentPlayers.flatMap(p => p.hand.map(t => t.id)),
          ...currentPile.map(t => t.id),
        ]);
        rotToken = pickRotToken(allTokens, inPlayIds);
      }

      const rotModal = { type: "rot", asker: me.name, target: them.name, base: useBase, rotToken, needsDraw: true };
      modalQueue.current = pendingModals;
      setModal(rotModal);
    }
  }

  // Called when human taps "HAND OVER" after Rottington asks them
  function confirmHandOver() {
    const { base, cards, useTarget } = modal;
    const currentPlayers = playersRef.current;
    const currentPile = pileRef.current;
    const me = currentPlayers[cur];
    setModal(null);

    const matching = cards;
    const pendingModals = [];
    const newSetsFound = [];

    let ps = currentPlayers.map((p, i) => {
      if (i === useTarget) return { ...p, hand: p.hand.filter(t => !matching.find(m => m.id === t.id)) };
      if (i === cur) return { ...p, hand: [...p.hand, ...matching] };
      return p;
    });
    ps = applyCheck(ps, cur, newSetsFound);
    addLog(`${me.name} got ${matching.length}× ${base} from ${currentPlayers[useTarget].name}`);

    pendingModals.push({
      type: "match",
      asker: me.name, target: currentPlayers[useTarget].name, base,
      cards: matching, score: matching.length, bonusDesc: [],
    });

    newSetsFound.forEach(({ player, set, isBot }) => {
      pendingModals.push({ type: "set", player, set, isBot });
    });

    setPlayers(ps); setSelBase(null);

    // Check if game should end (turn counts already updated by ask())
    const gameDone = currentPlayers.every((_, i) => (turnCounts[i] || 0) >= TURNS_PER_PLAYER);
    if (gameDone) {
      let finalPs = ps;
      const finalSets = [];
      finalPs.forEach((_, i) => { finalPs = applyCheck(finalPs, i, finalSets); });
      setPlayers(finalPs);
      finalSets.forEach(({ player, set, isBot }) => pendingModals.push({ type: "set", player, set, isBot }));
      pendingModals.push({ type: "gameend", players: finalPs });
    }

    modalQueue.current = pendingModals;
    showNext();
  }

  // Called when the player taps the draw pile during a Go Rot modal
  function performDraw() {
    const p2 = [...pileRef.current];
    const drawnCard = p2.length > 0 ? p2.pop() : null;
    const curIdx = cur; // capture current index for closure

    if (drawnCard) {
      addLog(`${playersRef.current[curIdx].name} drew: ${getBase(drawnCard)}`);
      setPile(p2);
    }

    // Use functional updater — always gets the absolute latest players state
    // regardless of when this function was created or closures
    setPlayers(latestPlayers => {
      let ps = latestPlayers.map((p, i) =>
        i === curIdx && drawnCard ? { ...p, hand: [...p.hand, drawnCard] } : p
      );
      const newSetsFound = [];
      ps = applyCheck(ps, curIdx, newSetsFound);

      const setModals = newSetsFound.map(({ player, set, isBot }) => ({ type: "set", player, set, isBot }));

      if (setModals.length > 0) {
        // Schedule after this state update settles
        setTimeout(() => {
          modalQueue.current = setModals;
          setModal(null);
          showNext();
        }, 0);
      } else {
        const next = (curIdx + 1) % ps.length;
        setTimeout(() => {
          setModal(null);
          setCur(next);
          setTargetIdx((next + 1) % ps.length);
          setRevealed(isBotMode && next === BOT_IDX);
          setSelBase(null);
        }, 0);
      }

      return ps;
    });
  }

  function dismissModal() {
    if (modal?.type === "gameend") {
      onEnd(modal.players);
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
        <SetModal player={modal.player} set={modal.set} isBot={isBotMode && modal.isBot} onDismiss={dismissModal} />
      )}

      {/* Top bar */}
      <div style={{ background: C.corrupt, borderBottom: `1px solid ${C.border}`, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: imp, fontSize: 15, letterSpacing: 1 }}>
            <span style={{ color: C.acid }}>GO</span> <span style={{ color: C.mag }}>ROT</span>
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>
            Turn {(turnCounts[cur] || 0) + 1}/{TURNS_PER_PLAYER} · {isBotTurn ? <span style={{ color: C.mag }}>🤖 Rottington is thinking…</span> : `${me.name}'s turn`}
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
  const [status, setStatus] = useState("Connecting…");
  const [progress, setProgress] = useState(0);
  const [loadKey, setLoadKey] = useState(0);
  const [previewCards, setPreviewCards] = useState([]); // increment to re-trigger load
  const [mode, setMode] = useState(null);
  const [gamePlayers, setGamePlayers] = useState([]);
  const [gamePile, setGamePile] = useState([]);
  const [gameAllTokens, setGameAllTokens] = useState([]);
  const [endPlayers, setEndPlayers] = useState([]);

  // ── LOAD ────────────────────────────────────────────────────────────────
  // Single async load on mount. Retries forever until we have real cards.
  // TOKEN_STORE (module-level) is the single source of truth.
  useEffect(() => {
    let cancelled = false;
    setPreviewCards([]);

    async function fetchWithRetry(path, tries = 4) {
      for (let i = 0; i < tries; i++) {
        try {
          const r = await fetch(`${BASE_URL}${path}`, {
            headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" }
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return await r.json();
        } catch (e) {
          if (i < tries - 1) await new Promise(r => setTimeout(r, 600 * (i + 1)));
          else throw e;
        }
      }
    }

    async function loadCards() {
      // Step 1: get Base trait catalog
      if (cancelled) return;
      setStatus("Fetching card catalog…"); setProgress(5);
      let bases;
      try {
        const td = await fetchWithRetry("/traits?type=Base");
        bases = (td?.data?.[0]?.values || []).filter(b => b.count >= 4);
        if (!bases.length) throw new Error("No base types found");
      } catch (e) {
        if (!cancelled) { setStatus(`Failed: ${e.message}. Retrying…`); setProgress(0); await new Promise(r => setTimeout(r, 3000)); return loadCards(); }
        return;
      }

      // Step 2: get token ID pools for up to 20 base types
      if (cancelled) return;
      setStatus(`Found ${bases.length} creature types. Loading pools…`); setProgress(10);
      const pools = [];
      const take = Math.min(bases.length, 20);
      for (let i = 0; i < take; i++) {
        if (cancelled) return;
        try {
          const d = await fetchWithRetry(`/traits/tokens?type=Base&value=${encodeURIComponent(bases[i].value)}&limit=100`);
          const ids = d?.data?.token_ids || [];
          if (ids.length >= 3) pools.push({ base: bases[i].value, ids });
        } catch { /* skip this base */ }
        setProgress(10 + Math.round(((i + 1) / take) * 20));
      }
      if (!pools.length) {
        if (!cancelled) { setStatus("Could not load any card pools. Retrying…"); setProgress(0); await new Promise(r => setTimeout(r, 3000)); return loadCards(); }
        return;
      }

      // Step 3: fetch metadata for 4 tokens per base type (sequential, not parallel — avoids rate limits)
      if (cancelled) return;
      const perBase = 4;
      const toFetch = [];
      shuffle(pools).forEach(p => toFetch.push(...shuffle(p.ids).slice(0, perBase)));
      const uniqueIds = [...new Set(toFetch)];
      if (!uniqueIds.length) {
        if (!cancelled) { setStatus("No token IDs found. Retrying…"); setProgress(0); await new Promise(r => setTimeout(r, 3000)); return loadCards(); }
        return;
      }
      setStatus(`Loading ${uniqueIds.length} cards…`); setProgress(30);

      const cards = [];
      for (let i = 0; i < uniqueIds.length; i++) {
        if (cancelled) return;
        try {
          const d = await fetchWithRetry(`/tokens/${uniqueIds[i]}/metadata`, 2);
          if (d?.data) {
            cards.push(d.data);
            // Stream every 3rd card to the background collage
            if (cards.length % 3 === 0) setPreviewCards(c => [...c, d.data]);
          }
        } catch { /* skip */ }
        if (i % 5 === 0) {
          setProgress(30 + Math.round((i / uniqueIds.length) * 65));
          setStatus(`Loading cards… ${i + 1}/${uniqueIds.length}`);
        }
        if (i > 0 && i % 10 === 0) await new Promise(r => setTimeout(r, 200));
      }

      // Validate we actually got usable cards
      if (cards.length < 20) {
        if (!cancelled) {
          setStatus(`Only ${cards.length} cards loaded (need 20+). Retrying…`);
          setProgress(0);
          await new Promise(r => setTimeout(r, 3000));
          return loadCards();
        }
        return;
      }

      if (cancelled) return;
      TOKEN_STORE = cards;
      setProgress(100);
      setStatus(`${cards.length} cards loaded. Ready!`);
      await new Promise(r => setTimeout(r, 400));
      if (!cancelled) setPhase("mode-select");
    }

    loadCards();
    return () => { cancelled = true; };
  }, [loadKey]);

  // ── BUILD DECK ──────────────────────────────────────────────────────────
  function buildDeck(playerNames) {
    if (TOKEN_STORE.length < 20) {
      TOKEN_STORE = [];
      setProgress(0);
      setStatus("Reloading cards…");
      setPhase("loading");
      setLoadKey(k => k + 1);
      return;
    }
    usedRotIds = new Set();
    const tokens = shuffle([...TOKEN_STORE]);
    const handSize = Math.min(5, Math.floor(tokens.length / playerNames.length));
    const players = playerNames.map((name, i) => ({
      name,
      hand: tokens.slice(i * handSize, (i + 1) * handSize),
      sets: [], score: 0
    }));
    setGamePlayers(players);
    setGamePile(tokens.slice(playerNames.length * handSize));
    setGameAllTokens([...TOKEN_STORE]);
    setPhase("game");
  }

  // ── RENDER ──────────────────────────────────────────────────────────────
  if (phase === "loading") return <Loader msg={status} progress={progress} previewCards={previewCards} />;
  if (phase === "mode-select") return (
    <ModeSelect onPick={m => { setMode(m); setPhase(m === "invite" ? "invite" : "lobby"); }} />
  );
  if (phase === "invite") return (
    <InviteScreen onBack={() => setPhase("mode-select")} onPlayLocalInstead={() => { setMode("local"); setPhase("lobby"); }} />
  );
  if (phase === "lobby") return (
    <Lobby onStart={buildDeck} ready={true} progress={100} mode={mode} onBack={() => setPhase("mode-select")} />
  );
  if (phase === "game") return (
    <GameScreen players={gamePlayers} pile={gamePile} allTokens={gameAllTokens} isBotMode={mode === "bot"}
      onEnd={ps => { setEndPlayers(ps); setPhase("end"); }} />
  );
  if (phase === "end") return <EndScreen players={endPlayers} onRestart={() => setPhase("mode-select")} />;
  return null;
}
