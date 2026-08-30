import type { VercelRequest, VercelResponse } from '@vercel/node';
import sendConfirmationEmailHandler from './send-confirmation-email.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Delegate registration processing and multi-attendee pass dispatch to sendConfirmationEmailHandler
  return sendConfirmationEmailHandler(req, res);
}
