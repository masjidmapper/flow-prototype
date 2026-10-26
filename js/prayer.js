// Prayer day model for the prototype. Times are never calculated here: each demo
// day is a case from spec/fixtures/prayer/days.json, read as-is. The demo clock
// picks "now" inside that day.
(function () {
  const ZONE = "America/Toronto";
  const PRAYERS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  const LABEL = { fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
  const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi’ al-Awwal", "Rabi’ al-Thani", "Jumada al-Ula",
    "Jumada al-Akhirah", "Rajab", "Sha’ban", "Ramadan", "Shawwal", "Dhu al-Qi’dah", "Dhu al-Hijjah"];

  const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: ZONE });
  const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: ZONE });
  const shortDayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: ZONE });
  const hijriFmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn",
    { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });

  // "6:45 AM", with a narrow no-break space before the period.
  function time(d) { return timeFmt.format(d).replace(/\s/, " "); }

  // The Hijri line in the fixtures' spelling (hijri.json), Umm al-Qura.
  function hijri(dateStr) {
    const parts = Object.fromEntries(hijriFmt.formatToParts(new Date(dateStr + "T12:00:00Z")).map(p => [p.type, p.value]));
    return `${parseInt(parts.day, 10)} ${HIJRI_MONTHS[parseInt(parts.month, 10) - 1]} ${parseInt(parts.year, 10)}`;
  }

  // Offset of the zone from UTC on a date, in minutes (e.g. -300 for EST).
  function zoneOffset(dateStr) {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, timeZoneName: "longOffset" });
    const name = f.formatToParts(new Date(dateStr + "T12:00:00Z")).find(p => p.type === "timeZoneName").value;
    const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
    return m ? (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10)) : 0;
  }

  // The instant for a local clock time ("minutes after midnight") on the day.
  function localInstant(dateStr, minutes) {
    return new Date(Date.parse(dateStr + "T00:00:00Z") + (minutes - zoneOffset(dateStr)) * 60000);
  }

  function localMinutes(d) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ZONE })
      .formatToParts(d).map(x => [x.type, x.value]));
    return parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);
  }

  // Build the day from a fixture case.
  function day(fixture) {
    const rows = fixture.expected.rows.map(r => ({
      salah: r.salah,
      label: LABEL[r.salah],
      starts: new Date(r.starts),
      iqamah: r.iqamah ? { at: new Date(r.iqamah.at), flagged: r.iqamah.flagged } : null,
      jummah: r.jummah.map(j => new Date(j)),
    }));
    const date = fixture.input.date;
    const isFriday = rows.some(r => r.jummah.length);
    return {
      date, rows, isFriday,
      masjid: fixture.input.masjid,
      method: fixture.input.method,
      madhab: fixture.input.madhab,
      hijri: hijri(date),
      gregorian: dayFmt.format(new Date(date + "T12:00:00Z")).replace(",", ""),
    };
  }

  // What the hero counts to (design/01 §4, design/10 §5.2.1). With a home masjid it
  // counts to iqamah (or each jummah slot); flagged iqamahs are never counted to.
  // After Isha it counts to tomorrow's Fajr. The fixture has one day, so tomorrow
  // is today's Fajr a calendar day later: fine for a prototype, not for the app.
  function next(dayModel, now, useIqamah) {
    const targets = [];
    for (const r of dayModel.rows) {
      if (r.salah === "sunrise") continue;
      if (r.salah === "dhuhr" && r.jummah.length && useIqamah) {
        r.jummah.forEach((j, i) => targets.push({ row: r, label: "Jummah", at: j, isIqamah: true, starts: r.starts, slot: i }));
        continue;
      }
      const iq = useIqamah && r.iqamah && !r.iqamah.flagged ? r.iqamah.at : null;
      targets.push({ row: r, label: r.label, at: iq || r.starts, isIqamah: !!iq, starts: r.starts });
    }
    const t = targets.find(x => x.at > now);
    if (t) return { ...t, tomorrow: false, started: t.isIqamah && now >= t.starts };
    const f = targets[0];
    const plusDay = d => localInstant(addDays(dayModel.date, 1), localMinutes(d));
    return { ...f, at: plusDay(f.at), starts: plusDay(f.starts), tomorrow: true, started: false };
  }

  function addDays(dateStr, n) {
    const d = new Date(dateStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // Minute-aligned: "now" at the minute, never 59 s early.
  function minutesUntil(target, now) {
    return Math.round((Math.floor(target / 60000) * 60000 - Math.floor(now / 60000) * 60000) / 60000);
  }

  // "42 min", "1 h 05 min", or "now", joined with narrow no-break spaces.
  function duration(mins) {
    if (mins <= 0) return "now";
    const h = Math.floor(mins / 60), m = mins % 60;
    const N = " ";
    return h ? `${h}${N}h ${String(m).padStart(2, "0")}${N}min` : `${m}${N}min`;
  }

  const keyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: ZONE });

  window.Prayer = { ZONE, dateKey: d => keyFmt.format(d), LABEL, time, hijri, day, next, minutesUntil, duration, localInstant, localMinutes,
    shortDate: d => shortDayFmt.format(d) };
})();
