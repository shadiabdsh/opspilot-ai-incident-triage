/** Edits a recommendation's parameters for Modify, showing what each value was. */
import { useId } from 'react';
import styles from '../Dialog/Dialog.module.css';

export interface ActionEditorProps {
  original: Record<string, string>;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

export function ActionEditor({ original, value, onChange }: ActionEditorProps) {
  const baseId = useId();
  const keys = Object.keys(original);
  if (keys.length === 0) return <p className={styles.description}>This action has no editable parameters.</p>;
  return (
    <div className={styles.fieldset}>
      {keys.map((key, i) => {
        const current = value[key] ?? original[key] ?? '';
        const changed = current !== original[key];
        return (
          <div className={styles.field} key={key}>
            <label htmlFor={`${baseId}-${i}`}>{key}</label>
            <input
              id={`${baseId}-${i}`}
              className={styles.input}
              value={current}
              aria-describedby={changed ? `${baseId}-${i}-was` : undefined}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
            {changed && (
              <span id={`${baseId}-${i}-was`} className={styles.hint}>
                Was: {original[key]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
