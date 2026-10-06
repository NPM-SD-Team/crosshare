# Firebase Documentation

## Overview

Firebase is the primary infrastructure layer for Crosshare. It powers the app’s authentication, data persistence, file storage, server-side admin access, and scheduled background jobs. The project is built as a Next.js + React application that uses Firebase in both the browser and the backend, while Cloud Functions handle automated operations that would be expensive or awkward to run directly in the frontend.

In practical terms, Firebase is not just a minor dependency in this codebase; it is the core platform that stores puzzle data, keeps user sessions, validates content, serves profile images, and runs scheduled maintenance tasks.

## High-level architecture

The Firebase integration is split into three major layers:

1. Client-side Firebase SDK for browser behavior
   - Authentication
   - Firestore reads/writes from the React app
   - Storage access for user media
   - Emulator connections during local development

2. Admin SDK for server-side and background code
   - Firestore access from SSR pages and API routes
   - admin user lookup and token verification
   - storage bucket access for signed URLs and media retrieval
   - use of service credentials or application default credentials

3. Firebase Cloud Functions for automation
   - scheduled imports/exports
   - moderation workflows
   - analytics aggregation
   - email notification processing
   - puzzle update hooks and processing

This architecture is visible across the repository:

- `app/lib/firebaseWrapper.ts` for browser/client Firebase setup
- `app/lib/firebaseAdminWrapper.ts` for server/admin Firebase setup
- `app/lib/useAuth.ts` for auth state and Firestore-driven user context
- `functions/src/index.ts` for scheduled backend jobs
- `app/firebase.json` for Firebase project configuration, emulator ports, and hosting targets

## Firebase project configuration

### Web app configuration

The project uses Firebase SDK configuration values in a file typically generated from the project setup. The emulator config is defined in `app/firebaseConfig.emulators.ts`, and production config is expected in `app/firebaseConfig.ts`.

The emulator config includes values such as:

- `projectId`
- `apiKey`
- `authDomain`
- `storageBucket`

Those values are then passed into `initializeApp()` when the app boots. The browser-side wrapper checks whether the app is running with emulators by looking at `process.env.NEXT_PUBLIC_USE_EMULATORS`.

### Local emulator configuration

The `app/firebase.json` file defines the emulator runtime setup:

- Auth emulator on port `9099`
- Functions emulator on port `5001`
- Firestore emulator on port `8080`
- Storage emulator on port `9199`
- UI on port `4000`
- Pub/Sub emulator on port `8085`

This is a strong signal that the project is designed to run with Firebase emulators in local development instead of hitting a live remote project. The scripts in `app/package.json` make this explicit:

- `pnpm emulate` launches the auth, Firestore, storage, and functions emulators, then runs the Next.js development environment
- `pnpm emulatorAndTest` runs a Firestore-only emulator flow for tests

This keeps the entire app testable without mutating production data.

## Client-side Firebase integration

The client-side Firebase setup is centralized in `app/lib/firebaseWrapper.ts`.

### App initialization

The file initializes a single Firebase app and Firestore instance:

- `getApps()` checks for an already initialized app
- if no app exists, it creates one based on either emulator config or production config
- `getFirestore(App)` returns the app’s Firestore instance
- `connectFirestoreEmulator` is called when emulators are enabled
- `connectAuthEmulator` is called for Auth
- `connectStorageEmulator` is called for Storage

The initialization logic is intentionally defensive and uses a singleton-like pattern so the app does not accidentally create multiple Firebase apps.

### Firebase Auth on the client

The project wraps the browser Auth instance with a helper:

- `getAuth()` returns the Auth instance for the current app
- `signInAnonymously()` calls Firebase Auth’s anonymous sign-in flow
- `setUpForSignInAnonymously` exists as a testing-only stub for test harness usage

This means the app supports anonymous browsing and user identity flows without requiring a full custom auth service. The Auth state is then consumed by `useAuth()` in `app/lib/useAuth.ts`.

### Auth state management

`useAuth()` is the key frontend hook that integrates Firebase Auth with application-level user state. It uses `react-firebase-hooks/auth` and `useAuthState(getAuth())` to subscribe to the current user.

That hook then:

