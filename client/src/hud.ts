// Everything drawn on top of the 3D scene: the action dock, the dealer's
// ticket picker, the ticket sheet, announcements and the wallet. It reads the
// store and the event stream, and acts only through `actions`.
import { DECK, type PublicPlayer, type RoomState } from "../../shared/protocol.ts";
import { renderAdf } from "./adf.ts";
import type { Actions } from "./app/actions.ts";
import type { GameEvent } from "./app/events.ts";
import type { Storage } from "./app/storage.ts";
import type { AppState, Store } from "./app/store.ts";
import type { Mic } from "./audio/mic.ts";
import type { Audio } from "./audio/sfx.ts";
import { CARD_SUIT } from "./scene/textures.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const KEY_RE = /\b[A-Za-z][A-Za-z0-9_]+-\d+\b/;

export interface HudDeps {
  store: Store;
  actions: Actions;
  audio: Audio;
  storage: Storage;
  mic: Mic;
  /** Opens the look editor over the table. */
  openLook(): void;
}

/** Events that the next render should know about; handled right after it. */
const DEFERRED = new Set<GameEvent["t"]>(["synced", "joined", "left", "dealt", "ticketChanged", "queueChanged", "revealed", "settled"]);

const TYPE_ICON: Record<string, [string, string]> = {
  bug: ["●", "#e5493a"], story: ["▮", "#63ba3c"], epic: ["⚡", "#904ee2"], task: ["✓", "#4bade8"],
  subtask: ["✓", "#4bade8"], "sub-task": ["✓", "#4bade8"],
};
const typeIcon = (type: string) => {
  const [glyph, color] = TYPE_ICON[type.toLowerCase()] ?? ["◆", "#8993a4"];
  return `<span class="type-ico" style="background:${color}" title="${esc(type)}">${glyph}</span>`;
};

function cardHtml(v: number, cls = "", extra = "") {
  const s = CARD_SUIT[v] ?? { glyph: "♠", red: false };
  // a tiny, stable tilt per card so the hand looks dealt rather than laid out by a robot
  const tilt = (((v * 37) % 7) - 3) * 0.6;
  const corner = `<span>${v}</span><span>${s.glyph}</span>`;
  return `<button class="pcard ${s.red ? "red" : ""} ${cls}" data-v="${v}" aria-label="${v} points" style="--tilt:${tilt}deg">
    <span class="c-corner tl">${corner}</span><span class="c-suit">${s.glyph}</span><span class="c-num">${v}</span><span class="c-corner br">${corner}</span>${extra}</button>`;
}

