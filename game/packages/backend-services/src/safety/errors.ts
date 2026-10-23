/** Stable machine code. Messages never include a contact, a birth year, or free text. */
export class SafetyError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'SafetyError'
  }
}
