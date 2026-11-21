import { getSeedProducts } from "../src/data/seed-products";
import { getCatalogue } from "../src/lib/catalogue";

const all = getSeedProducts();
const approved = getCatalogue();
console.log("total", all.length, "approved", approved.length);
console.log("first 3 approved:", approved.slice(0, 3).map((p) => p.id));
console.log("last 3 approved:", approved.slice(-3).map((p) => p.id));
const ali = approved.filter((p) => p.id.startsWith("aliexpress-"));
console.log("aliexpress approved:", ali.length);
const noImg = all.filter((p) => !p.imageUrls?.length);
console.log("products missing images:", noImg.length);
