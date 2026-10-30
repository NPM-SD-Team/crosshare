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

  // Check admin access on the server since a hidden admin button is not security
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
    try {
      // SMTP credentials and connections stay on the server

      await client.sendMail({
        from: 'Nebraska Public Media Labs <labs@nebraskapublicmedia.org>',
        to: claims.email,
        subject: 'NPM SMTP test',
        text: 'This is a test email from the NPM Games admin page.',
      });
      res.status(200).json({ message: 'Test email sent' });
    } catch (error) {
      console.error('Failed to send admin test email', error);
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : undefined;
      res.status(500).json({
        message: code
          ? `SMTP request failed (${code})`
          : 'Failed to send test email',
      });
    }
  } catch (error) {
    //if this fails its because the client refused
    console.error('Failed to get client', error);
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : undefined;
    res.status(501).json({
      message: code
        ? `SMTP client connection refused (${code})`
        : 'Failed to send test email',
    });
  }
}
