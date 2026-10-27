import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type { Root } from 'hast';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useContext } from 'react';
import { AuthContext } from '../components/AuthContext.js';
import { I18nTags } from '../components/I18nTags.js';
import { Markdown } from '../components/Markdown.js';
import { LinkablePuzzle, PuzzleResultLink } from '../components/PuzzleLink.js';
import { DefaultTopBar } from '../components/TopBar.js';
import { UnfinishedPuzzleList } from '../components/UnfinishedPuzzleList.js';
import { ArticleT, validate } from '../lib/article.js';
import { ConstructorPageBarebones } from '../lib/constructorPage.js';
import { AdminSettingsV } from '../lib/dbtypes.js';
import { getCollection } from '../lib/firebaseAdminWrapper.js';
import { markdownToHast } from '../lib/markdown/markdown.js';
import { paginatedPuzzles } from '../lib/paginatedPuzzles.js';
import { isUserPatron } from '../lib/patron.js';
import { userIdToPage } from '../lib/serverOnly.js';
import { withTranslation } from '../lib/translation.js';
import { PAGE_SIZE } from './featured/[pageNumber].js';
// eslint-disable-next-line css-modules/no-unused-class
import styles from './index.module.scss';

type HomepagePuz = LinkablePuzzle & {
  constructorPage: ConstructorPageBarebones | null;
  constructorIsPatron: boolean;
};

interface HomePageProps {
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
  return {
    props: {
      announcement,
      homepageText,
      newest: newest,
      articles,
    },
  };
};

export const getServerSideProps = withTranslation(gssp);

export default function HomePage({
  announcement,
  newest: newest,
}: HomePageProps) {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  //just the newsest puzzle out of the newest filtered list
  const todaysPuzzle = newest[0];
  const title = t`Crosshare - Free Crossword Constructor and Daily Mini Crossword Puzzles`;
  return (
    <>
      <Head>
        <title>{title}</title>
        <I18nTags locale={router.locale || 'en'} canonicalPath="/" />
      </Head>

      <DefaultTopBar />

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
        <div className="marginBottom1em">
          {todaysPuzzle ? (
            <div>
              <h2>
                {/*This is the type of ' you can use in html code*/}
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
          {/* <div className="flex50">
            <CreateShareSection halfWidth={true} />
          </div> */}
        </div>
        {user && !user.isAnonymous ? (
          <>
            <hr className="margin2em0" />
            <UnfinishedPuzzleList user={user} />
          </>
        ) : (
          ''
        )}
        <hr className="margin2em0" />
        <h2 className="marginBottom0">
          <Trans>Newest Puzzles</Trans>
        </h2>
        {newest.map((p, i) => (
          <PuzzleResultLink
            key={i}
            puzzle={p}
            showDate={true}
            constructorPage={p.constructorPage}
            showAuthor={true}
            constructorIsPatron={p.constructorIsPatron}
            filterTags={[]}
          />
        ))}
        <hr className="margin2em0" />
      </div>
    </>
  );
}
