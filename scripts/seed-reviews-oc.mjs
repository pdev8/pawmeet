// Seed community place reviews on real OC OSM places (dog parks, beaches,
// trails, parks). Uses the same Overpass query + id format as the app so the
// review place_ids match what the map renders. Run: node seed-reviews-oc.mjs
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const PW = 'SeedPawk2026!';
const H = { apikey: ANON, 'Content-Type': 'application/json' };
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const rand = (a) => a[Math.floor(Math.random() * a.length)];

async function api(method, path, token, body, prefer) {
  const headers = { ...H, Authorization: `Bearer ${token}` };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function signIn(email) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: H, body: JSON.stringify({ email, password: PW }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`sign-in failed ${email}`);
  return { id: j.user.id, token: j.access_token };
}

function categorize(t) {
  if (t.leisure === 'dog_park') return 'dog_park';
  if (t.natural === 'beach') return 'beach';
  if (t.leisure === 'nature_reserve') return 'nature_reserve';
  if (t.leisure === 'park') return 'park';
  if (t.highway === 'path' || t.highway === 'track' || t.route === 'hiking') return 'trail';
  return null;
}

async function overpass(lat, lng, radiusM = 3500) {
  const around = `(around:${radiusM},${lat},${lng})`;
  const query = `[out:json][timeout:25];
(
  way["leisure"="dog_park"]${around};
  way["leisure"="park"]["dog"!="no"]${around};
  way["leisure"="nature_reserve"]["dog"!="no"]${around};
  way["natural"="beach"]["dog"!="no"]${around};
  way["highway"~"^(path|track)$"]["name"]["dog"!="no"]${around};
);
out geom 200;`;
  let json = null;
  let lastErr = '';
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'pawk-demo-seed/1.0 (dog-events app)',
        },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) { lastErr = `${url} -> ${res.status}`; continue; }
      json = await res.json();
      break;
    } catch (e) {
      lastErr = `${url} -> ${e.message}`;
    }
  }
  if (!json) throw new Error(`Overpass all mirrors failed: ${lastErr}`);
  const out = [];
  for (const el of json.elements ?? []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2 || !el.tags) continue;
    const category = categorize(el.tags);
    if (!category || !el.tags.name) continue; // named places only, nicer demo
    out.push({ id: `way-${el.id}`, name: el.tags.name, category });
  }
  return out;
}

const REVIEWS = {
  dog_park: ['Great fenced area — separate small-dog section is clutch.', 'Clean, shady, and the pups love it.', 'Gets busy at 8am but everyone’s friendly.', 'Water stations everywhere, big win in summer.'],
  park: ['Tons of open grass for fetch.', 'Wide paths, easy for a long leashed walk.', 'Good shade and picnic spots for a meetup.'],
  beach: ['Off-leash hours are the best — so much room to run!', 'Sandy paws but 100% worth it.', 'Our lab wouldn’t leave the water. Perfect.', 'Go early for parking; the pack scene is great.'],
  trail: ['Shady and scenic, ideal for a long sniff walk.', 'Well-marked, moderate — bring water for the dog.', 'Quiet in the mornings, saw lots of happy pups.'],
  nature_reserve: ['Peaceful trails, more birds than people.', 'Keep them leashed but a lovely calm walk.'],
};
const ratingFor = () => rand([5, 5, 4, 4, 4, 3]);

const CLUSTERS = [
  ['Huntington Beach', 33.6783, -118.0044],
  ['Irvine', 33.6846, -117.8265],
  ['Newport Beach', 33.6189, -117.9298],
  ['Yorba Linda (foothills)', 33.8886, -117.8131],
];

async function main() {
  if (!URL || !ANON) throw new Error('Missing env');
  const users = [];
  for (let i = 1; i <= 15; i++) users.push(await signIn(`seed-oc-${i}@pawk.dev`));
  console.log(`${users.length} seed users signed in`);

  // Gather named places across clusters, dedupe, guarantee beach + trail coverage.
  const byId = new Map();
  for (const [name, lat, lng] of CLUSTERS) {
    const places = await overpass(lat, lng);
    for (const pl of places) if (!byId.has(pl.id)) byId.set(pl.id, pl);
    const cats = [...new Set(places.map((p) => p.category))];
    console.log(`  ${name}: ${places.length} named places (${cats.join(', ')})`);
    await new Promise((r) => setTimeout(r, 1200)); // be gentle to Overpass
  }
  const all = [...byId.values()];
  const pick = (cat, n) => all.filter((p) => p.category === cat).slice(0, n);
  const selected = [
    ...pick('dog_park', 5),
    ...pick('beach', 4),
    ...pick('trail', 5),
    ...pick('park', 4),
    ...pick('nature_reserve', 2),
  ];
  console.log(`Selected ${selected.length} places to review:`);

  let reviewCount = 0;
  for (const pl of selected) {
    // skip if already reviewed (safe re-runs)
    const anyUser = users[0];
    const existing = await api('GET', `/rest/v1/place_reviews?place_id=eq.${encodeURIComponent(pl.id)}&select=id&limit=1`, anyUser.token);
    if (existing.length) { console.log(`  = ${pl.name} (${pl.category}) already has reviews, skip`); continue; }

    const n = 2 + Math.floor(Math.random() * 3); // 2-4 reviews
    const authors = users.slice().sort(() => Math.random() - 0.5).slice(0, n);
    for (const u of authors) {
      await api('POST', '/rest/v1/place_reviews', u.token, {
        place_id: pl.id, author_id: u.id, rating: ratingFor(), body: rand(REVIEWS[pl.category]),
      }, 'return=minimal');
      reviewCount++;
    }
    console.log(`  + ${pl.name} (${pl.category}) [${pl.id}] — ${n} reviews`);
  }
  console.log(`\nDone: ${reviewCount} reviews across ${selected.length} places.`);
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
