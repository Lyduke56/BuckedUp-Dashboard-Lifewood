import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  console.log("Fetching products with missing catalog_product_id...");
  const { data: products, error: pError } = await supabase
    .from("products")
    .select("id, name")
    .is("catalog_product_id", null);

  if (pError) throw pError;
  if (!products || products.length === 0) {
    console.log("No products need linking.");
    return;
  }

  console.log(`Found ${products.length} unlinked video requests. Matching against catalog...`);

  const { data: catalogProducts, error: cpError } = await supabase
    .from("catalog_products")
    .select("id, name");

  if (cpError) throw cpError;

  let linkedCount = 0;
  for (const product of products) {
    const pName = product.name.trim().toLowerCase();
    // Try to find exact name match
    const match = catalogProducts?.find(cp => cp.name.trim().toLowerCase() === pName);

    if (match) {
      const { error: updateError } = await supabase
        .from("products")
        .update({ catalog_product_id: match.id })
        .eq("id", product.id);
        
      if (updateError) {
        console.error(`Failed to update ${product.name}:`, updateError);
      } else {
        linkedCount++;
        console.log(`Linked "${product.name}" to catalog item!`);
      }
    } else {
      console.log(`No exact catalog match found for "${product.name}"`);
    }
  }

  console.log(`Successfully linked ${linkedCount} products!`);
}

main().catch(console.error);
