"use client";
import { useEffect, useMemo, useState } from "react";
import { rosters, TeamName } from "@/lib/rosters";

const MAX_POINTS = 8;
const MAX_KEEPERS = 3;

type SleeperPlayer = {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team?: string | null;
};

function normalize(s: string) {
  return s.toLowerCase().replace(/[.’']/g, "").replace(/\b(sr|jr|iii|ii)\b/g, "").replace(/[^a-z0-9]/g, "");
}
function logo(team: string) {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${team.toLowerCase()}.png`;
}

export default function KeeperApp() {
  const teamNames = Object.keys(rosters) as TeamName[];
  const [team, setTeam] = useState<TeamName | "">("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pinError, setPinError] = useState("");
  const [sleeper, setSleeper] = useState<Record<string, SleeperPlayer>>({});

  useEffect(() => {
    fetch("https://api.sleeper.app/v1/players/nfl?active=true")
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, SleeperPlayer>) => {
        const index: Record<string, SleeperPlayer> = {};
        Object.values(data).forEach(p => {
          const name = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
          if (name) index[normalize(name)] = p;
        });
        setSleeper(index);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!team) {
      setSelected([]);
      setSaved([]);
      return;
    }

    setLoading(true);
    setMessage("");
    setPin("");
    setPinError("");
    setShowPin(false);

    fetch(`/api/submission?team=${encodeURIComponent(team)}`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load submission.");
        const keepers = Array.isArray(data.keepers) ? data.keepers : [];
        setSelected(keepers);
        setSaved(keepers);
      })
      .catch(() => {
        setSelected([]);
        setSaved([]);
        setMessage("Could not load the current submission.");
      })
      .finally(() => setLoading(false));
  }, [team]);

  const roster = team ? rosters[team] : [];
  const points = useMemo(
    () => roster.filter(p => selected.includes(p.name)).reduce((sum, p) => sum + p.points, 0),
    [roster, selected]
  );
  const remaining = MAX_POINTS - points;
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...saved].sort());

  function toggle(name: string) {
    const player = roster.find(p => p.name === name)!;
    if (selected.includes(name)) {
      setSelected(selected.filter(n => n !== name));
      setMessage("");
      return;
    }
    if (selected.length >= MAX_KEEPERS) {
      setMessage(`You can select up to ${MAX_KEEPERS} keepers.`);
      return;
    }
    if (points + player.points > MAX_POINTS) {
      setMessage(`${player.name} would put you over the ${MAX_POINTS}-point cap.`);
      return;
    }
    setSelected([...selected, name]);
    setMessage("");
  }

  function requestSubmit() {
    if (!team || selected.length === 0 || !dirty) return;
    setPin("");
    setPinError("");
    setShowPin(true);
  }

  async function submit() {
    if (!team || selected.length === 0 || pin.length !== 4) return;

    setLoading(true);
    setPinError("");
    try {
      const res = await fetch("/api/submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, pin, keepers: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      setSaved(selected);
      setShowPin(false);
      setPin("");
      setMessage("Saved. You can come back and change these anytime.");
    } catch (e) {
      setPinError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="simple-header">
        <h1>Danika Way Fantasy Football</h1>
        <p>2026 Keeper Selection</p>
      </header>

      <section className="panel team-panel">
        <label htmlFor="team">TEAM</label>
        <select id="team" value={team} onChange={e => setTeam(e.target.value as TeamName | "")}>
          <option value="">Select a team…</option>
          {teamNames.map(t => <option key={t}>{t}</option>)}
        </select>
      </section>

      {team && (
        <>
          <div className="scorebar">
            <div>
              <span className="score-label">KEEPERS</span>
              <strong>{selected.length}<em> / {MAX_KEEPERS}</em></strong>
            </div>
            <div className="score-main">
              <span className="score-label">POINTS USED</span>
              <strong>{points}<em> / {MAX_POINTS}</em></strong>
            </div>
            <div>
              <span className="score-label">REMAINING</span>
              <strong className={remaining <= 1 ? "warn" : ""}>{remaining}</strong>
            </div>
          </div>
          <div className="meter">
            <div style={{ width: `${Math.min(100, (points / MAX_POINTS) * 100)}%` }} />
          </div>

          {saved.length > 0 && (
            <div className="saved-note">
              Current keeper selection shown below. You can preview changes, but the team PIN is required to save.
            </div>
          )}

          <section className="roster">
            <div className="roster-head">
              <div>
                <span>ROSTER</span>
                <h2>{team}</h2>
              </div>
              <span className="hint">Tap a player to select</span>
            </div>

            <div className="players">
              {roster.map(player => {
                const active = selected.includes(player.name);
                const s = sleeper[normalize(player.name)];
                const headshot = s?.player_id
                  ? `https://sleepercdn.com/content/nfl/players/thumb/${s.player_id}.jpg`
                  : null;

                return (
                  <button
                    type="button"
                    onClick={() => toggle(player.name)}
                    key={player.name}
                    className={`player ${active ? "active" : ""}`}
                  >
                    <div className="portrait">
                      {headshot ? (
                        <img src={headshot} alt="" onError={e => { e.currentTarget.style.display = "none"; }} />
                      ) : null}
                      <img className="team-logo" src={logo(player.nflTeam)} alt="" />
                    </div>
                    <div className="player-info">
                      <div className="name-row">
                        <b>{player.name}</b>
                        <span>{player.position} · {player.nflTeam}</span>
                      </div>
                      <small>{player.draft === "-" ? "Free agent" : player.draft}</small>
                    </div>
                    <div className="points">
                      <b>{player.points}</b>
                      <span>{player.points === 1 ? "PT" : "PTS"}</span>
                    </div>
                    <div className="check">{active ? "✓" : "+"}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="sticky-submit">
            <div>
              <b>{points} / {MAX_POINTS} points</b>
              <span>{selected.length} keeper{selected.length === 1 ? "" : "s"} selected</span>
            </div>
            <button disabled={loading || selected.length === 0 || !dirty} onClick={requestSubmit}>
              {saved.length ? "Update keepers" : "Submit keepers"}
            </button>
          </div>

          {message && <div className={`toast ${message.startsWith("Saved") ? "success" : ""}`}>{message}</div>}
        </>
      )}

      {showPin && (
        <div className="pin-overlay" role="dialog" aria-modal="true" aria-labelledby="pin-title" onMouseDown={e => {
          if (e.target === e.currentTarget) setShowPin(false);
        }}>
          <div className="pin-card">
            <button className="pin-close" type="button" aria-label="Close" onClick={() => setShowPin(false)}>×</button>
            <div className="pin-lock">🔒</div>
            <h2 id="pin-title">Enter your team PIN</h2>
            <p>Confirm you’re allowed to submit keepers for <strong>{team}</strong>.</p>

            <label className="pin-label" htmlFor="team-pin">4-DIGIT PIN</label>
            <input
              id="team-pin"
              className="pin-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              placeholder="••••"
              value={pin}
              autoFocus
              onChange={e => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setPinError("");
              }}
              onKeyDown={e => { if (e.key === "Enter" && pin.length === 4) submit(); }}
            />

            {pinError && <div className="pin-error">{pinError}</div>}

            <button className="pin-submit" type="button" disabled={loading || pin.length !== 4} onClick={submit}>
              {loading ? "Submitting…" : saved.length ? "Confirm update" : "Confirm submission"}
            </button>
            <button className="pin-cancel" type="button" onClick={() => setShowPin(false)}>Cancel</button>
          </div>
        </div>
      )}
    </main>
  );
}
