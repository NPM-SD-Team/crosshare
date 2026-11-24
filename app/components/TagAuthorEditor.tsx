import * as t from 'io-ts';
import { useEffect, useState } from 'react';
import { getFromSessionOrDB } from '../lib/dbUtils.js';
import { TAG_LENGTH_LIMIT, TAG_LENGTH_MIN, eqSet } from '../lib/utils.js';
import { Button } from './Buttons.js';
import { LengthView } from './Inputs.js';
import { useSnackbar } from './Snackbar.js';
import { TagList } from './TagList.js';

interface TagEditorBaseProps {
  save: (newTags: string[]) => Promise<void>;
  cancel?: () => void;
}

interface TagEditorUserProps extends TagEditorBaseProps {
  userTags: string[];
  forced?: false;
}

interface TagEditorForcedProps extends TagEditorBaseProps {
  forcedTags: string[];
  forced: true;
}

type TagEditorProps = TagEditorForcedProps | TagEditorUserProps;

export function TagAuthorEditor(props: TagEditorProps) {
  const { showSnackbar } = useSnackbar();
  const [savedTags, setSavedTags] = useState(
    props.forced ? props.forcedTags : props.userTags
  );
  const [tags, setTags] = useState(
    props.forced ? props.forcedTags : props.userTags
  );
  const [newTag, setNewTag] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!props.forced);
  const [disallowed, setDisallowed] = useState<string[]>([]);

  useEffect(() => {
    if (props.forced) {
      // If we're editing forced tags then anything goes!
      return;
    }
    let didCancel = false;
    getFromSessionOrDB({
      collection: 'settings',
      docId: 'tags',
      validator: t.type({ disallowed: t.array(t.string) }),
      ttl: 30 * 60 * 1000,
    })
      .then((s) => {
        if (didCancel) {
          return;
        }
        if (!s) {
          setError('Could not load settings');
          setLoading(false);
        } else {
          setDisallowed(s.disallowed);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (didCancel) {
          return;
        }
        console.log(e);
        setError(String(e));
        setLoading(false);
      });
    return () => {
      didCancel = true;
    };
  }, [props.forced]);

  function addTag(t: string) {
    if (disallowed.includes(t)) {
      showSnackbar('Sorry, that tag is reserved.');
    } else {
      //flipped to alwats go first!!!!
      setTags((prv) => (prv.includes(t) ? prv : [t, ...prv]));
    }
  }

  function removeTag(t: string) {
    setTags((prv) => prv.filter((x) => x !== t));
  }

  if (loading) {
    return <p>Loading tag editor</p>;
  }
  if (error) {
    return <p>Failed to load tag editor: {error}. Please try again</p>;
  }

  return (
    <>
      <h4>Add or Remove Author Tags :</h4>
      <TagList
        tags={tags}
        remove={(t) => {
          removeTag(t);
        }}
      />

      <>
        <div className="marginTop1em">
          <input
            type="text"
            placeholder={`New author name`}
            value={newTag}
            onChange={(e) => {
              setNewTag(
                e.target.value
                  .replace(/[^A-Za-z0-9-]/g, '')
                  .slice(0, TAG_LENGTH_LIMIT)
              );
            }}
          />
          <LengthView value={newTag} maxLength={TAG_LENGTH_LIMIT} />
          <Button
            onClick={() => {
              addTag(newTag);
              setNewTag('');
            }}
            text="Add author tag"
            disabled={newTag.length < TAG_LENGTH_MIN}
          />
        </div>
        {props.forced ? (
          ''
        ) : (
          <>
            <h5 className="marginTop1em">Example authors:</h5>
            <TagList
              tags={[
                'Lauren-Paatela',
                'Madeline-Schmit',
                'Sophia-Strong',
                'Harrison-Strong',
                'Mike Fields',
                'Patrick-Bate',
                'Jacob-Schwitzer',
                'Sky-Mavis-Gann',
              ]}
              onClick={(t) => {
                addTag(t);
              }}
            />
          </>
        )}
      </>
      <div className="marginTop1em">
        <Button
          onClick={() => {
            props
              .save(
                Array.from(
                  new Set(
                    tags
                      .map((tag) => tag.trim())
                      .filter((tag) => tag.length > 2)
                  )
                )
              )
              .then(() => {
                setSavedTags(tags);
                showSnackbar('Saved tags');
              })
              .catch((e: unknown) => {
                console.error('error saving tags', e);
              });
          }}
          disabled={eqSet(new Set(tags), new Set(savedTags))}
          text="Save tags"
        />
        {props.cancel ? (
          <Button
            boring={true}
            className="marginLeft0-5em"
            onClick={props.cancel}
            text="Cancel"
          />
        ) : (
          ''
        )}
      </div>
    </>
  );
}