- tracks whether the user is an admin via `user.getIdTokenResult()` and custom claims
- loads a constructor page document for the signed-in user from the `cp` collection
- loads notifications from the `n` collection
- loads account preferences from the `prefs` collection
- exposes a combined auth context object containing the user, flags, notifications, constructor page data, and loading status

This is a good example of how Crosshare uses Firebase not just as storage but as the central state source for identity and application-level permissions.

### Firestore client wrappers

`getCollection(collectionName)` returns a Firestore collection reference with a custom converter. The project defines a converter that:

- clones data deeply
- converts custom timestamp objects into Firestore-compatible Timestamp values
- preserves the Firestore document structure

The app also defines `getValidatedCollection()` which wraps a collection in a decoder-based validator. This is a strong design pattern in this project: Firestore documents are validated at runtime using `io-ts` decoders before they are used in the frontend.

That pattern ensures malformed data does not silently break UI logic and makes the app easier to reason about in a schema-heavy environment.

## Firestore data model and usage

### Document-based persistence

Crosshare stores most relevant application state in Firestore collections. The schema is heavily encoded in `app/lib/dbtypes.ts`, which defines validation objects for many document types.

Examples of collections and document families include:

- `c` — crossword puzzle documents
- `cp` — constructor profile pages
- `a` — article content
- `settings` — site and tag settings
- `prefs` — per-user preferences
- `n` — notifications
- `cfm` — comments awaiting or undergoing moderation
- `deleteComment` — comment deletion requests
- `reaction` — user/puzzle reactions
- `followers` — per-constructor follower lists
- `cache` — generated lookup caches

This is a Firebase-native document model rather than a relational schema. Most relationships are represented by document IDs or ID-valued fields, not by nested SQL-style joins. The collections below are root-level collections in the default Firestore database; the project does not generally organize these entities as nested subcollections.

### Firestore path layout

In Firestore, a collection contains documents, and each document has a stable document ID. In this project the shorthand collection names are literal collection IDs, so, for example, `c/{puzzleId}` means a document in the root-level `c` collection. The following tree shows the main layouts and representative paths:

```text
(default database)
├── c/{puzzleId}                         # crossword and its embedded comments
├── cp/{usernameLowercase}               # public constructor profile
├── a/{articleId}                        # article content; s is its slug
├── packs/{packId}                       # puzzle pack metadata
├── prefs/{userId}                       # account preferences
├── p/{puzzleId}-{userId}                # a user's saved play state
├── s/{puzzleId}                         # aggregate stats for one puzzle
├── cs/{userId}                          # constructor stats indexed by puzzle ID
├── followers/{constructorUserId}        # f: array of follower user IDs
├── n/{notificationId}                   # notification for a user
├── reaction/{userId}-{kind}-{puzzleId}  # one user's reaction to a puzzle
├── em/{userId}                          # puzzle embed/display options
├── cfm/{commentId}                      # moderation queue record
├── deleteComment/{deletionId}           # requested comment deletion
├── cr/{commentId}-{userId}              # comment report
├── settings/settings                    # site/admin settings
├── settings/tags                        # tag metadata
├── donations/donations                  # donations aggregate/list
├── ds/{dateString}                      # daily aggregate stats
├── in/{queryIndexId}                    # paging cursor/index data
├── cache/barebonesConstructorPages      # generated constructor lookup cache
├── cron_status/{jobId}                  # scheduled-job progress markers
├── automoderated/{id}                   # moderation processing records
└── toClean/{id}                         # cleanup work records
```

The tree is a guide to document locations, not an instruction to create every path manually. Some collections are generated or maintained by scripts and Cloud Functions. The app's document validators and Firebase rules are the more precise references for each family; schemas live primarily in `app/lib/dbtypes.ts`, `app/lib/constructorPage.ts`, `app/lib/notificationTypes.ts`, and `app/lib/pack.ts`, while access policies are in `app/firestore.rules`.

### Main document families and shapes

The stored field names are intentionally compact. The snippets below show representative shapes rather than exhaustive schemas; optional fields can be absent, and several documents contain additional fields documented by the corresponding validators.

#### Puzzles: `c/{puzzleId}`

