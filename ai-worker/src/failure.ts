/** A failure with a code the Studio shows, and whether another attempt could succeed. */
export class TaskFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
