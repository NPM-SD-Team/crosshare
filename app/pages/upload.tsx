import { ConstructOrUploadPage } from '../components/ConstructOrUploadPage.js';
import { withStaticTranslation } from '../lib/translation.js';
import {
  requiresAdmin,
  //requiresAuth,
} from '../components/AuthHelpers.js';

export const getStaticProps = withStaticTranslation(() => {
  return { props: {} };
});

export default requiresAdmin(UploadPage);

function UploadPage() {
  return <ConstructOrUploadPage key="upload" isUpload={true} />;
}
