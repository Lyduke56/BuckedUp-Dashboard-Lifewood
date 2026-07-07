import { Product } from "./types";

/**
 * Mock data standing in for the live database sync described in the
 * project scope (Read: full capability to fetch/sync from connected
 * databases). Swap this for a query layer (e.g. src/lib/db.ts calling
 * Supabase/Sheets) once the source system is available — the shape of
 * `Product` should stay the same so components don't need to change.
 */
export const PRODUCTS: Product[] = [
  {
    rank: 1,
    name: "Creatine Monohydrate",
    category: "Creatine",
    subcategory: "Creatine Powder",
    price: "$29.99",
    contentType: "Educational + Product Demo",
    items: [
      {
        id: "1-0",
        name: "Creatine Monohydrate — Educational + Product Demo",
        published: true,
      },
    ],
  },
  {
    rank: 2,
    name: "Woke AF Pre-Workout",
    category: "Pre-Workout & Energy",
    subcategory: "High Stimulant Pre-Workout",
    price: "$54.99",
    contentType: "Hype / POV Reel",
    items: [
      {
        id: "2-0",
        name: "Woke AF Pre-Workout — Hype / POV Reel",
        published: false,
      },
    ],
  },
  {
    rank: 3,
    name: "Bucked Up Pre-Workout",
    category: "Pre-Workout & Energy",
    subcategory: "Standard Stim Pre-Workout",
    price: "$49.99",
    contentType: "Product Demo",
    items: [
      {
        id: "3-0",
        name: "Bucked Up Pre-Workout — Product Demo (11 variants)",
        published: false,
      },
    ],
  },
  {
    rank: 4,
    name: "Energy Drinks",
    category: "Drinks",
    subcategory: "Energy Drinks",
    price: "from $39.99",
    contentType: "Collection Haul / Taste Test",
    items: [
      {
        id: "4-0",
        name: "2-Case Custom Bundle",
        variant: "Mix & match Protein Soda + Energy",
        published: false,
      },
      {
        id: "4-1",
        name: "Babe Energy (2 Cases / 24 Cans)",
        variant: "Cherry Blossom, Raspberry Twist",
        published: false,
      },
      {
        id: "4-2",
        name: "Bucked Up Energy (2 Cases / 24 Cans)",
        variant: "15 flavors incl. NEW",
        published: false,
      },
      {
        id: "4-3",
        name: "Bucked Up Mini Energy Drink (7.5 oz)",
        variant: "4 flavors incl. NEW",
        published: false,
      },
      {
        id: "4-4",
        name: 'Refresher™ Energy Drinks (1 Case / 12 Cans)',
        variant: "5 flavors incl. NEW",
        published: false,
      },
    ],
  },
  {
    rank: 5,
    name: "Protein Drinks (Protein Soda)",
    category: "Drinks",
    subcategory: "Protein Drinks",
    price: "from $5.99",
    contentType: "Collection Haul / Reaction",
    items: [
      {
        id: "5-0",
        name: "Protein Popcorn (1 Bag)",
        variant: "★ Best Seller #1 · NEW",
        published: false,
      },
      {
        id: "5-1",
        name: "Collagen Peptides",
        variant: "★ Best Seller #8",
        published: false,
      },
      {
        id: "5-2",
        name: "Buck Feed Original Protein",
        variant: "★ Best Seller #20",
        published: false,
      },
      {
        id: "5-3",
        name: "Babe Collagen",
        variant: "Chocolate, Blueberry Pomegranate",
        published: false,
      },
      {
        id: "5-4",
        name: "Buck Feed All-Natural Protein",
        variant: "Chocolate",
        published: false,
      },
      {
        id: "5-5",
        name: "Bucked Up Protein Soda (2 Cases / 24 Cans)",
        variant: "8 flavors",
        published: false,
      },
    ],
  },
  {
    rank: 6,
    name: "Mother Bucker Pre-Workout",
    category: "Pre-Workout & Energy",
    subcategory: "High Stimulant Pre-Workout",
    price: "$59.99",
    contentType: "Product Demo / Comparison",
    items: [
      {
        id: "6-0",
        name: "Mother Bucker Pre-Workout — Product Demo / Comparison",
        published: false,
      },
    ],
  },
  {
    rank: 7,
    name: "Six Point Creatine",
    category: "Creatine",
    subcategory: "Creatine Powder",
    price: "$34.99",
    contentType: "Educational / Comparison",
    items: [
      {
        id: "7-0",
        name: "Six Point Creatine — Educational / Comparison",
        published: false,
      },
    ],
  },
  {
    rank: 8,
    name: "RUT Testosterone Booster",
    category: "Vitamins & Wellness",
    subcategory: "Joint & Bone",
    price: "$69.99",
    contentType: "Educational",
    items: [
      {
        id: "8-0",
        name: "RUT Testosterone Booster — Educational",
        published: false,
      },
    ],
  },
  {
    rank: 9,
    name: "Buck Naked Fat Burner",
    category: "Vitamins & Wellness",
    subcategory: "Joint & Bone",
    price: "$59.99",
    contentType: "Educational / Lifestyle",
    items: [
      {
        id: "9-0",
        name: "Buck Naked Fat Burner — Educational / Lifestyle",
        published: false,
      },
    ],
  },
  {
    rank: 10,
    name: "Buck Feed Protein Powder",
    category: "Drinks",
    subcategory: "Protein Drinks",
    price: "$68.99",
    contentType: "Product Demo / Recipe",
    items: [
      {
        id: "10-0",
        name: "Buck Feed Protein Powder — Product Demo / Recipe",
        published: false,
      },
    ],
  },
  {
    rank: 11,
    name: "PWR BUCK Energy Pouches",
    category: "Pre-Workout & Energy",
    subcategory: "On The Go Energy",
    price: "$8.99–$39.99",
    contentType: "Trend Short",
    items: [
      {
        id: "11-0",
        name: "PWR BUCK Energy Pouches — Trend Short",
        published: false,
      },
    ],
  },
  {
    rank: 12,
    name: "Pump Ocalypse",
    category: "Pre-Workout & Energy",
    subcategory: "Stim Free & Pump",
    price: "$45.99",
    contentType: "Product Demo / Stack",
    items: [
      {
        id: "12-0",
        name: "Pump Ocalypse — Product Demo / Stack",
        published: false,
      },
    ],
  },
];
