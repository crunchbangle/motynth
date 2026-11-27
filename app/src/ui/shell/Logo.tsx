/** Column heights of the pixel bars in the logo. */
const COLUMNS = [2, 3, 5, 6, 5, 3, 1, 2, 4, 5];
const COLORS = ['#7d90ff', '#ff6fa3', '#ffc04a', '#2ed3bf', '#a98cff'];
const CELL = 5;
const GAP = 1;
const ROWS = 6;

/** A small bar chart of coloured pixels. */
export function Logo() {
  const pitch = CELL + GAP;
  const width = COLUMNS.length * pitch;
  const height = ROWS * pitch;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * 0.9}
      height={height * 0.9}
      aria-hidden="true"
    >
      {COLUMNS.flatMap((count, column) =>
        Array.from({ length: count }, (_, k) => (
          <rect
            key={`${column}-${k}`}
            x={column * pitch}
            y={(ROWS - 1 - k) * pitch}
            width={CELL}
            height={CELL}
            fill={COLORS[(column + k) % COLORS.length]}
          />
        )),
      )}
    </svg>
  );
}
