import { PlayButton } from '../common/PlayButton.tsx';
import { Logo } from './Logo.tsx';
import { Scope } from './Scope.tsx';

export type TabName = 'compose' | 'sounds' | 'learn';

export const TABS: readonly { name: TabName; label: string }[] = [
  { name: 'compose', label: 'Compose' },
  { name: 'sounds', label: 'Sounds' },
  { name: 'learn', label: 'Learn' },
];

interface HeaderProps {
  tab: TabName;
  onTabChange(tab: TabName): void;
  loop: boolean;
  onLoopChange(loop: boolean): void;
  /** Whether the Compose code is playing. */
  playing: boolean;
  onPlayToggle(): void;
}

export function Header({
  tab,
  onTabChange,
  loop,
  onLoopChange,
  playing,
  onPlayToggle,
}: HeaderProps) {
  return (
    <header className="top">
      <div className="brand">
        <span>
          <Logo />
        </span>
        <h1 className="name">Motynth</h1>
      </div>
      <div className="tabs" role="tablist" aria-label="Sections">
        {TABS.map(({ name, label }) => (
          <button
            key={name}
            type="button"
            className="tab"
            role="tab"
            id={`tab-${name}`}
            aria-selected={tab === name}
            aria-controls={`view-${name}`}
            onClick={() => onTabChange(name)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="transport">
        <label>
          <input type="checkbox" checked={loop} onChange={(e) => onLoopChange(e.target.checked)} />{' '}
          Loop
        </label>
        <Scope />
        <PlayButton id="playbtn" playing={playing} onClick={onPlayToggle} />
      </div>
    </header>
  );
}
