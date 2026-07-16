async function run() {
  const cdnUrl = 'https://www.buckedup.com/cdn-cgi/image/width=1200,format=auto,quality=85/public/upload%2Fimg%2Fproducts%2F2198-WHO-MotherBucker-SwoleWhip-20srv-25-04-00-01_medium.webp';
  
  const directPath = decodeURIComponent(cdnUrl.split('/cdn-cgi/image/width=1200,format=auto,quality=85/')[1]);
  const directUrl = 'https://www.buckedup.com/' + directPath;
  console.log('Direct URL:', directUrl);
  
  const res = await fetch(directUrl);
  console.log('Status:', res.status, res.headers.get('content-type'));
}
run();
