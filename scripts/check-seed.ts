import { getSeedProducts } from "../src/data/seed-products";
const all = getSeedProducts();
console.log("total:", all.length);
console.log("aliexpress:", all.filter((p) => p.id.startsWith("aliexpress-")).length);
console.log("approved:", all.filter((p) => p.approvalStatus === "approved").length);
