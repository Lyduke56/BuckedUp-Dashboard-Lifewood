import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const csvPath = path.join(process.cwd(), 'BuckedUp Product Catalog(Product Catalog).csv');
const jsonPath = path.join(process.cwd(), 'public', 'data', 'products.json');

const csvContent = fs.readFileSync(csvPath, 'utf-8');

const { data } = Papa.parse(csvContent, {
  header: false,
  skipEmptyLines: true,
});

const products = [];
let currentCategory = '';
let currentSubcategory = '';

// Assuming first row is header
for (let i = 1; i < data.length; i++) {
  const row = data[i] as string[];
  
  // Clean up columns
  const col1 = row[1] || '';
  const col2 = row[2] || '';
  const col3 = row[3] || ''; // variants
  const col4 = row[4] || ''; // var count
  const col5 = row[5] || ''; // price
  const col6 = row[6] || ''; // flag
  const col7 = row[7] || ''; // link

  // Check if it's a category or subcategory row (col2 is empty, col1 has text)
  if (!col2.trim() && col1.trim()) {
    // Determine indentation
    const leadingSpacesMatch = col1.match(/^ */);
    const leadingSpaces = leadingSpacesMatch ? leadingSpacesMatch[0].length : 0;
    
    if (leadingSpaces <= 2) {
      currentCategory = col1.trim();
      currentSubcategory = ''; // reset subcategory
    } else {
      currentSubcategory = col1.trim();
    }
    continue;
  }

  // It's a product row
  if (col2.trim()) {
    products.push({
      id: i.toString(),
      category: currentCategory,
      subcategory: currentSubcategory,
      name: col2.trim(),
      variants: col3.trim(),
      variantCount: col4.trim(),
      price: col5.trim(),
      flag: col6.trim(),
      link: col7.trim(),
    });
  }
}

// Ensure output directory exists
const outputDir = path.dirname(jsonPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(jsonPath, JSON.stringify(products, null, 2), 'utf-8');
console.log(`Parsed ${products.length} products. Saved to ${jsonPath}`);
