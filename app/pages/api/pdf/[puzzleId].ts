import { jsPDF } from 'jspdf';
import { readFile } from 'node:fs/promises';
import { NextApiRequest, NextApiResponse } from 'next';
import { join } from 'node:path';
import { getPuzzle } from '../../../lib/serverOnly.js';
import {
  Direction,
  PuzzleT,
  getClueText,
  puzzleFromDB,
} from '../../../lib/types.js';
import {
  ViewableEntry,
  ViewableGrid,
  addClues,
  fromCells,
} from '../../../lib/viewableGrid.js';

async function pathToBase64(path: string): Promise<string> {
  const image = await readFile(join(process.cwd(), 'public', path));
  return `data:image/png;base64,${image.toString('base64')}`;
}

function layoutPDFClues(
  doc: jsPDF,
  puzzle: PuzzleT,
  grid: ViewableGrid<ViewableEntry>,
  yOffset: number
) {
  const margin = 15;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;
  const gutter = 10; // between the A and D sections
  const subGutter = 5; // between the two columns inside each section
  const sectionW = (contentW - gutter) / 2;
  const subColW = (sectionW - subGutter) / 2;
  const acrossX = margin;
  const downX = margin + sectionW + gutter;
  const pageH = doc.internal.pageSize.getHeight();
  const footerH = 10;
  const headingH = 8;
  const cluesBottom = pageH - margin - footerH;
  const firstCluesTop = yOffset + grid.height + 10;
  const lineHeightFactor = doc.getLineHeightFactor();
  const pointsToMillimeters = 0.3528;

  //decompile the clues from the puzzle.clues into their root
  const clued = addClues(grid, puzzle.clues, (_c) => {
    return { type: 'root', children: [] };
  });
  const acrossEntries = clued.entries.filter(
    (e) => e.direction === Direction.Across
  );
  const acrossClues = acrossEntries.map((e) => ({
    label: e.labelNumber.toString(),
    clue: getClueText(e),
  }));
  const downEntries = clued.entries.filter(
    (e) => e.direction === Direction.Down
  );
  const downClues = downEntries.map((e) => ({
    label: e.labelNumber.toString(),
    clue: getClueText(e),
  }));

  //A list of clues wrapped by pagination
  type WrappedClue = { lines: string[] };
  //where you are in the iteration
  type ClueCursor = { clueIndex: number; lineIndex: number };

  //split clues by width so they go over to the left and right
  const wrapClues = (
    clues: { label: string; clue: string }[],
    width: number
  ): WrappedClue[] =>
    clues.map(({ label, clue }) => ({
      lines: doc.splitTextToSize(`${label}. ${clue}`, width),
    }));

  const availableHeight = (top: number) => cluesBottom - (top + headingH + 2);

  let cluesTop = firstCluesTop;
  const minLineHeight = 8 * lineHeightFactor * pointsToMillimeters;
  if (availableHeight(cluesTop) < minLineHeight) {
    doc.addPage();
    cluesTop = margin;
  }

  let fontSize = 12;
  let across: WrappedClue[];
  let down: WrappedClue[];
  let lineHeight: number;
  let linesPerColumn: number;

  //this loop will keep sizing down until the font size is a minimum 8 pts, to help fit better
  while (true) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    across = wrapClues(acrossClues, subColW);
    down = wrapClues(downClues, subColW);
    lineHeight = fontSize * lineHeightFactor * pointsToMillimeters;
    linesPerColumn = Math.max(
      1,
      Math.floor(availableHeight(cluesTop) / lineHeight)
    );
    if (
      (across.reduce((count, clue) => count + clue.lines.length, 0) <=
        linesPerColumn * 2 &&
        down.reduce((count, clue) => count + clue.lines.length, 0) <=
          linesPerColumn * 2) ||
      fontSize <= 10
    ) {
      break;
    }
    fontSize -= 0.5;
  }

  const flowClues = (
    clues: WrappedClue[],
    cursor: ClueCursor
  ): { cols: [string[], string[]]; next: ClueCursor } => {
    const cols: [string[], string[]] = [[], []];
    let col = 0;
    while (col < cols.length && cursor.clueIndex < clues.length) {
      const clue = clues[cursor.clueIndex];
      if (!clue) {
        throw new Error('clue index out of bounds');
      }
      const line = clue.lines[cursor.lineIndex];
      if (line === undefined) {
        cursor.clueIndex += 1;
        cursor.lineIndex = 0;
        continue;
      }

      const column = cols[col];
      if (!column) {
        throw new Error('clue column out of bounds');
      }
      column.push(line);
      cursor.lineIndex += 1;
      if (column.length === linesPerColumn) {
        col += 1;
      }
    }
    while (
      cursor.clueIndex < clues.length &&
      cursor.lineIndex === clues[cursor.clueIndex]?.lines.length
    ) {
      cursor.clueIndex += 1;
      cursor.lineIndex = 0;
    }
    return { cols, next: cursor };
  };

  const ACCENT: [number, number, number] = [22, 26, 100];
  let acrossCursor: ClueCursor = { clueIndex: 0, lineIndex: 0 };
  let downCursor: ClueCursor = { clueIndex: 0, lineIndex: 0 };
  let firstPage = true;
  do {
    if (!firstPage) {
      doc.addPage();
      cluesTop = margin;
      linesPerColumn = Math.max(
        1,
        Math.floor(availableHeight(cluesTop) / lineHeight)
      );
    }

    const acrossPage = flowClues(across, acrossCursor);
    const downPage = flowClues(down, downCursor);
    acrossCursor = acrossPage.next;
    downCursor = downPage.next;
    const cluesY = cluesTop + headingH;

    //headers
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...ACCENT);
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.4);
    doc.text('ACROSS', acrossX, cluesTop + 4);
    doc.line(acrossX, cluesTop + 6, acrossX + sectionW, cluesTop + 6);
    doc.text('DOWN', downX, cluesTop + 4);
    doc.line(downX, cluesTop + 6, downX + sectionW, cluesTop + 6);

    //the lines undernearth the headers
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(40);
    const drawLines = (lines: string[], x: number) => {
      if (lines.length) {
        doc.text(lines, x, cluesY + 2);
      }
    };
    drawLines(acrossPage.cols[0], acrossX);
    drawLines(acrossPage.cols[1], acrossX + subColW + subGutter);
    drawLines(downPage.cols[0], downX);
    drawLines(downPage.cols[1], downX + subColW + subGutter);

    //divider
    doc.setDrawColor(210);
    doc.setLineWidth(0.2);
    doc.line(
      margin + sectionW + gutter / 2,
      cluesTop,
      margin + sectionW + gutter / 2,
      cluesBottom
    );

    //footer
    doc.line(margin, pageH - margin - 4, pageW - margin, pageH - margin - 4);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      'labs.nebraskapublicmedia.org/crosswords',
      pageW / 2,
      pageH - margin + 1,
      { align: 'center' }
    );
    firstPage = false;
  } while (
    acrossCursor.clueIndex < across.length ||
    downCursor.clueIndex < down.length
  );
}

