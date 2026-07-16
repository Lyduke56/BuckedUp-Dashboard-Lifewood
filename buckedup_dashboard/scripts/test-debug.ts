import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const { data: products } = await supabase.from("products").select("id, name, catalog_product_id");
  const { data: catalogProducts } = await supabase.from("catalog_products").select("id, name");

  console.log(`Products: ${products?.length}`);
  console.log(`Catalog: ${catalogProducts?.length}`);

  let matchCount = 0;
  for (const p of products || []) {
    if (p.catalog_product_id) {
      const match = catalogProducts?.find(cp => cp.id === p.catalog_product_id);
      if (match) {
        matchCount++;
      } else {
        console.log(`Orphaned product: ${p.name} (catalog_product_id: ${p.catalog_product_id})`);
      }
    } else {
      console.log(`Product missing catalog_product_id: ${p.name}`);
    }
  }

  console.log(`Total properly linked products: ${matchCount}`);
}

main().catch(console.error);
