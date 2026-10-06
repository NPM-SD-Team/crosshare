# Crosshare Project Documentation

## Overview

Crosshare is an open-source crossword community and publishing platform. It lets users:

- create and publish crossword puzzles
- solve puzzles online
- browse daily minis, featured content, and tags
- follow constructors and view their pages
- participate in comments, reactions, and metadata-driven stats
- manage subscriptions and community moderation workflows

The codebase is a TypeScript application built with Next.js, React.js, and Firebase. The frontend uses React component-based rendering, while Next.js handles routing and server-rendered pages; the main app lives in the `app/` directory, with Firebase Cloud Functions in `functions/` and deployment/configuration at the repo root.

## Product summary

Crosshare is effectively a crossword CMS + social platform + puzzle runtime. The project combines:

- a browser-based puzzle editor and constructor workspace
- server-rendered public puzzle pages
- Firestore-backed persistence and metadata
- Firebase Auth for user identity and anonymous sign-ins
- Cloud Functions for scheduled jobs, moderation, analytics, and notification processing
- multiple puzzle types including daily minis and contests

At the frontend layer, React.js drives the interactive experience: the puzzle editor, grid interactions, clue editing, overlays, comments, and dynamic user account pages are implemented as React components and context-based state flows.

## Repository layout

```text
.
├── app/                     # Next.js frontend application
│   ├── components/          # Reusable React UI components
│   ├── lib/                 # App logic, puzzle logic, data validation, Firebase wrappers
│   ├── pages/               # Next.js routes and page-level SSR entry points
│   ├── public/              # Static assets and generated front-end files
│   ├── __tests__/           # Jest and related test fixtures
│   ├── emulator-data/        # Firebase emulator seed/export data
│   ├── firebase.json         # Firebase config for emulators and hosting
│   ├── firestore.rules      # Firestore access rules
│   ├── storage.rules        # Storage access rules
│   └── next.config.mjs      # Next.js config
├── functions/               # Firebase Cloud Functions backend
│   └── src/
├── docs/                    # Project documentation
├── README.md                # Project landing and local setup guide
├── DEPLOY.md                # Deployment reference
├── package.json             # Workspace-level package manager config
├── pnpm-lock.yaml           # Lockfile
├── serviceAccountKey.json   # Local admin credentials for Firebase access (runtime-local secret)
├── .github/                 # CI and automation config
├── LICENSE                  # AGPL-3.0
└── .devcontainer/           # Development container config
```

## Core technology stack

### Frontend

- Next.js 14/15-era app running in the `app/` folder
- React.js for component-driven UI and client-side interactivity
- TypeScript used throughout the React application for strong typing and state management
- CSS Modules and SCSS for styling
- Lingui for internationalization
- Firebase client SDK for auth, Firestore, and storage

### Backend and data

- Firebase Firestore for puzzle, user, settings, comments, and analytics data
- Firebase Authentication for user/session identity
- Firebase Storage for uploads and media assets
- Cloud Functions using Firebase Functions v1 for scheduled automation
- Google Cloud Firestore and Secret Manager support for admin-side workloads

### Supporting tooling

- Jest for unit and integration tests
- Playwright for browser-level verification
- ESLint, Stylelint, Prettier, TypeScript for code quality
- pnpm as the package manager/workspace orchestrator

## Application architecture

### 1. Frontend route structure

The app uses a page-based Next.js routing model. The biggest entry points are in `app/pages/`.

Key routes include:

- `/` — landing page with daily mini, featured puzzles, and articles
- `/construct` and `/upload` — puzzle creation flows
- `/crosswords/[puzzleId]` — puzzle play/read page
- `/edit/[puzzleId]` — editing and publishing workflows
- `/account`, `/dashboard`, `/subscription` — user and account management
- `/featured/[pageNumber]`, `/newest/[pageNumber]`, `/tags/[...path]` — browsing and listing pages
- `/dailyminis/...` — daily mini discovery and historical archive
- `/articles/[slug]` — static-ish editorial pages

This routing structure shows that Crosshare is not a single monolithic app page; it is a content-rich portal of puzzle browsing, creation, and social features.

### 2. React.js component model

Crosshare uses React.js extensively across the frontend. The app renders a large set of interactive React components for puzzle browsing, construction, editor state, overlays, comments, and user profiles. The `app/components/` folder contains most reusable UI modules, including:

