type AuthEmailMessage = {
  to: string;
  subject: string;
  heading: string;
  message: string;
  actionLabel: string;
  actionUrl: string;
};

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

/** Server-only transactional email delivery via Resend. */
export async function sendAuthEmail(message: AuthEmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Transactional email delivery is not configured.");

  let actionUrl: URL;
  try {
    actionUrl = new URL(message.actionUrl);
  } catch {
    throw new Error("The authentication email contains an invalid action URL.");
  }
  if (actionUrl.protocol !== "https:" && actionUrl.protocol !== "http:") {
    throw new Error("The authentication email action URL must use HTTP or HTTPS.");
  }

  const safeHeading = escapeHtml(message.heading);
  const safeMessage = escapeHtml(message.message);
  const safeActionLabel = escapeHtml(message.actionLabel);
  const safeUrl = escapeHtml(actionUrl.toString());
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;background:#f4f5f2;color:#202324;font-family:Arial,sans-serif;">' +
    '<main style="max-width:560px;margin:24px auto;padding:32px;background:#fff;border-radius:12px;">' +
    '<p style="color:#426c35;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Evergreen Estates</p>' +
    '<h1 style="font-size:24px;line-height:1.3;">' + safeHeading + '</h1>' +
    '<p style="font-size:16px;line-height:1.6;">' + safeMessage + '</p>' +
    '<p style="margin:28px 0;"><a href="' + safeUrl +
    '" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#78b75c;color:#111;text-decoration:none;font-weight:bold;">' +
    safeActionLabel + '</a></p>' +
    '<p style="font-size:12px;line-height:1.5;color:#636963;">If the button does not work, copy this link into your browser:<br>' +
    '<a href="' + safeUrl + '">' + safeUrl + '</a></p>' +
    '<p style="font-size:12px;color:#636963;">If you did not request this, you can ignore this email.</p>' +
    '</main></body></html>';
  const text = [
    message.heading, "", message.message, "", message.actionLabel + ": " + actionUrl.toString(), "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, html, text }),
  });
  if (!response.ok) {
    // Never log a provider response body; it may contain recipient or account details.
    throw new Error("Transactional email delivery failed with HTTP " + response.status + ".");
  }
}
