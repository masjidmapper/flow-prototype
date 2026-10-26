// Mock data, shaped like masjidmapper backend/openapi.json responses.
// Masjids are invented (Mihrab mockup names). Nothing here is real.
(function () {
  // The user's place: central Toronto, the default when location is skipped (design/00).
  const USER_PLACE = { label: "Toronto, ON", latitude: 43.6532, longitude: -79.3832 };

  // MasjidSetItem (GET /api/v1/masjids/all), trimmed to the fields the prototype reads.
  // Masjid An-Nur's location, iqamah and jummah come from spec/fixtures/prayer/days.json.
  const MASJIDS = [
    {
      id: "m-annur", name: "Masjid An-Nur", locality: "Mississauga", country: "CA",
      address: "12 Example Rd, Mississauga, ON", latitude: 43.589, longitude: -79.6441,
      timezone: "America/Toronto", is_claimed: true,
      iqamah: { fajr: "06:45", dhuhr: "12:44", asr: "15:35", maghrib: "17:12", isha: "18:46" },
      jummah: [{ start_time: "13:15", khateeb: null }, { start_time: "14:00", khateeb: null }],
      tiers: { iqamah: "verified", jummah: "verified", facilities: "verified" },
      tier_dates: { iqamah: "2026-01-03" },
      facilities: { womens_space: true, parking: "lot", wheelchair: true, wudu: true },
      primary_image_url: null,
    },
    {
      id: "m-alhuda", name: "Masjid Al-Huda", locality: "Scarborough", country: "CA",
      address: "40 Example Ave, Scarborough, ON", latitude: 43.7315, longitude: -79.2581,
      timezone: "America/Toronto", is_claimed: false,
      iqamah: { fajr: "06:40", dhuhr: "13:00", asr: "15:30", maghrib: "17:10", isha: "19:00" },
      jummah: [{ start_time: "13:30", khateeb: null }],
      tiers: { iqamah: "community" }, tier_dates: { iqamah: "2026-01-02" }, agree: 3,
      facilities: { womens_space: true, parking: "street", wheelchair: null, wudu: true },
      primary_image_url: null,
    },
    {
      id: "m-assakinah", name: "As-Sakinah Islamic Centre", locality: "Downtown", country: "CA",
      address: "120 Example St, Toronto, ON", latitude: 43.6515, longitude: -79.3835,
      timezone: "America/Toronto", is_claimed: false,
      iqamah: { fajr: "06:50", dhuhr: "13:15", asr: "15:45", maghrib: "17:10", isha: "19:15" },
      jummah: [{ start_time: "13:15", khateeb: null }, { start_time: "14:15", khateeb: null }],
      tiers: {}, tier_dates: { iqamah: "2025-08-14" },
      facilities: { womens_space: true, parking: null, wheelchair: true, wudu: true },
      primary_image_url: null,
    },
    {
      id: "m-alfurqan", name: "Al-Furqan Masjid", locality: "North York", country: "CA",
      address: "5 Example Blvd, North York, ON", latitude: 43.7801, longitude: -79.4153,
      timezone: "America/Toronto", is_claimed: true,
      iqamah: { fajr: "06:45", dhuhr: "13:00", asr: "15:40", maghrib: "17:12", isha: "19:00" },
      jummah: [{ start_time: "13:30", khateeb: "Sh. Example" }],
      tiers: { iqamah: "verified", jummah: "verified" }, tier_dates: { iqamah: "2026-01-10" },
      facilities: { womens_space: true, parking: "lot", wheelchair: true, wudu: true },
      primary_image_url: null,
    },
    {
      id: "m-arrahmah", name: "Masjid Ar-Rahmah", locality: "Ottawa", country: "CA",
      address: "300 Example St, Ottawa, ON", latitude: 45.4127, longitude: -75.6972,
      timezone: "America/Toronto", is_claimed: false,
      iqamah: { fajr: "06:50", dhuhr: "12:45", asr: "15:20", maghrib: "16:58", isha: "18:45" },
      jummah: [{ start_time: "13:00", khateeb: null }],
      tiers: {}, tier_dates: { iqamah: "2025-09-02" },
      facilities: {}, primary_image_url: null,
    },
  ];

  // FollowData (GET /api/v1/me/follows)
  const FOLLOWS = [
    { masjid_id: "m-annur", masjid_name: "Masjid An-Nur", is_home: true, push_enabled: true },
    { masjid_id: "m-alfurqan", masjid_name: "Al-Furqan Masjid", is_home: false, push_enabled: false },
    { masjid_id: "m-alhuda", masjid_name: "Masjid Al-Huda", is_home: false, push_enabled: true },
  ];

  // SavedMasjidData (GET /api/v1/me/saved)
  const SAVED = [
    { masjid_id: "m-assakinah", masjid_name: "As-Sakinah Islamic Centre", saved_at: "2026-01-11T15:02:00Z" },
  ];

  // ListData (GET /api/v1/me/lists), with an id for the prototype's own routing.
  const LISTS = [
    { id: "l-work", name: "Near work", created_at: "2026-01-02T14:00:00Z", masjids: [
      { masjid_id: "m-assakinah", masjid_name: "As-Sakinah Islamic Centre", added_at: "2026-01-02T14:00:00Z" },
      { masjid_id: "m-alfurqan", masjid_name: "Al-Furqan Masjid", added_at: "2026-01-03T14:00:00Z" },
    ] },
    { id: "l-travel", name: "Travel", created_at: "2026-01-05T14:00:00Z", masjids: [
      { masjid_id: "m-arrahmah", masjid_name: "Masjid Ar-Rahmah", added_at: "2026-01-05T14:00:00Z" },
    ] },
  ];

  // Recent masjids are phone-only (design/11 §3). Minutes before "now".
  const RECENT = [
    { masjid_id: "m-annur", ago_min: 120 },
    { masjid_id: "m-assakinah", ago_min: 60 * 24 },
    { masjid_id: "m-alhuda", ago_min: 60 * 24 * 3 },
    { masjid_id: "m-arrahmah", ago_min: 60 * 24 * 6 },
  ];

  // AnnouncementResponse (GET /api/v1/me/updates). Times are relative to the demo
  // clock (minutes from now) and resolved in app.js, so the feed fits any demo day.
  const ANNOUNCEMENTS = [
    { id: "a-1", masjid_id: "m-annur", masjid_name: "Masjid An-Nur", masjid_timezone: "America/Toronto",
      type: "janazah", title: "Janazah of Br. Yusuf Example",
      body: "The janazah of Br. Yusuf Example will be prayed after Asr today. Burial follows at Example Cemetery. May Allah have mercy on him and give his family patience.",
      location_text: "Example Cemetery, 1 Fixture Rd, Mississauga", created_ago: 51, event_in: "asr-iqamah" },
    { id: "a-2", masjid_id: "m-alhuda", masjid_name: "Masjid Al-Huda", masjid_timezone: "America/Toronto",
      type: "event", title: "Youth halaqa tonight", body: "For ages 13 to 18, after Isha in the lower hall.",
      location_text: "Masjid Al-Huda, lower hall", created_ago: 0, event_in: "isha+60" },
    { id: "a-3", masjid_id: "m-alfurqan", masjid_name: "Al-Furqan Masjid", masjid_timezone: "America/Toronto",
      type: "event", title: "Family night: stories from the Seerah",
      body: "Dinner, a talk for parents and a kids' corner. Details at the front desk.",
      location_text: "Al-Furqan Masjid, main hall", created_ago: 60 * 26, event_in: "-1500" },
    { id: "a-4", masjid_id: "m-annur", masjid_name: "Masjid An-Nur", masjid_timezone: "America/Toronto",
      type: "general", title: "Winter iqamah times from Monday",
      body: "Dhuhr moves to 12:45 PM from Monday. Fajr and Isha stay the same.",
      location_text: null, created_ago: 60 * 50, event_in: null },
  ];

  const USER = { name: "Sara Usman", email: "sara@example.org" };

  window.MOCK = { USER_PLACE, MASJIDS, FOLLOWS, SAVED, LISTS, RECENT, ANNOUNCEMENTS, USER };
})();