This is the central content record. The document ID is the puzzle ID referenced by the rest of the system. `DBPuzzleV` in `app/lib/dbtypes.ts` requires the author, title, dimensions, grid, clue strings/numbers, moderation state, and publication timestamp. Puzzle visibility is represented using `pv` (private) or `pvu` (public/available timestamp); the validator requires one form or the other.

```text
c/{puzzleId}:
  a: author user ID
  n: author display name
  t: puzzle title
  w, h: grid width and height
  g: solution grid (array of cell strings)
  ac, an: across clues and displayed clue numbers
  dc, dn: down clues and displayed clue numbers
  m: moderation state
  p: publication timestamp
  pv or pvu: private marker or public-availability timestamp
  f, dmd, tg_u, tg_a, tg_f, tg_i: optional featured/daily-mini/tag metadata
  cs: optional comments/replies embedded in the puzzle document
  pk: optional pack ID
```

Comments and replies are currently represented as nested objects inside the puzzle's `cs` array, rather than as Firestore subcollections below `c/{puzzleId}`. Other optional puzzle fields include alternate solutions, notes, blog text, clue explanations, contest data, likes, ratings, style marks, and hidden cells. Avoid treating this abbreviated list as a complete schema; use `DBPuzzleV` as the canonical field definition.

#### Constructor profiles: `cp/{usernameLowercase}`

The document ID is the normalized username (the rules require it to match the lowercase username); the `i` field preserves the desired display capitalization. The `u` field points to the Firebase Auth UID.

```text
cp/{usernameLowercase}:
  i: username with preferred capitalization
  u: Firebase Auth user ID
  n: display name
  b: biography
  t: last-updated timestamp (or null)
  m, pp, pt, sig, st: optional moderation/payment/signature/share metadata
```

This is a public-facing profile record. Constructor profiles are queried by username for profile routes and by `u` when resolving a user's page. The `cache/barebonesConstructorPages` document is a derived lookup cache, not a replacement for these canonical profile documents.

#### Account and activity documents

- `prefs/{userId}` stores preference flags, notification unsubscribe categories, followed user IDs, rating state, and pack access/ownership metadata. It is a single document per user; the shape is defined by `AccountPrefsV` in `app/lib/prefs.ts`.
- `p/{puzzleId}-{userId}` stores a user's play progress. The ID format is enforced in `firestore.rules`. The document references the puzzle in `c` and stores the user in `u`, plus the in-progress grid, per-cell timing/check state, completion/cheating state, and optional contest submission fields.
- `s/{puzzleId}` stores aggregate stats for a puzzle, including completion counts, solve-time totals, update timestamp, and per-cell aggregates. It denormalizes author UID in `a` for access checks; optional fields include a secret stats-sharing key and contest submissions.
- `cs/{userId}` stores constructor-level stats as a map keyed by puzzle ID. Each puzzle entry contains completion counts and time totals (and optional contest submission counts). This differs from `s`: `s` is keyed by puzzle, while `cs` is keyed by constructor.
- `followers/{constructorUserId}` stores `f`, an array of follower UIDs. This is a per-constructor document, not an individual document for each follow edge.

These records are related by IDs and fields rather than by nesting. For example, a play document's `c` value identifies its puzzle, while `s/{puzzleId}` uses the same puzzle ID as its document ID.

#### Notifications and reactions

- `n/{notificationId}` is a user-targeted notification. Its schema contains `u` (recipient UID), `t` (display time), `r` (read/handled flag), `e` (considered for email), and `k` (kind). The kind selects additional fields; comment/reply notifications point to a puzzle and comment, new-puzzle notifications point to a puzzle and author, and featured notifications identify the feature context. The code makes notification IDs idempotent because update triggers can run more than once.
- `reaction/{userId}-{kind}-{puzzleId}` stores one user's reaction to one puzzle. Fields are `u` (user), `p` (puzzle), `k` (reaction kind), and `s` (set/unset state). The ID is constructed from those values by `firebaseKey()` in `app/lib/reactions.ts`.

#### Packs and embedded-player settings

- `packs/{packId}` stores pack owners in `a`, title in `t`, description in `d`, and an ordered list of puzzle IDs in `p`; optional `r` contains rejected puzzle IDs. Puzzle documents refer back with their optional `pk` field.
- `em/{userId}` stores embed/player styling preferences for a constructor. Optional settings include primary/link/error colors, dark mode, custom font URLs, and the Slate UI setting. The embed pages read this document to customize an embedded puzzle or puzzle list.

