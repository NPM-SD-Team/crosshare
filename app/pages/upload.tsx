import { ConstructOrUploadPage } from '../components/ConstructOrUploadPage.js';
import { withStaticTranslation } from '../lib/translation.js';
import {
  requiresAdmin,
  //requiresAuth,
} from '../components/AuthHelpers.js';

export const getStaticProps = withStaticTranslation(() => {
  return { props: {} };
});

// This page should be locked to people with only admin privileges, as it allows uploading of new puzzles to the database.
export default requiresAdmin(UploadPage);

// This function calls for the ConstructOrUploadPage component and gets the necessary html depending on it's 'isUpload' boolean.
function UploadPage() {
  return <ConstructOrUploadPage key="upload" isUpload={true} />;
}
