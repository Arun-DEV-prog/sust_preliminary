require("dotenv").config();
const express = require("express");
const cors = require("cors");
const ticketRoutes = require("./routes/tickets");
const { connectPrisma } = require("./config/prisma");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ strict: false }));
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON payload." });
  }
  next(err);
});
app.use(ticketRoutes);

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: "Internal server error." });
});

async function start() {
  await connectPrisma();
  const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.warn(
        `Port ${port} is already in use; continuing with existing process.`,
      );
      return;
    }
    console.error("Server error:", error.message);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
module.exports.app = app;
module.exports.start = start;
