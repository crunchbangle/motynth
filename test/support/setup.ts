// Runs before every test file.

// jsdom has no canvas: getContext logs "not implemented" and returns
// nothing. Return null quietly instead; components skip drawing then.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext;
}

// Each test starts with empty storage.
if (typeof localStorage !== 'undefined') {
  afterEach(() => localStorage.clear());
}