#### Articles, site settings, and donations

- `a/{articleId}` stores article content. Article lookup and navigation use the `s` slug field; articles can also be marked featured with `f`. Article documents are loaded by server-side page helpers and used for articles and weekly-email archives.
- `settings/settings` stores admin/site configuration, including automoderation controls, moderator UID lists, homepage announcement content, and optional homepage text. `settings/tags` is a separate settings document for public tag metadata. These are two documents in the same root collection, not separate collections.
- `donations/donations` is an aggregate document containing a `d` array of donation records (email, date, donated/received amounts, name, page, and optional UID). Patron lookup reads this record and resolves users through the profile or Auth collections.

#### Moderation and reporting

- `cfm/{commentId}` stores a comment submitted for moderation. Its fields include comment text and author/solve metadata, puzzle ID `pid`, reply target `rt`, and optional moderation decision flags. The scheduled `autoModerator` function reads these records.
- `deleteComment/{deletionId}` records a deletion request with puzzle ID `pid`, comment ID `cid`, author UID `a`, and whether a moderator removed it. The moderation workflow reconciles these records with embedded puzzle comments.
- `cr/{commentId}-{userId}` stores a report against a comment; this document ID pattern is enforced by Firestore rules.
- `automoderated/{id}` is referenced by the rules as admin-only. Its document schema is not centrally described in the app's public validators, so treat it as an internal moderation record and follow the writer code when maintaining it.

#### Aggregates and operational records

- `ds/{dateString}` contains daily aggregates, including total completions, user IDs, per-puzzle counts, and counts grouped by UTC hour. The date string is generated by the app's date helper; use the exact helper rather than inventing a date format.
- `in/{queryIndexId}` stores an array of timestamps (`p`) used by `paginatedPuzzles` as page boundaries. Its ID is derived from the filter field/value and page size (or `public-{pageSize}` for unfiltered listings), with a suffix for non-equality operators.
- `cache/barebonesConstructorPages` stores a generated UID-to-profile-summary map used for faster constructor name lookups. The cache is rebuilt from `cp` documents by `app/scripts/caching.ts`.
- `cron_status/{jobId}` stores a `ranAt` timestamp used to resume scheduled processing such as hourly analytics.
- `toClean/{id}` is an operational cleanup queue referenced by scripts/functions. Its shape is not represented by a shared validator in the inspected code; consult its producer/consumer before writing documents.

The rules also include `uc/{userId}` and `up/{userId}` as user-owned document paths. Their purpose and document schemas are not established by the shared validators above; treat them as private user-scoped records and do not infer fields from the path alone.

### How to lay out or seed data

When creating or importing Firestore data for this project:

1. Use the collection/document IDs shown above. In particular, don't put a puzzle under a user subcollection: write it to `c/{puzzleId}` and set its `a` author UID.
2. Preserve key relationships through canonical IDs and fields: `p.c` references `c/{puzzleId}`, `s/{puzzleId}` and the relevant `cs/{userId}` entry summarize the same puzzle, `packs/{packId}.p` lists puzzle IDs, and `c/{puzzleId}.pk` points back to its pack when applicable.
3. Keep profile document IDs normalized as required by the rules (`cp/{usernameLowercase}`), while retaining display capitalization in `i`.
4. Include all fields required by the corresponding validator. For example, a puzzle must satisfy `DBPuzzleV`, and a play record uses the `puzzleId-userId` document ID and the play schema in `dbtypes.ts`.
5. Preserve Firestore-native value types such as `Timestamp` for timestamp fields. Do not substitute arbitrary strings or JavaScript `Date` values in raw emulator import JSON without using the repo's serialization/import conventions.
6. Treat caches, indexes, stats, notifications, and moderation records as distinct document families with their own writers. Prefer the application code or emulator seed data over hand-constructing derived records.
7. Check `app/firestore.rules` before choosing client writes. Admin SDK code bypasses Firestore Security Rules, but browser SDK reads/writes are restricted by them. The rules also explain which fields users are allowed to change.

