// One-shot demo seed for Supabase: ~15 users (profile+pet), events across
// Orange County cities, RSVPs, and comments. Idempotent-ish: existing seed
// users are signed in rather than recreated. Run: node seed-oc.mjs
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const PW = 'SeedPawk2026!';
const H = { apikey: ANON, 'Content-Type': 'application/json' };

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const jitter = (v) => v + (Math.random() - 0.5) * 0.02; // ~±0.7 mi
const inDays = (d, h = 10) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};

async function api(method, path, token, body, prefer) {
  const headers = { ...H, Authorization: `Bearer ${token}` };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return json;
}

async function signUpOrIn(email) {
  let r = await fetch(`${URL}/auth/v1/signup`, {
    method: 'POST', headers: H, body: JSON.stringify({ email, password: PW }),
  });
  let j = await r.json();
  if (j.access_token && j.user) return { id: j.user.id, token: j.access_token };
  // Already registered (or confirmation flow) -> sign in.
  r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: H, body: JSON.stringify({ email, password: PW }),
  });
  j = await r.json();
  if (!j.access_token) throw new Error(`auth failed for ${email}: ${JSON.stringify(j)}`);
  return { id: j.user.id, token: j.access_token };
}

const CITIES = [
  ['Irvine', 33.6846, -117.8265],
  ['Santa Ana', 33.7455, -117.8677],
  ['Anaheim', 33.8366, -117.9143],
  ['Huntington Beach', 33.6595, -117.9988],
  ['Newport Beach', 33.6189, -117.9298],
  ['Costa Mesa', 33.6411, -117.9187],
  ['Orange', 33.7879, -117.8531],
  ['Tustin', 33.7458, -117.8261],
  ['Fullerton', 33.8704, -117.9242],
  ['Garden Grove', 33.7739, -117.9414],
  ['Fountain Valley', 33.7092, -117.9537],
  ['Yorba Linda', 33.8886, -117.8131],
];

const PEOPLE = [
  ['Maya Chen', 'Golden Retriever', 'L', ['friendly', 'fetch-obsessed']],
  ['Diego Torres', 'French Bulldog', 'S', ['chill', 'snuggly']],
  ['Priya Patel', 'Border Collie', 'M', ['smart', 'high-energy']],
  ['Sam Rivera', 'Labrador', 'L', ['goofy', 'water-lover']],
  ['Aisha Khan', 'Corgi', 'S', ['sassy', 'food-motivated']],
  ['Tyler Brooks', 'German Shepherd', 'L', ['loyal', 'protective']],
  ['Nina Alvarez', 'Dachshund', 'S', ['stubborn', 'burrower']],
  ['Marcus Lee', 'Australian Shepherd', 'M', ['athletic', 'clever']],
  ['Sofia Nguyen', 'Shiba Inu', 'M', ['independent', 'aloof']],
  ['Jordan Kim', 'Beagle', 'M', ['nosy', 'vocal']],
  ['Elena Popov', 'Poodle', 'M', ['elegant', 'quick']],
  ['Chris Adams', 'Bernese Mountain Dog', 'L', ['gentle', 'giant']],
  ['Hana Sato', 'Pomeranian', 'S', ['tiny', 'fierce']],
  ['Luis Romero', 'Boxer', 'L', ['bouncy', 'playful']],
  ['Grace Miller', 'Cavalier Spaniel', 'S', ['sweet', 'lap-dog']],
];

const VENUES = ['dog_park', 'public_park', 'home_backyard', 'business', 'other'];

// title, cityIdx, venue, daysFromNow, hour, durH, capacity|null, breedFocus|null, recurrence|null
const EVENTS = [
  ['Golden Hour Retriever Romp', 0, 'dog_park', 2, 17, 1.5, null, 'Golden Retriever', 'weekly'],
  ['Small Dog Social', 3, 'public_park', 3, 9, 1.5, 12, null, null],
  ['Puppy Playdate & Basics', 1, 'business', 4, 11, 2, 8, null, null],
  ['Sunset Beach Pack Walk', 4, 'public_park', 5, 18, 1, null, null, 'weekly'],
  ['Backyard BarkBQ', 2, 'home_backyard', 6, 12, 3, 15, null, null],
  ['Herding Breeds Meetup', 6, 'dog_park', 7, 10, 1.5, null, 'Border Collie', null],
  ['Corgi Meet & Greet', 5, 'public_park', 8, 10, 1.5, 20, 'Corgi', null],
  ['Trail Sniffari', 11, 'other', 9, 8, 2, 10, null, 'biweekly'],
  ['Downtown Yappy Hour', 7, 'business', 10, 18, 2, 25, null, null],
  ['Big Dogs Only Play Session', 8, 'dog_park', 11, 16, 1.5, null, null, null],
  ['Rescue Pups Mixer', 9, 'public_park', 12, 11, 2, 18, null, null],
  ['Frenchie Fan Club', 3, 'home_backyard', 13, 15, 2, 10, 'French Bulldog', 'monthly'],
  ['Morning Zoomies Club', 10, 'public_park', 14, 8, 1, null, null, 'weekly'],
  ['Adopt-a-thon Social', 2, 'business', 16, 10, 3, 30, null, null],
];

