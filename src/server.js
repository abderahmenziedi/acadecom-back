require("dotenv").config();

if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
  console.error("Variables manquantes: JWT_SECRET ou DATABASE_URL");
  process.exit(1);
}

const app = require("./app");

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`AcadeCom API http://localhost:${PORT}`);
});