The repository's rules define the supported collection paths and access boundaries; `app/firestore.indexes.json` defines composite indexes needed by the query patterns. A Firestore import or a new collection should be accompanied by the corresponding schema validation, security rules, indexes, and updates to the relevant writers/readers.

### Runtime validation

The app uses `io-ts` decoders extensively. Examples include:

- `DBPuzzleV`
- `ConstructorPageV`
- `CommentForModerationV`
- `AccountPrefsV`
- `AdminSettingsV`

Firestore reads are not blindly trusted. Instead, the project validates each document before using it. When validation fails, it logs the path report and throws or rejects the operation.

This is a major architectural trait of the project and a clear sign that Firebase data is treated as a dynamic external data source requiring runtime schema enforcement.

### Timestamp handling

A custom `timestamp.ts` helper and conversion logic are used to normalize Firestore timestamps. In `firebaseWrapper.ts`, `convertTimestamps` recursively converts timestamp-like values into Firestore `Timestamp` objects and `fromFirestore` returns raw `s.data()`.

This is important because the app uses rich temporal data such as:

- publication dates
- puzzle times
- comments and metadata timestamps
- moderation and analytics timestamps

The use of custom timestamp conversion helps unify server and client expectations when passing data through Firestore and React components.

### Query usage patterns

The Firestore access pattern is straightforward and consistent, and it is used in multiple places across the app rather than only in the admin layer. The project relies on Firestore `where`, `orderBy`, `limit`, `startAfter`, and `endBefore` queries to efficiently retrieve only the data currently needed.

#### Concrete query examples in the codebase

- User-specific constructor page and notification loads in [app/lib/useAuth.ts](../app/lib/useAuth.ts):
  - `query(getCollection('cp'), where('u', '==', user.uid))`
  - `query(getCollection('n'), where('u', '==', user.uid), where('r', '==', false))`
  - These queries are used to fetch the current authenticated user’s constructor profile and unread notifications, then hydrate the app’s auth context.

- Authored puzzle list in [app/pages/dashboard.tsx](../app/pages/dashboard.tsx):
  - `query(getCollection('c'), where('a', '==', user.uid), orderBy('p', 'desc'))`
  - This query powers the dashboard’s “Recent Puzzles” list and is combined with the paginated query hook so the user can browse older/newer puzzle pages.

- Featured article selection in [app/pages/index.tsx](../app/pages/index.tsx):
  - `getCollection('a').where('f', '==', true)`
  - This fetches only articles marked as featured for the homepage, then filters and validates the results before rendering.

- Generic paginated puzzle browsing in [app/lib/paginatedPuzzles.ts](../app/lib/paginatedPuzzles.ts):
  - The function creates a base query from `getCollection('c')`, optionally appends `where(queryField, queryOperator, queryValue)`, and then applies `where('pvu', '<=', ...)`, `orderBy('pvu', 'desc')`, and `limit(pageSize + 1)`.
  - This is the foundational query pattern for the “featured/newest” browsing flow and supports a custom index document to maintain pagination state across requests.

- Daily mini lookup in [app/lib/serverOnly.ts](../app/lib/serverOnly.ts):
  - `db.collection('c').where('dmd', '==', prettifyDateString(d))`
  - This is used to resolve the puzzle for a specific calendar date, which drives the homepage daily mini and historical daily mini lookups.

- Article slug and archive navigation in [app/lib/serverOnly.ts](../app/lib/serverOnly.ts):
  - `db.collection('a').where('s', '==', slug).get()`
  - a range query for weekly emails such as:
    ```ts
    db.collection('a')
      .where('s', '>=', `weekly-email-${year}`)
      .where('s', '<=', `weekly-email-${year}\uf8ff`)
      .orderBy('s', 'desc')
      .get();
    ```
  - `db.collection('a').where('s', '<', slug).orderBy('s', 'desc').limit(1).get()`
  - `db.collection('a').where('s', '>', slug).orderBy('s', 'asc').limit(1).get()`
  - These queries support article retrieval, weekly email browsing, and next/previous article navigation.

- Constructor page lookup by user id in [app/lib/serverOnly.ts](../app/lib/serverOnly.ts):
  - `db.collection('cp').where('u', '==', userid).limit(1).get()`
  - This resolves the public constructor profile associated with a given user and is used to display a blog page or author profile metadata.

