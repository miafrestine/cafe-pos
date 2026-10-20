export const MAIN_CATEGORIES = [
  { id: 'coffee', label: 'Coffee' },
  { id: 'tea', label: 'Tea' },
  { id: 'juice', label: 'Juice' },
  { id: 'meal', label: 'Meal' },
  { id: 'snack', label: 'Snack' },
  { id: 'dessert', label: 'Dessert' },
];

export const SIZES = ['Small', 'Medium', 'Large'];

// Prices are in pesos, based on the Coffee Bean & Tea Leaf PH January 2025 menu. A coffee's `price`
// is its Small price; these amounts are added for the bigger cups. Medium is the menu's "Regular".
// On the menu, Regular is +20 and Large is +50 over Small for the espresso and latte drinks.
// Set every value to 0 to turn size pricing off.
export const SIZE_UPCHARGES = { Small: 0, Medium: 20, Large: 50 };

// The one add-on offered on each product card, and what it costs.
export function getModifier(product) {
  if (product.hasPlantMilkOption) return { label: 'Plant Milk', price: 35 };
  if (product.category === 'tea' || product.category === 'juice') return { label: 'Extra Ice', price: 0.5 };
  return { label: 'Warm Up', price: 0.5 };
}

export const SUB_CATEGORIES_MAP = {
  coffee: ['All', 'Espresso', 'Cappuccino', 'Latte', 'Mocha', 'Macchiato'],
  tea: ['All', 'Hot Teas', 'Iced Teas', 'Milk Teas / Boba', 'Specialty Lattes'],
  juice: ['All', 'Classic Fruit', 'Daily Greens', 'Booster Shots'],
  meal: ['All', 'Sandwiches & Wraps', 'Salads & Bowls', 'Small Bites & Sides'],
  snack: ['All', 'Savory Bites', 'Sweet Treats', 'Crunchy & Packaged'],
  dessert: ['All', 'Cakes & Slices', 'Tarts & Pastries', 'Cookies & Macarons'],
};

export const PRODUCTS = [
  { id: 1, name: 'Espresso', price: 125, subCat: 'Espresso', category: 'coffee', image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: true },
  { id: 2, name: 'Cold Brew', price: 145, subCat: 'Espresso', category: 'coffee', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: true },
  { id: 3, name: 'Cinnamon Latte', price: 175, subCat: 'Latte', category: 'coffee', image: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: true },
  { id: 4, name: 'Cappuccino', price: 145, subCat: 'Cappuccino', category: 'coffee', image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: true },
  { id: 5, name: 'White Mocha', price: 175, subCat: 'Mocha', category: 'coffee', image: 'https://images.unsplash.com/photo-1530373239216-42518e6b4039?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: true },
  { id: 6, name: 'Hazelnut Latte', price: 175, subCat: 'Latte', category: 'coffee', image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: true },
  { id: 7, name: 'Caramel Macchiato', price: 185, subCat: 'Macchiato', category: 'coffee', image: 'https://images.unsplash.com/photo-1485808191679-edf8637cb6a9?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: true },
  { id: 8, name: 'Earl Grey Infusion', price: 175, subCat: 'Hot Teas', category: 'tea', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: false },
  { id: 9, name: 'Iced Jasmine Green', price: 175, subCat: 'Iced Teas', category: 'tea', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: false },
  { id: 10, name: 'Brown Sugar Boba Milk', price: 4.8, subCat: 'Milk Teas / Boba', category: 'tea', image: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: true },
  { id: 13, name: 'Matcha Green Latte', price: 195, subCat: 'Specialty Lattes', category: 'tea', image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: true },
  { id: 14, name: 'Fresh Orange Juice', price: 4.0, subCat: 'Classic Fruit', category: 'juice', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: false },
  { id: 15, name: 'Apple Lychee Blend', price: 4.8, subCat: 'Classic Fruit', category: 'juice', image: 'https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: false },
  { id: 21, name: 'Avocado Sourdough Toast', price: 7.5, subCat: 'Sandwiches & Wraps', category: 'meal', image: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: false, tags: ['🌱 Vegan', '⏱️ Grab & Go'] },
  { id: 22, name: 'Turkey Cranberry Panini', price: 8.9, subCat: 'Sandwiches & Wraps', category: 'meal', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: false, tags: [] },
  { id: 23, name: 'Mediterranean Grain Bowl', price: 9.5, subCat: 'Salads & Bowls', category: 'meal', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: false, tags: ['🌱 Vegan', '🌾 Gluten-Free'] },
  { id: 11, name: 'Almond Croissant', price: 3.8, subCat: 'Sweet Treats', category: 'snack', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: false, tags: ['🌱 Vegan'] },
  { id: 24, name: 'Artisan Sausage Roll', price: 4.5, subCat: 'Savory Bites', category: 'snack', image: 'https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: false, tags: ['🔥 Serve Warm'] },
  { id: 12, name: 'Tiramisu Slice', price: 6.5, subCat: 'Cakes & Slices', category: 'dessert', image: 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: false, tags: ['❄️ Chilled'] },
  { id: 29, name: 'Warm Lava Cake', price: 6.9, subCat: 'Cakes & Slices', category: 'dessert', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=80', hasPlantMilkOption: false, tags: ['🔥 Serve Warm'] },
];
