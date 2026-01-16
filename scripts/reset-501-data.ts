// Reset script to delete all matches and reset 501 ELO to 1000
// Run with env vars set

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetData() {
  console.log("Starting data reset...");

  // 1. Delete ALL matches
  console.log("Deleting all matches...");
  const { data: matches, error: matchFetchError } = await supabase
    .from("matches")
    .select("id");

  if (matchFetchError) {
    console.error("Error fetching matches:", matchFetchError);
  } else if (matches && matches.length > 0) {
    console.log(`Found ${matches.length} matches to delete`);

    const { error: matchDeleteError } = await supabase
      .from("matches")
      .delete()
      .neq("id", ""); // Delete all

    if (matchDeleteError) {
      console.error("Error deleting matches:", matchDeleteError);
    } else {
      console.log(`Deleted ${matches.length} matches`);
    }
  } else {
    console.log("No matches found");
  }

  // 2. Reset all players' 501 stats
  console.log("Resetting all players' 501 ELO and stats...");
  const { data: players, error: playerFetchError } = await supabase
    .from("players")
    .select("id, name");

  if (playerFetchError) {
    console.error("Error fetching players:", playerFetchError);
  } else if (players && players.length > 0) {
    console.log(`Found ${players.length} players to reset`);

    const { error: updateError } = await supabase
      .from("players")
      .update({
        elo501: 1000,
        wins501: 0,
        losses501: 0,
      })
      .neq("id", ""); // Update all

    if (updateError) {
      console.error("Error resetting players:", updateError);
    } else {
      console.log(`Reset 501 stats for ${players.length} players`);
      players.forEach((p) => console.log(`  - ${p.name}: ELO reset to 1000`));
    }
  } else {
    console.log("No players found");
  }

  console.log("Reset complete!");
}

resetData().catch(console.error);
