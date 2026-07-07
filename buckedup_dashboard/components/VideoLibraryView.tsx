"use client";

import { useMemo, useState } from "react";
import { CATEGORY_TREE, STATUS_CLASS } from "@/lib/data";
import type { Product, StatusFilter, VideoItem } from "@/lib/types";
import {
  categoryCountProducts,
  getModalKey,
  productBucket,
  productDone,
  productProgressPct,
  subcategoryCountProducts,
} from "@/lib/utils";
import { FolderIconFilled, PlayIcon } from "./icons";
import { Card } from "./Card";
import { CardGrid } from "./CardGrid";

const CATEGORY_PALETTE = [
  "var(--castleton)",
  "var(--saffron)",
  "var(--g2)",
  "var(--earth-yellow)",
  "var(--g3)",
  "var(--serpent)",
];

function categoryColor(category: string) {
  const keys = Object.keys(CATEGORY_TREE);
  const idx = keys.indexOf(category);
  return CATEGORY_PALETTE[idx >= 0 ? idx % CATEGORY_PALETTE.length : 0];
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "not-started", label: "Not started" },
  { value: "in-progress", label: "In progress" },
  { value: "published", label: "Published" },
];

interface VideoLibraryViewProps {
  onOpenModal: (key: string) => void;
  products: Product[];
}

export function VideoLibraryView({ onOpenModal, products }: VideoLibraryViewProps) {
  const [currentCategory, setCurrentCategory] = useState("all");
  const [currentSubcategory, setCurrentSubcategory] = useState("all");
  const [currentStatusFilter, setCurrentStatusFilter] =
    useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

const filteredProducts = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return products.filter((product) => {
      if (currentCategory !== "all" && product.category !== currentCategory) {
        return false;
      }
      if (
        currentSubcategory !== "all" &&
        product.subcategory !== currentSubcategory
      ) {
        return false;
      }
      if (
        currentStatusFilter !== "all" &&
        productBucket(product) !== currentStatusFilter
      ) {
        return false;
      }
      if (query && !product.name.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [products, currentCategory, currentSubcategory, currentStatusFilter, searchTerm]);

  const handleCategoryChange = (value: string) => {
    setCurrentCategory(value);
    setCurrentSubcategory("all");
  };

  const openProduct = (rank: number) => {
    const product = products.find((p) => p.rank === rank);
    if (product) setSelectedProduct(product);
  };

  const closeDetail = () => {
    setSelectedProduct(null);
  };

  if (selectedProduct) {
    const done = productDone(selectedProduct);
    const total = selectedProduct.items.length;

    return (
      <div>
        <button type="button" className="back-row" onClick={closeDetail}>
          ← Back to Video Library
        </button>
        <h1 className="section-heading">{selectedProduct.name}</h1>
        <p className="section-sub">
          {selectedProduct.category} › {selectedProduct.subcategory} · Rank #
          {selectedProduct.rank} · {done}/{total} videos published
        </p>
        <div className="file-list">
          <div className="file-row head">
            <div />
            <div>Video item</div>
            <div>Stage</div>
            <div>Video</div>
          </div>
          {selectedProduct.items.map((item, index) => (
            <FileRow
              key={getModalKey(selectedProduct.rank, index)}
              item={item}
              modalKey={getModalKey(selectedProduct.rank, index)}
              onOpenModal={onOpenModal}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-heading">Video Library</div>
      <div className="section-sub">
        Priority-ranked shot list — grows automatically as new products are
        requested, across any category in the catalog.
      </div>
      <div className="toolbar">
        <div className="filter-group">
          <select
            value={currentCategory}
            onChange={(event) => handleCategoryChange(event.target.value)}
          >
            <option value="all">All categories ({products.length})</option>
            {Object.keys(CATEGORY_TREE).map((category) => (
              <option key={category} value={category}>
                {category} ({categoryCountProducts(products, category)})
              </option>
            ))}
          </select>
          <select
            value={currentSubcategory}
            disabled={currentCategory === "all"}
            onChange={(event) => setCurrentSubcategory(event.target.value)}
          >
            {currentCategory === "all" ? (
              <option value="all">All subcategories</option>
            ) : (
              <>
                <option value="all">
                  All subcategories (
                  {categoryCountProducts(products, currentCategory)})
                </option>
                {CATEGORY_TREE[currentCategory].map((subcategory) => (
                  <option key={subcategory} value={subcategory}>
                    {subcategory} (
                    {subcategoryCountProducts(
                      products,
                      currentCategory,
                      subcategory,
                    )}
                    )
                  </option>
                ))}
              </>
            )}
          </select>
          <div className="filter-pills">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`pill${currentStatusFilter === filter.value ? " active" : ""}`}
                onClick={() => setCurrentStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="Search product…"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>
      <CardGrid columns={4} className="folder-grid">
        {filteredProducts.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
            No products currently requested in this category yet — it will
            appear here automatically once BuckedUp adds one.
          </div>
        ) : (
          filteredProducts.map((product) => {
            const done = productDone(product);
            const total = product.items.length;
            return (
              <Card
                key={product.rank}
                height={210}
                className="folder-card"
                onClick={() => openProduct(product.rank)}
              >
                <div
                  className="folder-card-strip"
                  style={{ background: categoryColor(product.category) }}
                />
                <div className="folder-card-body">
                  <div className="folder-top">
                    <FolderIconFilled />
                    <div className="rank-chip">
                      <span>{product.rank}</span>
                    </div>
                  </div>
                  <div className="folder-name">{product.name}</div>
                  <div className="folder-meta">
                    {product.category} · {total} video{total > 1 ? "s" : ""}
                  </div>
                  {product.items[0] ? (
                    <span
                      className={`status-pill ${STATUS_CLASS[product.items[0].status]}`}
                    >
                      {product.items[0].status}
                    </span>
                  ) : null}
                  <div className="folder-progress-track">
                    <div
                      className="folder-progress-fill"
                      style={{ width: `${productProgressPct(product)}%` }}
                    />
                  </div>
                  <div className="folder-bottom">
                    <span className="folder-count">
                      {done}/{total} recorded
                    </span>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </CardGrid>
    </div>
  );
}

interface FileRowProps {
  item: VideoItem;
  modalKey: string;
  onOpenModal: (key: string) => void;
}

function FileRow({ item, modalKey, onOpenModal }: FileRowProps) {
  return (
    <div className="file-row">
      <div className="thumb">
        <PlayIcon />
      </div>
      <div
        className="file-name"
        onClick={() => onOpenModal(modalKey)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            onOpenModal(modalKey);
          }
        }}
        role="button"
        tabIndex={0}
      >
        {item.name}
        {item.variant ? (
          <span className="variant-ctx">{item.variant}</span>
        ) : null}
      </div>
      <div className="fr-status">
        <span className={`status-pill ${STATUS_CLASS[item.status]}`}>
          {item.status}
        </span>
      </div>
      <div>
        {item.videoUrl ? (
          <button
            type="button"
            className="video-link"
            onClick={(event) => {
              event.stopPropagation();
              onOpenModal(modalKey);
            }}
          >
            ▶ Watch
          </button>
        ) : (
          <button
            type="button"
            className="preview-btn"
            onClick={(event) => {
              event.stopPropagation();
              onOpenModal(modalKey);
            }}
          >
            Preview
          </button>
        )}
      </div>
    </div>
  );
}
