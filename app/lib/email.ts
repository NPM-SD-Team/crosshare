import { toHtml } from 'hast-util-to-html';
import { getUser } from './firebaseAdminWrapper.js';
import { markdownToHast } from './markdown/markdown.js';
import { UnsubscribeFlags } from './prefs.js';
import { getSig } from './subscriptions.js';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export async function getAddress(userId: string): Promise<string | undefined> {
  try {
    const user = await getUser(userId);
    return user.email;
  } catch (e) {
    console.log(e);
    console.warn('error getting user ', userId);
    return undefined;
  }
}

export type EmailClient = Transporter;

export async function getClient() {
  // These settings come from the server environment, not from browser code.
  const { SMTP_HOST, SMTP_PORT } = process.env;

  if (!SMTP_HOST || !SMTP_PORT) {
    throw new Error('SMTP_HOST, SMTP_PORT must be configured');
  }

  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port number');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: port,
    // since no username or password is sent the SMTP relay must allow this server.
  });
}

export const RATE_LIMIT = 13;

export const emailLink = (campaign: string, linkTo: string) =>
  `https://labs.nebraskapublicmedia.org/crosswords/${linkTo}#utm_source=crosshare&utm_medium=email&utm_campaign=${campaign}`;

const tagsToReplace: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

function replaceTag(tag: string) {
  return tagsToReplace[tag] || tag;
}

function safeForHtml(str: string) {
  return str.replace(/[&<>]/g, replaceTag);
}

export async function sendEmail({
  client,
  userId,
  subject,
  markdown,
  oneClickUnsubscribeTag,
  campaign,
  footerText,
  email,
}: {
  client: EmailClient;
  userId: string;
  email?: string;
  subject: string;
  markdown: string;
  oneClickUnsubscribeTag: keyof typeof UnsubscribeFlags;
  campaign: string;
  footerText?: string;
}) {
  const toAddress = email || (await getAddress(userId));
  if (!toAddress) {
    console.warn('missing to address for ', userId);
    return;
  }

  const sig = await getSig(userId);
  const link = emailLink(campaign, `subscription?u=${userId}&s=${sig}`);
  // Add a signed settings link so the recipient can manage email preferences.
  markdown =
    markdown.trim() +
    `\n\n\n\n---\n\nTo unsubscribe or manage your preferences [click here](${link})${
      footerText ? '. ' + footerText : ''
    }`;

  function buildHtmlBody(subject: string, markdown: string) {
    return `<!DOCTYPE html>
          <html>
          <head>
          <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
          <title>${safeForHtml(subject || 'NPM crosswords Notifications')}</title>
          </head>
          <body>
          ${toHtml(
            markdownToHast({
              text: markdown,
              leaveEmoji: true,
            })
          )}
          </body>
          </html>`;
  }

  const htmlBody = {
    Data: buildHtmlBody(subject, markdown),
  };

  return client.sendMail({
    from: 'Nebraska Public Media Labs <labs@nebraskapublicmedia.org>',
    to: toAddress,
    subject,
    // Send both formats so the message works in HTML and text-only email apps.
    text: markdown,
    html: htmlBody.Data,
    headers: {
      'List-Unsubscribe': `<https://labs.nebraskapublicmedia.org/crosswords/api/subscription?u=${userId}&s=${sig}&f=${oneClickUnsubscribeTag}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}
