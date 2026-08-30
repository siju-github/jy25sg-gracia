import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support CORS for client requests
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const { name, email, phone, type, passId } = req.body || {};
  const isMusical = type === 'musical';
  const passTypeLabel = isMusical ? "GRACIA - Musical Concert Ticket" : "GRACIA - Jubilee Conference Pass";
  const passSerial = passId || `GRACIA-${isMusical ? 'MUS' : 'CONF'}-${Math.floor(100000 + Math.random() * 900000)}`;

  const walletApiKey = (
    process.env.WALLETWALLETI_API_KEY ||
    process.env.WALLET_API_KEY ||
    process.env.WALLETWALLETI_KEY ||
    ""
  ).trim();

  if (walletApiKey) {
    try {
      const response = await fetch("https://api.walletwallet.dev/api/passes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${walletApiKey}`
        },
        body: JSON.stringify({
          cardTitle: "Jesus Youth Singapore",
          header: "Jesus Youth Singapore",
          subheader: passTypeLabel,
          hexBackgroundColor: "#1B0F2B",
          appleFontColor: "#FFFFFF",
          logoText: "Jesus Youth Singapore",
          barcodeValue: passSerial,
          barcodeFormat: "QR",
          primaryFields: [
            { label: "PASS TYPE", value: passTypeLabel }
          ],
          secondaryFields: [
            { label: "PARTICIPANT", value: name || "Participant" },
            { label: "DATE & TIME", value: isMusical ? "11 Oct 2026 • 7:30 PM" : "10-11 Oct 2026 • 9:00 AM" }
          ],
          auxiliaryFields: [
            { label: "VENUE", value: isMusical ? "Agape Village, Main Auditorium" : "MPH, Agape Village, Singapore" },
            { label: "PASS ID", value: passSerial }
          ]
        })
      });

      if (response.ok) {
        const passData = await response.json();
        if (passData.shareUrl || passData.applePass) {
          return res.status(200).json({
            status: "success",
            provider: "walletwallet",
            shareUrl: passData.shareUrl,
            applePass: passData.applePass,
            googleSaveUrl: passData.googleSaveUrl,
            serialNumber: passData.serialNumber
          });
        }
      } else {
        const errText = await response.text();
        console.warn("[WalletWallet API warning]:", response.status, errText);
      }
    } catch (err: any) {
      console.error("WalletWallet API request error:", err);
    }
  }

  return res.status(200).json({
    status: "notice",
    provider: "none",
    message: "WalletWallet API key is required for instant signed Apple & Google Wallet pass links.",
    hint: "Set WALLETWALLETI_API_KEY in Vercel Environment Variables with your WalletWallet API Key (from walletwallet.dev)."
  });
}
