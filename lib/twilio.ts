import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const FROM = process.env.TWILIO_FROM_NUMBER!;

export async function sendSms(to: string, body: string) {
  return client.messages.create({ from: FROM, to, body });
}

export const SMS = {
  scanReceived: () =>
    "Basin received your bathroom scan. We'll review it within 24 hours. Questions? Reply to this message.",

  scanApproved: () =>
    "Good news — your Basin scan looks great! We'll send your bathroom design within 2 business days.",

  scanFlagged: (note: string) =>
    `We weren't able to use your scan. ${note} Reply to this message or open the Basin app to re-scan.`,
};
