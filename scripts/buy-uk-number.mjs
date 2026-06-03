/**
 * Buy a UK mobile number from Twilio for WhatsApp Business verification.
 * Reads credentials from .env — NEVER outputs them.
 * Usage: node scripts/buy-uk-number.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = "/Users/qassimabdulkarim/Documents/AI-Agency/PluggedIN/.env";
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim()];
    })
);

const SID = env.TWILIO_ACCOUNT_SID;
const TOKEN = env.TWILIO_AUTH_TOKEN;

if (!SID || !TOKEN) {
  console.error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in .env");
  process.exit(1);
}

async function main() {
  const auth = Buffer.from(`${SID}:${TOKEN}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}` };

  // Step 1: Find ANY available SMS-capable number
  console.log("Searching for available numbers...");
  for (const country of ["GB", "US"]) {
    for (const type of ["Mobile", "Local"]) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${SID}/AvailablePhoneNumbers/${country}/${type}.json?Limit=1&SmsEnabled=true`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data.available_phone_numbers?.length) {
        const number = data.available_phone_numbers[0].phone_number;
        console.log(`Found: ${number} (${country} ${type})`);

        // Buy it
        console.log("Buying...");
        const buy = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers.json`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ PhoneNumber: number, SmsEnabled: "true" }),
        });
        const buyData = await buy.json();
        if (buyData.sid) {
          console.log(`✅ Purchased: ${buyData.phone_number}`);
          return;
        } else {
          console.log(`Failed: ${buyData.message}`);
        }
      }
    }
  }
  console.log("No numbers found. Account may not support number purchasing in GB/US.");
}

main();
