import { Trans } from '@lingui/react/macro';
import { useRouter } from 'next/router';
import styles from './DailyPuzzle.module.scss';
import { BLOCK, DailyPuzzlePuzzle } from '../lib/types.js';
import { slugify } from '../lib/utils.js';

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

const isBlock = (
  grid: string[],
  r: number,
  c: number,
  rows: number,
  cols: number
) =>
  r < 0 ||
  c < 0 ||
  r >= rows ||
  c >= cols ||
  grid[r * cols + c] === undefined ||
  grid[r * cols + c] === BLOCK;

/** Standard crossword numbering: a cell is numbered if a word starts there */
function numberGrid(
  grid: string[],
  rows: number,
  cols: number
): (number | null)[][] {
  const numbers: (number | null)[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(null)
  );
  let number = 0;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (isBlock(grid, r, c, rows, cols)) continue;

      const startsAcross =
        isBlock(grid, r, c - 1, rows, cols) &&
        !isBlock(grid, r, c + 1, rows, cols);
      const startsDown =
        isBlock(grid, r - 1, c, rows, cols) &&
        !isBlock(grid, r + 1, c, rows, cols);

      if (startsAcross || startsDown) {
        numbers[r]![c] = ++number;
      }
    }
  }

  return numbers;
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

export const DailyPuzzle = ({
  puzzle,
  label,
}: {
  puzzle: DailyPuzzlePuzzle;
  label: string;
}) => {
  const { locale } = useRouter();

  const date = puzzle.publishTime;
  const author = puzzle.authorName;

  const rows = puzzle.size.rows !== undefined ? puzzle.size.rows : 5;
  const cols = puzzle.size.cols !== undefined ? puzzle.size.cols : 5;
  const numbers = numberGrid(puzzle.grid, rows, cols);

  const highlighted = new Set<string>();
  let activeKey = '';
  const clue = puzzle.clues[0];
  if (clue) {
    for (let r = 0; r < rows && !activeKey; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (numbers[r]?.[c] !== clue.num) continue;

        const startsClue =
          clue.dir === 0
            ? isBlock(puzzle.grid, r, c - 1, rows, cols) &&
              !isBlock(puzzle.grid, r, c + 1, rows, cols)
            : isBlock(puzzle.grid, r - 1, c, rows, cols) &&
              !isBlock(puzzle.grid, r + 1, c, rows, cols);
        if (!startsClue) continue;

        activeKey = `${r}-${c}`;
        const [dr, dc] = clue.dir === 0 ? [0, 1] : [1, 0];
        for (
          let rr = r, cc = c;
          !isBlock(puzzle.grid, rr, cc, rows, cols);
          rr += dr, cc += dc
        ) {
          highlighted.add(`${rr}-${cc}`);
        }
        break;
      }
    }
  }

  const PrintHref = () => {
    window.location.href = `/api/pdf/${puzzle.id}${''}`;
  };
  const url = `/puzzles/${puzzle.id}/${slugify(puzzle.title)}`;
  const PlayHref = () => {
    window.location.href = url;
  };
  return (
    <div className={styles.card}>
      <div
        className={styles.board}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        aria-hidden="true"
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const key = `${r}-${c}`;
            const num = numbers[r]?.[c];
            if (isBlock(puzzle.grid, r, c, rows, cols)) {
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
            {label} · {cols}×{rows}
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
            {puzzle.clues[0]?.num}{' '}
            {puzzle.clues[0]?.dir === 0 ? (
              <Trans>Across</Trans>
            ) : (
              <Trans>Down</Trans>
            )}
          </div>
          <div className={styles.clueText}>{puzzle.clues[0]?.clue}</div>
        </div>

        <div className={styles.buttons}>
          <button type="button" className={styles.play} onClick={PlayHref}>
            <PlayIcon />
            <Trans>Play today&apos;s puzzle</Trans>
          </button>

          <button type="button" className={styles.print} onClick={PrintHref}>
            <PrintIcon />
            <Trans>Print</Trans>
          </button>
        </div>
      </div>
    </div>
  );
};
