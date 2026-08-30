import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const { senderName, senderEmail, queryMessage } = req.body || {};
  if (!queryMessage) {
    return res.status(400).json({ status: "error", message: "queryMessage is required" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `You are an AI Communications Assistant for Jesus Youth Singapore and GRACIA (25th Jubilee Celebration).
Your task is to draft a warm, polite, welcoming, and helpful response to an inquiry sent by a visitor or participant.

Key Event Details:
- Movement: Jesus Youth Singapore (Catholic youth movement).
- Event Name: GRACIA - 25th Jubilee Celebration of Jesus Youth Singapore.
- Dates: October 10 & 11, 2026 (Saturday & Sunday).
- Main Highlights: GRACIA Conference (October 10 & 11, 2026) & GRACIA Musical Concert (October 11, 2026) in Singapore.
- Key Contact Email: singapore@jesusyouth.org
- Official Website: https://singapore.jesusyouth.org/

Instructions:
1. Address the sender warmly by name ("Dear ${senderName || 'Friend'}").
2. Answer their query clearly and concisely based on GRACIA details.
3. Keep the tone joyful, encouraging, professional, and faithful.
4. Include a warm sign-off:
   "In Christ,
   Jesus Youth Singapore GRACIA Conference Team"
5. Output ONLY plain text without code blocks.`;

    const prompt = `Sender Name: ${senderName || 'Participant'}
Sender Email: ${senderEmail || 'N/A'}
Inquiry Message:
"${queryMessage}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    const replyText = response.text || `Dear ${senderName || 'Friend'},\n\nThank you for contacting Jesus Youth Singapore regarding GRACIA! We have received your inquiry and our team will get back to you shortly.\n\nIn Christ,\nJesus Youth Singapore GRACIA Conference Team`;

    return res.status(200).json({ status: "success", replyText });
  } catch (err: any) {
    console.error("Error generating AI reply:", err);
    const fallbackText = `Dear ${senderName || 'Friend'},\n\nThank you for reaching out to the GRACIA organizing team!\n\nWe have received your query regarding "${queryMessage.slice(0, 60)}..." and will get back to you promptly.\n\nIn Christ,\nJesus Youth Singapore GRACIA Conference Team`;
    return res.status(200).json({ status: "success", replyText: fallbackText, isFallback: true });
  }
}
