export async function notifyOps(scanId: string, homeownerName: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const scanUrl = `${appUrl}/ops/scans/${scanId}`;
  const message = `New Basin scan from ${homeownerName}\n${scanUrl}`;

  const slackWebhook = process.env.OPS_NOTIFY_SLACK_WEBHOOK;
  if (slackWebhook) {
    await fetch(slackWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    }).catch(() => {});
  }

  const opsEmail = process.env.OPS_NOTIFY_EMAIL;
  if (opsEmail) {
    // Placeholder — swap in Resend/SendGrid when configured
    console.log(`[ops email] To: ${opsEmail}\n${message}`);
  }
}
