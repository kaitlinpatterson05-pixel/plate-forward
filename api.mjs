// Plate Forward booking + lights API (runs on Netlify Functions).
// Bookings are saved in Netlify Blobs (a small built-in storage, nothing to set up).
//
//   GET  /api/bookings  -> { lights, slots }   public: lights on today + spots taken per shift
//   POST /api/bookings  -> books a shift        body: { date: "2026-11-03", hour: 9, email }
//   GET  /api/lights    -> "12"                 plain number for the light controller (ESP32)
//
// The lights reset every 24 hours: only bookings MADE TODAY (Melbourne time) count,
// so at midnight the number goes back to 0 and the wall starts dark again.
//   GET  /api/admin?key=YOUR_ADMIN_KEY -> every booking with emails (only for you)

import { getStore } from "@netlify/blobs";

const TOTAL_LIGHTS = 100;
const FIRST_HOUR = 9;   // first shift starts 9am
const LAST_HOUR = 18;   // last shift ends 6pm
const SPOTS_PER_SLOT = 5;
const DAYS_AHEAD = 60;
const TZ = "Australia/Melbourne";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
  });

function melbNow(when = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(when);
  const g = (t) => parts.find((p) => p.type === t).value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) % 24 };
}
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// how many bookings were made today (Melbourne time) -> how many lights are on
function litToday(rows) {
  const today = melbNow().date;
  return Math.min(rows.filter((r) => melbNow(new Date(r.at)).date === today).length, TOTAL_LIGHTS);
}

async function allBookings(store) {
  const { blobs } = await store.list({ prefix: "b/" });
  const rows = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return rows.filter(Boolean).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

export default async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/\/+$/, "").split("/").pop();
  const store = getStore({ name: "plate-forward-bookings", consistency: "strong" });

  if (req.method === "OPTIONS") return json({}, 204);

  // ---- light controller: just a number ----
  if (route === "lights" && req.method === "GET") {
    const rows = await allBookings(store);
    return new Response(String(litToday(rows)), {
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  }

  // ---- public availability ----
  if (route === "bookings" && req.method === "GET") {
    const rows = await allBookings(store);
    const slots = {};
    for (const r of rows) slots[`${r.date}|${r.hour}`] = (slots[`${r.date}|${r.hour}`] || 0) + 1;
    return json({ lights: litToday(rows), total: rows.length, slots });
  }

  // ---- make a booking ----
  if (route === "bookings" && req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Something went wrong sending your booking. Try again." }, 400); }
    const date = String(body.date || "");
    const hour = Number(body.hour);
    const email = String(body.email || "").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200)
      return json({ error: "Enter an email address like name@example.com." }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(hour) || hour < FIRST_HOUR || hour >= LAST_HOUR)
      return json({ error: "Shifts run between 9am and 6pm. Pick a time in that range." }, 400);

    const now = melbNow();
    if (date < now.date || date > addDays(now.date, DAYS_AHEAD) || (date === now.date && hour <= now.hour))
      return json({ error: "That time has passed or is too far ahead. Pick another time." }, 400);

    const rows = await allBookings(store);
    if (rows.filter((r) => r.date === date && r.hour === hour).length >= SPOTS_PER_SLOT)
      return json({ error: "That time just filled up. Pick another time." }, 409);
    if (rows.some((r) => r.email === email && r.date === date && r.hour === hour))
      return json({ error: "You've already booked this shift." }, 409);

    const at = new Date().toISOString();
    const id = `${at.replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
    await store.setJSON(`b/${id}`, { id, date, hour, email, at });

    const n = litToday(rows) + 1;
    return json({ ok: true, light: n <= TOTAL_LIGHTS ? n : null, date, hour }, 201);
  }

  // ---- your private list ----
  if (route === "admin" && req.method === "GET") {
    const key = Netlify.env.get("ADMIN_KEY");
    if (!key || url.searchParams.get("key") !== key) return json({ error: "Wrong admin key." }, 401);
    const rows = await allBookings(store);
    // light number restarts at 1 each day, matching the wall
    const perDay = {};
    const list = rows.map((r) => {
      const day = melbNow(new Date(r.at)).date;
      perDay[day] = (perDay[day] || 0) + 1;
      return { light: perDay[day] <= TOTAL_LIGHTS ? perDay[day] : null, bookedOn: day, ...r };
    });
    return json({ bookings: list.reverse() });
  }

  return json({ error: "Not found" }, 404);
};

export const config = { path: ["/api/bookings", "/api/lights", "/api/admin"] };