const COMMENTS = [
  'Is there shade / water for the pups?',
  'Bringing my two — can’t wait!',
  'First timer here, is it beginner-friendly?',
  'Parking tips? 🚗',
  'My dog is a little shy, is that ok?',
  'Any age limit for puppies?',
];
const REPLIES = [
  'Yes! Plenty of shade and a water station. 🐶',
  'Totally beginner-friendly — come hang out!',
  'Parking is free in the lot on the north side.',
];

async function main() {
  if (!URL || !ANON) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY');
  console.log('Seeding Orange County demo...');

  // 1) Users + profiles + pets
  const users = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const [name, breed, size, temperament] = PEOPLE[i];
    const email = `seed-oc-${i + 1}@pawk.dev`;
    const { id, token } = await signUpOrIn(email);
    const [cityName] = CITIES[i % CITIES.length];
    await api('PATCH', `/rest/v1/profiles?id=eq.${id}`, token, {
      display_name: name,
      home_area: `${cityName}, CA`,
      avatar_url: `https://i.pravatar.cc/150?img=${(i % 60) + 1}`,
    });
    // one pet each (skip if they already have one, for re-runs)
    const existing = await api('GET', `/rest/v1/pets?owner_id=eq.${id}&select=id`, token);
    if (!existing.length) {
      await api('POST', '/rest/v1/pets', token, {
        owner_id: id,
        name: rand(['Biscuit', 'Mochi', 'Rex', 'Luna', 'Cooper', 'Bella', 'Ziggy', 'Nala', 'Tofu', 'Scout']),
        breed,
        size,
        temperament_tags: temperament,
        photo_url: `https://placedog.net/300/300?id=${20 + i}`,
      });
    }
    users.push({ id, token, name });
    process.stdout.write(`  user ${i + 1}/${PEOPLE.length}\r`);
  }
  console.log(`\n  ${users.length} users ready`);

  // 2) Events (host rotates through users)
  const eventIds = [];
  for (let i = 0; i < EVENTS.length; i++) {
    const [title, cityIdx, venue, days, hour, durH, capacity, breed, recurrence] = EVENTS[i];
    const host = users[i % users.length];
    const [cityName, lat, lng] = CITIES[cityIdx];
    const startsAt = inDays(days, hour);
    const endsAt = new Date(new Date(startsAt).getTime() + durH * 3600 * 1000).toISOString();
    const row = await api('POST', '/rest/v1/events?select=id', host.token, {
      host_id: host.id,
      title,
      description: `${title} in ${cityName}. Friendly, leashed dogs welcome — come meet the pack!`,
      cover_photo_url: `https://placedog.net/800/500?id=${40 + i}`,
      starts_at: startsAt,
      ends_at: endsAt,
      venue_type: venue,
      lat: jitter(lat),
      lng: jitter(lng),
      address: `${100 + i} Main St, ${cityName}, CA`,
      area_label: `${cityName}, CA`,
      breed_focus: breed,
      capacity,
      rsvp_mode: 'open',
      recurrence,
      status: 'active',
    }, 'return=representation');
    eventIds.push({ id: row[0].id, hostIdx: i % users.length, capacity, title });
    process.stdout.write(`  event ${i + 1}/${EVENTS.length}\r`);
  }
  console.log(`\n  ${eventIds.length} events created`);

  // 3) RSVPs — a spread of going/interested/waitlisted per event
  let rsvpCount = 0;
  for (const ev of eventIds) {
    const attendees = users
      .map((_, idx) => idx)
      .filter((idx) => idx !== ev.hostIdx)
      .sort(() => Math.random() - 0.5)
      .slice(0, 5 + Math.floor(Math.random() * 6)); // 5-10
    let going = 0;
    for (let k = 0; k < attendees.length; k++) {
      const u = users[attendees[k]];
      let status = k % 3 === 0 ? 'interested' : 'going';
      if (status === 'going') {
        going++;
        if (ev.capacity != null && going > ev.capacity) status = 'waitlisted';
      }
      try {
        await api('POST', '/rest/v1/rsvps', u.token, {
          event_id: ev.id, user_id: u.id, status, pet_ids: [],
        }, 'return=minimal');
        rsvpCount++;
      } catch { /* ignore dup */ }
    }
  }
  console.log(`  ${rsvpCount} RSVPs`);

  // 4) Comments on ~two-thirds of events, with an occasional host reply
  let commentCount = 0;
  for (let e = 0; e < eventIds.length; e++) {
    if (e % 3 === 2) continue;
    const ev = eventIds[e];
    const asker = users[(ev.hostIdx + 1 + e) % users.length];
    const c = await api('POST', '/rest/v1/comments?select=id', asker.token, {
      event_id: ev.id, author_id: asker.id, body: COMMENTS[e % COMMENTS.length],
    }, 'return=representation');
    commentCount++;
    if (e % 2 === 0) {
      const host = users[ev.hostIdx];
      await api('POST', '/rest/v1/comments', host.token, {
        event_id: ev.id, author_id: host.id, body: REPLIES[e % REPLIES.length], parent_id: c[0].id,
      }, 'return=minimal');
      commentCount++;
    }
  }
  console.log(`  ${commentCount} comments`);
  console.log('Done. Discover centers best around Santa Ana / central OC.');
}

main().catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1); });
