import { setDoc } from 'firebase/firestore';
import { getDocRef } from '../lib/firebaseWrapper.js';
import {
  AccountPrefsFlagsT,
  AccountPrefsT,
  SolverPrefsT,
} from '../lib/prefs.js';
import { logAsyncErrors } from '../lib/utils.js';
import { useSnackbar } from './Snackbar.js';

interface PrefSettingProps {
  prefs: AccountPrefsT | undefined;
  userId?: string;
  flag: keyof AccountPrefsFlagsT;
  text: string;
  invert?: boolean;
  onGuestPrefsChange?: (prefs: SolverPrefsT) => void;
}

export const PrefSetting = (props: PrefSettingProps) => {
  const { showSnackbar } = useSnackbar();
  const prefSet = props.prefs?.[props.flag] ?? false;
  return (
    <label>
      <input
        className="marginRight1em"
        type="checkbox"
        checked={props.invert ? !prefSet : prefSet}
        onChange={logAsyncErrors(async (e) => {
          const value = props.invert ? !e.target.checked : e.target.checked;
          //this will send you to user saved prefences otherwise it will go to guest
          if (props.userId) {
            await setDoc(
              getDocRef('prefs', props.userId),
              { [props.flag]: value },
              { merge: true }
            );
            showSnackbar('Preferences Updated');
            return;
          }
          //this would only run if you didn't set up the presetting compo right, has to be done
          //for eslint reasons
          if (!props.onGuestPrefsChange) {
            throw new Error('didnt assign prefs change');
          }
          //send prefsChange with new props
          props.onGuestPrefsChange({ ...props.prefs, [props.flag]: value });
          showSnackbar('Preferences Updated');
        })}
        onClick={(e) => {
          e.stopPropagation();
        }}
      />
      {props.text}
    </label>
  );
};

export const SolverPreferencesList = ({
  prefs,
  userId,
  onGuestPrefsChange,
}: {
  prefs?: AccountPrefsT;
  userId?: string;
  onGuestPrefsChange?: (prefs: SolverPrefsT) => void;
}) => {
  return (
    <>
      <li>
        <PrefSetting
          prefs={prefs}
          userId={userId}
          flag={'advanceOnPerpendicular'}
          text="Advance to next square when changing direction with arrow keys"
          onGuestPrefsChange={onGuestPrefsChange}
        />
      </li>
      <li>
        <PrefSetting
          prefs={prefs}
          userId={userId}
          flag={'dontSkipCompleted'}
          invert={true}
          text="Skip over completed squares after entering a letter"
          onGuestPrefsChange={onGuestPrefsChange}
        />
      </li>
      <li>
        <PrefSetting
          prefs={prefs}
          userId={userId}
          flag={'dontAdvanceWordAfterCompletion'}
          invert={true}
          text="Move to next clue after completing an entry"
          onGuestPrefsChange={onGuestPrefsChange}
        />
      </li>
      <li>
        <PrefSetting
          prefs={prefs}
          userId={userId}
          flag={'solveDownsOnly'}
          text="Start puzzles in downs-only mode"
          onGuestPrefsChange={onGuestPrefsChange}
        />
      </li>
      <li>
        <PrefSetting
          prefs={prefs}
          userId={userId}
          flag={'dontPauseOnLostFocus'}
          invert={true}
          text="Automatically pause solving when page loses focus"
          onGuestPrefsChange={onGuestPrefsChange}
        />
      </li>
    </>
  );
};