- `Builder.tsx` and related editor components for crossword construction
- `Grid.tsx`, `ClueList.tsx`, `Puzzle.tsx`, `PuzzleOverlay.tsx` for gameplay presentation
- `TopBar.tsx`, `Page.tsx`, `Hero.tsx`, `FeatureList.tsx` for layout and navigation
- `AuthContext.tsx` and surrounding auth helpers for signed-in state
- `Comments.tsx`, `ReactionButton.tsx`, `FollowButton.tsx`, `ModerateOverlay.tsx` for community interactions

The architecture is organized around high-level, domain-specific UI blocks rather than a strict feature-folder split, which is typical of a React-driven application that relies on reusable stateful components and context providers.

### 3. Shared domain logic

The `app/lib/` directory contains most of the application logic. It is the real “engine” of the project and includes:

- puzzle validation and representation (`dbtypes.ts`, `types.ts`, `converter.ts`)
- crossword solving and grid logic (`gridBase.ts`, `viewableGrid.ts`, `Autofiller.ts`)
- markdown and article rendering (`markdown/` subfolder, `article.ts`)
- Firebase wrappers and emulator configuration (`firebaseWrapper.ts`, `firebaseAdminWrapper.ts`)
- notifications, analytics, subscriptions, reactions, and moderation flows
- puzzle publication update logic and indexing helpers

This directory also contains the validation schemas built with `io-ts`, which are important because the project relies on strong runtime shape checking for Firestore documents.

### 4. Server-side and scheduled backend

The `functions/src/index.ts` file registers Firebase Functions for:

- scheduled rating updates (`ratings`)
- automoderation (`autoModerator`)
- hourly analytics aggregation (`analytics`)
- periodic Firestore exports (`scheduledFirestoreExport`)
- email notification dispatch (`notificationsSend`)
- puzzle write hook processing (`puzzleUpdate`)

These functions make Crosshare a hybrid system: the React frontend handles UX, while Firebase services automate data processing and background maintenance.

## Data model and domain concepts

### Firestore-backed puzzle documents

The project’s most important collection is the puzzle collection (`c`), with document schemas defined in `app/lib/dbtypes.ts`.

A stored puzzle contains fields such as:

- `a`: author user id
- `n`: author display name
- `t`: title
- `w`, `h`: grid dimensions
- `ac`, `dc`: across/down clues
- `an`, `dn`: clue numbers
- `g`: solution grid
- `m`: moderation status
- `p`: publication timestamp
- optional metadata like tags, comments, reactions, packs, daily mini markers, and contest configuration

The validation approach indicates the project takes data integrity seriously: most Firestore documents are validated at runtime through `io-ts` decoders before use.

### User and constructor profiles

Crosshare models user identity and public constructor pages separately:

- Firebase Auth provides identity/session info
- user metadata and page profile fields are stored in dedicated doc structures and validated by `ConstructorPageV`
- public pages expose profile data such as username, display name, bio, and social snippet metadata

### Comments and moderation

The moderation model includes comment records, replies, spam detection, deleting/flagging workflows, and moderator review collections (`cfm`, `deleteComment`, etc.). This explains why there are dedicated moderation utilities and scheduled automated moderation jobs.

### Analytics and engagement

The codebase includes support for puzzle stats, reactions, follows, daily stats, user preferences, subscriptions, and social features. These are not just one-off widgets; they are part of the core content and engagement model.

## Key workflows

### Puzzle authoring

The constructor flow is centered around interactive grid editing, clue management, and publication controls. Key components include:

- `components/Builder.tsx`
- `components/Grid.tsx`
- `components/ClueList.tsx`
- `components/PublishOverlay.tsx`
- `components/PublishWarningsList.tsx`

The authoring experience supports puzzle editing, validation, and publishing, then stores the completed puzzle document in Firestore.

### Solving and puzzle viewing

The user-facing solver experience is likely rendered by puzzle page components and grid overlays. These include:

- `components/Puzzle.tsx`
- `components/PuzzlePage.tsx`
- `components/RevealOverlay.tsx`
- `components/Comments.tsx`
- `components/Stats` and related puzzle data pages

This means puzzles are not static files; they are interactive, stateful experiences with real-time or persisted solve metadata.

### Daily mini generation and list pages

The project has explicit support for daily mini puzzles, archived minis, and periodic “throwback” logic. This is represented by routes and helpers such as:

