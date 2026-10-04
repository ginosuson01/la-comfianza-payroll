import {
  useEffect,
  useState,
} from 'react'

import { ApiError } from '../api/client'
import {
  generatePayroll,
  getPayrollReadiness,
  regeneratePayroll,
  type PayrollReadinessResponse,
} from '../api/payroll'
import { reopenPayrollCutoff } from '../api/payroll-cutoffs'
import type { PayrollCutoffSummary } from '../api/types'

import './PayrollLifecycleActions.css'

interface PayrollLifecycleActionsProps {
  accessToken: string
  companyId: string
  cutoff: PayrollCutoffSummary
  onChanged: () => void
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

  return 'Unable to update payroll.'
}

function formatStatus(
  status: string,
): string {
  return status
    .split('_')
    .map(
      (part) =>
        part.charAt(0) +
        part.slice(1).toLowerCase(),
    )
    .join(' ')
}

export function PayrollLifecycleActions({
  accessToken,
  companyId,
  cutoff,
  onChanged,
}: PayrollLifecycleActionsProps) {
  const [
    reopenReason,
    setReopenReason,
  ] = useState('')

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    message,
    setMessage,
  ] = useState<string | null>(null)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  const [
    readiness,
    setReadiness,
  ] = useState<PayrollReadinessResponse | null>(null)

  const [
    readinessLoading,
    setReadinessLoading,
  ] = useState(false)

  const [
    readinessError,
    setReadinessError,
  ] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (
      cutoff.status !== 'OPEN' &&
      cutoff.status !== 'REOPENED'
    ) {
      setReadiness(null)
      setReadinessError(null)
      setReadinessLoading(false)

      return () => {
        cancelled = true
      }
    }

    async function loadReadiness() {
      setReadinessLoading(true)
      setReadinessError(null)

      try {
        const response =
          await getPayrollReadiness(
            accessToken,
            companyId,
            cutoff.id,
          )

        if (cancelled) {
          return
        }

        setReadiness(response)
      } catch (readinessLoadError: unknown) {
        if (cancelled) {
          return
        }

        setReadiness(null)
        setReadinessError(
          getErrorMessage(
            readinessLoadError,
          ),
        )
      } finally {
        if (!cancelled) {
          setReadinessLoading(false)
        }
      }
    }

    void loadReadiness()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    companyId,
    cutoff.id,
    cutoff.status,
  ])

  async function handleGenerate() {
    if (
      submitting ||
      cutoff.status !== 'OPEN' ||
      readinessLoading ||
      readiness?.ready === false
    ) {
      return
    }

    const confirmed = window.confirm(
      'Generate payroll for this cutoff? Successful generation will lock the cutoff and create Payroll Version 1.',
    )

    if (!confirmed) {
      return
    }

    setSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      const result =
        await generatePayroll(
          accessToken,
          companyId,
          cutoff.id,
        )

      setMessage(
        `Payroll Version ${result.version} generated successfully.`,
      )

      onChanged()
    } catch (actionError: unknown) {
      setError(
        getErrorMessage(actionError),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReopen() {
    if (
      submitting ||
      cutoff.status !== 'LOCKED'
    ) {
      return
    }

    const normalizedReason =
      reopenReason.trim()

    if (!normalizedReason) {
      setMessage(null)

      setError(
        'A reopen reason is required.',
      )

      return
    }

    const confirmed = window.confirm(
      'Reopen this payroll cutoff? If a current payroll run exists, it will move to Pending Regeneration so corrections can be made.',
    )

    if (!confirmed) {
      return
    }

    setSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      await reopenPayrollCutoff(
        accessToken,
        cutoff.id,
        {
          reason:
            normalizedReason,
        },
      )

      setReopenReason('')

      setMessage(
        'Payroll cutoff reopened successfully.',
      )

      onChanged()
    } catch (actionError: unknown) {
      setError(
        getErrorMessage(actionError),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegenerate() {
    if (
      submitting ||
      cutoff.status !== 'REOPENED'
    ) {
      return
    }

    const confirmed = window.confirm(
      'Regenerate payroll for this reopened cutoff? The pending payroll run will be preserved as Superseded and a new locked version will be created.',
    )

    if (!confirmed) {
      return
    }

    setSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      const result =
        await regeneratePayroll(
          accessToken,
          companyId,
          cutoff.id,
        )

      setMessage(
        `Payroll Version ${result.version} regenerated successfully.`,
      )

      onChanged()
    } catch (actionError: unknown) {
      setError(
        getErrorMessage(actionError),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="payroll-lifecycle-card">
      <div className="payroll-lifecycle-heading">
        <div>
          <p className="eyebrow">
            Payroll Lifecycle
          </p>

          <h2>
            Cutoff Actions
          </h2>

          <p>
            Current cutoff status:{' '}
            <strong>
              {formatStatus(
                cutoff.status,
              )}
            </strong>
          </p>
        </div>

        <span
          className={`status-badge payroll-cutoff-status-${cutoff.status.toLowerCase()}`}
        >
          {formatStatus(
            cutoff.status,
          )}
        </span>
      </div>

      {cutoff.status === 'OPEN' && (
        <div className="payroll-lifecycle-body">
          <div className="payroll-lifecycle-description">
            <strong>
              {readinessLoading
                ? 'Checking Payroll Readiness'
                : readiness?.ready
                  ? 'Ready for Initial Generation'
                  : readiness
                    ? 'Action Required Before Generation'
                    : 'Payroll Readiness'}
            </strong>

            <span>
              {readinessLoading
                ? 'Checking employee, attendance, configuration, and payroll calculation readiness.'
                : readiness?.ready
                  ? 'Payroll readiness checks passed. Successful generation creates Version 1 and locks the cutoff.'
                  : readiness
                    ? 'Resolve the readiness issues below before generating payroll.'
                    : 'Payroll generation performs readiness checks before creating Version 1 and locking the cutoff.'}
            </span>
          </div>

          <button
            type="button"
            className="primary-button"
            disabled={
              submitting ||
              readinessLoading ||
              readiness?.ready === false
            }
            onClick={() =>
              void handleGenerate()
            }
          >
            {submitting
              ? 'Generating...'
              : 'Generate Payroll'}
          </button>
        </div>
      )}

      {(cutoff.status === 'OPEN' ||
        cutoff.status === 'REOPENED') &&
        readiness && (
        <div
          className={`payroll-readiness-panel ${
            readiness.ready
              ? 'payroll-readiness-ready'
              : 'payroll-readiness-blocked'
          }`}
        >
          <div className="payroll-readiness-summary">
            <strong>
              {readiness.ready
                ? 'Payroll readiness passed'
                : 'Payroll is not ready for generation'}
            </strong>

            <span>
              Eligible employees:{' '}
              {readiness.eligibleEmployeeCount}
              {' · '}
              Calculated employees:{' '}
              {readiness.calculatedEmployeeCount}
            </span>
          </div>

          {!readiness.ready && (
            <div className="payroll-readiness-issues">
              {readiness.issues.length > 0 ? (
                readiness.issues.map(
                  (issue, index) => (
                    <div
                      key={`${issue.source}-${issue.code}-${issue.employeeId ?? 'cutoff'}-${index}`}
                      className="payroll-readiness-issue"
                    >
                      <strong>
                        {issue.employeeNumber
                          ? `${issue.employeeNumber} · `
                          : ''}
                        {issue.code}
                      </strong>

                      <span>
                        {issue.message}
                      </span>
                    </div>
                  ),
                )
              ) : (
                <div className="payroll-readiness-issue">
                  <strong>
                    Readiness check incomplete
                  </strong>

                  <span>
                    Payroll readiness could not be confirmed.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {readinessError && (
        <div
          className="form-feedback form-feedback-error payroll-lifecycle-feedback"
          role="alert"
        >
          Unable to load payroll readiness: {readinessError}
        </div>
      )}

      {cutoff.status === 'LOCKED' && (
        <div className="payroll-lifecycle-body payroll-reopen-body">
          <div className="payroll-lifecycle-description">
            <strong>
              Payroll Cutoff Locked
            </strong>

            <span>
              Reopening is required before
              corrections can be made. A
              reason is mandatory and will
              be captured in the audit log.
            </span>
          </div>

          <label className="payroll-reopen-reason">
            <span>
              Reopen Reason
            </span>

            <textarea
              rows={3}
              value={reopenReason}
              disabled={submitting}
              placeholder="Describe why this payroll cutoff must be reopened."
              onChange={(event) =>
                setReopenReason(
                  event.target.value,
                )
              }
            />
          </label>

          <div className="payroll-lifecycle-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={
                submitting ||
                !reopenReason.trim()
              }
              onClick={() =>
                void handleReopen()
              }
            >
              {submitting
                ? 'Reopening...'
                : 'Reopen Payroll'}
            </button>
          </div>
        </div>
      )}

      {cutoff.status === 'REOPENED' && (
        <div className="payroll-lifecycle-body">
          <div className="payroll-lifecycle-description">
            <strong>
              Pending Regeneration
            </strong>

            <span>
              Complete required corrections,
              then regenerate payroll. The
              previous version remains in
              history and the new version
              becomes Current Locked.
            </span>
          </div>

          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={() =>
              void handleRegenerate()
            }
          >
            {submitting
              ? 'Regenerating...'
              : 'Regenerate Payroll'}
          </button>
        </div>
      )}

      {error && (
        <div
          className="form-feedback form-feedback-error payroll-lifecycle-feedback"
          role="alert"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className="form-feedback form-feedback-success payroll-lifecycle-feedback"
          role="status"
        >
          {message}
        </div>
      )}
    </section>
  )
}
