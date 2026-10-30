import { updateProfile } from 'firebase/auth';
import { query, where } from 'firebase/firestore';
import type { Either, Right } from 'fp-ts/Either';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollection, useDocument } from 'react-firebase-hooks/firestore';
import { AuthContextValue } from '../components/AuthContext.js';
import { withBasePath } from './basePath.js';
import { ConstructorPageV } from './constructorPage.js';
import { getAuth, getCollection, getDocRef } from './firebaseWrapper.js';
import { getDisplayName } from './hooks.js';
import { NotificationT, NotificationV } from './notificationTypes.js';
import { PathReporter } from './pathReporter.js';
import {
  AccountPrefsV,
  GUEST_SOLVER_PREFS_STORAGE_KEY,
  SolverPrefsT,
  SolverPrefsV,
} from './prefs.js';
import { parseUserInfo } from './userinfo.js';
import { logAsyncErrors } from './utils.js';

const isRight = <A>(ma: Either<unknown, A>): ma is Right<A> =>
  ma._tag === 'Right';

export function useAuth(): AuthContextValue {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [guestPrefs, setGuestPrefs] = useState<SolverPrefsT>();
  const [loadingGuestPrefs, setLoadingGuestPrefs] = useState(true);

  //only runs once because of loadingGuests bool
  useEffect(() => {
    try {
      //set prefs based on key in your specific browser, localstorage is per browser storage
      const serializedPrefs = localStorage.getItem(
        GUEST_SOLVER_PREFS_STORAGE_KEY
      );

      //if you get it
      if (serializedPrefs) {
        const validationResult = SolverPrefsV.decode(
          JSON.parse(serializedPrefs)
        );
        if (isRight(validationResult)) {
          //set this prefs in your localstorage
          setGuestPrefs(validationResult.right);
        } else {
          console.error(
            'Could not decode guest solver preferences',
            PathReporter.report(validationResult).join(',')
          );
          setGuestPrefs({});
        }
      } else {
        setGuestPrefs({});
      }
    } catch (error) {
      console.error('Could not load guest solver preferences', error);
      setGuestPrefs({});
    } finally {
      //wont run again
      setLoadingGuestPrefs(false);
    }
  }, []);

  const updateGuestPrefs = useCallback((prefs: SolverPrefsT) => {
    try {
      localStorage.setItem(
        GUEST_SOLVER_PREFS_STORAGE_KEY,
        JSON.stringify(prefs)
      );
    } catch (error) {
      console.error('Could not save guest solver preferences', error);
      throw error;
    }
    setGuestPrefs(prefs);
  }, []);

  // Current user
  const [user, loadingUser, authError] = useAuthState(getAuth());

  // Is admin
  useEffect(() => {
    if (user?.email) {
      user
        .getIdTokenResult()
        .then((idTokenResult) => {
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (idTokenResult.claims.admin) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        })
        .catch((error: unknown) => {
          setIsAdmin(false);
          console.error(error);
        });
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  // Constructor page + notifications + prefs
  const [cpDocRef, notificationsDocRef, prefsDocRef] = useMemo(() => {
    if (user?.email && !user.isAnonymous) {
      setIsLoading(true);
      return [
        query(getCollection('cp'), where('u', '==', user.uid)),
        query(
          getCollection('n'),
          where('u', '==', user.uid),
          where('r', '==', false)
        ),
        getDocRef('prefs', user.uid),
      ];
    }
    if (!loadingUser) {
      setIsLoading(false);
    }
    return [null, null, null];
  }, [user, loadingUser]);
  const [accountPrefsDoc, loadingAccountPrefs, accountPrefsDBError] =
    useDocument(prefsDocRef);
  const [accountPrefs, accountPrefsDecodeError] = useMemo(() => {
    if (!accountPrefsDoc?.exists()) {
      return [undefined, undefined];
    }
    const validationResult = AccountPrefsV.decode(accountPrefsDoc.data());
    if (isRight(validationResult)) {
      return [validationResult.right, undefined];
    } else {
      console.log(PathReporter.report(validationResult).join(','));
      return [undefined, 'failed to decode account prefs'];
    }
  }, [accountPrefsDoc]);
  const accountPrefsError =
    accountPrefsDBError?.message || accountPrefsDecodeError;
  const hasAccount = !!user?.email && !user.isAnonymous;

  const [notificationsSnapshot, , notificationError] =
    useCollection(notificationsDocRef);
  if (notificationError) {
    console.log(notificationError);
  }
  const notifications: NotificationT[] = useMemo(() => {
    if (notificationsSnapshot === undefined || notificationsSnapshot.empty) {
      return [];
    }
    return notificationsSnapshot.docs
      .map((d) => NotificationV.decode(d.data()))
      .filter(isRight)
      .map((r) => r.right);
  }, [notificationsSnapshot]);
  const [cpSnapshot, loadingCP, cpError] = useCollection(cpDocRef);
  const [constructorPage, cpDecodeError] = useMemo(() => {
    if (cpSnapshot === undefined) {
      return [undefined, undefined];
    }
    setIsLoading(false);
    if (cpSnapshot.empty || cpSnapshot.docs[0] === undefined) {
      return [undefined, undefined];
    }
    if (cpSnapshot.size !== 1) {
      return [undefined, 'Multiple matching constructor pages'];
    }
    const validationResult = ConstructorPageV.decode(
      cpSnapshot.docs[0].data({ serverTimestamps: 'previous' })
    );
    if (isRight(validationResult)) {
      return [
        { ...validationResult.right, id: cpSnapshot.docs[0].id },
        undefined,
      ];
    } else {
      console.log(PathReporter.report(validationResult).join(','));
      return [undefined, 'Failed to decode constructor page'];
    }
  }, [cpSnapshot]);

  const [displayName, setDisplayName] = useState(
    getDisplayName(user || undefined, constructorPage)
  );
  const [didUpdateDN, setDidUpdateDN] = useState(false);

  // On change to user/cp, update display name if we haven't already set
  useEffect(() => {
    if (!didUpdateDN) {
      setDisplayName(getDisplayName(user || undefined, constructorPage));
    }
  }, [user, constructorPage, didUpdateDN]);

  // On logout, reset display name
  useEffect(() => {
    if (!user) {
      setDisplayName(null);
      setDidUpdateDN(false);
    }
  }, [user]);

  const updateDisplayName = useCallback(
    async (newDN: string) => {
      if (user) {
        setDisplayName(newDN);
        setDidUpdateDN(true);
        return updateProfile(user, {
          displayName: newDN,
        });
      }
    },
    [user]
  );

  const [isPatron, setIsPatron] = useState(false);
  const [isMod, setIsMod] = useState(false);
  useEffect(() => {
    if (!user) {
      return;
    }
    let didCancel = false;
    async function getUserInfo() {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const res = await (
        await fetch(withBasePath(`/api/userinfo/${user?.uid}`))
      )
        .json()
        .catch((e: unknown) => {
          console.log(e);
        });
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!didCancel && res) {
        const ui = parseUserInfo(res);
        setIsPatron(ui.isPatron);
        setIsMod(ui.isMod);
      }
    }
    logAsyncErrors(getUserInfo)();
    return () => {
      didCancel = true;
    };
  }, [user]);

  return {
    user: user || undefined,
    isPatron,
    isMod,
    isAdmin,
    constructorPage,
    notifications,
    prefs: hasAccount ? accountPrefs : guestPrefs,
    updateGuestPrefs,
    loading:
      isLoading ||
      loadingUser ||
      loadingCP ||
      loadingAccountPrefs ||
      (!hasAccount && loadingGuestPrefs),
    error:
      authError?.message ||
      cpError?.message ||
      cpDecodeError ||
      accountPrefsError,
    displayName,
    updateDisplayName,
  };
}
