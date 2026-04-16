require("dotenv").config();

const http = require("http");
const { neon } = require("@neondatabase/serverless");

const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
const port = Number(process.env.PORT || 3000);

if (!databaseUrl) {
  console.error("NEON_DATABASE_URL or DATABASE_URL is required. Set one before starting the server.");
  process.exit(1);
}

const sql = neon(databaseUrl);

const requestHandler = async (req, res) => {
  try {
    const result = await sql`SELECT version()`;
    const { version } = result[0];
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(version);
  } catch (error) {
    console.error("Neon DB query failed:", error);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Database request failed");
  }
};

http.createServer(requestHandler).listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
