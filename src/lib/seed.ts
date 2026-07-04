import { at, addDays } from './dates';
import { offsetMi } from './geo';
import type {
  AppNotification,
  EventComment,
  LatLng,
  Pet,
  PetEvent,
  Rsvp,
  User,
} from './types';

export const ME_ID = 'me';

export interface SeedData {
  users: Record<string, User>;
  pets: Record<string, Pet>;
  events: Record<string, PetEvent>;
  rsvps: Rsvp[];
  comments: EventComment[];
  notifications: AppNotification[];
}

const PEOPLE: Array<[name: string, avatarImg: number, petName: string, breed: string]> = [
  ['Sarah M.', 5, 'Cooper', 'Golden Retriever'],
  ['Mike T.', 12, 'Luna', 'Labrador Retriever'],
  ['Jess K.', 9, 'Max', 'Poodle'],
  ['Dan R.', 14, 'Daisy', 'Corgi'],
  ['Emily W.', 20, 'Charlie', 'Golden Retriever'],
  ['Chris P.', 33, 'Rocky', 'German Shepherd'],
  ['Amanda L.', 24, 'Bella', 'French Bulldog'],
  ['Tyler B.', 53, 'Duke', 'Siberian Husky'],
  ['Nina S.', 26, 'Molly', 'Beagle'],
  ['Omar H.', 59, 'Zeus', 'Golden Retriever'],
  ['Katie D.', 32, 'Sadie', 'Australian Shepherd'],
  ['Ben F.', 61, 'Tucker', 'Border Collie'],
  ['Lily C.', 44, 'Ruby', 'Dachshund'],
  ['Marcus J.', 56, 'Bear', 'Mixed / Other'],
  ['Rachel G.', 16, 'Penny', 'Corgi'],
  ['Sam O.', 68, 'Finn', 'Labrador Retriever'],
  ['Priya N.', 10, 'Mochi', 'Shiba Inu'],
];

const AREAS = [
  'Riverside', 'Oakwood', 'Hillcrest', 'Cedar Hollow', 'Maple Heights',
  'Sunset Ridge', 'Brookfield', 'Elm Grove',
];

function dogPhoto(id: number, w = 300, h = 300) {
  return `https://placedog.net/${w}/${h}?id=${id}`;
}

function avatar(img: number) {
  return `https://i.pravatar.cc/150?img=${img}`;
}

