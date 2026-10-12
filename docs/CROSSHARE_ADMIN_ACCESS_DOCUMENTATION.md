# Crosshare Admin Access

This guide explains how to open Crosshare's admin pages and how an authorized
operator can grant an account the app's admin role.

## Admin pages in the application

Sign in to Crosshare with a non-anonymous account that has the Firebase Auth
custom claim `admin: true`, then navigate to:

- `/admin` — moderation, site settings, stats, upcoming minis, and donation
  tools.
- `/articles` — list and manage articles.
- `/articles/{slug}/edit` — edit an article.

For example, on a local development server these routes are
`http://localhost:3000/admin` and `http://localhost:3000/articles`.

These are app pages, not Firebase Console pages. They are guarded by the
`requiresAdmin` check; signed-out users are asked to sign in and signed-in
users without the claim see a permission error. Firestore Security Rules also
check the claim for protected reads and writes. Hiding or directly visiting a
route does not bypass those checks.

## Local development

Follow the [local setup instructions in the README](../README.md#running-the-site-locally).
The `pnpm emulate` workflow starts the application at `http://localhost:3000`
and the Firebase Emulator UI at `http://localhost:4000`.

The checked-in emulator Auth data includes `mike@example.com` with the
`admin: true` claim. Use the Auth emulator's local sign-in flow for that
account. This is disposable emulator data; it does not grant access to a
production Crosshare account.

The Emulator UI is a separate tool for inspecting or editing local emulator
data. It is not the Crosshare admin console.

## Granting the admin claim

Only grant admin access to an account whose operator is authorized to use
Crosshare's administrative tools. The repository script
[`app/scripts/makeAdmin.ts`](../app/scripts/makeAdmin.ts) looks up an existing
Firebase Auth user by email and sets its custom claims to `{ "admin": true }`.
It does not create a user.

From the `app` directory, run the command for the intended Firebase
environment:

**Local Auth emulator** — start `pnpm emulate` first, then run in another
terminal:

```sh
NEXT_PUBLIC_USE_EMULATORS=1 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
npx tsx scripts/makeAdmin.ts person@example.com
```

This connects the Admin SDK to the local Auth emulator. Use the email of a
user that already exists there.

**A deployed Firebase project** — ensure the production Firebase configuration
is present and Application Default Credentials are configured for an identity
authorized to administer that project's Firebase Authentication. Then run:

```sh
npx tsx scripts/makeAdmin.ts person@example.com
```

Before running against a deployed project, verify the active project,
configuration, and credentials. Do not put service-account keys, passwords,
or OAuth tokens in the repository or this document.

## Removing the admin claim

There is currently no admin-removal mode in `makeAdmin.ts`. To remove access,
use the Firebase Admin SDK against the same intended Firebase environment and
remove only the `admin` property from the account's custom claims. For example,
in a trusted server-side TypeScript script that has initialized `auth` as in
[`makeAdmin.ts`](../app/scripts/makeAdmin.ts):

```ts
const user = await auth.getUserByEmail('person@example.com');
const updatedClaims = { ...(user.customClaims ?? {}) };
delete updatedClaims.admin;
await auth.setCustomUserClaims(user.uid, updatedClaims);
```

Replace the example email with the account to update. This preserves any other
custom claims; setting an empty claims object or using `makeAdmin.ts` is not
equivalent. The latter sets only `{ admin: true }` and replaces existing
custom claims, so do not use it to remove the admin role. Verify the Firebase
project and inspect the user's current claims before applying the change.

The new claims take effect when the user's ID token is refreshed. Have the
user sign out and back in or refresh their ID token; already-issued tokens may
continue to carry the old claim until they expire.

### Important claim behavior

The current script calls `setCustomUserClaims` with only `{ admin: true }`.
Firebase replaces the user's existing custom-claims object rather than
merging it, so this can remove other custom claims. Check with the project's
Firebase administrator before running it for a user who may have other
claims. Only authorized operators should run this script.

Custom claims are included in ID tokens. After a role change, the user may
need to sign out and sign back in, or refresh their ID token, before the app
recognizes the new role.

## Implementation references

- [Admin console page](../app/pages/admin.tsx)
- [Admin-only page guard](../app/components/AuthHelpers.tsx)
- [Client-side admin-claim check](../app/lib/useAuth.ts)
- [Admin-claim grant script](../app/scripts/makeAdmin.ts)
- [Firestore Security Rules](../app/firestore.rules)
- [Firebase project and emulator configuration](../app/firebase.json)
- [Firebase integration overview](./FIREBASE_DOCUMENTATION.md)

## Firebase references

- [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase Authentication Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth)
- [Firebase Emulator Suite UI](https://firebase.google.com/docs/emulator-suite)
- [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)
