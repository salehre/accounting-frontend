/**
 * The backend answers in English. Known messages are translated here (by pattern, with the
 * dynamic part passed along); anything unknown is shown as the server wrote it.
 */
const PATTERNS: Array<[RegExp, string, ((m: RegExpMatchArray) => Record<string, string>)?]> = [
  [/^This account is in use\. Disable it instead/, 'serverMsg.accountInUseDelete'],
  [/^This account is already in use: only its name/, 'serverMsg.accountInUseEdit'],
  [/^Disable the child accounts first/, 'serverMsg.disableChildrenFirst'],
  [/^Enable the parent account first/, 'serverMsg.enableParentFirst'],
  [/^The parent account is disabled/, 'serverMsg.parentDisabled'],
  [/^Only level 3 accounts can require/, 'serverMsg.onlyLevel3Detail'],
  [/^The code must start with the parent code \((.+?)\)/, 'serverMsg.codeFollowsParent', (m) => ({ code: m[1]! })],
  [/has already been taken/, 'serverMsg.taken'],
  [/^Nothing to update/, 'serverMsg.nothingToUpdate'],
  [/^Account not found/, 'serverMsg.notFound'],
  [/^A closed fiscal year cannot be edited/, 'serverMsg.yearClosedEdit'],
  [/^Dates can no longer be changed/, 'serverMsg.yearHasEntriesDates'],
  [/^A closed fiscal year cannot be deleted/, 'serverMsg.yearClosedDelete'],
  [/^This fiscal year has entries and cannot be deleted/, 'serverMsg.yearHasEntriesDelete'],
  [/^This fiscal year is already closed/, 'serverMsg.yearAlreadyClosed'],
  [/^This fiscal year is not closed/, 'serverMsg.yearNotClosed'],
  [/^The fiscal year cannot be closed yet/, 'serverMsg.yearCannotClose'],
  [/^The end date must be after the start date/, 'serverMsg.endAfterStart'],
  [/^A fiscal year cannot be longer than (\d+) days/, 'serverMsg.yearTooLong', (m) => ({ n: m[1]! })],
  [/^Fiscal year not found/, 'serverMsg.yearNotFound'],
  [/^Each line must have either a debit or a credit/, 'serverMsg.lineAmount'],
  [/^The fiscal year does not exist or is closed/, 'serverMsg.entryYearClosed'],
  [/^Entry is already posted/, 'serverMsg.entryPosted'],
  [/^Entry not found/, 'serverMsg.entryNotFound'],
  [/^Year-end entries are managed from/, 'serverMsg.yearEndManaged'],
  [/^The soft lock already has this date/, 'serverMsg.softSame'],
  [/^The password is incorrect/, 'serverMsg.passwordWrong'],
  [/^Type exactly:/, 'serverMsg.phraseWrong'],
  [/^Read the warnings of the preview/, 'serverMsg.ackWarnings'],
  [/before or equal to today/, 'serverMsg.notFuture'],
  [/must be at least (\d+) characters/, 'serverMsg.minChars', (m) => ({ n: m[1]! })],
  [/^Detail accounts can only be shown at level 3/, 'serverMsg.detailsLevel3'],
  [/^The report has more than (\d+) rows/, 'serverMsg.reportTooBig', (m) => ({ n: m[1]! })],
  [/^The last number must not be before/, 'serverMsg.numberOrder'],
  [/^The cursor is not valid/, 'serverMsg.cursorInvalid'],
  [/^You cannot change your own role or disable your own account/, 'serverMsg.selfChange'],
  [/^At least one active administrator must remain/, 'serverMsg.adminRemains'],
  [/^Use the change-password feature for your own account/, 'serverMsg.selfReset'],
  [/^The password is too long/, 'serverMsg.passwordTooLong'],
  [/^The administrator role always has every permission/, 'serverMsg.adminRoleFixed'],
  [/^A built-in role cannot be renamed/, 'serverMsg.builtInRename'],
  [/^A built-in role cannot be deleted/, 'serverMsg.builtInDelete'],
  [/^This role is used by (\d+) user/, 'serverMsg.roleInUse', (m) => ({ n: m[1]! })],
  [/^A role with this name already exists/, 'serverMsg.roleNameTaken'],
  [/^"([^"]+)" also needs "([^"]+)"/, 'serverMsg.permNeeds', (m) => ({ a: m[1]!, b: m[2]! })],
  [/^The books cannot be hard-locked yet/, 'serverMsg.cannotHardLock'],
  [/^The file has more than (\d+) rows/, 'serverMsg.openingTooMany', (m) => ({ n: m[1]! })],
  [/^The file could not be read/, 'serverMsg.openingUnreadable'],
  [/^The file cannot be imported/, 'serverMsg.openingCannotImport'],
  [/must be a file of type|must be an? .*xlsx/i, 'serverMsg.openingFileType'],
  [/greater than 5120|may not be greater than 5120/i, 'serverMsg.openingFileSize'],
  [/^A fiscal year cannot start inside the hard-locked period/, 'serverMsg.fyHardStart'],
  [/^Dates cannot be changed: this fiscal year starts inside the hard-locked/, 'serverMsg.fyHardDates'],
  [/^This fiscal year starts inside the hard-locked period and cannot be deleted/, 'serverMsg.fyHardDelete'],
  [/^This fiscal year ends inside the hard-locked period .* cannot be reopened/, 'serverMsg.fyHardReopen'],
  [/^Year-end entries already exist/, 'serverMsg.yeAlready'],
  [/^Year-end entries cannot be generated yet/, 'serverMsg.yeCannotGenerate'],
  [/^There is nothing to close in this fiscal year/, 'serverMsg.yeNothing'],
  [/^There are no year-end drafts/, 'serverMsg.yeNoDrafts'],
  [/^The year-end entries are already posted\. Reverse/, 'serverMsg.yePostedReverse'],
  [/^Generate the year-end entries first/, 'serverMsg.yeGenerateFirst'],
  [/^The year-end entries are already posted/, 'serverMsg.yeAlreadyPosted'],
  [/^The year-end entries cannot be posted yet/, 'serverMsg.yeCannotPost'],
  [/^There are no year-end entries to reverse/, 'serverMsg.yeNothingToReverse'],
  [/^The year-end entries are still drafts/, 'serverMsg.yeStillDrafts'],
  [/^Reopen fiscal year "(.+?)" first/, 'serverMsg.yeReopenFirst', (m) => ({ title: m[1]! })],
  // ---- bank reconciliation
  [/^The closing balance does not follow .*should be (-?\d+)\./, 'serverMsg.bankClosing', (m) => ({ n: Number(m[1]).toLocaleString('en-US') })],
  [/^The statement has no lines/, 'serverMsg.bankNoLines'],
  [/^A statement can have at most (\d+) lines/, 'serverMsg.bankTooManyLines', (m) => ({ n: m[1]! })],
  [/^Another statement of this account already covers/, 'serverMsg.bankOverlap'],
  [/^The whole period of the statement must lie inside one fiscal year/, 'serverMsg.bankOneYear'],
  [/^The date of the line is outside the period/, 'serverMsg.bankLineOutside'],
  [/^A line cannot have a zero amount/, 'serverMsg.bankZeroAmount'],
  [/^Choose an active account that can receive entries/, 'serverMsg.bankBadAccount'],
  [/^The end date is before the start date/, 'serverMsg.bankEndBeforeStart'],
  [/^Bank statement not found|^Statement line not found/, 'serverMsg.bankNotFound'],
  [/^This line is already matched/, 'serverMsg.bankLineMatched'],
  [/^The selected lines add up to (-?\d+) but the statement line is (-?\d+)/, 'serverMsg.bankSumMismatch', (m) => ({ a: Number(m[1]).toLocaleString('en-US'), b: Number(m[2]).toLocaleString('en-US') })],
  [/^Some of the lines are already matched/, 'serverMsg.bankLinesTaken'],
  [/^Some of the lines do not belong to this account/, 'serverMsg.bankLinesForeign'],
  [/^Choose at least one line of the books/, 'serverMsg.bankPickOne'],
  [/^This statement is reconciled\. Reopen/, 'serverMsg.bankLocked'],
  [/^(\d+) line\(s\) of the statement are not matched yet/, 'serverMsg.bankNotMatchedYet', (m) => ({ n: m[1]! })],
  [/^The reconciliation does not balance: the difference is (-?\d+)/, 'serverMsg.bankNotBalanced', (m) => ({ n: Number(m[1]).toLocaleString('en-US') })],
  [/^A later statement of this account exists/, 'serverMsg.bankLaterExists'],
  [/^This statement is not reconciled/, 'serverMsg.bankNotReconciled'],
  [/^This line has no match/, 'serverMsg.bankNoMatch'],
  [/^None of these lines was marked as cleared/, 'serverMsg.bankNoCleared'],
  [/^Some of the lines were matched by someone else/, 'serverMsg.bankRace'],
  // ---- treasury (cheques)
  [/^Set the account "[^"]+" in the treasury settings first/, 'serverMsg.trSettings'],
  [/^This cheque number already exists for this bank/, 'serverMsg.trNumberTaken'],
  [/^This Sayad id already exists/, 'serverMsg.trSayadTaken'],
  [/^The cheque is "[^"]+": "[^"]+" is possible only from/, 'serverMsg.trWrongStatus'],
  [/^A (received|issued) cheque has no action/, 'serverMsg.trNoAction'],
  [/^No fiscal year covers this date/, 'serverMsg.trNoYear'],
  [/^The fiscal year of this date is closed/, 'serverMsg.trYearClosed'],
  [/^Cheque not found/, 'serverMsg.trNotFound'],
  [/^The bank account the cheque is drawn on is required/, 'serverMsg.trBankRequired'],
  [/^This account needs a detail account|^The account of the cheques needs a detail account/, 'serverMsg.trDetailRequired'],
  [/^The detail account does not exist/, 'serverMsg.trDetailMissing'],
  [/^The cheque has no bank account/, 'serverMsg.trNoBank'],
  [/due date.* after or equal to/i, 'serverMsg.trDueBeforeIssue'],
  [/^Voucher not found/, 'serverMsg.trVoucherNotFound'],
  [/^This voucher is already cancelled/, 'serverMsg.trVoucherCancelled'],
  [/^The amount of the voucher must be above zero/, 'serverMsg.trVoucherAmount'],
]

export function useErrorText() {
  const { t } = useI18n()

  function text(message: string): string {
    for (const [re, key, params] of PATTERNS) {
      const m = message.match(re)
      if (m) return t(key, params ? params(m) : {})
    }
    return message
  }

  /** One readable sentence for any error */
  function of(e: unknown): string {
    const err = toApiError(e)
    if (err.status === 0) return t('errors.network')
    if (err.status === 403) return t('errors.forbidden')
    if (err.status === 429) return t('errors.tooManyAttempts')
    if (err.status >= 500) return t('errors.generic')
    return text(err.message)
  }

  return { text, of }
}