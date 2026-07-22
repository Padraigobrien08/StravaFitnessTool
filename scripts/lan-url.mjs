// Prints the LAN URL(s) to open StrideIQ from another device on the same
// network, plus the Strava callback domain to register for OAuth.
// Usage: npm run lan
import { networkInterfaces } from "node:os";

const port = process.env.PORT || "3000";
const nets = networkInterfaces();
const addrs = [];
for (const list of Object.values(nets)) {
  for (const net of list ?? []) {
    if (net.family === "IPv4" && !net.internal) addrs.push(net.address);
  }
}

console.log("\nOpen StrideIQ on another device on this Wi-Fi:\n");
if (addrs.length === 0) {
  console.log("  (no LAN address found — are you connected to a network?)");
} else {
  for (const a of addrs) console.log(`  http://${a}:${port}`);
}
console.log(
  "\nThe demo and Strava-export import work over this URL as-is.\n" +
    "For live Strava OAuth from the device, register the host as your\n" +
    "Strava app's Authorization Callback Domain (leave STRAVA_REDIRECT_URI\n" +
    "blank so the callback follows the host you browse):",
);
if (addrs[0]) console.log(`  Callback domain: ${addrs[0]}`);
console.log(
  "\nOff-network access (and clean HTTPS OAuth): run a tunnel, e.g.\n" +
    `  cloudflared tunnel --url http://localhost:${port}\n` +
    "then register the printed *.trycloudflare.com host as the callback domain.\n" +
    "Start the server with:  npm run dev:lan\n",
);
