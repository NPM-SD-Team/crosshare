import { ConstructOrUploadPage } from '../components/ConstructOrUploadPage.js';
import { withStaticTranslation } from '../lib/translation.js';
import {
  AuthProps,
  requiresAdmin,
  //requiresAuth,
} from '../components/AuthHelpers.js';

export const getStaticProps = withStaticTranslation(() => {
  return { props: {} };
});

// This page should be locked to people with only admin privileges, as it allows uploading of new puzzles to the database.
export default requiresAdmin(ConstructorPage);

// This function calls for the ConstructOrUploadPage component and gets the necessary html depending on it's 'isUpload' boolean.
function ConstructorPage() {
  return <ConstructOrUploadPage key="constructor" isUpload={false} />;
}