function layoutPDFGrid(
  doc: jsPDF,
  y: number,
  puzzle: PuzzleT,
  grid: ViewableGrid<ViewableEntry>
): number {
  const PointsToMillimeters = 0.3528;
  const squareSize = Math.min(
    24,
    (360 / puzzle.size.rows) * PointsToMillimeters,
    (360 / puzzle.size.cols) * PointsToMillimeters
  );
  const pageW = doc.internal.pageSize.getWidth();
  const format = {
    squareSize: squareSize,
    gridOrigin: { x: pageW / 2 - (squareSize * puzzle.size.rows) / 2, y: y },
    labelOffset: { x: squareSize / 24, y: squareSize / 4 },
    labelFontSize: squareSize / PointsToMillimeters / 3.5,
    lineWidth: 0.5,
    barWidth: 4,
  };
  // Draw grid
  doc.setDrawColor(0);
  doc.setLineWidth(format.lineWidth);
  for (let i = 0; i < puzzle.size.rows; i++) {
    for (let j = 0; j < puzzle.size.cols; j++) {
      const square = i * puzzle.size.cols + j;
      const circled = puzzle.cellStyles.circle?.includes(square);
      const shaded = puzzle.cellStyles.shade?.includes(square);
      const hidden = puzzle.hidden.includes(square);
      const barRight = puzzle.vBars.includes(square);
      const barBottom = puzzle.hBars.includes(square);
      doc.setFillColor(
        puzzle.grid[square] === '.'
          ? 'rgb(53, 63, 89)'
          : shaded
            ? '#DDD'
            : 'white'
      );
      if (!hidden) {
        doc.rect(
          format.gridOrigin.x + j * format.squareSize,
          format.gridOrigin.y + i * format.squareSize,
          format.squareSize,
          format.squareSize,
          'FD'
        );
      }
      if (barRight) {
        doc.setLineWidth(format.barWidth);
        doc.line(
          format.gridOrigin.x + (j + 1) * format.squareSize,
          format.gridOrigin.y + i * format.squareSize,
          format.gridOrigin.x + (j + 1) * format.squareSize,
          format.gridOrigin.y + (i + 1) * format.squareSize
        );
        doc.setLineWidth(format.lineWidth);
      }
      if (barBottom) {
        doc.setLineWidth(format.barWidth);
        doc.line(
          format.gridOrigin.x + j * format.squareSize,
          format.gridOrigin.y + (i + 1) * format.squareSize,
          format.gridOrigin.x + (j + 1) * format.squareSize,
          format.gridOrigin.y + (i + 1) * format.squareSize
        );
        doc.setLineWidth(format.lineWidth);
      }
      if (circled) {
        doc.circle(
          format.gridOrigin.x + (j + 0.5) * format.squareSize,
          format.gridOrigin.y + (i + 0.5) * format.squareSize,
          format.squareSize / 2,
          'S'
        );
      }
    }
  }
  // Label grid
  doc.setFont('helvetica');
  doc.setFontSize(format.labelFontSize);
  for (let i = 0; i < puzzle.size.rows; i++) {
    for (let j = 0; j < puzzle.size.cols; j++) {
      const number = grid.cellLabels.get(i * puzzle.size.cols + j);
      if (number) {
        doc.text(
          number.toString(),
          format.gridOrigin.x + j * format.squareSize + format.labelOffset.x,
          format.gridOrigin.y + i * format.squareSize + format.labelOffset.y
        );
      }
    }
  }
  return squareSize;
}