#### Pagination mechanics

The project also adopts cursor-based pagination in the client layer via [app/lib/usePagination.ts](../app/lib/usePagination.ts). Rather than retrieving an entire collection, it wraps the query with `limit()`, `startAfter()`, and `endBefore()` and then reads only the necessary page slice.

This pattern is especially visible in [app/pages/dashboard.tsx](../app/pages/dashboard.tsx), where the dashboard loads a limited number of authored puzzle results per page and provides “Older puzzles” / “Newer puzzles” actions.

The architectural pattern is consistent across the project: query by stable domain fields (`u`, `a`, `s`, `f`, `dmd`, `p`), validate the results immediately, and only then use them in view logic or server-rendered page props. This approach keeps reads targeted, efficient, and robust against malformed documents.

## Admin Firebase integration

The project also uses the Firebase Admin SDK for privileged operations not suitable for the browser.

### Admin app initialization

`app/lib/firebaseAdminWrapper.ts` creates a Firebase Admin app with:

- `initializeApp()`
- `applicationDefault()` as the default credential source in production
- emulator config on local development when `NEXT_PUBLIC_USE_EMULATORS` is enabled

This means that server-side code can safely talk to Firebase if the execution environment has the right credentials or if it is running inside emulator mode.

### Firestore access via Admin SDK

The admin wrapper exposes:

- `getAdminApp()`
- `firestore()`
- `getCollection(c)` for Firestore collection references with custom conversion
- `mapEachResult()` to validate and transform a query result into a typed list

This is used throughout server-side rendering and scheduled functions.

### User and Firebase Auth lookups

The admin wrapper exposes:

- `getUser(userId)` via `getAuth(getAdminApp()).getUser(userId)`

This is used for privileged user identity checks and server-side permission resolution.

### Storage and media access

The `serverOnly.ts` file uses `getStorage(getAdminApp()).bucket().file(storageKey)` to inspect and fetch user media objects. It can:

- check whether a profile image exists
- generate a public URL in emulator mode
- generate a signed URL when running in production

This is a clear example of admin-side Firebase Storage use, especially for public profile picture access outside the browser client.

## Authentication and authorization model

### Client auth

Browser clients sign in anonymously or with standard Firebase auth flows. The app does not appear to implement a custom JWT/session system; it relies on Firebase’s user identity and ID token claims.

### Admin and role detection

In `useAuth()`, the app fetches a user’s ID token result and checks for `claims.admin`:

- if the token contains `admin`, the UI treats the user as an admin
- other flags such as `isPatron` and `isMod` are loaded separately from user info endpoints

This shows the project uses Firebase Auth not only for login but also as a role/claims-based authorization system.

### Server verification

Some API routes and backend operations verify Firebase ID tokens with `verifyIdToken(token)` from the Admin SDK. This is important for privileged endpoints that must ensure the caller is an authenticated user before performing actions.

This pattern is common in apps that need to secure API operations without storing custom session cookies or JWTs of their own.

## Storage usage

### Profile storage

The project uses Firebase Storage for uploaded profile images and related media. This is implemented in the server layer using the Admin SDK:

- check for file existence in a storage bucket
- generate signed URLs for read access
- provide public URLs during emulation

This allows the app to render media while keeping the storage backend behind Firebase Storage rather than a custom file service.

### Emulator mode

When emulators are enabled, `connectStorageEmulator(storage, 'localhost', 9199)` is used. This ensures local development uses a local bucket rather than the cloud environment.

## Cloud Functions and background jobs

The functions code is in `functions/src/index.ts` and is a major part of Crosshare’s Firebase architecture.

### Scheduled jobs

The following scheduled jobs are defined:

- `ratings`: runs daily at 00:05 UTC to run the Glicko rating update process
- `autoModerator`: runs every 30 minutes to moderate comments and spam content
- `analytics`: runs hourly to aggregate analytics data
- `scheduledFirestoreExport`: runs daily at 00:00 UTC to export Firestore documents to Google Cloud Storage
- `notificationsSend`: runs daily at 16:00 UTC to queue emails and clean notifications

These functions are configured with Firebase Functions v1 and are clearly part of the operational backend, not just the application runtime.

