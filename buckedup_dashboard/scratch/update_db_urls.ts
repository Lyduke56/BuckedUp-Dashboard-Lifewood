import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const { data: products } = await supabase.from('catalog_products').select('id, thumbnail_url').not('thumbnail_url', 'is', null);
  
  if (!products) return;
  
  for (const product of products) {
    let imageUrl = product.thumbnail_url;
    if (imageUrl.includes('/cdn-cgi/image/')) {
      const match = imageUrl.match(/\/cdn-cgi\/image\/[^\/]+\/(.+)/);
      if (match && match[1]) {
        const originalPath = decodeURIComponent(match[1]);
        const base = imageUrl.startsWith('http') ? new URL(imageUrl).origin : 'https://www.buckedup.com';
        imageUrl = `${base}/${originalPath}`;
        
        console.log(`Updating ${product.id} to ${imageUrl}`);
        await supabase.from('catalog_products').update({ thumbnail_url: imageUrl }).eq('id', product.id);
      }
    }
  }
}

main();
