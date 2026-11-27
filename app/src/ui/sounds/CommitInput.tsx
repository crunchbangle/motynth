import { useState, type InputHTMLAttributes } from 'react';

interface CommitInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onInput'
> {
  value: string;
  /** Called on Enter or when focus leaves, if the text changed. */
  onCommit(text: string): void;
  /** Called on every keystroke. */
  onDraft?(text: string): void;
}

/**
 * A text input that applies its value only when editing is finished, so a
 * half-typed name or number doesn't take effect.
 */
export function CommitInput({ value, onCommit, onDraft, ...props }: CommitInputProps) {
  const [draft, setDraft] = useState(value);
  const [committed, setCommitted] = useState(value);
  // Follow outside changes (another instrument selected, a rename elsewhere).
  if (value !== committed) {
    setCommitted(value);
    setDraft(value);
  }

  const commit = () => {
    if (draft !== value) onCommit(draft);
    // If the parent rejected the text, show its value again.
    setDraft(value);
  };

  return (
    <input
      {...props}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        onDraft?.(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
      }}
    />
  );
}
