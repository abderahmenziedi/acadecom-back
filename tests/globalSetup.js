const path = require("path");
const { execSync } = require("child_process");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const db = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!db) {
  throw new Error("Définissez DATABASE_URL ou TEST_DATABASE_URL pour npm test.");
}

const root = path.join(__dirname, "..");
const env = { ...process.env, DATABASE_URL: db };

execSync("npx prisma migrate deploy", { stdio: "inherit", cwd: root, env });
execSync("node prisma/seed.js", { stdio: "inherit", cwd: root, env });

module.exports = async () => {};