async function layoutPDFInfo(doc: jsPDF, puzzle: PuzzleT) {
  const logoSize = 22;
  const margin = 15;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;
  const ACCENT: [number, number, number] = [22, 26, 100];
  const LOGO = await pathToBase64('NPM_Logo.png');
  doc.addImage(LOGO, 'PNG', margin, margin, logoSize, logoSize);
  doc.setFont('helvetica');
  doc.setFontSize(18);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const title: string[] = doc.splitTextToSize(
    puzzle.title,
    doc.internal.pageSize.width - 100
  );
  const textX = margin + logoSize + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...ACCENT);
  doc.text(title, textX, margin + 9, {
    maxWidth: contentW - logoSize - 6,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(createPublishedByLine(puzzle), textX, margin + 18);
  const ruleY = margin + logoSize + 5;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(margin, ruleY, pageW - margin, ruleY);
  return ruleY + 5;
}

function createPublishedByLine(puzzle: PuzzleT) {
  let authorText;
  if (puzzle.guestConstructor) {
    authorText = `By ${puzzle.guestConstructor} - Published by ${puzzle.authorName}`;
  } else {
    authorText = `By ${puzzle.authorName} - Published`;
  }
  return authorText;
}

async function getPdf(puzzle: PuzzleT): Promise<ArrayBuffer> {
  console.log('Generating pdf for ' + puzzle.title);

  const grid = fromCells({
    mapper: (e) => e,
    width: puzzle.size.cols,
    height: puzzle.size.rows,
    cells: puzzle.grid,
    allowBlockEditing: false,
    cellStyles: new Map<string, Set<number>>(
      Object.entries(puzzle.cellStyles).map(([k, v]) => [k, new Set(v)])
    ),
    vBars: new Set(puzzle.vBars),
    hBars: new Set(puzzle.hBars),
    hidden: new Set(puzzle.hidden),
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.setProperties({
    title: puzzle.title,
    creator: 'labs.nebraskapublicmedia.org/crosswords',
    author: puzzle.authorName,
  });
  const headerEnd = await layoutPDFInfo(pdf, puzzle);
  const squareSize = layoutPDFGrid(pdf, headerEnd, puzzle, grid);
  layoutPDFClues(pdf, puzzle, grid, squareSize + headerEnd + 100);
  return pdf.output('arraybuffer');
}

export default async function pdf(req: NextApiRequest, res: NextApiResponse) {
  const { puzzleId, slate } = req.query;
  if (Array.isArray(puzzleId) || !puzzleId) {
    res.status(404).json({ statusCode: 404, message: 'bad puzzle params' });
    return;
  }
  const puzzle = await getPuzzle(puzzleId);
  if (!puzzle) {
    res.status(404).json({ statusCode: 404, message: 'failed to get puzzle' });
    return;
  }
  const isSlate = slate != undefined && slate.length != 0;
  if (isSlate && puzzle.pdf_override) {
    res.redirect(301, puzzle.pdf_override);
    return;
  }
  const fromDB = puzzleFromDB(puzzle, puzzleId);
  if (puzzle.pk) {
    res
      .status(403)
      .json({ statusCode: 403, message: 'no pdfs for pack puzzles' });
    return;
  }

  res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');
  res.setHeader(
    'Content-Disposition',
    'inline; filename="' + puzzle.a.replace(' ', '_') + '.pdf"'
  );
  res.writeHead(200, { 'Content-Type': 'application/pdf' });
  res.end(Buffer.from(await getPdf(fromDB)));
}
