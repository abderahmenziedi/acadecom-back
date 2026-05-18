const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL ou TEST_DATABASE_URL requis pour npm test.");
}
process.env.DATABASE_URL = url;
process.env.NODE_ENV = "test";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "dev-test-secret-at-least-32-chars-xx";
}
