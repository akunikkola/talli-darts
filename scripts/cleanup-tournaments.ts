// Cleanup script to remove all tournament data
// Run with: source .env.local && npx tsx scripts/cleanup-tournaments.ts

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables");
  console.error("Run with: source .env.local && npx tsx scripts/cleanup-tournaments.ts");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupTournaments() {
  console.log("Starting tournament cleanup...");

  // 1. Delete all matches that have a tournament_id
  console.log("Deleting tournament matches...");
  const { data: tournamentMatches, error: matchFetchError } = await supabase
    .from("matches")
    .select("id")
    .not("tournament_id", "is", null);

  if (matchFetchError) {
    console.error("Error fetching tournament matches:", matchFetchError);
  } else if (tournamentMatches && tournamentMatches.length > 0) {
    console.log(`Found ${tournamentMatches.length} tournament matches to delete`);

    const { error: matchDeleteError } = await supabase
      .from("matches")
      .delete()
      .not("tournament_id", "is", null);

    if (matchDeleteError) {
      console.error("Error deleting tournament matches:", matchDeleteError);
    } else {
      console.log(`Deleted ${tournamentMatches.length} tournament matches`);
    }
  } else {
    console.log("No tournament matches found");
  }

  // 2. Delete all tournaments
  console.log("Deleting all tournaments...");
  const { data: tournaments, error: tournamentFetchError } = await supabase
    .from("tournaments")
    .select("id, name");

  if (tournamentFetchError) {
    console.error("Error fetching tournaments:", tournamentFetchError);
  } else if (tournaments && tournaments.length > 0) {
    console.log(`Found ${tournaments.length} tournaments to delete:`);
    tournaments.forEach((t) => console.log(`  - ${t.name} (${t.id})`));

    const { error: tournamentDeleteError } = await supabase
      .from("tournaments")
      .delete()
      .neq("id", ""); // Delete all

    if (tournamentDeleteError) {
      console.error("Error deleting tournaments:", tournamentDeleteError);
    } else {
      console.log(`Deleted ${tournaments.length} tournaments`);
    }
  } else {
    console.log("No tournaments found");
  }

  console.log("Cleanup complete!");
}

cleanupTournaments().catch(console.error);
