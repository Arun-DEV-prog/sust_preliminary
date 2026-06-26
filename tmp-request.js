const http = require("http");
const payload = '{"ticket_id":"x"';
const req = http.request(
  {
    hostname: "127.0.0.1",
    port: 3000,
    path: "/analyze-ticket",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  },
  (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => {
      console.log("malformed", res.statusCode, data);
      process.exit(0);
    });
  },
);
req.on("error", (err) => {
  console.error(err.message);
  process.exit(1);
});
req.write(payload);
req.end();