function names(list: string[]) {
  return list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} & ${list.at(-1)}`;
}

export class Hud {
  private me = { id: "", isDealer: false };
  private st: RoomState | null = null;
  private myVote: number | null = null;
  private wallet = 0;
  private loading = false;
  private loadTimer = 0;
  private sheetKey = "";
  private pickerForced = false;
  private dockKey = "";
  private phaseKey = "";
  private pending: GameEvent[] = [];
  private queued = false;
  private readonly store: Store;
  private readonly actions: Actions;
  private readonly audio: Audio;
  private readonly deps: HudDeps;

  constructor(deps: HudDeps) {
    this.deps = deps;
    this.store = deps.store;
    this.actions = deps.actions;
    this.audio = deps.audio;
    this.setupChrome();
    this.setupMic();
    this.setupPicker();
    this.setupSheet();
    this.store.subscribe((s, prev) => this.onStore(s, prev));
    this.store.events.on((e) => {
      if (DEFERRED.has(e.t)) { this.pending.push(e); this.schedule(); }
      else this.react(e);
    });
    this.onStore(this.store.getState(), null);
  }

  private onStore(s: AppState, prev: AppState | null) {
    if (s.me && s.me !== prev?.me) {
      this.me = { ...s.me };
      document.body.classList.toggle("is-dealer", s.me.isDealer);
    }
    if (s.connection !== prev?.connection) {
      const { status, reason } = s.connection;
      $("conn").textContent = status === "open" || status === "idle" ? "" : status === "connecting" ? "reconnecting…" : `disconnected: ${reason ?? ""}`;
      if (status === "closed" && reason === "Removed by the dealer") this.toast("👋 The dealer removed you from this table.", "error");
    }
    if (s.room !== prev?.room) this.schedule();
    else if (s.ui.myVote !== prev?.ui.myVote) {
      this.myVote = s.ui.myVote;
      if (this.st) { this.renderDock(this.st, false); this.renderStatus(this.st); }
    }
  }

  /** Render once per new view, after its events are in. */
  private schedule() {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      const st = this.store.getState().room;
      const evs = this.pending;
      this.pending = [];
      if (!st) return;
      this.myVote = this.store.getState().ui.myVote;
      this.render(st, evs);
      for (const e of evs) this.react(e);
    });
  }

  // ------------------------------------------------------------------ chrome

  private setupChrome() {
    $("invite").onclick = () => this.copyInvite();
    $("wardrobe").onclick = () => this.deps.openLook();
    const mute = $("mute");
    const paint = () => (mute.textContent = this.audio.muted ? "🔇" : "🔊");
    paint();
    mute.onclick = () => { this.audio.setMuted(!this.audio.muted); paint(); };
    $("help").onclick = () => this.togglePop("help-pop");
    $("wallet").onclick = () => this.togglePop("board");
    $("dealer-btn").onclick = () => this.togglePop("dealer-pop");
    $("ticket-tab").onclick = () => this.openSheet();
    for (const id of ["help-pop", "board", "dealer-pop"]) {
      $(id).addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("[data-close]")) $(id).hidden = true; });
    }
    addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      this.closeSheet();
      if (this.st?.ticket) this.closePicker();
      $("help-pop").hidden = $("board").hidden = $("dealer-pop").hidden = true;
    });
  }

  private togglePop(id: string) {
    const el = $(id);
    const show = el.hidden;
    $("help-pop").hidden = $("board").hidden = true;
    el.hidden = !show;
  }

  /** Mic loudness makes your bean's mouth move; no audio ever leaves the browser. */
  private setupMic() {
    const { mic, storage } = this.deps;
    const btn = $("mic");
    const paint = () => {
      btn.classList.toggle("on", mic.on);
      btn.title = mic.on ? "Mic on: your mouth moves when you talk (no audio is sent). Click to turn off." : "Turn on mic: your character's mouth moves when you talk (no audio is sent)";
    };
    mic.onLevel = (level) => this.actions.talk(level);
    mic.onMeter = (level) => btn.style.setProperty("--lvl", level.toFixed(2));
    const start = async () => {
      try {
        await mic.start();
        storage.setMic(true);
      } catch {
        this.toast("Couldn't use the mic. Check your browser's permission for this site.", "error");
        storage.setMic(false);
      }
      paint();
    };
    btn.onclick = () => {
      if (mic.on) { mic.stop(); storage.setMic(false); paint(); }
      else start();
    };
    paint();
    if (storage.mic()) start();
    else setTimeout(() => this.toast("🎙️ Tip: turn on your mic (top right) and your bean's mouth moves when you talk. No audio is sent."), 4000);
  }

  async copyInvite() {
    const url = `${location.origin}${location.pathname}?room=${this.store.getState().connection.room}`;
    try {
      await navigator.clipboard.writeText(url);
      this.toast("🔗 Invite link copied. Paste it in Slack or Teams.");
    } catch {
      prompt("Send this link to your team:", url);
    }
  }

  toast(text: string, level: "info" | "error" = "info") {
    const el = document.createElement("div");
    el.className = `toast ${level}`;
    el.textContent = text;
    $("toasts").append(el);
    setTimeout(() => el.classList.add("out"), 3600);
    setTimeout(() => el.remove(), 4000);
  }

  // ------------------------------------------------------------------ main update

  private render(st: RoomState, evs: GameEvent[]) {
    this.st = st;
    const phaseKey = `${st.phase}:${st.round}`;
    const phaseChanged = phaseKey !== this.phaseKey;
    this.phaseKey = phaseKey;

    // the dealer's ticket picker opens by itself when there's no ticket
    if (this.me.isDealer) {
      if (!st.ticket && !this.pickerForced) { this.pickerForced = true; this.openPicker(); }
      this.renderPicker(st);
    }

    this.renderTicketTab(st);
    this.renderStatus(st);
    this.renderDock(st, phaseChanged);
    this.renderBoard(st);
    this.renderDealer(st);
    // a winner's wallet counts up when the coins land; everything else updates straight away
    const iWon = evs.some((e) => e.t === "settled") && st.winners.includes(this.me.id);
    if (!iWon) this.setWallet(st.players.find((p) => p.id === this.me.id)?.chips ?? 0);
    const mine = st.players.find((p) => p.id === this.me.id);
    if (mine) $("wardrobe").style.setProperty("--me", mine.color);
    document.title = `${st.ticket ? st.ticket.key + " · " : ""}Point Poker`;
  }

  private react(e: GameEvent) {
    const st = this.st;
    switch (e.t) {
      case "synced":
        if (st?.ticket && st.phase === "voting") this.openSheet();
        return;
      case "joined":
        if (e.player.id !== this.me.id) this.toast(`👋 ${e.player.name} sat down`);
        return;
      case "left":
        this.toast(`🚪 ${e.player.name} left`);
        return;
      case "ticketChanged":
        if (!this.me.isDealer) return;
        this.stopLoading();
        this.pickerForced = false;
        this.closePicker();
        return;
      case "queueChanged":
        if (this.me.isDealer && this.loading) this.stopLoading();
        return;
      case "dealt":
        if (!st?.ticket) return;
        this.announce(`<div class="a-kicker">New ticket</div><div class="a-title">${esc(st.ticket.key)}</div><div class="a-sub">${esc(st.ticket.summary)}</div>`, "deal", 1800);
        setTimeout(() => this.openSheet(), 900);
        return;
      case "revealed": {
        if (!st) return;
        this.closeSheet();
        const votes = st.players.filter((p) => p.plays && p.vote !== null).map((p) => p.vote!);
        const same = votes.length > 1 && votes.every((v) => v === votes[0]);
        this.announce(same
          ? `<div class="a-title">Everyone said ${votes[0]}! 🎉</div><div class="a-sub">Consensus. Mark it on the calendar.</div>`
          : `<div class="a-title">Cards up!</div><div class="a-sub">${votes.length ? `From ${Math.min(...votes)} to ${Math.max(...votes)}` : "Nobody picked a card"}</div>`, "reveal", 1700);
        this.audio.flip();
        return;
      }
      case "settled":
        if (st) this.celebrate(st);
        return;
      case "toast":
        this.toast(e.text, e.level);
        if (e.level === "error") this.audio.bonk();
        return;
      case "loadFailed":
        this.loadFailed(e.text);
        return;
      case "openTicket":
        this.openSheet();
        return;
    }
  }

  // ------------------------------------------------------------------ ticket tab + sheet

  private renderTicketTab(st: RoomState) {
    const t = st.ticket;
    const tab = $("ticket-tab");
    tab.hidden = !t;
    if (!t) return;
    tab.innerHTML = `${typeIcon(t.type || "task")}<span class="tt-key">${esc(t.key)}</span><span class="tt-sum">${esc(t.summary)}</span><span class="tt-open">Read ▸</span>`;
    if (this.sheetKey && this.sheetKey !== t.key + st.round) this.fillSheet(st);
  }

  private setupSheet() {
    $("sheet-scrim").onclick = () => this.closeSheet();
    $("sheet-close").onclick = () => this.closeSheet();
  }

  private fillSheet(st: RoomState) {
    const t = st.ticket;
    if (!t) return;
    this.sheetKey = t.key + st.round;
    const project = t.key.split("-")[0];
    const cat = t.statusCategory || "new";
    const crumbs = [`<span>Projects</span>`, `<span>${esc(project)}</span>`];
    if (t.parent) crumbs.push(`<span>${typeIcon("epic")} ${esc(t.parent.key)}</span>`);
    else if (st.epic) crumbs.push(`<span>${typeIcon("epic")} ${esc(st.epic.key)}</span>`);
    crumbs.push(`<span>${typeIcon(t.type || "task")} ${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noreferrer">${esc(t.key)}</a>` : esc(t.key)}</span>`);
    const field = (label: string, value: string) => `<div class="f"><div class="f-l">${label}</div><div class="f-v">${value}</div></div>`;
    const person = (n: string) => n ? `<span class="avatar">${esc(n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase())}</span>${esc(n)}` : `<span class="muted">None</span>`;
    $("sheet-body").innerHTML = `
      <div class="crumbs">${crumbs.join(`<i>/</i>`)}</div>
      <h1 class="s-title">${esc(t.summary)}</h1>
      <div class="s-grid">
        <div class="s-main"><h4>Description</h4><div id="sheet-desc"></div></div>
        <aside class="s-side">
          ${t.status ? `<span class="status status-${cat}">${esc(t.status)}</span>` : ""}
          <div class="s-details">
            <div class="s-dh">Details</div>
            ${field("Assignee", person(t.assignee && t.assignee !== "Unassigned" ? t.assignee : ""))}
            ${t.reporter ? field("Reporter", person(t.reporter)) : ""}
            ${t.priority ? field("Priority", esc(t.priority)) : ""}
            ${field("Labels", t.labels.length ? t.labels.map((l) => `<span class="label">${esc(l)}</span>`).join(" ") : `<span class="muted">None</span>`)}
            ${field("Story points", t.currentPoints !== null ? `<span class="pts">${t.currentPoints}</span>` : `<span class="muted">Not pointed yet</span>`)}
          </div>
          ${t.url ? `<a class="s-open" href="${esc(t.url)}" target="_blank" rel="noreferrer">Open in Jira ↗</a>` : ""}
        </aside>
      </div>`;
    $("sheet-desc").append(renderAdf(t.adf, t.description));
  }

  openSheet() {
    if (!this.st?.ticket) return;
    if (this.sheetKey !== this.st.ticket.key + this.st.round) this.fillSheet(this.st);
    const s = $("sheet");
    if (!s.hidden) return;
    s.hidden = false;
    $("sheet-scrim").hidden = false;
    s.classList.remove("leaving");
    void s.offsetWidth;
    s.classList.add("arriving");
    this.audio.slide();
  }

  closeSheet() {
    const s = $("sheet");
    if (s.hidden) return;
    s.classList.remove("arriving");
    s.classList.add("leaving");
    $("sheet-scrim").hidden = true;
    setTimeout(() => { if (s.classList.contains("leaving")) s.hidden = true; }, 380);
  }

  // ------------------------------------------------------------------ status (top centre)

  private renderStatus(st: RoomState) {
    const voters = st.players.filter((p) => p.plays);
    const step = st.phase === "voting" ? 1 : st.phase === "revealed" ? 2 : st.phase === "settled" ? 3 : 0;
    const steps = ["Pick", "Reveal", "Settle"].map((s, i) =>
      `<span class="step ${i + 1 < step ? "done" : i + 1 === step ? "on" : ""}"><b>${i + 1 < step ? "✓" : i + 1}</b>${s}</span>`).join(`<span class="bar"></span>`);
    let line = "";
    const amVoter = !!voters.find((p) => p.id === this.me.id);
    if (st.phase === "waiting") line = this.me.isDealer ? "Add a ticket to start" : "Waiting for the dealer to add a ticket…";
    else if (st.phase === "voting") {
      const n = voters.filter((p) => p.hasVoted).length;
      line = amVoter && this.myVote === null ? "Pick a card below" : `${n} of ${voters.length} picked`;
    } else if (st.phase === "revealed") line = this.me.isDealer ? "Choose the final points below" : "The dealer is choosing the final points…";
    else if (st.phase === "settled") line = `Final: ${st.finalPoints} points`;
    const dots = st.phase === "voting" ? `<div class="dots">${voters.map((p) =>
      `<span class="dot ${p.hasVoted ? "in" : ""}" style="--c:${p.color}" title="${esc(p.name)}${p.hasVoted ? " ✓" : " is thinking…"}"></span>`).join("")}</div>` : "";
    $("status").innerHTML = `<div class="steps ${step ? "" : "idle"}">${steps}</div><div class="s-line">${esc(line)}</div>${dots}`;
  }

  // ------------------------------------------------------------------ dock (bottom centre)

  private renderDock(st: RoomState, phaseChanged: boolean) {
    const voters = st.players.filter((p) => p.plays);
    const amVoter = !!voters.find((p) => p.id === this.me.id);
    const counts = new Map<number, PublicPlayer[]>();
    for (const p of voters) if (p.vote !== null) counts.set(p.vote, [...(counts.get(p.vote) ?? []), p]);
    let top = -1, best = 0;
    for (const [v, ps] of counts) if (ps.length > best || (ps.length === best && v > top)) { best = ps.length; top = v; }
    // only call out a favourite when there clearly is one
    if (best < 2 || [...counts.values()].filter((ps) => ps.length === best).length > 1) top = -1;
    const voteDots = (v: number) => (counts.get(v) ?? []).map((p) => `<i style="--c:${p.color}" title="${esc(p.name)}"></i>`).join("");

    let title = "", body = "", side = "";
    const D = this.me.isDealer;
    if (st.phase === "waiting") {
      if (D) {
        title = "";
        body = `<button class="btn gold xl" data-act="picker">＋ Add a Jira ticket</button>`;
      } else body = `<div class="waiting"><span class="spin"></span>The dealer is picking a ticket</div>`;
    } else if (st.phase === "voting") {
      const n = voters.filter((p) => p.hasVoted).length;
      const all = n === voters.length && n > 0;
      if (amVoter) {
        title = this.myVote === null ? "How big is it? Pick a card" : `You picked <b>${this.myVote}</b> · tap another card to change`;
        body = `<div class="hand">${DECK.map((v) => cardHtml(v, v === this.myVote ? "on" : this.myVote !== null ? "dim" : "")).join("")}</div>`;
      } else if (D) {
        const waiting = voters.filter((p) => !p.hasVoted).map((p) => p.name);
        title = all ? "Everyone's in!" : waiting.length ? `Waiting on ${esc(names(waiting.slice(0, 4)))}${waiting.length > 4 ? "…" : ""}` : "Nobody's at the table yet";
      }
      if (D) side = `<button class="btn gold big ${all ? "pulse" : ""}" data-act="reveal" ${n ? "" : "disabled"}>Reveal cards<small>${n} of ${voters.length} in</small></button>
        <button class="btn link" data-act="redeal">Restart vote</button>`;
    } else if (st.phase === "revealed" || st.phase === "settled") {
      const settled = st.phase === "settled";
      if (D) {
        title = settled ? `Final: <b>${st.finalPoints}</b> points · tap a card to change it` : "Tap the final points";
        body = `<div class="hand settle">${DECK.map((v) => cardHtml(v,
          `${settled && v === st.finalPoints ? "on" : settled ? "dim" : ""} ${!settled && v === top ? "suggest" : ""}`,
          `${counts.get(v) ? `<span class="c-votes">${voteDots(v)}</span>` : ""}${!settled && v === top ? `<span class="c-ribbon">most votes</span>` : ""}`)).join("")}</div>`;
        if (!settled) side = `<button class="btn link" data-act="redeal">Vote again</button>`;
        else {
          const played = new Set([...st.history.map((h) => h.key), ...st.skipped]);
          const next = st.queue.find((x) => !played.has(x.key) && x.key !== st.ticket?.key && x.points === null)
            ?? st.queue.find((x) => !played.has(x.key) && x.key !== st.ticket?.key);
          side = next
            ? `<button class="btn gold big" data-act="next">Next ticket →<small>${esc(next.key)}</small></button><button class="btn link" data-act="picker">Choose a different one</button>`
            : `<button class="btn gold big" data-act="picker">＋ Next ticket</button>`;
          if (st.ticket?.url) side += `<a class="btn link" href="${esc(st.ticket.url)}" target="_blank" rel="noreferrer">Open in Jira ↗</a>`;
        }
      } else {
        title = settled ? `Final: <b>${st.finalPoints}</b> points` : "Here's how everyone voted";
        body = `<div class="spread">${DECK.filter((v) => counts.has(v) || (settled && v === st.finalPoints)).map((v) =>
          `<div class="mini ${settled && v === st.finalPoints ? "on" : ""}"><span>${v}</span><div class="mini-dots">${voteDots(v)}</div></div>`).join("") || `<div class="waiting">Nobody voted</div>`}</div>`;
      }
    }

    const key = [st.phase, st.round, D, amVoter, this.myVote, title, body.length, side].join("|");
    if (key === this.dockKey) return;
    this.dockKey = key;
    const dock = $("dock");
    dock.className = `dock phase-${st.phase}${phaseChanged ? " enter" : ""}`;
    dock.innerHTML = `${title ? `<div class="d-title">${title}</div>` : ""}<div class="d-row">${body}${side ? `<div class="d-side">${side}</div>` : ""}</div>`;
    dock.hidden = !body && !side && !title;
    dock.querySelectorAll<HTMLButtonElement>(".pcard").forEach((b) => {
      const v = Number(b.dataset.v);
      b.onpointerenter = () => this.audio.hover();
      b.onclick = () => {
        if (st.phase === "voting") this.actions.vote(v);
        else if (D && (st.phase === "revealed" || st.phase === "settled") && v !== st.finalPoints) this.actions.dealer.settle(v);
      };
    });
    dock.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((b) => (b.onclick = () => {
      const act = b.dataset.act;
      if (act === "picker") this.openPicker();
      else if (act === "reveal") this.actions.dealer.reveal();
      else if (act === "redeal") this.actions.dealer.deal();
      else if (act === "next") { this.actions.dealer.next(); this.startLoading("Dealing the next ticket…"); }
    }));
  }

  // ------------------------------------------------------------------ dealer's ticket picker

  private setupPicker() {
    const input = $<HTMLInputElement>("pk-input");
    const submit = () => {
      const ref = input.value.trim();
      if (!ref) return input.focus();
      if (!KEY_RE.test(ref)) return this.pickerError("Paste a Jira link, or a key like SD-1234");
      this.actions.dealer.load(ref);
      this.startLoading(`Fetching ${ref.match(KEY_RE)![0].toUpperCase()} from Jira…`);
    };
    $("pk-form").onsubmit = (e) => { e.preventDefault(); submit(); };
    input.addEventListener("paste", () => setTimeout(() => { if (KEY_RE.test(input.value)) submit(); }, 0));
    input.oninput = () => this.pickerError("");
    $("pk-close").onclick = () => this.closePicker();
    $("pk-scrim").onclick = () => { if (this.st?.ticket) this.closePicker(); };
    $("pk-sprint").onclick = () => { this.actions.dealer.loadSprint(); this.startLoading("Loading this sprint's tickets…"); };
    $("pk-invite").onclick = () => this.copyInvite();
    $("pk-manual").onsubmit = (e) => {
      e.preventDefault();
      const summary = $<HTMLInputElement>("pk-m-summary").value.trim();
      if (!summary) return;
      this.actions.dealer.typeIn(summary);
      $<HTMLInputElement>("pk-m-summary").value = "";
    };
    const plays = $<HTMLInputElement>("pk-plays");
    plays.onchange = () => this.actions.dealer.setPlays(plays.checked);
  }

  openPicker() {
    document.body.classList.add("picking");
    $("picker").hidden = false;
    $("pk-scrim").hidden = false;
    this.pickerError("");
    if (this.st) this.renderPicker(this.st);
    setTimeout(() => $("pk-input").focus(), 60);
  }

  closePicker() {
    document.body.classList.remove("picking");
    $("picker").hidden = true;
    $("pk-scrim").hidden = true;
  }

  private renderPicker(st: RoomState) {
    $("pk-close").hidden = !st.ticket;
    $("pk-jira").hidden = !st.jiraEnabled;
    $("pk-sprint").hidden = !st.jiraEnabled;
    ($("pk-manual-wrap") as HTMLDetailsElement).open ||= !st.jiraEnabled;
    $<HTMLInputElement>("pk-plays").checked = st.dealerPlays;
    const others = st.players.filter((p) => !p.isDealer);
    $("pk-people").innerHTML = others.length
      ? `${others.slice(0, 8).map((p) => `<span class="dot in" style="--c:${p.color}" title="${esc(p.name)}"></span>`).join("")}<span>${others.length} at the table</span>`
      : `<span>Nobody's here yet</span>`;
    $("pk-invite").classList.toggle("gold", others.length === 0);
    const done = new Set(st.history.map((h) => h.key));
    const skipped = new Set(st.skipped);
    const played = new Set([...done, ...skipped]);
    $("pk-queue").innerHTML = st.queue.length ? `<div class="pk-qh">${esc(st.queueLabel)} · tap one to deal it</div>
      <div class="pk-list">${st.queue.map((q) => `<button class="pk-item ${played.has(q.key) ? "played" : ""} ${q.key === st.ticket?.key ? "current" : ""}" data-key="${esc(q.key)}">
        <span class="k">${esc(q.key)}</span><span class="s">${esc(q.summary)}</span>
        <span class="p">${done.has(q.key) ? "✓ done" : skipped.has(q.key) ? "skipped" : q.points !== null ? `${q.points} pts` : ""}</span></button>`).join("")}</div>` : "";
    $("pk-queue").querySelectorAll<HTMLButtonElement>("[data-key]").forEach((b) => (b.onclick = () => {
      this.actions.dealer.load(b.dataset.key!);
      this.startLoading(`Fetching ${b.dataset.key}…`);
    }));
  }

  private startLoading(text: string) {
    this.loading = true;
    $("picker").classList.add("loading");
    $("pk-status").textContent = text;
    clearTimeout(this.loadTimer);
    this.loadTimer = window.setTimeout(() => { if (this.loading) { this.stopLoading(); this.pickerError("Jira is taking too long. Try again?"); } }, 15000);
  }

  private stopLoading() {
    this.loading = false;
    $("picker").classList.remove("loading");
    $("pk-status").textContent = "";
    clearTimeout(this.loadTimer);
  }

  loadFailed(text: string) {
    this.stopLoading();
    if ($("picker").hidden) this.openPicker();
    this.pickerError(text);
    this.audio.bonk();
  }

  private pickerError(text: string) {
    $("pk-error").textContent = text;
    $("pk-error").hidden = !text;
    $("pk-form").classList.toggle("bad", !!text);
  }

  // ------------------------------------------------------------------ wallet + leaderboard

  /** The dealer's control panel: round actions and the player list with kick buttons. */
  private renderDealer(st: RoomState) {
    if (!this.me.isDealer) return;
    const live = st.phase === "voting" || st.phase === "revealed";
    const nextUp = st.queue.find((q) => !q.played && q.key !== st.ticket?.key && q.points === null)
      ?? st.queue.find((q) => !q.played && q.key !== st.ticket?.key);
    const btn = (act: string, label: string, sub: string, on: boolean, cls = "") =>
      `<button class="btn ${cls}" data-dc="${act}" ${on ? "" : "disabled"}><span>${label}<small>${sub}</small></span></button>`;
    const players = st.players.filter((p) => !p.isDealer);
    $("dealer-body").innerHTML = `
      <div class="dc-sec">This round</div>
      <div class="dc-grid">
        ${btn("redeal", "🔁 Restart vote", "everyone picks again", live)}
        ${btn("skip", "⏭️ Skip ticket", nextUp ? `no payout · next ${esc(nextUp.key)}` : "no payout", live)}
        ${btn("cancel", "✋ Cancel round", "no payout, clear ticket", live, "danger")}
        ${btn("picker", "🗂️ Pick a ticket", "load or switch", true)}
      </div>
      <div class="dc-sec">Players (${players.length})</div>
      ${players.length ? players.map((p) => `<div class="dc-row">
        <span class="dot in" style="--c:${p.color}"></span>
        <span class="lb-name">${esc(p.name)}</span>
        <span class="dc-state">${!p.connected ? "away" : st.phase === "voting" ? (p.hasVoted ? "✓ voted" : "thinking…") : ""}</span>
        <button class="dc-kick" data-kick="${p.id}" data-name="${esc(p.name)}">Kick</button>
      </div>`).join("") : `<div class="dc-state">Nobody else here yet. Send the invite link.</div>`}
      <label class="dc-toggle"><input type="checkbox" id="dc-plays" ${st.dealerPlays ? "checked" : ""}> I play a card too</label>`;
    const body = $("dealer-body");
    body.querySelectorAll<HTMLButtonElement>("[data-dc]").forEach((b) => (b.onclick = () => {
      const act = b.dataset.dc;
      if (act === "redeal") this.actions.dealer.deal();
      else if (act === "skip") { this.actions.dealer.skip(); if (nextUp) this.startLoading(`Skipping to ${nextUp.key}…`); }
      else if (act === "cancel") { if (confirm("Cancel this round? Nobody gets paid and the ticket is cleared.")) this.actions.dealer.cancel(); }
      else if (act === "picker") this.openPicker();
      $("dealer-pop").hidden = true;
    }));
    body.querySelectorAll<HTMLButtonElement>("[data-kick]").forEach((b) => (b.onclick = () => {
      if (confirm(`Kick ${b.dataset.name} from the table? They won't be able to rejoin.`)) this.actions.dealer.kick(b.dataset.kick!);
    }));
    const plays = body.querySelector<HTMLInputElement>("#dc-plays")!;
    plays.onchange = () => this.actions.dealer.setPlays(plays.checked);
  }

  private setWallet(n: number) {
    this.wallet = n;
    $("wallet-n").textContent = String(n);
  }

  private countWalletTo(n: number) {
    const from = this.wallet, start = performance.now(), dur = 900;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      $("wallet-n").textContent = String(Math.round((from + (n - from) * k) * 100) / 100);
      if (k < 1) requestAnimationFrame(tick);
      else this.setWallet(n);
    };
    requestAnimationFrame(tick);
    const w = $("wallet");
    w.classList.remove("bump"); void w.offsetWidth; w.classList.add("bump");
  }

  private renderBoard(st: RoomState) {
    const rows = [...st.players].sort((a, b) => b.chips - a.chips).map((p, i) => `
      <div class="lb-row ${p.id === this.me.id ? "me" : ""} ${p.connected ? "" : "away"}">
        <span class="lb-rank">${i === 0 && p.chips > 0 ? "👑" : i + 1}</span>
        <span class="dot in" style="--c:${p.color}"></span>
        <span class="lb-name">${esc(p.name)}${p.isDealer ? " · dealer" : ""}${p.connected ? "" : " · away"}</span>
        <span class="lb-chips">🪙 ${p.chips}</span>
        ${this.me.isDealer && !p.isDealer && !p.connected ? `<button class="btn link" data-kick="${p.id}">remove</button>` : ""}
      </div>`).join("");
    const hist = st.history.slice().reverse().map((h) =>
      `<div class="lb-h"><b>${esc(h.key)}</b> → ${h.finalPoints} pts · ${h.houseWon ? `house wins · ${esc(names(h.winners))} +${h.share}` : h.winners.length ? `${esc(names(h.winners))} +${h.share}` : "no cards played"}</div>`).join("");
    $("board-body").innerHTML = `${rows}${hist ? `<div class="lb-hh">Rounds played <button class="btn link" id="copy-rounds">📋 Copy for Jira</button></div><div class="lb-hist">${hist}</div>` : ""}`;
    $("board-body").querySelector<HTMLButtonElement>("#copy-rounds")?.addEventListener("click", async () => {
      // latest result per ticket, oldest first: "SD-123  5 pts  Summary"
      const latest = new Map<string, (typeof st.history)[number]>();
      for (const h of st.history) latest.set(h.key, h);
      const text = [...latest.values()].map((h) => `${h.key}\t${h.finalPoints} pts\t${h.summary}`).join("\n");
      try { await navigator.clipboard.writeText(text); this.toast(`📋 Copied ${latest.size} ticket${latest.size === 1 ? "" : "s"} and their points`); }
      catch { prompt("Copy these:", text.replace(/\n/g, " | ")); }
    });
    $("board-body").querySelectorAll<HTMLButtonElement>("[data-kick]").forEach((b) => (b.onclick = () => this.actions.dealer.kick(b.dataset.kick!)));
  }

  // ------------------------------------------------------------------ announcements + winning

  private announce(html: string, kind: string, ms: number) {
    const a = $("announce");
    a.className = `announce ${kind}`;
    a.innerHTML = `<div class="a-card">${html}</div>`;
    a.hidden = false;
    void a.offsetWidth;
    a.classList.add("show");
    clearTimeout(Number(a.dataset.t));
    a.dataset.t = String(setTimeout(() => {
      a.classList.remove("show");
      setTimeout(() => (a.hidden = true), 400);
    }, ms));
  }

  private celebrate(st: RoomState) {
    const winners = st.players.filter((p) => st.winners.includes(p.id));
    const iWon = st.winners.includes(this.me.id);
    const final = `<div class="a-kicker">Final call · ${st.finalPoints} points</div>`;
    if (st.houseWon) {
      const why = `Nobody was within one card of ${st.finalPoints}.`;
      if (iWon) {
        this.announce(`${final}<div class="a-title win">House wins <span class="amt">+${st.share}</span></div><div class="a-sub">${why} You rake in the pot.</div>`, "settle me", 2800);
        setTimeout(() => this.coinBurst(st.share), 350);
      } else {
        this.announce(`${final}<div class="a-title">House wins</div><div class="a-sub">${why} ${esc(winners[0]?.name ?? "The dealer")} rakes in 🪙 +${st.share}</div>`, "settle", 2800);
      }
      return;
    }
    if (!winners.length) {
      const played = st.players.some((p) => p.vote !== null);
      const why = !played ? "Nobody picked a card." : st.pot > 0 ? `Nobody was within one card of ${st.finalPoints}.` : "Nobody was close, but the pot was empty anyway.";
      this.announce(`${final}<div class="a-title">House wins</div><div class="a-sub">${why}</div>`, "settle", 2600);
      return;
    }
    const others = winners.filter((p) => p.id !== this.me.id).map((p) => p.name);
    if (iWon) {
      this.announce(`${final}<div class="a-title win">You win <span class="amt">+${st.share}</span></div>
        <div class="a-sub">${winners.length > 1 ? `Split with ${esc(names(others))}` : `The whole pot is yours`}</div>`, "settle me", 2800);
      setTimeout(() => this.coinBurst(st.share), 350);
    } else {
      this.announce(`${final}<div class="a-title">${esc(names(winners.map((p) => p.name)))} ${winners.length > 1 ? "split the pot" : "takes the pot"}</div>
        <div class="a-sub">🪙 +${st.share}${winners.length > 1 ? " each" : ""}</div>`, "settle", 2600);
    }
  }

  /** Coins burst out of the middle of the screen and stream into the wallet. */
  private coinBurst(amount: number) {
    const target = $("wallet").getBoundingClientRect();
    const tx = target.left + 22, ty = target.top + target.height / 2;
    const cx = innerWidth / 2, cy = innerHeight * 0.42;
    const n = Math.max(8, Math.min(28, Math.round(amount)));
    let landed = 0;
    for (let i = 0; i < n; i++) {
      const c = document.createElement("div");
      c.className = "fly-coin";
      document.body.append(c);
      const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 120;
      const bx = cx + Math.cos(a) * r, by = cy + Math.sin(a) * r * 0.7;
      const anim = c.animate([
        { transform: `translate(${cx}px, ${cy}px) scale(.3)`, opacity: 0 },
        { transform: `translate(${bx}px, ${by}px) scale(1.15)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${bx}px, ${by - 10}px) scale(1)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${tx}px, ${ty}px) scale(.55)`, opacity: 0.9 },
      ], { duration: 1150 + i * 35, easing: "cubic-bezier(.3,.1,.3,1)", delay: i * 18, fill: "forwards" });
      anim.onfinish = () => {
        c.remove();
        if (++landed % 3 === 0) this.audio.chip();
        if (landed === 1) this.countWalletTo(this.st?.players.find((p) => p.id === this.me.id)?.chips ?? this.wallet);
      };
    }
    this.audio.win();
  }
}
