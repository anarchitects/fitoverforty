/** Thrown when a block cannot be stored. Callers turn this into a 400. */
export class InvalidBlockError extends Error {
  constructor(
    readonly index: number,
    readonly blockType: string,
    reason: string,
  ) {
    super(`block ${index} (${blockType}): ${reason}`);
    this.name = 'InvalidBlockError';
  }
}