### Trigger-based processing

The project also defines a Firestore trigger:

- `puzzleUpdate` listens to the `c/{puzzleId}` collection and reacts to puzzle writes

This is a classic Firebase event-driven backend pattern: app writes to Firestore, the function responds, and additional processing occurs automatically.

### Why Cloud Functions are needed

A large amount of Crosshare’s functionality is not instantaneous or not safe for the browser to do directly.

Examples include:

- recalculating puzzle ratings
- scanning and moderating comments at intervals
- aggregating analytics over time
- exporting data for backup
- sending queued emails
- checking spam and comment quality

These tasks are natural Cloud Function workloads, and the project organizes them cleanly around the Firebase Functions system.

## Firebase emulator workflow

The project treats Firebase emulators as a first-class development environment.

The emulator stack includes:

- Auth emulator for sign-ins and identity testing
- Firestore emulator for persistence and queries
- Storage emulator for media testing
- Functions emulator for backend function testing
- Pub/Sub emulator for scheduled messaging workloads
- UI for debugging local state

This is especially helpful because the app relies on Firebase for several responsibilities that are normally difficult to reproduce in a traditional local-only Node app.

The `pnpm emulate` script is a canonical example of this workflow:

```bash
cd app
pnpm install
cp firebaseConfig.emulators.ts firebaseConfig.ts
pnpm compileI18n
pnpm emulate
```

During this mode, the app points at local emulator ports and does not require a live production Firebase project for normal development.

## Security and data protection model

### Firestore security rules

The project includes:

- `app/firestore.rules`
- `app/storage.rules`

These rules are part of Firebase’s declarative access control. They enforce which users or clients can read and write collections/documents and which storage paths are accessible.

This is essential because Crosshare stores user-specific, puzzle-specific, and moderator-only data in public-facing Firestore collections. Without clear rules, a large number of objects would become broadly writable.

### Admin credentials

The admin layer uses `applicationDefault()` when running in production, which means the system expects Google Cloud Application Default Credentials or an equivalent service identity environment. This is the normal pattern for server-side Firebase access in a GCP-hosted or CI environment.

The repo also contains a top-level `serviceAccountKey.json` file for local credentialing. This is useful for local admin tasks and service access when not using emulator mode.

## Firebase in the app lifecycle

Firebase is integrated throughout the project lifecycle:

- app startup initializes Firestore and Auth through wrapper files
- users are tracked via Firebase Auth sessions
- data is persisted to Firestore as typed documents
- media is stored in Firebase Storage
- admin actions use the Admin SDK and privileged credentials
- scheduled tasks happen via Cloud Functions and Firestore events
- local development runs through emulators without touching production infrastructure

This makes Firebase the central runtime substrate of the entire project, not merely a storage backend.

## Key implementation patterns

### 1. Single-source wrappers

The codebase uses consistent wrapper files instead of ad hoc Firebase calls: `firebaseWrapper.ts` and `firebaseAdminWrapper.ts` hide environment differences and make the rest of the app independent from the underlying SDK configuration.

### 2. Type-safe Firestore documents

Nearly every major document kind is validated with `io-ts` decoders. This is one of the strongest patterns in the codebase and helps maintain correctness as the app evolves.

### 3. Emulator-first development

The project is explicitly built around emulator-based local development. This reduces the risk of schema or permission mistakes affecting the live app.

### 4. Admin-driven operational logic

Sensitive, periodic, and expensive operations are moved to the Admin SDK and Cloud Functions. This avoids placing operational logic in browser-time React code and keeps production infrastructure safer and more maintainable.

## Summary

Firebase is the backbone of Crosshare’s application architecture. It handles:

- user authentication and identity
- Firestore-based puzzle and social data persistence
- asset storage for media and profile images
- server-side privileged operations
- scheduled and event-driven background processing
- emulator-based local development and testing

The project uses Firebase in a mature, layered way: the browser app talks to the client SDK, the server and SSR code talk to the Admin SDK, and Cloud Functions provide the automation layer that makes the platform operationally robust.

In short, Crosshare is not just a React app with a database—it is a Firebase-native application with a document-based data architecture, cloud automation, and a local emulator-first workflow.
