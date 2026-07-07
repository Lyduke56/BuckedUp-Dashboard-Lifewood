import { ProductBucket } from "@/lib/types";
import { bucketLabel } from "@/lib/productHelpers";

const BUCKET_CLASSES: Record<ProductBucket, string> = {
  "not-started": "bg-neutral-4 text-neutral-1",
  "in-progress": "bg-saffron/25 text-[#a15e00]",
  published: "bg-castleton/15 text-castleton",
};

export function StatusPill({ bucket }: { bucket: ProductBucket }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold ${BUCKET_CLASSES[bucket]}`}
    >
      {bucketLabel(bucket)}
    </span>
  );
}
