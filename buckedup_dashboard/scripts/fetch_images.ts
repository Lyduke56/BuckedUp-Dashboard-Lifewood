import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  console.log("Fetching products with missing thumbnail_url from Supabase...");
  
  const { data: products, error: fetchError } = await supabase
    .from('catalog_products')
    .select('id, name, product_url, thumbnail_url')
    .is('thumbnail_url', null)
    .not('product_url', 'is', null);

  if (fetchError) {
    console.error("Error fetching products:", fetchError);
    return;
  }

  if (!products || products.length === 0) {
    console.log("All products already have thumbnails!");
    return;
  }

  console.log(`Found ${products.length} products missing thumbnails. Launching Puppeteer...`);
  const browser = await puppeteer.launch({ headless: true });

  const concurrency = 3;
  for (let i = 0; i < products.length; i += concurrency) {
    const chunk = products.slice(i, i + concurrency);
    
    await Promise.all(chunk.map(async (product) => {
      console.log(`Fetching image for: ${product.name}`);
      let newPage;
      try {
        newPage = await browser.newPage();
        await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Timeout 30s, wait until dom content is loaded
        const response = await newPage.goto(product.product_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const status = response ? response.status() : null;
        const finalUrl = newPage.url();
        const isRedirectedToHome = finalUrl === 'https://www.buckedup.com/' || finalUrl === 'https://www.buckedup.com';
        
        if (status === 404 || isRedirectedToHome) {
          console.log(`--> Product not available (status ${status}, URL ${finalUrl}). Marking as inactive.`);
          await supabase.from('catalog_products').update({ is_active: false }).eq('id', product.id);
          return;
        }
        
        const imageUrl = await newPage.evaluate(() => {
          const ogMeta = document.querySelector('meta[property="og:image"]');
          if (ogMeta && ogMeta.getAttribute('content')) return ogMeta.getAttribute('content');
          const twMeta = document.querySelector('meta[name="twitter:image"]');
          if (twMeta && twMeta.getAttribute('content')) return twMeta.getAttribute('content');
          const img = document.querySelector('img.product-image, img.product-featured-img');
          return img ? img.getAttribute('src') : null;
        });

        if (imageUrl) {
          const fullImageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
          console.log(`--> Found image for ${product.name}: ${fullImageUrl}`);
          
          // Update Supabase Database!
          const { error: updateError } = await supabase
            .from('catalog_products')
            .update({ thumbnail_url: fullImageUrl })
            .eq('id', product.id);
            
          if (updateError) {
             console.error(`--> Failed to update DB for ${product.name}: ${updateError.message}`);
          }
        } else {
          console.log(`--> No image found for ${product.name}`);
        }
      } catch (err: any) {
        console.error(`--> Error (${product.name}): ${err.message}`);
      } finally {
        if (newPage) await newPage.close();
      }
    }));
    
    console.log(`Completed batch (${Math.min(i + concurrency, products.length)}/${products.length})`);
    
    // Small delay between batches to be polite to the server
    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();
  console.log('Finished updating Supabase catalog_products with thumbnail URLs.');
}

main().catch(console.error);
