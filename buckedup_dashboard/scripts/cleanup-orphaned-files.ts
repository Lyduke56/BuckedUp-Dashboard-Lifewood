import { createClient } from "@supabase/supabase-js";

/**
 * Scans the 'thumbnails' and 'stage-documents' Supabase Storage buckets for files
 * that are no longer referenced in the database ('products' and 'stage_deliverables' tables),
 * and permanently deletes them to free up storage.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/cleanup-orphaned-files.ts
 */

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log("Cleaning up orphaned thumbnails...");
  await cleanupThumbnails(supabase);

  console.log("\nCleaning up orphaned stage deliverables...");
  await cleanupDeliverables(supabase);

  console.log("\nCleanup complete!");
}

async function cleanupThumbnails(supabase: any) {
  // 1. Fetch all thumbnail URLs from the DB
  const { data: products, error: dbErr } = await supabase
    .from("products")
    .select("thumbnail_url")
    .not("thumbnail_url", "is", null);

  if (dbErr) throw dbErr;

  const validUrls = new Set(products.map((p: any) => p.thumbnail_url));

  // 2. Fetch all files from the thumbnails bucket (we need to list folders first, which are product IDs)
  const { data: folders, error: folderErr } = await supabase.storage.from("thumbnails").list();
  if (folderErr) throw folderErr;

  let deletedCount = 0;

  for (const folder of folders) {
    if (!folder.id) continue; // Skip if it's not a folder
    const { data: files, error: fileErr } = await supabase.storage.from("thumbnails").list(folder.name);
    if (fileErr) continue;

    for (const file of files) {
      if (file.name === ".emptyFolderPlaceholder") continue;

      const path = `${folder.name}/${file.name}`;
      const { data } = supabase.storage.from("thumbnails").getPublicUrl(path);
      
      if (!validUrls.has(data.publicUrl)) {
        console.log(`Deleting orphaned thumbnail: ${path}`);
        await supabase.storage.from("thumbnails").remove([path]);
        deletedCount++;
      }
    }
  }
  
  console.log(`Deleted ${deletedCount} orphaned thumbnails.`);
}

async function cleanupDeliverables(supabase: any) {
  // 1. Fetch all deliverable URLs from the DB
  const { data: deliverables, error: dbErr } = await supabase
    .from("stage_deliverables")
    .select("file_url")
    .not("file_url", "is", null);

  if (dbErr) throw dbErr;

  const validUrls = new Set(deliverables.map((d: any) => d.file_url));

  // 2. Fetch all folders from the stage-documents bucket
  const { data: productFolders, error: pErr } = await supabase.storage.from("stage-documents").list();
  if (pErr) throw pErr;

  let deletedCount = 0;

  for (const pFolder of productFolders) {
    if (!pFolder.id) continue;
    
    // Each product folder contains stage folders
    const { data: stageFolders } = await supabase.storage.from("stage-documents").list(pFolder.name);
    if (!stageFolders) continue;

    for (const sFolder of stageFolders) {
      if (!sFolder.id) continue;

      const prefix = `${pFolder.name}/${sFolder.name}`;
      const { data: files } = await supabase.storage.from("stage-documents").list(prefix);
      if (!files) continue;

      for (const file of files) {
        if (file.name === ".emptyFolderPlaceholder") continue;

        const path = `${prefix}/${file.name}`;
        const { data } = supabase.storage.from("stage-documents").getPublicUrl(path);

        if (!validUrls.has(data.publicUrl)) {
          console.log(`Deleting orphaned deliverable: ${path}`);
          await supabase.storage.from("stage-documents").remove([path]);
          deletedCount++;
        }
      }
    }
  }

  console.log(`Deleted ${deletedCount} orphaned stage deliverables.`);
}

main().catch(console.error);
