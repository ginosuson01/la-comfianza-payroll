import {
  useEffect,
  useState,
} from 'react'

import { ApiError } from '../api/client'
import {
  getEmployeePayrollProfile,
  revealEmployeePayrollAccount,
  setEmployeePayrollProfile,
  type EmployeeDirectoryView,
  type EmployeePayoutMethod,
  type EmployeePayrollProfileView,
} from '../api/employees'

interface EmployeePayrollProfilePanelProps {
  accessToken: string
  employee: EmployeeDirectoryView

  onCancel: () => void

  onSaved: (
    profile: EmployeePayrollProfileView,
  ) => void
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to manage employee payroll profile.'
}

export function EmployeePayrollProfilePanel({
  accessToken,
  employee,
  onCancel,
  onSaved,
}: EmployeePayrollProfilePanelProps) {
  const [
    profile,
    setProfile,
  ] =
    useState<EmployeePayrollProfileView | null>(
      null,
    )

  const [
    payoutMethod,
    setPayoutMethod,
  ] =
    useState<EmployeePayoutMethod>('CASH')

  const [
    bankName,
    setBankName,
  ] = useState('')

  const [
    accountNumber,
    setAccountNumber,
  ] = useState('')

  const [
    showAccountNumber,
    setShowAccountNumber,
  ] = useState(false)

  const [
    revealedAccountNumber,
    setRevealedAccountNumber,
  ] = useState<string | null>(null)

  const [
    revealLoading,
    setRevealLoading,
  ] = useState(false)

  const [
    accountCopied,
    setAccountCopied,
  ] = useState(false)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  const currentEmployment =
    employee.currentEmployment

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!currentEmployment) {
        setLoading(false)

        return
      }

      try {
        setLoading(true)
        setError(null)

        const result =
          await getEmployeePayrollProfile(
            accessToken,
            employee.id,
          )

        if (cancelled) {
          return
        }

        setProfile(result)

        if (result) {
          setPayoutMethod(
            result.payoutMethod,
          )

          setBankName(
            result.bankName ?? '',
          )
        } else {
          setPayoutMethod('CASH')
          setBankName('')
        }

        setAccountNumber('')
        setShowAccountNumber(false)

        setRevealedAccountNumber(null)
        setAccountCopied(false)
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              loadError,
            ),
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    employee.id,
    currentEmployment,
  ])

  useEffect(() => {
    if (!revealedAccountNumber) {
      return
    }

    const timeoutId =
      window.setTimeout(
        () => {
          setRevealedAccountNumber(
            null,
          )

          setAccountCopied(false)
        },
        30_000,
      )

    return () => {
      window.clearTimeout(
        timeoutId,
      )
    }
  }, [revealedAccountNumber])

  useEffect(() => {
    if (!accountCopied) {
      return
    }

    const timeoutId =
      window.setTimeout(
        () => {
          setAccountCopied(false)
        },
        2_000,
      )

    return () => {
      window.clearTimeout(
        timeoutId,
      )
    }
  }, [accountCopied])

  if (!currentEmployment) {
    return (
      <div className="employee-payroll-profile-panel">
        <div className="employee-form-header">
          <div>
            <p className="eyebrow">
              Payroll Configuration
            </p>

            <h2>
              Payroll Profile
            </h2>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>

        <div
          className="form-feedback form-feedback-error"
          role="alert"
        >
          Current employment assignment is
          required before a payroll profile can
          be configured.
        </div>
      </div>
    )
  }

  const existingAtmAccount =
    profile?.payoutMethod === 'ATM' &&
    Boolean(profile.accountNumberLast4)

  const trimmedBankName =
    bankName.trim()

  const trimmedAccountNumber =
    accountNumber.trim()

  const accountNumberValid =
    trimmedAccountNumber.length === 0 ||
    /^\d{4,30}$/.test(
      trimmedAccountNumber,
    )

  const atmValid =
    payoutMethod === 'CASH' ||
    (
      trimmedBankName.length > 0 &&
      accountNumberValid &&
      (
        existingAtmAccount ||
        trimmedAccountNumber.length > 0
      )
    )

  async function handleRevealAccount() {
    setError(null)
    setAccountCopied(false)

    try {
      setRevealLoading(true)

      const result =
        await revealEmployeePayrollAccount(
          accessToken,
          employee.id,
        )

      setRevealedAccountNumber(
        result.accountNumber,
      )
    } catch (revealError: unknown) {
      setError(
        getErrorMessage(
          revealError,
        ),
      )
    } finally {
      setRevealLoading(false)
    }
  }

  function handleHideRevealedAccount() {
    setRevealedAccountNumber(null)
    setAccountCopied(false)
  }

  async function handleCopyRevealedAccount() {
    if (!revealedAccountNumber) {
      return
    }

    setError(null)

    try {
      if (!navigator.clipboard) {
        throw new Error(
          'Clipboard access is not available in this browser.',
        )
      }

      await navigator.clipboard.writeText(
        revealedAccountNumber,
      )

      setAccountCopied(true)
    } catch (copyError: unknown) {
      setError(
        getErrorMessage(
          copyError,
        ),
      )
    }
  }

  async function handleSave() {
    setError(null)

    if (
      payoutMethod === 'ATM' &&
      trimmedBankName.length === 0
    ) {
      setError(
        'Bank Name is required for ATM payout.',
      )

      return
    }

    if (
      payoutMethod === 'ATM' &&
      trimmedAccountNumber.length > 0 &&
      !/^\d{4,30}$/.test(
        trimmedAccountNumber,
      )
    ) {
      setError(
        'Account Number must contain 4 to 30 digits only.',
      )

      return
    }

    if (
      payoutMethod === 'ATM' &&
      !existingAtmAccount &&
      trimmedAccountNumber.length === 0
    ) {
      setError(
        'Account Number is required when configuring ATM payout.',
      )

      return
    }

    try {
      setSaving(true)

      const saved =
        await setEmployeePayrollProfile(
          accessToken,
          employee.id,
          payoutMethod === 'CASH'
            ? {
                payoutMethod: 'CASH',
              }
            : {
                payoutMethod: 'ATM',
                bankName:
                  trimmedBankName,
                ...(trimmedAccountNumber
                  ? {
                      accountNumber:
                        trimmedAccountNumber,
                    }
                  : {}),
              },
        )

      setProfile(saved)

      setPayoutMethod(
        saved.payoutMethod,
      )

      setBankName(
        saved.bankName ?? '',
      )

      setAccountNumber('')
      setShowAccountNumber(false)

      setRevealedAccountNumber(null)
      setAccountCopied(false)

      onSaved(saved)
    } catch (saveError: unknown) {
      setError(
        getErrorMessage(
          saveError,
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="employee-payroll-profile-panel">
      <div className="employee-form-header">
        <div>
          <p className="eyebrow">
            Payroll Configuration
          </p>

          <h2>
            Payroll Profile
          </h2>

          <p>
            {employee.fullName}
            {' · '}
            {employee.employeeNumber}
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      {loading ? (
        <div className="employee-payroll-profile-loading">
          Loading payroll profile...
        </div>
      ) : (
        <>
          <div className="employee-profile-section">
            <h3>
              Current Payout Profile
            </h3>

            {profile ? (
              <div className="employee-profile-grid">
                <div>
                  <span>
                    Payout Method
                  </span>

                  <strong>
                    {
                      profile.payoutMethod
                    }
                  </strong>
                </div>

                {profile.payoutMethod ===
                  'ATM' && (
                  <>
                    <div>
                      <span>
                        Bank
                      </span>

                      <strong>
                        {
                          profile.bankName ??
                          '—'
                        }
                      </strong>
                    </div>

                    <div className="employee-current-account">
                      <span>
                        Account
                      </span>

                      <div className="employee-current-account-value">
                        <strong>
                          {revealedAccountNumber ??
                            (
                              profile.accountNumberLast4
                                ? `•••• ${profile.accountNumberLast4}`
                                : '—'
                            )}
                        </strong>

                        {profile.accountNumberLast4 && (
                          <div className="employee-current-account-actions">
                            {revealedAccountNumber ? (
                              <>
                                <button
                                  type="button"
                                  className="employee-account-secondary-action"
                                  onClick={() =>
                                    void handleCopyRevealedAccount()
                                  }
                                >
                                  {accountCopied
                                    ? 'Copied'
                                    : 'Copy'}
                                </button>

                                <button
                                  type="button"
                                  className="employee-account-secondary-action"
                                  onClick={
                                    handleHideRevealedAccount
                                  }
                                >
                                  Hide
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="employee-account-secondary-action"
                                disabled={
                                  revealLoading
                                }
                                onClick={() =>
                                  void handleRevealAccount()
                                }
                              >
                                {revealLoading
                                  ? 'Revealing...'
                                  : 'Show Full Account'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {revealedAccountNumber && (
                        <small>
                          Full account is temporarily
                          visible and will hide
                          automatically after 30
                          seconds.
                        </small>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="employee-payroll-profile-empty">
                No payroll payout profile has
                been configured for the current
                employment assignment.
              </div>
            )}
          </div>

          <div className="employee-profile-section">
            <h3>
              {profile
                ? 'Update Payout Profile'
                : 'Set Payout Profile'}
            </h3>

            <div className="employee-payroll-profile-form-grid">
              <label>
                <span>
                  Payout Method
                </span>

                <select
                  value={payoutMethod}
                  disabled={saving}
                  onChange={(event) => {
                    const value =
                      event.target
                        .value as EmployeePayoutMethod

                    setPayoutMethod(
                      value,
                    )

                    setError(null)

                    if (
                      value === 'CASH'
                    ) {
                      setAccountNumber('')
                      setShowAccountNumber(
                        false,
                      )
                    }
                  }}
                >
                  <option value="CASH">
                    CASH
                  </option>

                  <option value="ATM">
                    ATM
                  </option>
                </select>
              </label>

              {payoutMethod === 'ATM' && (
                <>
                  <label>
                    <span>
                      Bank Name
                    </span>

                    <input
                      type="text"
                      value={bankName}
                      disabled={saving}
                      placeholder="e.g. BDO"
                      onChange={(event) =>
                        setBankName(
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Account Number
                    </span>

                    <div className="employee-account-number-field">
                      <input
                        type={
                          showAccountNumber
                            ? 'text'
                            : 'password'
                        }
                        inputMode="numeric"
                        autoComplete="off"
                        value={accountNumber}
                        disabled={saving}
                        placeholder={
                          existingAtmAccount
                            ? `Leave blank to keep account ending in ${profile?.accountNumberLast4 ?? ''}`
                            : 'Enter account number'
                        }
                        onChange={(event) =>
                          setAccountNumber(
                            event.target.value,
                          )
                        }
                      />

                      <button
                        type="button"
                        className="employee-account-visibility-button"
                        disabled={
                          saving ||
                          accountNumber.length === 0
                        }
                        aria-pressed={
                          showAccountNumber
                        }
                        aria-label={
                          showAccountNumber
                            ? 'Hide account number'
                            : 'Show account number'
                        }
                        onClick={() =>
                          setShowAccountNumber(
                            (current) =>
                              !current,
                          )
                        }
                      >
                        {showAccountNumber
                          ? 'Hide'
                          : 'Show'}
                      </button>
                    </div>

                    {existingAtmAccount && (
                      <small>
                        Current stored account:
                        {' '}
                        ••••{' '}
                        {
                          profile?.accountNumberLast4
                        }
                      </small>
                    )}
                  </label>
                </>
              )}
            </div>

            <div className="employee-employment-note">
              {payoutMethod === 'CASH'
                ? (
                    <>
                      CASH payout does not store
                      bank information. Saving CASH
                      clears any banking information
                      previously attached to this
                      payroll profile.
                    </>
                  )
                : existingAtmAccount
                  ? (
                      <>
                        Leave Account Number blank
                        to keep the existing ATM
                        account. Enter a new number
                        only when the employee's
                        account must be replaced.
                        Show/Hide applies to the new
                        number being entered.
                      </>
                    )
                  : (
                      <>
                        Bank Name and Account Number
                        are required for the first
                        ATM setup. Use Show/Hide to
                        verify the account number
                        before saving.
                      </>
                    )}
            </div>
          </div>

          {error && (
            <div
              className="form-feedback form-feedback-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="employee-form-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </button>

            <button
              type="button"
              className="primary-button"
              disabled={
                saving ||
                !atmValid
              }
              onClick={() =>
                void handleSave()
              }
            >
              {saving
                ? 'Saving...'
                : profile
                  ? 'Save Payout Profile'
                  : 'Set Payout Profile'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
