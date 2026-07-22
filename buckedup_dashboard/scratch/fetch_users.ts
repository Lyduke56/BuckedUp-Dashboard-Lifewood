import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, role');

  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  console.log("Current Users:");
  console.log("===================================");
  
  if (profiles && profiles.length > 0) {
    for (const p of profiles) {
      console.log(`Email: ${p.email}`);
      console.log(`Role:  ${p.role}`);
      console.log("-----------------------------------");
    }
  } else {
    console.log("No users found in the profiles table.");
  }
}

main();
