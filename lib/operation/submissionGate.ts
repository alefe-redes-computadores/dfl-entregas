/** R49: bloqueio síncrono por instância de formulário. Não substitui idempotência do repositório. */
export interface SubmissionLock { current: boolean }

export function claimSubmission(lock: SubmissionLock): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

/** Liberar apenas após falha; em sucesso o formulário aguarda navegação. */
export function releaseSubmission(lock: SubmissionLock): void {
  lock.current = false;
}
