import { type DecodedIdToken, getAuth } from 'firebase-admin/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getClient } from '../../../lib/email.js';
import { getAdminApp } from '../../../lib/firebaseAdminWrapper.js';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: 'POST only' });
    return;
  }

  const authorization = req.headers.authorization;
  const token = authorization?.match(/^Bearer[ \t]+(\S+)$/i)?.[1];
  if (!token) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  let claims: DecodedIdToken;
  try {
    claims = await getAuth(getAdminApp()).verifyIdToken(token);
  } catch (error) {
    console.warn('Invalid authentication token for admin test email', error);
    res.status(401).json({ message: 'Invalid authentication token' });
    return;
  }

  if (claims.admin !== true) {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  if (!claims.email) {
    res.status(400).json({ message: 'Admin account has no email address' });
    return;
  }

  try {
    const client = await getClient();
    await client.sendMail({
      from: 'Nebraska Public Media Labs <labs@nebraskapublicmedia.org>',
      to: claims.email,
      subject: 'Crosshare SMTP test',
      text: 'This is a test email from the Crosshare admin page.',
    });
    res.status(200).json({ message: 'Test email sent' });
  } catch (error) {
    console.error('Failed to send admin test email', error);
    res.status(500).json({ message: 'Failed to send test email' });
  }
}
