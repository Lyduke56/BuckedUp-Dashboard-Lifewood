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
  const page = await browser.newPage();
  
  // Set a common user agent to help avoid basic blocks
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log(`Loaded ${products.length} products. Fetching images...`);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    if (product.link && !product.imageUrl) {
      console.log(`Fetching image for: ${product.name}`);
      try {
        await page.goto(product.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const imageUrl = await page.evaluate(() => {
          // Try og:image first
          const ogMeta = document.querySelector('meta[property="og:image"]');
          if (ogMeta && ogMeta.getAttribute('content')) {
            return ogMeta.getAttribute('content');
          }
          // Fallback 1: twitter:image
          const twMeta = document.querySelector('meta[name="twitter:image"]');
          if (twMeta && twMeta.getAttribute('content')) {
            return twMeta.getAttribute('content');
          }
          // Fallback 2: general product images
          const img = document.querySelector('img.product-image, img.product-featured-img');
          return img ? img.getAttribute('src') : null;
        });

        if (imageUrl) {
          product.imageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
          console.log(`--> Found image: ${product.imageUrl}`);
        } else {
          console.log(`--> No image found.`);
        }
      } catch (err: any) {
        console.error(`--> Error: ${err.message}`);
      }
      
      // small delay to be polite
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  await browser.close();

  fs.writeFileSync(jsonPath, JSON.stringify(products, null, 2), 'utf-8');
  console.log('Finished updating products.json with image URLs.');
}

main().catch(console.error);
