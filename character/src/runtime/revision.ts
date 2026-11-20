/**
 * The Character Runtime's revision: a package's `compatibility.minRuntime` must not exceed it. Raise it whenever
 * the runtime learns to draw something new that a package may rely on; a change in how an existing package is
 * drawn is a new revision too (its golden frames change).
 */
// 2: viseme channels are consumed through the face rig (`face.visemes`), without a control of their own.
export const RUNTIME_REVISION = 2;