export function buildSeed(
  center: LatLng,
  existingMe?: { user: User; pets: Pet[] },
): SeedData {
  const now = new Date();
  const users: Record<string, User> = {};
  const pets: Record<string, Pet> = {};

  PEOPLE.forEach(([name, img, petName, breed], i) => {
    const id = `u${i + 1}`;
    users[id] = {
      id,
      displayName: name,
      avatarUrl: avatar(img),
      homeArea: AREAS[i % AREAS.length],
    };
    pets[`p${i + 1}`] = {
      id: `p${i + 1}`,
      ownerId: id,
      name: petName,
      breed,
      photoUrl: dogPhoto(i + 12),
      size: breed === 'Corgi' || breed === 'Dachshund' || breed === 'French Bulldog' ? 'S' : 'L',
    };
  });

  if (existingMe) {
    users[ME_ID] = existingMe.user;
    existingMe.pets.forEach((p) => (pets[p.id] = p));
  } else {
    users[ME_ID] = {
      id: ME_ID,
      displayName: 'Paul',
      avatarUrl: avatar(8),
      homeArea: 'Near you',
    };
    pets['pm1'] = {
      id: 'pm1',
      ownerId: ME_ID,
      name: 'Buddy',
      breed: 'Golden Retriever',
      photoUrl: dogPhoto(5),
      size: 'L',
    };
  }

  const iso = (d: Date) => d.toISOString();

  interface EvSpec {
    id: string;
    title: string;
    hostId: string;
    day: number;
    hour: number;
    durH: number;
    venue: PetEvent['venueType'];
    east: number;
    north: number;
    cover: number;
    desc: string;
    area: string;
    address: string;
    breedFocus?: string;
    capacity?: number;
    approves?: boolean;
  }

  const specs: EvSpec[] = [
    {
      id: 'e1', title: 'Morning Pack Walk', hostId: 'u9', day: 1, hour: 8, durH: 1.5,
      venue: 'public_park', east: 1.2, north: 0.4, cover: 40, area: 'Riverside Trail',
      address: 'Riverside Trailhead, Lot B',
      desc: 'Easy 2-mile loop along the river. All friendly, leashed dogs welcome. We grab coffee at the kiosk after — dogs get pup cups. 🐾',
    },
    {
      id: 'e2', title: 'Yappy Hour at Hop Haus', hostId: 'u6', day: 2, hour: 17, durH: 2,
      venue: 'business', east: 2.8, north: -1.1, cover: 41, area: 'Brewery District',
      address: 'Hop Haus Beer Garden, 214 Canal St',
      desc: 'Dog-friendly patio takeover. $1 from every pint goes to the county shelter. Water bowls and shade provided.',
    },
    {
      id: 'e3', title: 'Golden Retriever Meetup at the Park', hostId: 'u1', day: 3, hour: 10, durH: 2,
      venue: 'public_park', east: 3.1, north: 2.0, cover: 42, area: 'Great Lawn',
      address: 'Great Lawn, north entrance by the fountain',
      breedFocus: 'Golden Retriever',
      desc: 'Monthly golden gathering! All friendly dogs welcome — goldens just set the dress code. Bring water; we bring the tennis balls. Group photo at 11.',
    },
    {
      id: 'e4', title: 'Small Dogs Social', hostId: 'u11', day: 5, hour: 9, durH: 1.5,
      venue: 'dog_park', east: 0.9, north: -0.7, cover: 43, area: 'Westside Dog Park',
      address: 'Westside Dog Park — small dog yard',
      desc: 'Small-yard session for dogs under 25 lbs. Great for shy pups building confidence.',
    },
    {
      id: 'e5', title: "Buddy's Backyard Hang", hostId: ME_ID, day: 6, hour: 15, durH: 3,
      venue: 'home_backyard', east: 0.3, north: 0.2, cover: 44, area: 'Near you',
      address: '18 Alder Ct (gate on the left side)',
      capacity: 12, approves: true,
      desc: "Chill afternoon in our fenced backyard. Kiddie pool is out if it's warm. BYO treats — Buddy will try to steal them either way.",
    },
    {
      id: 'e6', title: 'Agility Basics 101', hostId: 'u12', day: 7, hour: 9, durH: 2,
      venue: 'public_park', east: 2.2, north: 3.4, cover: 45, area: 'Fairview Park',
      address: 'Fairview Park, south field',
      capacity: 6,
      desc: 'Intro agility with portable jumps and tunnels. Capped small so every dog gets reps. Trainer-led, free.',
    },
    {
      id: 'e7', title: 'Backyard BBQ & Puppy Playdate', hostId: 'u4', day: 9, hour: 12, durH: 4,
      venue: 'home_backyard', east: 4.4, north: -3.2, cover: 46, area: 'Cedar Hollow',
      address: '92 Larkspur Ln',
      capacity: 15, approves: true,
      desc: 'Burgers for the humans, a splash zone for the dogs. Big shaded yard, fully fenced. Puppies especially welcome.',
    },
    {
      id: 'e8', title: 'Corgi Takeover: Park Picnic', hostId: 'u15', day: 12, hour: 11, durH: 3,
      venue: 'public_park', east: 6.2, north: 4.8, cover: 47, area: 'Meadowbrook Park',
      address: 'Meadowbrook Park pavilion 3',
      breedFocus: 'Corgi',
      desc: 'The quarterly low-rider convention. Costume optional but encouraged. All short kings and their friends welcome.',
    },
    {
      id: 'e9', title: 'Puppy Socialization Hour', hostId: 'u17', day: 14, hour: 18, durH: 1,
      venue: 'business', east: 1.8, north: 2.4, cover: 48, area: 'Pet Supply Co.',
      address: 'Pet Supply Co., 310 Main St (training room)',
      desc: 'Staff-supervised play for pups under 1 year. Vaccination card required at the door.',
    },
    {
      id: 'e10', title: 'Golden Hour at the Dog Park', hostId: 'u10', day: 16, hour: 17, durH: 2,
      venue: 'dog_park', east: 7.5, north: -5.0, cover: 49, area: 'Eastfield Dog Park',
      address: 'Eastfield Dog Park, big dog side',
      breedFocus: 'Golden Retriever',
      desc: 'Goldens at golden hour. Bring a towel — there is a pond and they WILL find it.',
    },
    {
      id: 'e11', title: 'Frenchie Frenzy', hostId: 'u7', day: 20, hour: 10, durH: 2,
      venue: 'dog_park', east: 12.0, north: 8.0, cover: 50, area: 'Northgate Dog Run',
      address: 'Northgate Dog Run',
      breedFocus: 'French Bulldog',
      desc: 'Snorts, zoomies, and a group photo that will break the internet. Shade tents up by 10.',
    },
    {
      id: 'e12', title: 'Husky Hike: Ridgeline Trail', hostId: 'u8', day: 24, hour: 7, durH: 3,
      venue: 'other', east: 24.0, north: 14.0, cover: 51, area: 'Ridgeline Trailhead',
      address: 'Ridgeline Trailhead parking lot',
      breedFocus: 'Siberian Husky',
      desc: '5-mile moderate hike for high-energy dogs. Early start to beat the heat. Bring 2L of water minimum.',
    },
  ];

  // A larger pool of "flavor" events. A deterministic subset is chosen per
  // area (keyed off the center) so different places show a different mix, and
  // re-picking the same place is stable. The core events above always appear so
  // the scripted demos (waitlist, my hosted event, inbox) keep working.
  const extraSpecs: EvSpec[] = [
    {
      id: 'x1', title: 'Sunrise Beagle Sniffari', hostId: 'u9', day: 2, hour: 7, durH: 1,
      venue: 'public_park', east: -2.1, north: 1.3, cover: 54, area: 'Lakeshore Meadows',
      address: 'Lakeshore Meadows, east gate', breedFocus: 'Beagle',
      desc: 'Nose-led wander for scent hounds and friends. Slow pace, lots of sniff breaks. Coffee after.',
    },
    {
      id: 'x2', title: 'Doodle Meet & Greet', hostId: 'u3', day: 4, hour: 10, durH: 2,
      venue: 'dog_park', east: 1.7, north: -2.4, cover: 55, area: 'Barkley Commons',
      address: 'Barkley Commons dog park', breedFocus: 'Poodle',
      desc: 'Poodles and doodles of every size. Curly coats encouraged but all welcome.',
    },
    {
      id: 'x3', title: 'Brew & Bark Trivia Night', hostId: 'u6', day: 5, hour: 18, durH: 2,
      venue: 'business', east: 2.4, north: 0.8, cover: 56, area: 'Tap Row',
      address: 'Fetch & Firkin, 88 Tap Row', capacity: 30,
      desc: 'Dog-friendly pub trivia. Teams of 4 (dogs are honorary members). Prizes and pup cups.',
    },
    {
      id: 'x4', title: 'Senior Dogs Slow Stroll', hostId: 'u13', day: 6, hour: 9, durH: 1,
      venue: 'public_park', east: -1.2, north: 2.6, cover: 57, area: 'Willow Bend',
      address: 'Willow Bend Park, pond loop',
      desc: 'Gentle short loop for grey muzzles and recovering pups. Benches the whole way.',
    },
    {
      id: 'x5', title: 'Puppy Kindergarten Playdate', hostId: 'u17', day: 8, hour: 16, durH: 1.5,
      venue: 'business', east: 0.6, north: -1.5, cover: 58, area: 'Downtown',
      address: 'Wag Academy, 12 Market St', capacity: 10, approves: true,
      desc: 'Supervised play for pups under 5 months. Vaccination proof required at the door.',
    },
    {
      id: 'x6', title: 'Herding Breeds Field Day', hostId: 'u11', day: 10, hour: 9, durH: 3,
      venue: 'public_park', east: 5.1, north: 3.3, cover: 59, area: 'Highland Fields',
      address: 'Highland Fields, west pasture', breedFocus: 'Australian Shepherd', capacity: 20,
      desc: 'Aussies, collies, heelers — come put that brain to work. Intro herding demos on the hour.',
    },
    {
      id: 'x7', title: 'Lakeside Retriever Swim', hostId: 'u2', day: 11, hour: 8, durH: 2,
      venue: 'other', east: -3.4, north: -2.2, cover: 60, area: 'Cedar Lake',
      address: 'Cedar Lake dog beach', breedFocus: 'Labrador Retriever',
      desc: 'Water dogs, unite. Bring a towel and a floaty toy. Shallow entry, lifeguard-brained humans welcome.',
    },
    {
      id: 'x8', title: 'Adoptable Dogs Mixer', hostId: 'u4', day: 12, hour: 11, durH: 3,
      venue: 'public_park', east: 2.9, north: 1.1, cover: 61, area: 'Civic Green',
      address: 'Civic Green, main lawn',
      desc: 'Local rescues bring adoptable pups to meet the crew. Foster-curious folks especially welcome. 🐾',
    },
    {
      id: 'x9', title: 'Corgi Beach Sprint', hostId: 'u15', day: 15, hour: 10, durH: 2,
      venue: 'other', east: -4.8, north: 3.9, cover: 62, area: 'Dune Point',
      address: 'Dune Point off-leash beach', breedFocus: 'Corgi',
      desc: 'Short legs, big zoomies. Loaf races at noon. Sand will get everywhere and it will be worth it.',
    },
    {
      id: 'x10', title: 'Shiba & Spitz Society', hostId: 'u1', day: 17, hour: 15, durH: 2,
      venue: 'dog_park', east: 3.6, north: -3.7, cover: 63, area: 'Northside',
      address: 'Northside Bark Park', breedFocus: 'Shiba Inu',
      desc: 'Curly tails and side-eye. Shibas, huskies, akitas, and the fluffy-adjacent all welcome.',
    },
    {
      id: 'x11', title: 'Dog-Friendly Farmers Market Walk', hostId: 'u16', day: 19, hour: 9, durH: 2,
      venue: 'other', east: 1.0, north: 0.5, cover: 64, area: 'Old Town',
      address: 'Old Town Farmers Market entrance',
      desc: 'Leashed stroll through the stalls. Several vendors do dog treats. Meet by the flower cart.',
    },
    {
      id: 'x12', title: 'Big Dogs Only Romp', hostId: 'u8', day: 22, hour: 17, durH: 2,
      venue: 'dog_park', east: 6.8, north: -4.1, cover: 65, area: 'Eastgate',
      address: 'Eastgate Dog Run, large dog side', capacity: 25,
      desc: '50 lbs and up. Big zoomies, big water bowls. Gentle giants and bouncy adolescents welcome.',
    },
    {
      id: 'x13', title: 'Rescue Mutts Social', hostId: 'u14', day: 25, hour: 10, durH: 2,
      venue: 'public_park', east: -2.7, north: -1.8, cover: 66, area: 'Southside Commons',
      address: 'Southside Commons, shelter pavilion', breedFocus: 'Mixed / Other',
      desc: 'One-of-a-kind pups and their people. Best-ears contest, entirely unofficial.',
    },
    {
      id: 'x14', title: 'German Shepherd Working Group', hostId: 'u6', day: 27, hour: 8, durH: 2,
      venue: 'public_park', east: 4.2, north: 2.7, cover: 67, area: 'Ridgeview',
      address: 'Ridgeview Park, training field', breedFocus: 'German Shepherd', capacity: 15,
      desc: 'Focus, drive, and good manners. Obedience warmups then off-leash recall practice.',
    },
  ];

  // Rotate a window into the pool based on the area center — stable per place,
  // different across places.
  const areaSeed = Math.abs(Math.round(center.lat * 1000 + center.lng * 1000));
  const EXTRA_COUNT = 8;
  const chosenExtras: EvSpec[] = Array.from(
    { length: Math.min(EXTRA_COUNT, extraSpecs.length) },
    (_, i) => extraSpecs[(areaSeed + i) % extraSpecs.length],
  );

  const events: Record<string, PetEvent> = {};
  for (const s of [...specs, ...chosenExtras]) {
    const start = at(s.day, Math.floor(s.hour), Math.round((s.hour % 1) * 60));
    const end = new Date(start.getTime() + s.durH * 3600 * 1000);
    const loc = offsetMi(center, s.east, s.north);
    events[s.id] = {
      id: s.id,
      hostId: s.hostId,
      title: s.title,
      description: s.desc,
      coverPhotoUrl: dogPhoto(s.cover, 800, 500),
      startsAt: iso(start),
      endsAt: iso(end),
      venueType: s.venue,
      lat: loc.lat,
      lng: loc.lng,
      address: s.address,
      areaLabel: s.area,
      breedFocus: s.breedFocus,
      capacity: s.capacity,
      rsvpMode: s.approves ? 'host_approves' : 'open',
      status: 'active',
    };
  }

  // Two past (archived) events: one attended, one hosted by me.
  const past1Start = at(-10, 10);
  const past1Loc = offsetMi(center, 3.1, 2.0);
  events['e13'] = {
    id: 'e13', hostId: 'u1', title: 'Spring Golden Gathering',
    description: 'The spring edition of the golden meetup. Perfect weather, muddy dogs, zero regrets.',
    coverPhotoUrl: dogPhoto(52, 800, 500),
    startsAt: iso(past1Start), endsAt: iso(new Date(past1Start.getTime() + 2 * 3600 * 1000)),
    venueType: 'public_park', lat: past1Loc.lat, lng: past1Loc.lng,
    address: 'Great Lawn, north entrance', areaLabel: 'Great Lawn',
    breedFocus: 'Golden Retriever', rsvpMode: 'open',
    status: 'archived', archivedAt: iso(addDays(now, -9)),
  };
  const past2Start = at(-21, 14);
  const past2Loc = offsetMi(center, 0.3, 0.2);
  events['e14'] = {
    id: 'e14', hostId: ME_ID, title: 'Backyard Meet & Sniff',
    description: 'First-ever backyard meetup. Small crew, big success.',
    coverPhotoUrl: dogPhoto(53, 800, 500),
    startsAt: iso(past2Start), endsAt: iso(new Date(past2Start.getTime() + 2 * 3600 * 1000)),
    venueType: 'home_backyard', lat: past2Loc.lat, lng: past2Loc.lng,
    address: '18 Alder Ct', areaLabel: 'Near you',
    capacity: 8, rsvpMode: 'host_approves',
    status: 'archived', archivedAt: iso(addDays(now, -20)),
  };

  let rsvpSeq = 0;
  const rsvps: Rsvp[] = [];
  const addRsvp = (eventId: string, userId: string, status: Rsvp['status'], minutesAgo: number) => {
    const petId = userId === ME_ID ? Object.values(pets).find((p) => p.ownerId === ME_ID)?.id : `p${userId.slice(1)}`;
    rsvps.push({
      id: `r${++rsvpSeq}`,
      eventId,
      userId,
      petIds: petId ? [petId] : [],
      status,
      createdAt: iso(new Date(now.getTime() - minutesAgo * 60000)),
    });
  };

  addRsvp('e1', 'u9', 'going', 9000); addRsvp('e1', 'u3', 'going', 8000);
  addRsvp('e1', 'u5', 'going', 7000); addRsvp('e1', 'u12', 'going', 6100);
  addRsvp('e1', 'u7', 'interested', 5000);

  addRsvp('e2', 'u6', 'going', 9900); addRsvp('e2', 'u2', 'going', 8100);
  addRsvp('e2', 'u13', 'going', 7500); addRsvp('e2', 'u14', 'going', 6600);
  addRsvp('e2', 'u16', 'going', 4300); addRsvp('e2', 'u11', 'interested', 3200);

  addRsvp('e3', 'u1', 'going', 12000); addRsvp('e3', 'u5', 'going', 11000);
  addRsvp('e3', 'u10', 'going', 10000); addRsvp('e3', 'u2', 'going', 9000);
  addRsvp('e3', 'u4', 'going', 8000); addRsvp('e3', 'u15', 'going', 7000);
  addRsvp('e3', 'u16', 'interested', 6000); addRsvp('e3', 'u17', 'interested', 5500);

  addRsvp('e4', 'u11', 'going', 8800); addRsvp('e4', 'u13', 'going', 7700);
  addRsvp('e4', 'u15', 'going', 6600); addRsvp('e4', 'u17', 'going', 5500);

  // My hosted event: 3 going, 2 pending requests to approve.
  addRsvp('e5', 'u3', 'going', 4000); addRsvp('e5', 'u7', 'going', 3500);
  addRsvp('e5', 'u15', 'going', 3000);
  addRsvp('e5', 'u8', 'pending_approval', 300);
  addRsvp('e5', 'u13', 'pending_approval', 120);

  // Full event (capacity 6) to demo the waitlist.
  addRsvp('e6', 'u12', 'going', 9000); addRsvp('e6', 'u1', 'going', 8500);
  addRsvp('e6', 'u2', 'going', 8000); addRsvp('e6', 'u9', 'going', 7000);
  addRsvp('e6', 'u10', 'going', 6000); addRsvp('e6', 'u11', 'going', 5000);
  addRsvp('e6', 'u14', 'waitlisted', 4000);

  addRsvp('e7', 'u4', 'going', 9500); addRsvp('e7', 'u3', 'going', 8200);
  addRsvp('e7', 'u5', 'going', 7100); addRsvp('e7', 'u9', 'going', 6400);
  addRsvp('e7', 'u16', 'going', 5200); addRsvp('e7', 'u12', 'interested', 4100);

  addRsvp('e8', 'u15', 'going', 9700); addRsvp('e8', 'u4', 'going', 8600);
  addRsvp('e8', 'u13', 'going', 7300);
  addRsvp('e9', 'u17', 'going', 9100); addRsvp('e9', 'u7', 'going', 8300);
  addRsvp('e10', 'u10', 'going', 9600); addRsvp('e10', 'u1', 'going', 8700);
  addRsvp('e10', 'u5', 'going', 7900); addRsvp('e10', 'u9', 'interested', 6800);
  addRsvp('e11', 'u7', 'going', 9400); addRsvp('e11', 'u14', 'going', 8100);
  addRsvp('e12', 'u8', 'going', 9300); addRsvp('e12', 'u6', 'going', 8400);
  addRsvp('e12', 'u11', 'interested', 7200);

  // A few attendees for each location-varied flavor event so their cards
  // aren't empty. Deterministic per event so re-picking a place is stable.
  chosenExtras.forEach((s, idx) => {
    const n = 2 + (idx % 3); // 2–4 attendees
    for (let k = 0; k < n; k++) {
      const uid = `u${1 + ((idx * 3 + k) % PEOPLE.length)}`;
      addRsvp(s.id, uid, k === n - 1 ? 'interested' : 'going', 6000 - idx * 200 - k * 300);
    }
  });

  // Past events: I attended e13; e14 was mine with a few attendees.
  addRsvp('e13', 'u1', 'going', 20000); addRsvp('e13', ME_ID, 'going', 19000);
  addRsvp('e13', 'u5', 'going', 18000); addRsvp('e13', 'u10', 'going', 17000);
  addRsvp('e14', ME_ID, 'going', 40000); addRsvp('e14', 'u3', 'going', 39000);
  addRsvp('e14', 'u5', 'going', 38000); addRsvp('e14', 'u1', 'going', 37000);

  let cSeq = 0;
  const comments: EventComment[] = [];
  const addComment = (
    eventId: string, authorId: string, body: string, minutesAgo: number, parentId?: string,
  ) => {
    comments.push({
      id: `c${++cSeq}`,
      eventId,
      authorId,
      body,
      parentId,
      createdAt: iso(new Date(now.getTime() - minutesAgo * 60000)),
    });
  };

  addComment('e3', 'u2', "Is this okay for a 6-month-old puppy? She's friendly but still working on recall.", 300);
  addComment('e3', 'u1', "Absolutely — we keep a calmer corner near the fountain for the young ones. See you there! 🐾", 240, 'c1');
  addComment('e3', 'u10', 'Cooper and Zeus reunion!! We will be there early.', 180);
  addComment('e7', 'u3', 'Is street parking okay, or should we carpool?', 500);
  addComment('e7', 'u4', 'Street parking is fine on both sides of Larkspur. Gate code goes out to approved folks the night before.', 420, 'c4');
  addComment('e5', 'u7', 'What should we bring? Happy to grab extra water bowls.', 90);
  addComment('e13', 'u5', 'Great meetup! Charlie slept the entire ride home 😴', 14000);
  addComment('e13', 'u1', 'Thanks for coming everyone — spring edition photos are in the album!', 13800);

  const notifications: AppNotification[] = [
    {
      id: 'n1', type: 'request_received', eventId: 'e5', fromUserId: 'u8',
      message: "Tyler B. requested to join Buddy's Backyard Hang",
      createdAt: iso(new Date(now.getTime() - 300 * 60000)), read: false,
    },
    {
      id: 'n2', type: 'request_received', eventId: 'e5', fromUserId: 'u13',
      message: "Lily C. requested to join Buddy's Backyard Hang",
      createdAt: iso(new Date(now.getTime() - 120 * 60000)), read: false,
    },
    {
      id: 'n3', type: 'comment', eventId: 'e5', fromUserId: 'u7',
      message: "Amanda L. commented on Buddy's Backyard Hang",
      createdAt: iso(new Date(now.getTime() - 90 * 60000)), read: false,
    },
  ];

  return { users, pets, events, rsvps, comments, notifications };
}
