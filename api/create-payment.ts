import type { VercelRequest, VercelResponse } from '@vercel/node';
import hitpayHandler from './hitpay';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  req.query.path = 'create-payment';
  return hitpayHandler(req, res);
}
