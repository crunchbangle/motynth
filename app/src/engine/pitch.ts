// Pitch arithmetic.
//
// Pitch has three layers:
// - A tuning splits a register (usually an octave) into equal *steps*.
// - A mode picks some of those steps as a scale. Its *degrees* count through
//   the picked steps, wrapping into the next register.
// - The root is the frequency of step 0 (degree 1).
//
// Internally degrees count from 0; the language counts from 1.

/**
 * The tuning step of a zero-based degree.
 * With a major mode in 12 steps: degree 0 is step 0, degree 2 is step 4,
 * degree 7 is step 12 (the next register), degree -1 is step -1.
 */
export function degreeToStep(
  degree: number,
  mode: readonly number[],
  stepsPerRegister: number,
): number {
  const register = Math.floor(degree / mode.length);
  return (mode[degree - register * mode.length] as number) + register * stepsPerRegister;
}

/**
 * The degree at or below a tuning step, and how many steps the note sits above
 * that degree (non-zero when the step is not in the mode).
 */
export function stepToDegree(
  step: number,
  mode: readonly number[],
  stepsPerRegister: number,
): { degree: number; remainder: number } {
  let register = Math.floor(step / stepsPerRegister);
  const stepInRegister = step - register * stepsPerRegister;

  // The highest degree of the mode at or below the step.
  let index = -1;
  for (let k = 0; k < mode.length; k++) {
    if ((mode[k] as number) <= stepInRegister) index = k;
  }

  // Below the mode's first step (only for modes that skip step 0): use the
  // top degree of the register below.
  if (index < 0) {
    register -= 1;
    index = mode.length - 1;
    return {
      degree: register * mode.length + index,
      remainder: stepInRegister + stepsPerRegister - (mode[index] as number),
    };
  }
  return {
    degree: register * mode.length + index,
    remainder: stepInRegister - (mode[index] as number),
  };
}

/** Frequency in Hz of a tuning step, counted from the root. */
export function stepFrequency(
  step: number,
  rootHz: number,
  registerRatio: number,
  stepsPerRegister: number,
): number {
  return rootHz * Math.pow(registerRatio, step / stepsPerRegister);
}
