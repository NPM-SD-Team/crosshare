import { Trans } from '@lingui/react/macro';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import styles from './DailyPuzzle.module.scss';

/*
 * Daily puzzle feature card (display only).
 *
 * For devs wiring up real data: pass `puzzle`. Until then the card shows
 * SAMPLE_DAILY_PUZZLE below. The grid's clue numbers and the highlighted
 * entry are worked out from `grid` and `clue`, so only the raw grid is needed.
 * The Play and Print buttons don't do anything yet (see the TODOs).
 */

export interface DailyPuzzleData {
  title: string;
  author: string;
  /** Badge text, e.g. "Daily Mini" */
  label: string;
  /** Publish date; when left out, today's date is shown */
  date?: Date;
  /** One string per row: '#' is a block, anything else is an open cell */
  grid: string[];
  /** The clue shown in the card; its entry is highlighted in the grid */
  clue: { number: number; direction: 'across' | 'down'; text: string };
}

/** PLACEHOLDER: remove once real data is passed in. */
export const SAMPLE_DAILY_PUZZLE: DailyPuzzleData = {
  title: 'In My Reptile Era',
  author: 'Sophia Strong',
  label: 'Daily Mini',
  grid: ['#....', '#....', '.....', '....#', '....#'],
  clue: {
    number: 1,
    direction: 'across',
    text: 'A strong reaction to seeing a snake',
  },
};

const isBlock = (grid: string[], r: number, c: number) =>
  r < 0 ||
  c < 0 ||
  r >= grid.length ||
  c >= (grid[r]?.length ?? 0) ||
  grid[r]?.[c] === '#';

/** Standard crossword numbering: a cell is numbered if a word starts there */
function numberGrid(grid: string[]): (number | null)[][] {
  let n = 0;
  return grid.map((row, r) =>
    [...Array(row.length).keys()].map((c) => {
      if (isBlock(grid, r, c)) return null;
      const startsAcross = isBlock(grid, r, c - 1) && !isBlock(grid, r, c + 1);
      const startsDown = isBlock(grid, r - 1, c) && !isBlock(grid, r + 1, c);
      return startsAcross || startsDown ? ++n : null;
    })
  );
}

const PlayIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
  </svg>
);

const PrintIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
  </svg>
);

export const DailyPuzzle = (props: { puzzle?: DailyPuzzleData }) => {
  const puzzle = props.puzzle ?? SAMPLE_DAILY_PUZZLE;
  const { locale } = useRouter();

  // Today's date depends on the viewer's clock, so only fill it in after
  // mounting in the browser (avoids a server/client mismatch).
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    setToday(new Date());
  }, []);
  const date = puzzle.date ?? today;
  const author = puzzle.author;

  const rows = puzzle.grid.length;
  const cols = Math.max(...puzzle.grid.map((r) => r.length));
  const numbers = numberGrid(puzzle.grid);

  // Find the clue's entry: its start cell, then extend until a block
  const highlighted = new Set<string>();
  let activeKey = '';
  numbers.forEach((row, r) => {
    row.forEach((num, c) => {
      if (num !== puzzle.clue.number) return;
      activeKey = `${r}-${c}`;
      const [dr, dc] = puzzle.clue.direction === 'across' ? [0, 1] : [1, 0];
      for (
        let rr = r, cc = c;
        !isBlock(puzzle.grid, rr, cc);
        rr += dr, cc += dc
      ) {
        highlighted.add(`${rr}-${cc}`);
      }
    });
  });

  return (
    <div className={styles.card}>
      <div
        className={styles.board}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        aria-hidden="true"
      >
        {puzzle.grid.flatMap((_, r) =>
          [...Array(cols).keys()].map((c) => {
            const key = `${r}-${c}`;
            const num = numbers[r]?.[c];
            if (isBlock(puzzle.grid, r, c)) {
              return <span key={key} className={styles.block} />;
            }
            return (
              <span
                key={key}
                className={styles.cell}
                data-active={key === activeKey}
                data-highlighted={highlighted.has(key)}
              >
                {num ? <span className={styles.cellNum}>{num}</span> : ''}
              </span>
            );
          })
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.topRow}>
          <span className={styles.label}>
            {puzzle.label} · {cols}×{rows}
          </span>
          <span className={styles.date}>
            {date ? new Intl.DateTimeFormat(locale ?? 'en').format(date) : ' '}
          </span>
        </div>

        <h3 className={styles.title}>{puzzle.title}</h3>
        <p className={styles.by}>
          <Trans comment="The variable is the name of the puzzle's constructor">
            By {author}
          </Trans>
        </p>

        <div className={styles.clue}>
          <div className={styles.clueLabel}>
            {puzzle.clue.number}{' '}
            {puzzle.clue.direction === 'across' ? (
              <Trans>Across</Trans>
            ) : (
              <Trans>Down</Trans>
            )}
          </div>
          <div className={styles.clueText}>{puzzle.clue.text}</div>
        </div>

        <div className={styles.buttons}>
          {/* TODO: link to today's puzzle */}
          <button type="button" className={styles.play}>
            <PlayIcon />
            <Trans>Play today&apos;s puzzle</Trans>
          </button>
          {/* TODO: hook up printing */}
          <button type="button" className={styles.print}>
            <PrintIcon />
            <Trans>Print</Trans>
          </button>
        </div>
      </div>
    </div>
  );
};
