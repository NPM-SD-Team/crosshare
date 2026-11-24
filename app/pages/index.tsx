import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type { Root } from 'hast';
import { DailyPuzzlePuzzle, puzzleFromDB } from '../lib/types.js';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useContext } from 'react';
import { AuthContext } from '../components/AuthContext.js';
import { I18nTags } from '../components/I18nTags.js';
import { Markdown } from '../components/Markdown.js';
import {
  LinkablePuzzle,
  PuzzleResultLink,
  PuzzleResultGhostLink,
} from '../components/PuzzleLink.js';
import { DailyPuzzle } from '../components/DailyPuzzle.js';
import { DefaultTopBar } from '../components/TopBar.js';
import ParentWebsiteHeader from '../components/ParentWebsiteHeader.js';
// import { PuzzleCalendar } from '../components/PuzzleCalendar.js';
import { UnfinishedPuzzleList } from '../components/UnfinishedPuzzleList.js';
import { ArticleT, validate } from '../lib/article.js';
import { ConstructorPageBarebones } from '../lib/constructorPage.js';
import { AdminSettingsV } from '../lib/dbtypes.js';
import { getCollection } from '../lib/firebaseAdminWrapper.js';
import { markdownToHast } from '../lib/markdown/markdown.js';
import { paginatedPuzzles } from '../lib/paginatedPuzzles.js';
import { isUserPatron } from '../lib/patron.js';
import { getPuzzle, userIdToPage } from '../lib/serverOnly.js';
import { withTranslation } from '../lib/translation.js';
import { PAGE_SIZE } from './featured/[pageNumber].js';
// eslint-disable-next-line css-modules/no-unused-class
import styles from './index.module.scss';

type HomepagePuz = LinkablePuzzle & {
  constructorPage: ConstructorPageBarebones | null;
  constructorIsPatron: boolean;
};

interface HomePageProps {
  dailyPuzzle: DailyPuzzlePuzzle | null;
  newest: HomepagePuz[];
  announcement: { title: string; body: Root } | null;
}

const gssp: GetServerSideProps<HomePageProps> = async ({ res }) => {
  const [announcement, homepageText]: [
    { title: string; body: Root } | null,
    Root | null,
  ] = await getCollection('settings')
    .doc('settings')
    .get()
    .then((res) => {
      if (!res.exists) {
        return [null, null];
      }
      const a = AdminSettingsV.decode(res.data());
      if (a._tag === 'Right') {
        return [
          a.right.announcement
            ? {
                ...a.right.announcement,
                body: markdownToHast({ text: a.right.announcement.body }),
              }
            : null,
          a.right.homepageText
            ? markdownToHast({ text: a.right.homepageText })
            : null,
        ];
      } else {
        console.error('malformed settings doc');
        return [null, null];
      }
    });

  const unfilteredArticles = await getCollection('a')
    .where('f', '==', true)
    .get()
    .then((articlesResult) => {
      return articlesResult.docs.map((d) => validate(d.data()));
    });
  const articles: ArticleT[] = unfilteredArticles.filter((i): i is ArticleT => {
    return i !== null;
  });

  const [puzzlesWithoutConstructor] = await paginatedPuzzles(0, PAGE_SIZE);
  const newest = await Promise.all(
    puzzlesWithoutConstructor.map(async (p) => ({
      ...p,
      constructorPage: await userIdToPage(p.authorId),
      constructorIsPatron: await isUserPatron(p.authorId),
    }))
  );

  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');

  const todaysPuzzle = newest[0];
  let dailyPuzzle: DailyPuzzlePuzzle | null = null;

  //get the puzzle data
  if (todaysPuzzle) {
    const dbPuzzle = await getPuzzle(todaysPuzzle.id);
    if (dbPuzzle) {
      const puzzle = puzzleFromDB(dbPuzzle, dbPuzzle.id);
      dailyPuzzle = {
        id: dbPuzzle.id,
        title: puzzle.title,
        authorName: puzzle.authorName,
        publishTime: puzzle.publishTime,
        grid: puzzle.grid,
        clues: puzzle.clues,
        size: puzzle.size,
      };
    }
  }
  return {
    props: {
      dailyPuzzle,
      announcement,
      homepageText,
      newest: newest,
      articles,
    },
  };
};

export const getServerSideProps = withTranslation(gssp);

