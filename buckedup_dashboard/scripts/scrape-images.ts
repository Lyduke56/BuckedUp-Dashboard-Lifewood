import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeImages() {
  console.log("Fetching catalog products missing thumbnails...");
  
  // Get all products that have a product URL but no thumbnail
  const { data: products, error: fetchError } = await supabase
    .from("catalog_products")
    .select("id, name, product_url, thumbnail_url")
    .not("product_url", "is", null)
    .is("thumbnail_url", null);

  if (fetchError) {
    console.error("Error fetching products:", fetchError.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log("No products found that need a thumbnail update. We're all caught up!");
    return;
  }

  console.log(`Found ${products.length} products to update. Starting scrape...`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`[${i + 1}/${products.length}] Scraping ${product.name}...`);
    
    try {
      const proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(product.product_url);
      const response = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      
      if (!response.ok) {
        console.warn(`  ! Failed to fetch URL for ${product.name}: ${response.status} ${response.statusText}`);
        failCount++;
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      const ogImage = $('meta[property="og:image"]').attr('content');
      
      if (!ogImage) {
        console.warn(`  ! No og:image found on page for ${product.name}`);
        failCount++;
        continue;
      }

      console.log(`  ✓ Found image: ${ogImage}`);
      
      const { error: updateError } = await supabase
        .from("catalog_products")
        .update({ thumbnail_url: ogImage })
        .eq("id", product.id);
        
      if (updateError) {
        console.error(`  ! Failed to update DB for ${product.name}:`, updateError.message);
        failCount++;
      } else {
        successCount++;
      }
      
    } catch (err) {
      console.error(`  ! Unexpected error scraping ${product.name}:`, err);
      failCount++;
    }
    
    // Add a polite delay of 500ms between requests
    await sleep(500);
  }

  console.log("\nScraping complete!");
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
}

scrapeImages().catch(err => {
  console.error("Script failed:", err);
  process.exit(1);
});
