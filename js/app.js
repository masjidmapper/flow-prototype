// MasjidMapper flow prototype: state, routing and screens.
// Specs: masjidmapper design/00-overview.md, design/10-android-ux-overhaul.md, design/11-saved-tab.md.
(function () {
  const { MASJIDS, ANNOUNCEMENTS, USER, USER_PLACE } = window.MOCK;
  const P = window.Prayer;
  const $app = document.getElementById("app");
  const $screen = document.getElementById("screen");
  const STORE = "mm-flow-prototype-v1";

  // ---------- State ----------
  function fresh() {
    return {
      day: "wed", clockMin: 14 * 60 + 17, signedIn: true, theme: "",
      tab: "prayer", stacks: { prayer: [], masjids: [], saved: [] },
      follows: structuredClone(window.MOCK.FOLLOWS),
      saved: structuredClone(window.MOCK.SAVED),
      lists: structuredClone(window.MOCK.LISTS),
      recent: window.MOCK.RECENT.map(r => ({ masjid_id: r.masjid_id, ago_min: r.ago_min })),
      read: [], dismissed: [], savesFilter: "followed", updatesFilter: "all", recentAll: false,
    };
  }
  let S = load() || fresh();
  let clockSetAt = Date.now();
  let ui = { sheet: null, menu: null, snack: null, pending: null };

  function load() { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* private mode */ } }

  const masjid = id => MASJIDS.find(m => m.id === id);
  const follow = id => S.follows.find(f => f.masjid_id === id);
  const isSaved = id => S.saved.some(s => s.masjid_id === id);
  const home = () => S.signedIn ? S.follows.find(f => f.is_home) : null;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Clock and day ----------
  function dayFixture() {
    const f = window.FIXTURES.days;
    return S.day === "fri" ? f["friday jummah slots sorted"] : f["no masjid"];
  }
  // Start times always come from the fixture. Iqamah and jummah are the home
  // masjid's own data, read on the masjid's clock (for An-Nur on the Wednesday this
  // reproduces the "fixed iqamah for every prayer" fixture exactly).
  function today() {
    const d = P.day(dayFixture());
    const h = home(), m = h && masjid(h.masjid_id);
    d.home = m || null;
    for (const r of d.rows) {
      r.iqamah = null; r.jummah = [];
      if (!m || r.salah === "sunrise") continue;
      if (r.salah === "dhuhr" && S.day === "fri") {
        r.jummah = m.jummah.map(j => P.localInstant(d.date, toMin(j.start_time))).sort((a, b) => a - b);
      } else if (m.iqamah[r.salah]) {
        r.iqamah = { at: P.localInstant(d.date, toMin(m.iqamah[r.salah])), flagged: false };
      }
    }
    d.isFriday = S.day === "fri";
    return d;
  }
  const toMin = hhmm => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  function now() { return new Date(P.localInstant(dayFixture().input.date, S.clockMin).getTime() + (Date.now() - clockSetAt)); }

  function distanceKm(m) {
    const R = 6371, rad = x => x * Math.PI / 180;
    const dLat = rad(m.latitude - USER_PLACE.latitude), dLon = rad(m.longitude - USER_PLACE.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(USER_PLACE.latitude)) * Math.cos(rad(m.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  const fmtKm = km => km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
  function ago(min) {
    if (min < 1) return "now";
    if (min < 60) return `${min} min`;
    if (min < 60 * 24) return `${Math.floor(min / 60)} h`;
    return `${Math.floor(min / 1440)} d`;
  }

  // ---------- Routing ----------
  // Each tab keeps its own back stack (design/10 §4.1). Updates and Profile open
  // over the tab they were opened from.
  const top = () => S.stacks[S.tab][S.stacks[S.tab].length - 1];
  function push(page) { S.stacks[S.tab].push(page); closeOverlays(); save(); syncHash(true); render(true); }
  function back() { S.stacks[S.tab].pop(); closeOverlays(); save(); syncHash(false); render(true); }
  function selectTab(tab) {
    if (tab === S.tab) {
      if (S.stacks[tab].length) S.stacks[tab] = [];
      else { const v = $app.querySelector(".view"); if (v) v.scrollTo({ top: 0, behavior: "smooth" }); return; }
    }
    S.tab = tab; closeOverlays(); save(); syncHash(true); render(true);
  }
  function hashFor() { const t = top(); return "#/" + S.tab + (t ? "/" + t.type + (t.id ? "/" + t.id : "") : ""); }
  function syncHash(pushIt) { const h = hashFor(); if (location.hash !== h) history[pushIt ? "pushState" : "replaceState"](null, "", h); }
  function fromHash() {
    const [tab, type, id] = location.hash.replace(/^#\/?/, "").split("/");
    if (!["prayer", "masjids", "saved"].includes(tab)) return false;
    S.tab = tab;
    S.stacks[tab] = type ? [{ type, id }] : [];
    return true;
  }
  window.addEventListener("popstate", () => { if (fromHash()) { closeOverlays(); render(true); } });

  // ---------- Auth (inline sheet, resume contract: design/00) ----------
  function requireSignIn(reason, action) {
    if (S.signedIn) return action();
    ui.pending = action;
    openSheet("signin", { reason });
  }

  // ---------- Actions ----------
  function setHome(id) {
    S.follows.forEach(f => { f.is_home = false; });
    let f = follow(id);
    if (!f) { f = { masjid_id: id, masjid_name: masjid(id).name, is_home: true, push_enabled: true }; S.follows.unshift(f); }
    f.is_home = true;
    S.saved = S.saved.filter(s => s.masjid_id !== id);
  }
  const A = {
    follow(id) { requireSignIn("Sign in to follow this masjid and get its janazah notices and events.", () => {
      if (!follow(id)) S.follows.push({ masjid_id: id, masjid_name: masjid(id).name, is_home: false, push_enabled: true });
      S.saved = S.saved.filter(s => s.masjid_id !== id);
      done(`Following ${masjid(id).name}`, () => A.unfollow(id, true));
    }); },
    unfollow(id, quiet) {
      const wasSaved = isSaved(id);
      S.follows = S.follows.filter(f => f.masjid_id !== id);
      done(quiet ? null : `Unfollowed ${masjid(id).name}` + (wasSaved ? ". It stays in Saved." : ""));
    },
    makeHome(id) { requireSignIn("Sign in to choose your home masjid.", () => {
      setHome(id); done(`${masjid(id).name} is your home masjid`);
    }); },
    removeHome(id) { const f = follow(id); if (f) f.is_home = false; done("Home masjid removed. You still follow it."); },
    save(id) { requireSignIn("Sign in to save masjids.", () => {
      if (!isSaved(id) && !follow(id)) S.saved.unshift({ masjid_id: id, masjid_name: masjid(id).name, saved_at: now().toISOString() });
      done(follow(id) ? "You already follow this masjid. It's under Followed." : `Saved ${masjid(id).name}`);
    }); },
    unsave(id) { S.saved = S.saved.filter(s => s.masjid_id !== id); done(`Removed ${masjid(id).name} from Saved`); },
    removeFromList(listId, id) {
      const l = S.lists.find(x => x.id === listId);
      l.masjids = l.masjids.filter(m => m.masjid_id !== id);
      done(`Removed from ${l.name}`);
    },
    togglePush(id) { const f = follow(id); f.push_enabled = !f.push_enabled; done(`Announcements ${f.push_enabled ? "on" : "off"} for ${masjid(id).name}`); },
  };
  function done(msg, undo) { closeOverlays(); save(); render(); if (msg) snack(msg, undo); }

  function openMasjid(id) {
    S.recent = [{ masjid_id: id, ago_min: 0 }, ...S.recent.filter(r => r.masjid_id !== id)].slice(0, 50);
    push({ type: "masjid", id });
  }

  // ---------- Overlays ----------
  function closeOverlays() { ui.sheet = null; ui.menu = null; }
  function openSheet(kind, data) { ui.sheet = { kind, data: data || {} }; ui.menu = null; renderOverlays(); }
  function openMenu(items, anchor) {
    const r = anchor.getBoundingClientRect(), s = $screen.getBoundingClientRect();
    const scale = s.width / $screen.offsetWidth || 1;
    const h = items.length * 48 + 16, below = (r.bottom - s.top) / scale;
    const topPx = below + h > $screen.offsetHeight - 96 ? (r.top - s.top) / scale - h : below;
    ui.menu = { items, top: topPx, right: (s.right - r.right) / scale };
    renderOverlays();
  }
  let snackTimer;
  function snack(text, undo) {
    ui.snack = { text, undo }; renderOverlays();
    clearTimeout(snackTimer); snackTimer = setTimeout(() => { ui.snack = null; renderOverlays(); }, 4000);
  }
  const later = what => snack(`${what} isn't in this prototype yet`);

  // ---------- Shared pieces ----------
  const sym = (name, cls = "") => `<span class="sym ${cls}" aria-hidden="true">${name}</span>`;
  const mi = (outline) => `<span class="mi${outline ? " outline" : ""}" aria-hidden="true"></span>`;
  function arch(m, { sm, homeBadge } = {}) {
    return `<span class="arch${sm ? " sm" : ""}">${mi()}${homeBadge ? `<span class="home">${sym("home", "fill")}</span>` : ""}</span>`;
  }
  function initials(name) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => [...w][0].toUpperCase()).join(""); }
  function profileBtn() {
    return `<button class="icon-btn" data-act="open-profile" aria-label="Profile">${S.signedIn
      ? `<span class="avatar">${esc(initials(USER.name))}</span>` : sym("account_circle")}</button>`;
  }
  function unreadCount() { if (!S.signedIn) return 0; return feed().filter(a => !S.read.includes(a.id)).length; }
  function bellBtn() {
    const n = unreadCount();
    return `<button class="icon-btn" data-act="open-updates" aria-label="Updates${n ? `, ${n} unread` : ""}">${sym("notifications")}${n ? '<span class="dot"></span>' : ""}</button>`;
  }
  const TIER = {
    verified: ["verified", "Verified by the masjid"],
    community: ["groups", "Community-submitted, not yet verified"],
    seeded: ["info", "Not yet verified by the masjid"],
  };
  function tierLabel(m, field) {
    const t = (m.tiers && m.tiers[field]) || "seeded";
    const date = m.tier_dates && m.tier_dates[field] ? " · " + P.shortDate(new Date(m.tier_dates[field] + "T12:00:00Z")) : "";
    const extra = t === "community" && m.agree ? ` · ${m.agree} agree` : "";
    return `<button class="tier ${t}" data-act="explain-tier" data-tier="${t}">${sym(TIER[t][0])}${TIER[t][1]}${extra}${date}</button>`;
  }

  // ---------- Prayer ----------
  function sunPath(d, n) {
    const pts = d.rows.filter(r => r.salah !== "sunrise");
    const t0 = +pts[0].starts, t1 = +pts[pts.length - 1].starts, W = 300, H = 72, base = 64, amp = 52;
    const x = t => 8 + (W - 16) * Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const y = t => base - amp * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
    const cur = Math.min(t1, Math.max(t0, +now()));
    const path = (a, b) => { let s = ""; for (let i = 0; i <= 40; i++) { const t = a + (b - a) * i / 40; s += `${i ? "L" : "M"}${x(t).toFixed(1)} ${y(t).toFixed(1)}`; } return s; };
    return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <line x1="8" x2="${W - 8}" y1="${base}" y2="${base}" stroke="currentColor" stroke-opacity=".35" />
      <path d="${path(t0, cur)}" fill="none" stroke="currentColor" stroke-opacity=".75" stroke-width="2" />
      <path d="${path(cur, t1)}" fill="none" stroke="currentColor" stroke-opacity=".6" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" />
      ${pts.map(r => `<circle cx="${x(+r.starts)}" cy="${y(+r.starts)}" r="3.5" fill="currentColor" />`).join("")}
      <circle cx="${x(cur)}" cy="${y(cur)}" r="8" fill="var(--tertiary)" stroke="var(--on-primary-container)" stroke-opacity=".5" />
    </svg>`;
  }

  function prayerView() {
    const d = today(), t = now(), h = d.home;
    const n = P.next(d, t, !!h);
    const mins = P.minutesUntil(n.at, t);
    const dur = P.duration(mins);
    const label = n.label;
    let what;
    if (!h) what = n.tomorrow ? `Next prayer: ${label}, tomorrow` : `Next prayer: ${label}`;
    else if (n.started) what = `${label} has started · iqamah at ${esc(h.name)}`;
    else if (label === "Jummah") what = `Jummah at ${esc(h.name)}`;
    else what = `${label} ${n.isIqamah ? "iqamah " : ""}${n.tomorrow ? "tomorrow " : ""}at ${esc(h.name)}`;
    const when = h && n.isIqamah ? `${P.time(n.at)} · ${label === "Jummah" ? "Dhuhr" : label} starts ${P.time(n.starts)}` : `${label} starts ${P.time(n.at)}`;
    const countHtml = mins <= 0 ? "<b>now</b>" : `${n.started ? "iqamah " : ""}in <b>${dur}</b>`;
    const sentence = `${what.replace(/&amp;/g, "&")} ${mins <= 0 ? "now" : "in " + dur.replace(/ /g, " ")}, at ${P.time(n.at)}.`;

    const nextRow = n.tomorrow ? null : n.row;
    const anyMissing = h && d.rows.some(r => r.salah !== "sunrise" && !r.iqamah && !(r.salah === "dhuhr" && r.jummah.length));
    const rows = d.rows.map(r => {
      const end = r.iqamah ? r.iqamah.at : (r.jummah.length ? r.jummah[r.jummah.length - 1] : r.starts);
      const isNext = r === nextRow;
      const past = !isNext && (n.tomorrow || end <= t);
      const cls = ["trow", h ? "" : "one", r.salah === "sunrise" ? "quiet" : "", isNext ? "next" : "", past ? "past" : ""].join(" ");
      const name = r.jummah.length ? "Jummah" : r.label;
      const tag = isNext ? `<span class="badge-next">Next</span>` : "";
      if (r.jummah.length) {
        return `<div class="${cls}"><span class="name">${name} ${tag}</span><span class="slots">${r.jummah.map(P.time).join(" · ")}</span></div>`;
      }
      return `<div class="${cls}"><span class="name">${name} ${tag}</span><span class="starts tab">${P.time(r.starts)}</span>${h ? `<span class="iq">${r.iqamah ? P.time(r.iqamah.at) : ""}</span>` : ""}</div>`;
    }).join("");

    const firstRun = !h && !S.dismissed.includes("choose");
    const reminder = h && !S.dismissed.includes("reminder");

    return `
    <header class="topbar">
      <button class="loc-chip" data-act="later" data-what="The place picker">${sym("near_me")}<span>${esc(USER_PLACE.label)}</span>${sym("arrow_drop_down", "caret")}</button>
      <button class="icon-btn" data-act="later" data-what="Qibla" aria-label="Qibla">${sym("explore", "fill")}</button>
      ${bellBtn()}${profileBtn()}
    </header>
    <div class="view" data-view="prayer">
      <div class="dateline">${esc(d.hijri)} · ${esc(d.gregorian)}</div>
      <div class="pad">
        <button class="hero" data-act="${h ? "open-masjid" : "choose-home"}" data-id="${h ? h.id : ""}" aria-label="${esc(sentence)}">
          <div class="what">${what}</div>
          <div class="count">${countHtml}</div>
          <div class="when">${when}</div>
          ${sunPath(d, n)}
        </button>
        <section class="card table" aria-label="Today's prayer times">
          <div class="trow head ${h ? "" : "one"}"><span>Today</span><span class="starts">Starts</span>${h ? '<span class="iq">Iqamah</span>' : ""}</div>
          ${rows}
          <div class="tfoot">
            ${h ? tierLabel(h, "iqamah") : `<button class="link" data-act="choose-home">Choose a home masjid to see iqamah times</button>`}
            ${anyMissing ? `<div class="hint">Others not listed · <button class="link" data-act="later" data-what="Suggest times">Suggest times</button></div>` : ""}
            <button class="link" data-act="later" data-what="Settings › Prayer times">${d.method} · ${d.madhab === "hanafi" ? "Hanafi" : "Standard"} Asr</button>
          </div>
        </section>
        ${firstRun ? `<section class="card promo">${sym("mosque")}<div><h3>See when your masjid prays</h3><p>Choose your masjid and its iqamah times show here, with a countdown to each one.</p><button class="btn filled" data-act="choose-home">Choose your masjid</button></div><button class="icon-btn close" data-act="dismiss" data-id="choose" aria-label="Dismiss">${sym("close")}</button></section>` : ""}
        ${reminder ? `<section class="card promo">${sym("alarm")}<div><h3>Get a reminder before iqamah</h3><p>A notification 15 minutes before ${esc(h.name)}'s iqamah. Change the time and the prayers in Settings.</p><button class="btn filled" data-act="reminder-on">Turn on</button></div><button class="icon-btn close" data-act="dismiss" data-id="reminder" aria-label="Dismiss">${sym("close")}</button></section>` : ""}
      </div>
    </div>`;
  }

  // ---------- Masjids (placeholder) ----------
  function masjidsView() {
    const near = MASJIDS.map(m => ({ m, km: distanceKm(m) })).filter(x => x.km < 50).sort((a, b) => a.km - b.km);
    const proj = m => ({ x: 50 + (m.longitude - USER_PLACE.longitude) * 110, y: 46 - (m.latitude - USER_PLACE.latitude) * 130 });
    const h = home();
    const pins = near.map(({ m }) => { const p = proj(m);
      return `<button class="pin${h && h.masjid_id === m.id ? " home" : ""}" style="left:${p.x}%;top:${p.y}%" data-act="open-masjid" data-id="${m.id}" aria-label="${esc(m.name)}">${mi()}</button>`; }).join("");
    const first = near[0];
    return `
    <div class="view" data-view="masjids" style="overflow:hidden">
      <div class="map" aria-hidden="false">
        <div class="park" style="left:8%;top:22%;width:30%;height:14%"></div>
        <div class="park" style="left:62%;top:58%;width:26%;height:10%"></div>
        <div class="road" style="left:0;right:0;top:40%;height:6px"></div>
        <div class="road" style="top:0;bottom:0;left:46%;width:6px"></div>
        <div class="road" style="left:0;right:0;top:18%;height:4px;transform:rotate(-8deg)"></div>
        <div class="water"></div>
        ${pins}
        <span class="me-dot" style="left:50%;top:46%" aria-label="You are here"></span>
      </div>
      <div class="search-pill">${sym("search")}<button class="ph" style="text-align:left" data-act="later" data-what="Search">Search masjids or areas</button>${profileBtn()}</div>
      <div class="placeholder-note">Placeholder: the Masjids flow comes next</div>
      <button class="locate" data-act="later" data-what="Locate me" aria-label="Locate me">${sym("near_me")}</button>
      <div class="peek">
        <div class="handle"></div>
        <div class="h">${near.length} masjids nearby</div>
        ${first ? masjidRow(first.m, { sub: `${first.m.locality} · ${fmtKm(first.km)}`, noMenu: true }) : ""}
      </div>
    </div>`;
  }

  // ---------- Saved (design/11) ----------
  function masjidRow(m, { sub, menu, noMenu, homeBadge, list } = {}) {
    return `<div class="row" role="group">
      <button style="display:contents" data-act="open-masjid" data-id="${m.id}">
        ${arch(m, { homeBadge })}
        <span class="main"><span class="t" style="display:block">${esc(m.name)}</span><span class="s" style="display:block">${sub}</span></span>
      </button>
      ${noMenu ? "" : `<button class="icon-btn" data-act="row-menu" data-id="${m.id}" data-menu="${menu}" ${list ? `data-list="${list}"` : ""} aria-label="More for ${esc(m.name)}">${sym("more_vert")}</button>`}
    </div>`;
  }

  function savedView() {
    const recent = S.recent.filter(r => masjid(r.masjid_id));
    const shown = S.recentAll ? recent : recent.slice(0, 3);
    const recentHtml = recent.length ? `
      <h2 class="section-title">Your recent masjids</h2>
      <div class="pad" style="padding-bottom:0"><div class="group-list">
        ${shown.map(r => { const m = masjid(r.masjid_id); return masjidRow(m, { sub: `${esc(m.locality)} · Opened · ${ago(r.ago_min)}`, noMenu: true }); }).join("")}
      </div>
      ${recent.length > 3 ? `<div style="padding-top:var(--space-3)"><button class="btn tonal" data-act="recent-all">${S.recentAll ? "Show fewer" : "See all"}</button></div>` : ""}
      </div>` : "";

    let saves;
    if (!S.signedIn) {
      saves = `<div class="empty">${mi()}<h3>Sign in to save and follow masjids</h3><p>Follow your masjid for its janazah notices and events, save the ones you visit, and make lists.</p><button class="btn filled" data-act="sign-in">Sign in</button></div>`;
    } else {
      const f = S.savesFilter;
      const followed = [...S.follows].sort((a, b) => b.is_home - a.is_home);
      let rows = "";
      if (f === "followed") {
        rows = followed.length ? followed.map(x => {
          const m = masjid(x.masjid_id);
          const sub = `${x.is_home ? "Home masjid · " : ""}Announcements ${x.push_enabled ? "on" : "off"}`;
          return masjidRow(m, { sub, menu: "followed", homeBadge: x.is_home });
        }).join("") : "";
        if (!rows) rows = emptyFilter("You don't follow any masjids yet", "Follow a masjid to get its janazah notices and events.");
      } else {
        rows = S.saved.length ? S.saved.map(x => { const m = masjid(x.masjid_id); return masjidRow(m, { sub: `${esc(m.locality)} · ${fmtKm(distanceKm(m))}`, menu: "saved" }); }).join("")
          : emptyFilter("Nothing saved yet", "Save a masjid from its page to find it here.");
      }
      const lists = S.lists.map(l => `<button class="row" data-act="open-list" data-id="${l.id}"><span class="lead">${sym("list")}</span><span class="main"><span class="t" style="display:block">${esc(l.name)}</span><span class="s" style="display:block">${l.masjids.length} masjid${l.masjids.length === 1 ? "" : "s"}</span></span></button>`).join("");
      saves = `
        <div class="pad" style="padding-bottom:0">
          <h2 class="section-title plain">Your saves</h2>
          <div class="chips" role="tablist">
            <button class="chip${f === "followed" ? " on" : ""}" role="tab" aria-selected="${f === "followed"}" data-act="saves-filter" data-id="followed">Followed</button>
            <button class="chip${f === "saved" ? " on" : ""}" role="tab" aria-selected="${f === "saved"}" data-act="saves-filter" data-id="saved">Saved</button>
            <button class="chip action" data-act="new-list">${sym("add")}New list</button>
          </div>
          <div class="group-list">${rows}</div>
        </div>
        ${S.lists.length ? `<h2 class="section-title">Your lists</h2><div class="pad"><div class="group-list">${lists}</div></div>` : '<div class="pad"></div>'}`;
    }
    return `
    <header class="topbar"><h1 class="title" style="margin:0">Saved</h1>${bellBtn()}${profileBtn()}</header>
    <div class="view" data-view="saved">${recentHtml}${saves}</div>`;
  }
  function emptyFilter(h, p) {
    return `<div class="row" style="display:block;padding:var(--space-6) var(--space-4);text-align:center"><div class="t">${h}</div><div class="s" style="margin:var(--space-1) 0 var(--space-3)">${p}</div><button class="btn tonal" data-act="tab" data-id="masjids">Find masjids</button></div>`;
  }

  function listView(id) {
    const l = S.lists.find(x => x.id === id);
    if (!l) return goneView("This list was deleted");
    return `
    <header class="topbar back"><button class="icon-btn" data-act="back" aria-label="Back">${sym("arrow_back")}</button><h1 class="title" style="margin:0">${esc(l.name)}</h1>
      <button class="icon-btn" data-act="list-menu" data-id="${l.id}" aria-label="List options">${sym("more_vert")}</button></header>
    <div class="view"><div class="pad">
      <p class="s" style="color:var(--on-surface-variant);margin:0 0 var(--space-3)">Private to you · ${l.masjids.length} masjid${l.masjids.length === 1 ? "" : "s"}</p>
      <div class="group-list">${l.masjids.length ? l.masjids.map(x => { const m = masjid(x.masjid_id); return masjidRow(m, { sub: `${esc(m.locality)} · ${fmtKm(distanceKm(m))}`, menu: "list", list: l.id }); }).join("")
        : emptyFilter("This list is empty", "Add masjids from a masjid's page with Save to a list.")}</div>
    </div></div>`;
  }

  function goneView(msg) {
    return `<header class="topbar back"><button class="icon-btn" data-act="back" aria-label="Back">${sym("arrow_back")}</button></header>
      <div class="view"><div class="empty"><h3>${msg}</h3></div></div>`;
  }

  // ---------- Masjid page (minimal, enough to drive Follow and Save) ----------
  function masjidView(id) {
    const m = masjid(id);
    if (!m) return goneView("This masjid is no longer listed");
    const f = follow(id), sv = isSaved(id), isHome = f && f.is_home;
    const d = today();
    // Start times come from the Toronto fixture, so they only fit masjids nearby.
    const local = distanceKm(m) < 50;
    const rows = d.rows.filter(r => r.salah !== "sunrise").map(r => {
      const iq = r.salah === "dhuhr" && S.day === "fri" ? m.jummah.map(j => P.time(P.localInstant(d.date, toMin(j.start_time)))).join(" · ")
        : m.iqamah[r.salah] ? P.time(P.localInstant(d.date, toMin(m.iqamah[r.salah]))) : "";
      return `<div class="trow${local ? "" : " one"}"><span class="name">${r.salah === "dhuhr" && S.day === "fri" ? "Jummah" : r.label}</span>${local ? `<span class="starts">${P.time(r.starts)}</span>` : ""}<span class="iq">${iq}</span></div>`;
    }).join("");
    return `
    <header class="topbar back"><button class="icon-btn" data-act="back" aria-label="Back">${sym("arrow_back")}</button><span class="title"></span>
      <button class="icon-btn" data-act="later" data-what="Share" aria-label="Share">${sym("share")}</button></header>
    <div class="view"><div class="pad">
      <div style="display:flex;gap:var(--space-4);align-items:center;padding-bottom:var(--space-4)">${arch(m, { homeBadge: isHome })}
        <div><h1 style="margin:0;font:var(--headline-medium)">${esc(m.name)}</h1>
        <div style="color:var(--on-surface-variant)">${esc(m.locality)} · ${fmtKm(distanceKm(m))}</div>
        ${m.is_claimed ? `<div class="tier verified" style="margin-top:4px">${sym("verified")}Run by the masjid</div>` : ""}</div></div>
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;padding-bottom:var(--space-4)">
        ${f ? `<button class="btn tonal" data-act="unfollow" data-id="${id}">${sym("check")}Following</button>` : `<button class="btn filled" data-act="follow" data-id="${id}">Follow</button>`}
        ${f ? "" : sv ? `<button class="btn tonal" data-act="unsave" data-id="${id}">${sym("bookmark", "fill")}Saved</button>` : `<button class="btn outlined" data-act="save" data-id="${id}">${sym("bookmark")}Save</button>`}
        <button class="btn outlined" data-act="add-to-list" data-id="${id}">${sym("playlist_add")}Save to a list</button>
        ${isHome ? "" : `<button class="btn text" data-act="make-home" data-id="${id}">${sym("home")}Make home</button>`}
      </div>
      <section class="card table">
        <div class="trow head${local ? "" : " one"}"><span>Today</span>${local ? '<span class="starts">Starts</span>' : ""}<span class="iq">Iqamah</span></div>${rows}
        <div class="tfoot">${tierLabel(m, "iqamah")}</div>
      </section>
      <section class="card" style="padding:var(--space-4)"><div style="font:var(--title-small);color:var(--primary);margin-bottom:var(--space-2)">About</div>
        <div>${esc(m.address)}</div><p style="color:var(--on-surface-variant);margin:var(--space-3) 0 0;font:var(--body-small)">The full masjid page (photos, facilities, contribute) is a later flow.</p></section>
    </div></div>`;
  }

  // ---------- Updates (design/04, design/10 §5.11) ----------
  function feed() {
    const t = now(), d = today();
    const asrIq = (d.rows.find(r => r.salah === "asr").iqamah || {}).at || d.rows.find(r => r.salah === "asr").starts;
    const isha = d.rows.find(r => r.salah === "isha").starts;
    return ANNOUNCEMENTS.map(a => {
      let event_at = null;
      if (a.event_in === "asr-iqamah") event_at = asrIq;
      else if (a.event_in === "isha+60") event_at = new Date(+isha + 3600000);
      else if (a.event_in) event_at = new Date(+t + Number(a.event_in) * 60000);
      return { ...a, created_at: new Date(+t - a.created_ago * 60000), event_at };
    }).filter(a => !S.signedIn ? true : S.follows.some(f => f.masjid_id === a.masjid_id));
  }
  function whenText(dte) {
    const t = now();
    return `${P.dateKey(dte) === P.dateKey(t) ? "Today" : P.shortDate(dte)}, ${P.time(dte)}`;
  }
  function annCard(a, preview) {
    const unread = !preview && !S.read.includes(a.id);
    const mins = Math.round((now() - a.created_at) / 60000);
    const agoTxt = mins < 1 ? "now" : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.floor(mins / 60)} h ago` : mins < 2880 ? "Yesterday" : P.shortDate(a.created_at);
    const typeTag = a.type === "event" ? `<span class="type">${sym("event")}Event</span>` : "";
    return `<article class="card ann" data-act="read" data-id="${a.id}" tabindex="0">
      ${a.type === "janazah" && a.event_at ? `<div class="band">Janazah · ${whenText(a.event_at)}</div>` : ""}
      <div class="body">
        <div class="who">${arch(masjid(a.masjid_id), { sm: true })}<div><div class="n">${esc(a.masjid_name)}${unread ? '<span class="unread" aria-label="Unread"></span>' : ""}</div><div class="ago">${agoTxt}</div></div>${typeTag}</div>
        <h4>${esc(a.title)}</h4>
        <p>${esc(a.body)}</p>
        ${a.type === "event" && a.event_at ? `<span class="when-pill">${sym("event")}${whenText(a.event_at)}</span>` : ""}
        ${a.location_text ? `<div class="meta">${sym("location_on")}${esc(a.location_text)}</div>` : ""}
        ${a.type === "janazah" ? `<div class="acts"><button class="btn text" data-act="later" data-what="Directions">${sym("directions")}Directions</button><button class="btn text" data-act="later" data-what="Share">${sym("share")}Share</button></div>` : ""}
      </div></article>`;
  }
  function updatesView() {
    const t = now();
    const head = `<header class="topbar back"><button class="icon-btn" data-act="back" aria-label="Back">${sym("arrow_back")}</button><h1 class="title" style="margin:0">Updates</h1></header>`;
    if (!S.signedIn) {
      return head + `<div class="view"><div class="pad">
        <div class="empty">${sym("notifications")}<h3>Your masjid's news, here</h3><p>Follow your masjid to get its janazah notices and events here.</p><button class="btn filled" data-act="sign-in">Sign in</button></div>
        <div class="subhead">Recently from masjids near you</div>${feed().slice(0, 3).map(a => annCard(a, true)).join("")}</div></div>`;
    }
    if (!S.follows.length) {
      return head + `<div class="view"><div class="pad"><div class="empty">${mi()}<h3>No masjids followed</h3><p>Follow a masjid to see its announcements here.</p><button class="btn filled" data-act="tab" data-id="masjids">Find masjids</button></div></div></div>`;
    }
    const f = S.updatesFilter;
    const items = feed().filter(a => f === "all" || a.type === f);
    const upcoming = items.filter(a => a.event_at && a.event_at > t && a.type !== "general").sort((a, b) => a.event_at - b.event_at);
    const earlier = items.filter(a => !upcoming.includes(a)).sort((a, b) => b.created_at - a.created_at);
    const chip = (id, label) => `<button class="chip${f === id ? " on" : ""}" data-act="updates-filter" data-id="${id}">${f === id ? sym("check") : ""}${label}</button>`;
    return head + `<div class="view"><div class="pad">
      <div class="chips">${chip("all", "All")}${chip("janazah", "Janazah")}${chip("event", "Events")}</div>
      ${!items.length ? `<div class="empty"><h3>Nothing here yet</h3><p>No announcements of this kind from the masjids you follow.</p></div>` : ""}
      ${upcoming.length ? `<div class="subhead">Upcoming</div>${upcoming.map(a => annCard(a)).join("")}` : ""}
      ${earlier.length ? `<div class="subhead">Earlier</div>${earlier.map(a => annCard(a)).join("")}` : ""}
    </div></div>`;
  }

  // ---------- Profile (design/05, design/10 §5.13) ----------
  function profileView() {
    const head = `<header class="topbar back"><button class="icon-btn" data-act="back" aria-label="Back">${sym("arrow_back")}</button><h1 class="title" style="margin:0">Profile</h1></header>`;
    const item = (icon, t, s, act, what, trail) => `<button class="row" data-act="${act}" ${what ? `data-what="${what}"` : ""}><span class="lead round">${icon}</span><span class="main"><span class="t" style="display:block">${t}</span>${s ? `<span class="s" style="display:block">${s}</span>` : ""}</span>${trail != null ? `<span class="trail">${trail}</span>` : ""}</button>`;
    const common = `<div class="group-list" style="margin-top:var(--space-6)">
      ${item(sym("verified"), "Claim your masjid", "Keep its times and facilities right", "later", "Claim your masjid")}
      ${item(sym("add"), "Add a missing masjid", "", "later", "Add a missing masjid")}
      ${item(sym("settings"), "Settings", "", "later", "Settings")}
      ${item(sym("flag"), "Report a problem", "", "later", "Report a problem")}
    </div>`;
    if (!S.signedIn) {
      return head + `<div class="view"><div class="pad">
        <section class="card" style="padding:var(--space-5)"><h2 style="margin:0 0 var(--space-2);font:var(--title-large)">Follow masjids and get their janazah notices and events</h2>
        <p style="margin:0 0 var(--space-4);color:var(--on-surface-variant)">No account needed for prayer times and the map.</p><button class="btn filled" data-act="sign-in">Sign in</button></section>
        ${common}</div></div>`;
    }
    const h = home();
    return head + `<div class="view"><div class="pad">
      <div class="p-head"><span class="avatar lg">${esc(initials(USER.name))}</span><div><div class="n">${esc(USER.name)}</div><div class="e">${esc(USER.email)}</div></div></div>
      <div class="group-list">${item(sym("home"), "Home masjid", h ? esc(masjid(h.masjid_id).name) : "Choose your home masjid", h ? "open-masjid" : "choose-home")}</div>
      <h2 class="section-title" style="padding-left:var(--space-1)">Your activity</h2>
      <div class="group-list">
        ${item(sym("edit_note"), "Your suggestions", "", "later", "Your suggestions", 2)}
        ${item(sym("verified"), "Your claims", "", "later", "Your claims", 0)}
        ${item(mi(true), "Your submissions", "Masjids you've asked us to add", "later", "Your submissions", 1)}
      </div>
      ${common}
      <div style="padding-top:var(--space-6)"><button class="btn outlined block" data-act="sign-out">Sign out</button></div>
    </div></div>`.replace(`data-act="open-masjid"`, `data-act="open-masjid" data-id="${h ? h.masjid_id : ""}"`);
  }

  // ---------- Sheets ----------
  function sheetHtml() {
    const s = ui.sheet; if (!s) return "";
    let inner = "";
    if (s.kind === "signin") {
      inner = `<h2>Sign in</h2><p>${esc(s.data.reason)}</p>
        <div class="stack"><button class="btn filled block google" data-act="do-sign-in">${sym("account_circle")}Continue with Google</button>
        <button class="btn text block" data-act="skip-sign-in">Not now</button></div>`;
    } else if (s.kind === "new-list" || s.kind === "rename-list") {
      const l = s.kind === "rename-list" ? S.lists.find(x => x.id === s.data.id) : null;
      inner = `<h2>${l ? "Rename list" : "New list"}</h2><p>Lists are private to you.</p>
        <form data-form="${s.kind}"><div class="field"><label for="list-name">Name</label><input id="list-name" name="name" maxlength="40" autocomplete="off" value="${l ? esc(l.name) : ""}" placeholder="Near work"></div>
        <div class="acts"><button type="button" class="btn text" data-act="close">Cancel</button><button class="btn filled" type="submit">${l ? "Save" : "Create"}</button></div></form>`;
    } else if (s.kind === "delete-list") {
      const l = S.lists.find(x => x.id === s.data.id);
      inner = `<h2>Delete "${esc(l.name)}"?</h2><p>The masjids stay followed or saved. Only the list goes.</p>
        <div class="acts"><button class="btn text" data-act="close">Cancel</button><button class="btn filled" data-act="confirm-delete-list" data-id="${l.id}">Delete</button></div>`;
    } else if (s.kind === "add-to-list") {
      const m = masjid(s.data.id);
      inner = `<h2>Save to a list</h2><p>${esc(m.name)}</p><div class="group-list">
        ${S.lists.map(l => { const on = l.masjids.some(x => x.masjid_id === m.id);
          return `<button class="row" data-act="toggle-in-list" data-id="${l.id}" data-masjid="${m.id}"><span class="lead">${sym(on ? "check_box" : "check_box_outline_blank", on ? "fill" : "")}</span><span class="main"><span class="t">${esc(l.name)}</span></span></button>`; }).join("")}
        <button class="row" data-act="new-list" data-masjid="${m.id}"><span class="lead">${sym("add")}</span><span class="main"><span class="t" style="color:var(--primary)">New list</span></span></button>
        </div><div class="acts"><button class="btn filled" data-act="close">Done</button></div>`;
    } else if (s.kind === "choose-home") {
      const opts = MASJIDS.map(m => ({ m, km: distanceKm(m) })).sort((a, b) => a.km - b.km).slice(0, 4);
      inner = `<h2>Choose your home masjid</h2><p>Its iqamah times show on Prayer, and you'll get its janazah notices.</p><div class="group-list">
        ${opts.map(({ m, km }) => `<button class="row" data-act="pick-home" data-id="${m.id}">${arch(m)}<span class="main"><span class="t" style="display:block">${esc(m.name)}</span><span class="s" style="display:block">${esc(m.locality)} · ${fmtKm(km)}</span></span></button>`).join("")}
        </div>`;
    } else if (s.kind === "sign-out") {
      inner = `<h2>Sign out?</h2><p>Prayer times and the map keep working. Your follows and saves come back when you sign in.</p>
        <div class="acts"><button class="btn text" data-act="close">Cancel</button><button class="btn filled" data-act="confirm-sign-out">Sign out</button></div>`;
    } else if (s.kind === "tier") {
      const txt = { verified: "An admin of this masjid keeps these times. They override anything else.",
        community: "People who pray here sent these. The masjid hasn't confirmed them, and they never count as verified.",
        seeded: "The Masjid Mapper team entered these by hand. The masjid hasn't confirmed them yet." }[s.data.tier];
      inner = `<h2>${TIER[s.data.tier][1]}</h2><p>${txt}</p><div class="acts"><button class="btn filled" data-act="close">OK</button></div>`;
    }
    return `<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="handle"></div>${inner}</div>`;
  }

  function menuItems(kind, id, listId) {
    const f = follow(id);
    if (kind === "followed") return [
      ["Unfollow", "person_remove", () => A.unfollow(id)],
      f && f.is_home ? ["Remove home", "home", () => A.removeHome(id)] : ["Make home", "home", () => A.makeHome(id)],
      [f && f.push_enabled ? "Turn announcements off" : "Turn announcements on", "notifications", () => A.togglePush(id)],
      ["Add to list", "playlist_add", () => openSheet("add-to-list", { id })],
    ];
    if (kind === "saved") return [
      ["Follow", "person_add", () => A.follow(id)],
      ["Make home", "home", () => A.makeHome(id)],
      ["Unsave", "bookmark_remove", () => A.unsave(id)],
      ["Add to list", "playlist_add", () => openSheet("add-to-list", { id })],
    ];
    if (kind === "list") return [["Remove from list", "playlist_remove", () => A.removeFromList(listId, id)]];
    if (kind === "list-options") return [
      ["Rename", "edit", () => openSheet("rename-list", { id })],
      ["Delete", "delete", () => openSheet("delete-list", { id })],
    ];
    return [];
  }

  // ---------- Render ----------
  function currentView() {
    const t = top();
    if (t) {
      if (t.type === "updates") return updatesView();
      if (t.type === "profile") return profileView();
      if (t.type === "masjid") return masjidView(t.id);
      if (t.type === "list") return listView(t.id);
    }
    return S.tab === "prayer" ? prayerView() : S.tab === "masjids" ? masjidsView() : savedView();
  }
  function navBar() {
    const tab = (id, label, icon) => `<button role="tab" aria-selected="${S.tab === id}" data-act="tab" data-id="${id}"><span class="ind">${icon}</span>${label}</button>`;
    return `<nav class="navbar" role="tablist" aria-label="Main">
      ${tab("prayer", "Prayer", sym("wb_twilight"))}
      ${tab("masjids", "Masjids", mi(S.tab !== "masjids"))}
      ${tab("saved", "Saved", sym("bookmark"))}
    </nav>`;
  }
  let lastKey = "";
  function render(newPage) {
    const v = $app.querySelector(".view");
    const scroll = !newPage && v ? v.scrollTop : 0;
    const key = S.tab + JSON.stringify(top() || {});
    $app.innerHTML = currentView() + navBar() + `<div id="overlays"></div>`;
    const nv = $app.querySelector(".view");
    if (nv) { if (!newPage && key === lastKey) { nv.style.animation = "none"; nv.scrollTop = scroll; } }
    lastKey = key;
    renderOverlays();
    syncDemo();
  }
  function renderOverlays() {
    const o = document.getElementById("overlays"); if (!o) return;
    let html = sheetHtml();
    if (ui.menu) html += `<div class="scrim" style="background:transparent" data-act="close"></div><div class="menu" role="menu" style="top:${ui.menu.top}px;right:${ui.menu.right}px">${ui.menu.items.map((it, i) => `<button role="menuitem" data-act="menu-item" data-i="${i}">${sym(it[1])}${it[0]}</button>`).join("")}</div>`;
    if (ui.snack) html += `<div class="snackbar" role="status"><span>${esc(ui.snack.text)}</span>${ui.snack.undo ? '<button data-act="undo">Undo</button>' : ""}</div>`;
    o.innerHTML = html;
    const input = o.querySelector("input"); if (input && document.activeElement !== input) input.focus();
  }

  // ---------- Events ----------
  $app.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el || !$app.contains(el)) return;
    const act = el.dataset.act, id = el.dataset.id;
    switch (act) {
      case "tab": selectTab(id); break;
      case "back": back(); break;
      case "open-updates": push({ type: "updates" }); break;
      case "open-profile": push({ type: "profile" }); break;
      case "open-masjid": if (id) openMasjid(id); break;
      case "open-list": push({ type: "list", id }); break;
      case "later": later(el.dataset.what || "This"); break;
      case "dismiss": S.dismissed.push(id); save(); render(); break;
      case "reminder-on": S.dismissed.push("reminder"); save(); render(); snack("Reminders on: 15 minutes before each iqamah"); break;
      case "choose-home": requireSignIn("Sign in to choose your home masjid. It's followed too, so you get its janazah notices.", () => openSheet("choose-home")); break;
      case "pick-home": setHome(id); done(`${masjid(id).name} is your home masjid`); break;
      case "explain-tier": e.stopPropagation(); openSheet("tier", { tier: el.dataset.tier }); break;
      case "recent-all": S.recentAll = !S.recentAll; save(); render(); break;
      case "saves-filter": S.savesFilter = id; save(); render(); break;
      case "updates-filter": S.updatesFilter = id; save(); render(); break;
      case "new-list": requireSignIn("Sign in to make lists.", () => openSheet("new-list", { masjid: el.dataset.masjid })); break;
      case "row-menu": openMenu(menuItems(el.dataset.menu, id, el.dataset.list), el); break;
      case "list-menu": openMenu(menuItems("list-options", id), el); break;
      case "menu-item": { const it = ui.menu.items[+el.dataset.i]; ui.menu = null; it[2](); renderOverlays(); break; }
      case "follow": A.follow(id); break;
      case "unfollow": A.unfollow(id); break;
      case "save": A.save(id); break;
      case "unsave": A.unsave(id); break;
      case "make-home": A.makeHome(id); break;
      case "add-to-list": requireSignIn("Sign in to make lists.", () => openSheet("add-to-list", { id })); break;
      case "toggle-in-list": {
        const l = S.lists.find(x => x.id === id), mid = el.dataset.masjid;
        if (l.masjids.some(x => x.masjid_id === mid)) l.masjids = l.masjids.filter(x => x.masjid_id !== mid);
        else l.masjids.push({ masjid_id: mid, masjid_name: masjid(mid).name, added_at: now().toISOString() });
        save(); render(); break;
      }
      case "confirm-delete-list": {
        const l = S.lists.find(x => x.id === id);
        S.lists = S.lists.filter(x => x.id !== id);
        if (top() && top().type === "list") S.stacks[S.tab].pop();
        done(`Deleted ${l.name}`); syncHash(false); break;
      }
      case "read": if (!S.read.includes(id)) { S.read.push(id); save(); render(); } break;
      case "sign-in": requireSignIn("Sign in to follow masjids, save them and make lists.", () => done("Signed in")); break;
      case "do-sign-in": { S.signedIn = true; const p = ui.pending; ui.pending = null; closeOverlays(); save(); render(); if (p) p(); break; }
      case "skip-sign-in": ui.pending = null; closeOverlays(); renderOverlays(); break;
      case "sign-out": openSheet("sign-out"); break;
      case "confirm-sign-out": S.signedIn = false; S.stacks[S.tab] = []; done("Signed out"); syncHash(false); break;
      case "undo": { const u = ui.snack && ui.snack.undo; ui.snack = null; if (u) u(); renderOverlays(); break; }
      case "close": closeOverlays(); renderOverlays(); break;
    }
  });
  $app.addEventListener("submit", e => {
    e.preventDefault();
    const form = e.target, name = form.name.value.trim();
    if (!name) { form.name.focus(); return; }
    if (form.dataset.form === "rename-list") {
      S.lists.find(x => x.id === ui.sheet.data.id).name = name; done("List renamed");
    } else {
      const masjidId = ui.sheet.data.masjid;
      const l = { id: "l-" + Date.now().toString(36), name, created_at: now().toISOString(), masjids: [] };
      if (masjidId) l.masjids.push({ masjid_id: masjidId, masjid_name: masjid(masjidId).name, added_at: now().toISOString() });
      S.lists.push(l); done(masjidId ? `Saved to ${name}` : `Created ${name}`);
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && (ui.sheet || ui.menu)) { closeOverlays(); renderOverlays(); }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("article[data-act]")) { e.preventDefault(); e.target.click(); }
  });

  // ---------- Demo panel ----------
  const $ = id => document.getElementById(id);
  function syncDemo() {
    $("d-day").value = S.day; $("d-signed").checked = S.signedIn; $("d-home").checked = !!home();
    $("d-theme").value = S.theme || "";
    const m = P.localMinutes(now());
    if (document.activeElement !== $("d-time")) $("d-time").value = m;
    $("d-clock").textContent = P.time(now());
    $("sb-time").textContent = P.time(now()).replace(/ ?[AP]M/, "");
    if (S.theme) document.documentElement.dataset.theme = S.theme; else delete document.documentElement.dataset.theme;
  }
  $("d-day").addEventListener("change", e => { S.day = e.target.value; save(); render(); });
  $("d-time").addEventListener("input", e => { S.clockMin = +e.target.value; clockSetAt = Date.now(); save(); render(); });
  $("d-signed").addEventListener("change", e => { S.signedIn = e.target.checked; closeOverlays(); save(); render(); });
  $("d-home").addEventListener("change", e => {
    if (e.target.checked) { S.signedIn = true; setHome("m-annur"); } else S.follows.forEach(f => { f.is_home = false; });
    save(); render();
  });
  $("d-theme").addEventListener("change", e => { S.theme = e.target.value; save(); render(); });
  $("d-reset").addEventListener("click", () => { S = fresh(); clockSetAt = Date.now(); save(); history.replaceState(null, "", "#/prayer"); render(true); });

  // Re-render on each new minute so the countdown stays minute-aligned.
  let lastMinute = -1;
  setInterval(() => { const m = Math.floor(now() / 60000); if (m !== lastMinute) { lastMinute = m; if (!ui.sheet && !ui.menu) render(); else syncDemo(); } }, 1000);

  fromHash();
  syncHash(false);
  render(true);
})();
