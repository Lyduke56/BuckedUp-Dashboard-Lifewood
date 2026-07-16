import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const jsonPath = path.join(process.cwd(), 'public', 'data', 'products.json');

async function main() {
  if (!fs.existsSync(jsonPath)) {
    console.error(`File not found: ${jsonPath}`);
    return;
  }

  const content = fs.readFileSync(jsonPath, 'utf-8');
  const products = JSON.parse(content);

  const browser = await puppeteer.launch({ headless: true });
  console.log(`Loaded ${products.length} products. Fetching images...`);

  const concurrency = 3;
  for (let i = 0; i < products.length; i += concurrency) {
    const chunk = products.slice(i, i + concurrency);
    
    await Promise.all(chunk.map(async (product: any) => {
      if (product.link && !product.imageUrl) {
        console.log(`Fetching image for: ${product.name}`);
        let newPage;
        try {
          newPage = await browser.newPage();
          await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          await newPage.goto(product.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          const imageUrl = await newPage.evaluate(() => {
            const ogMeta = document.querySelector('meta[property="og:image"]');
            if (ogMeta && ogMeta.getAttribute('content')) return ogMeta.getAttribute('content');
            const twMeta = document.querySelector('meta[name="twitter:image"]');
            if (twMeta && twMeta.getAttribute('content')) return twMeta.getAttribute('content');
            const img = document.querySelector('img.product-image, img.product-featured-img');
            return img ? img.getAttribute('src') : null;
          });

          if (imageUrl) {
            product.imageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
            console.log(`--> Found image: ${product.imageUrl}`);
          } else {
            console.log(`--> No image found for ${product.name}`);
          }
        } catch (err: any) {
          console.error(`--> Error (${product.name}): ${err.message}`);
        } finally {
          if (newPage) await newPage.close();
        }
      }
    }));
    
    // Save incrementally
    fs.writeFileSync(jsonPath, JSON.stringify(products, null, 2), 'utf-8');
    console.log(`Saved progress (${Math.min(i + concurrency, products.length)}/${products.length})`);
    
    // Small delay between batches to be polite
    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();

  fs.writeFileSync(jsonPath, JSON.stringify(products, null, 2), 'utf-8');
  console.log('Finished updating products.json with image URLs.');
}

main().catch(console.error);
