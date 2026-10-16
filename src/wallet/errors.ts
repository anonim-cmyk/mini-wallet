export class DomainError extends Error {}

export class InsufficientBalanceError extends DomainError {
  constructor() {
    super("Saldo tidak cukup");
  }
}

export class InvalidTransferError extends DomainError {}
export class AccountNotFoundError extends DomainError {
  constructor() {
    super("Salah satu akun tidak ditemukan");
  }
}
export class IdempotencyConflictError extends DomainError {
  constructor() {
    super("Idempotency key dipakai untuk request yang berbeda");
  }
}
