"use client";

import { categoryColor } from "@/lib/colors";

interface CategoryLegendProps {
  categories: string[];
  currentCategory: string;
  onSelect: (category: string) => void;
}

export function CategoryLegend({
  categories,
  currentCategory,
  onSelect,
}: CategoryLegendProps) {
  return (
    <div className="category-legend">
      <button
        type="button"
        className={`category-legend-item${
          currentCategory === "all" ? " selected" : ""
        }`}
        onClick={() => onSelect("all")}
      >
        <span
          className="category-legend-dot"
          style={{ background: "var(--gray2)" }}
        />
        All categories
      </button>
      {categories.map((category) => {
        const isSelected = currentCategory === category;
        return (
          <button
            key={category}
            type="button"
            className={`category-legend-item${isSelected ? " selected" : ""}`}
            onClick={() =>
              onSelect(currentCategory === category ? "all" : category)
            }
          >
            <span
              className="category-legend-dot"
              style={{ background: categoryColor(category) }}
            />
            {category}
          </button>
        );
      })}
    </div>
  );
}