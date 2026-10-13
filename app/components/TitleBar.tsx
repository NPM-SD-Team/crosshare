/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import styles from './TitleBar.module.scss';

interface TitleBarProps {
  title: string;
  publishedAt: Date | string;
  author: string;
}

export default function TitleBar({
  title,
  publishedAt,
  author,
}: TitleBarProps) {
  const publicationDate = new Date(publishedAt);

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Link
          href="https://nebraskapublicmedia.org/"
          aria-label="Go to the NPM home page"
          className={styles.logoLink}
        >
          <img
            src="/Logo.png"
            alt=""
            width={36}
            height={36}
            className={styles.logo}
          />
        </Link>
        <div className={styles.titleDetails}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.author}>by {author}</p>
        </div>
      </div>

      <time
        className={styles.publishedDate}
        dateTime={publicationDate.toISOString()}
      >
        {publicationDate.toLocaleDateString(undefined, { dateStyle: 'short' })}
      </time>
    </header>
  );
}
