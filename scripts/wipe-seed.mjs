// Wipe the Orange County demo seed: signs in as each seed user and calls
// delete_current_user, which cascades their events, RSVPs, comments, pets, and
// place reviews (FKs are ON DELETE CASCADE). Idempotent — missing users are
// skipped. Run: node scripts/wipe-seed.mjs
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const PW = 'SeedPawk2026!';
const COUNT = 15;
const H = { apikey: ANON, 'Content-Type': 'application/json' };

async function main() {
  if (!URL || !ANON) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY');
  let deleted = 0;
  for (let i = 1; i <= COUNT; i++) {
    const email = `seed-oc-${i}@pawk.dev`;
    const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: H, body: JSON.stringify({ email, password: PW }),
    });
    const j = await r.json();
    if (!j.access_token) { console.log(`  - ${email}: not found, skip`); continue; }
    const del = await fetch(`${URL}/rest/v1/rpc/delete_current_user`, {
      method: 'POST', headers: { ...H, Authorization: `Bearer ${j.access_token}` }, body: '{}',
    });
    if (del.ok) { deleted++; console.log(`  x ${email} deleted (cascaded events/rsvps/comments/pets/reviews)`); }
    else console.log(`  ! ${email}: delete failed ${del.status}`);
  }
  console.log(`\nDone: removed ${deleted}/${COUNT} seed users and all their data.`);
}
main().catch((e) => { console.error('WIPE FAILED:', e.message); process.exit(1); });