export default function HomePage({
  dailyPuzzle,
  announcement,
  newest: newest,
}: HomePageProps) {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  //just the newsest puzzle out of the newest filtered list
  // (unused while <DailyPuzzle /> shows sample data; uncomment with the old block)

  const title = t`Daily Crossword Puzzles | Nebraska Public Media`;
  const timestampMinus6Days = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let NewestLastSixDays: HomepagePuz[] = [];
  let OlderLastSixDays: HomepagePuz[] = [];
  newest.forEach((puzzle) => {
    if (
      puzzle.publishTime >= timestampMinus6Days ||
      (puzzle.isPrivateUntil && puzzle.isPrivateUntil >= timestampMinus6Days)
    ) {
      NewestLastSixDays.push(puzzle);
    } else {
      OlderLastSixDays.push(puzzle);
    }
  });
  return (
    <>
      <Head>
        <title>{title}</title>
        <I18nTags locale={router.locale || 'en'} canonicalPath="/" />
      </Head>
      <div style={{ position: 'sticky', top: '0', zIndex: '99' }}>
        <DefaultTopBar />
        <ParentWebsiteHeader />
      </div>

      <div className="margin1em">
        {announcement ? (
          <div className={styles.campaign}>
            <h3>
              <span className="colorError">{announcement.title}</span>
            </h3>
            <div>
              <Markdown hast={announcement.body} />
            </div>
          </div>
        ) : (
          ''
        )}
        {/* caps the page content at 3 puzzle cards across and centers it */}
        <div className={styles.np_container}>
          <div className="marginBottom1em">
            {/* Old Today's Puzzle (swap back by uncommenting and removing <DailyPuzzle />)
            {todaysPuzzle ? (
              <div>
                <h2>
                  <Trans>Today&apos;s Puzzle</Trans>
                </h2>
                <PuzzleResultLink
                  fullWidth
                  puzzle={todaysPuzzle}
                  showAuthor={true}
                  constructorPage={todaysPuzzle.constructorPage}
                  constructorIsPatron={todaysPuzzle.constructorIsPatron}
                  filterTags={[]}
                />
              </div>
            ) : (
              ''
            )}
            */}
            {/* Display only for now: shows sample data until `puzzle` is passed in */}
            <h2 className={styles.np_sectionTitle}>
              <Trans>Today&apos;s Puzzle</Trans>
            </h2>

            {dailyPuzzle !== null ? (
              <DailyPuzzle puzzle={dailyPuzzle} label="Daily" />
            ) : (
              ''
            )}

            {/* <div className="flex50">
              <CreateShareSection halfWidth={true} />
            </div> */}
          </div>
          {user && !user.isAnonymous ? (
            <>
              <hr className="margin2em0" />
              <div className={styles.np_panel}>
                <UnfinishedPuzzleList user={user} />
              </div>
            </>
          ) : (
            ''
          )}
          <hr className="margin2em0" />
          {/* Display only for now: shows sample data until `days` is passed in */}
          {/* <div className={styles.np_calendarSection}>
            <PuzzleCalendar />
          </div> */}
          {/* <h2 className="marginBottom0">
            <Trans>Newest Puzzles</Trans>
          </h2> */}
          <h2 className={styles.np_sectionTitle}>
            <Trans>Recent Puzzles</Trans>
          </h2>
          <div className={styles.np_panel}>
            {user && !user.isAnonymous
              ? newest.map((p, i) =>
                  i !== 0 ? (
                    <div className={styles.np_card}>
                      <PuzzleResultLink
                        key={i}
                        puzzle={p}
                        showDate={true}
                        constructorPage={p.constructorPage}
                        showAuthor={true}
                        constructorIsPatron={p.constructorIsPatron}
                        filterTags={[]}
                      />
                    </div>
                  ) : (
                    ''
                  )
                )
              : NewestLastSixDays.map((p, i) =>
                  i !== 0 ? (
                    <div className={styles.np_card}>
                      <PuzzleResultLink
                        key={i}
                        puzzle={p}
                        showDate={true}
                        constructorPage={p.constructorPage}
                        showAuthor={true}
                        constructorIsPatron={p.constructorIsPatron}
                        filterTags={[]}
                      />
                    </div>
                  ) : (
                    ''
                  )
                )}
          </div>

          {!user || user.isAnonymous ? (
            <div className="margin2em0">
              <h2 className="marginBottom0">
                <a href="/account" target="_blank" rel="noopener noreferrer">
                  Create an account or login to see more
                </a>
              </h2>
              <div className={styles.np_panel}>
                {OlderLastSixDays.map((p, i) => (
                  <div className={styles.np_card}>
                    <PuzzleResultGhostLink
                      key={i}
                      puzzle={p}
                      showDate={true}
                      constructorPage={p.constructorPage}
                      showAuthor={true}
                      constructorIsPatron={p.constructorIsPatron}
                      filterTags={[]}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            ''
          )}
          <hr className="margin2em0" />
        </div>
      </div>
    </>
  );
}
