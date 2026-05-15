export async function renderPdfWithBrowserless(html: string): Promise<Buffer> {
  const token = process.env.BLESS_TOKEN;
  if (!token) {
    throw new Error("Missing BLESS_TOKEN for Browserless PDF rendering");
  }

  const response = await fetch(`https://chrome.browserless.io/pdf?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      options: {
        format: "A4",
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Browserless error: ${response.status} ${text}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
