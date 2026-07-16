import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const response = await page.goto('https://www.buckedup.com/shop/high-stimulant/mother-bucker-swole-whip', { waitUntil: 'domcontentloaded' });
  
  console.log('Status:', response?.status());
  console.log('Final URL:', page.url());
  
  const data = await page.evaluate(() => {
    const og = document.querySelector('meta[property="og:image"]');
    const tw = document.querySelector('meta[name="twitter:image"]');
    const imgs = Array.from(document.querySelectorAll('img')).map(img => img.src);
    return {
      og: og ? og.getAttribute('content') : null,
      tw: tw ? tw.getAttribute('content') : null,
      imgs: imgs
    };
  });
  
  console.log('Data:', JSON.stringify(data, null, 2));
  await browser.close();
}

run();
