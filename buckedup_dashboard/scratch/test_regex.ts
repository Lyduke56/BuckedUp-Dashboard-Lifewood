const urls = [
  'https://www.buckedup.com/cdn-cgi/image/width=1200,format=auto,quality=85/public/upload%2Fimg%2Fproducts%2F2198-WHO-MotherBucker-SwoleWhip-20srv-25-04-00-01_medium.webp',
  '//www.buckedup.com/cdn-cgi/image/width=500/public/upload/img.png',
  'https://some-other-site.com/image.png'
];

for (let imageUrl of urls) {
  if (imageUrl.includes('/cdn-cgi/image/')) {
    const match = imageUrl.match(/\/cdn-cgi\/image\/[^\/]+\/(.+)/);
    if (match && match[1]) {
      const originalPath = decodeURIComponent(match[1]);
      const base = imageUrl.startsWith('http') ? new URL(imageUrl).origin : 'https://www.buckedup.com';
      imageUrl = `${base}/${originalPath}`;
    }
  }
  console.log(imageUrl);
}