- `app/pages/dailyminis/[[...slug]].tsx`
- `app/lib/dailyMinis.ts`
- `app/lib/serverOnly.ts`

This is a strong sign that the app is designed as a puzzle publication platform rather than a generic editor.

### Community and social features

Crosshare includes social features beyond the puzzle itself:

- constructor pages
- follow relationships
- comments and replies
- likes/reactions
- recommendation and featured lists
- articles and mini newsletters
- donation/support flows

The `lib/reactions.ts`, `lib/notifications.ts`, `lib/subscriptions.ts`, and `lib/notifications.ts` family of files show substantial support for engagement and community management.

## Local development workflow

The repository README contains the canonical local setup process. The short version is:

1. open the repo in a devcontainer or equivalent Node environment
2. install dependencies with pnpm
3. configure Firebase credentials/local emulator setup
4. run the app and Firebase emulators
5. optionally run the test suite

Core commands from the project scripts:

```bash
cd app
pnpm install
cp firebaseConfig.emulators.ts firebaseConfig.ts
pnpm compileI18n
pnpm emulate
```

The app is then generally available at:

- `http://localhost:3000` — frontend app
- `http://localhost:4000` — Firebase emulator UI

Important: the development environment expects either a local `firebaseConfig.ts` or emulator-based config. For server-side admin tasks, a local service account credential (`serviceAccountKey.json`) is also used.

## Deployment and infrastructure

### Firebase hosting and functions

The Firebase configuration (`app/firebase.json`) defines:

- Firestore rules and indexes
- Hosting targets for `prod` and `staging`
- Cloud Functions source under `functions/`
- emulator ports for Auth, Firestore, Storage, and Pub/Sub

This is a standard Firebase deployment model for a Next.js web app plus serverless functions.

### Environment-specific deployment

The package scripts include deployment commands for:

- `pnpm predeploy` — TypeScript compile + build
- `pnpm prodDeploy` / `pnpm stagingDeploy` — target-specific Firebase hosting deploys

This suggests the project uses Firebase as both infrastructure and release target, with a front-end app deployed via hosting and backend automation running in Cloud Functions.

## Testing and quality gates

The repository expects the following checks:

- `pnpm lint` — ESLint + Stylelint
- `pnpm typecheck` — TypeScript compilation
- `pnpm format` / `pnpm checkFormat` — Prettier checks
- `pnpm test` — Jest watch mode for unit tests
- `pnpm playwright test` — browser automation where applicable

Tests and fixtures are in `app/__tests__/`, with extra sample crossword data under `app/__tests__/converter/puz` and `app/__tests__/converter/ipuz`.

## Notable implementation patterns

### Runtime validation with io-ts

The project relies heavily on runtime decoders (`io-ts`) for Firestore and other data sources. This makes malformed content fail early and gives a strong schema boundary in a dynamic app.

### Firebase emulator-first development

The repo includes emulator exports and a documented emulator workflow. This reduces the risk of damaging a production data set while developing locally.

### Content-first architecture

Crosshare is driven by rich content models: puzzles, constructor pages, articles, tags, social comments, and newsletter-style features. There is minimal reliance on a separate “backend service” pattern: most domain logic lives in library code and Firebase storage.

## Risks and operational considerations

- The app depends on Firebase configuration and project-specific credentials; local development requires emulator or proper project setup.
- Cloud Function scheduling and analytics workflows are part of the platform’s health, making operational monitoring important.
- Because data is validated at runtime and persisted in Firestore, schema evolution must be done carefully.
- The project has substantial front-end complexity due to a large interactive puzzle builder and publication engine.

## Recommended onboarding path

For engineers joining the project, the best starting points are:

1. `README.md` for startup and contributor expectations
2. `app/pages/_app.tsx` and one representative page such as `app/pages/index.tsx` to understand the frontend shell
3. `app/lib/firebaseWrapper.ts` and `app/lib/dbtypes.ts` to understand the Firebase/data model
4. `functions/src/index.ts` to understand background automation and moderation
5. the puzzle editor machinery in `app/components/Builder.tsx` and related files

This gives a practical mental model of the product before diving into the puzzle engine and validation layers.

## Summary

Crosshare is a full-stack crossword community platform built on Next.js + TypeScript + Firebase. It blends puzzle authoring, solving, social interaction, moderation, analytics, and scheduled automation into a single application architecture. The repo is organized around a content-rich app frontend, strongly typed Firestore schemas, and serverless background jobs for moderation and operations.
