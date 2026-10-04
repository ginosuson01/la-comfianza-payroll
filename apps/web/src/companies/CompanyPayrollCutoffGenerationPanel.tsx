import {
  useEffect,
  useState,
} from 'react'
import type {
  FormEvent,
} from 'react'

import { ApiError } from '../api/client'
import {
  generatePayrollCutoffs,
  type GeneratePayrollCutoffsResult,
} from '../api/payroll-cutoffs'

interface CompanyPayrollCutoffGenerationPanelProps {
  accessToken: string
  companyId: string
  cutoffTemplateId: string
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

  return 'Unable to generate payroll cutoffs.'
}

function formatDate(
  value: string,
): string {
  return value.slice(
    0,
    10,
  )
}

export function CompanyPayrollCutoffGenerationPanel({
  accessToken,
  companyId,
  cutoffTemplateId,
}: CompanyPayrollCutoffGenerationPanelProps) {
  const [
    referenceMonth,
    setReferenceMonth,
  ] = useState('')

  const [
    generating,
    setGenerating,
  ] = useState(false)

  const [
    error,
    setError,
  ] =
    useState<string | null>(null)

  const [
    result,
    setResult,
  ] =
    useState<GeneratePayrollCutoffsResult | null>(
      null,
    )

  useEffect(() => {
    setReferenceMonth('')
    setError(null)
    setResult(null)
  }, [companyId, cutoffTemplateId])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (generating) {
      return
    }

    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(
        referenceMonth,
      )
    ) {
      setError(
        'Select a valid reference month.',
      )

      return
    }

    setGenerating(true)
    setError(null)
    setResult(null)

    try {
      const generated =
        await generatePayrollCutoffs(
          accessToken,
          {
            companyId,
            cutoffTemplateId,
            referenceMonth,
          },
        )

      setResult(
        generated,
      )
    } catch (
      generationError: unknown
    ) {
      setError(
        getErrorMessage(
          generationError,
        ),
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="company-cutoff-generation">
      <div className="company-cutoff-generation-heading">
        <strong>
          Generate Payroll Cutoffs
        </strong>

        <span>
          Create actual payroll cutoff records from this template for a selected reference month.
        </span>
      </div>

      <form
        className="company-cutoff-generation-form"
        onSubmit={
          handleSubmit
        }
      >
        <label>
          <span>
            Reference Month
          </span>

          <input
            type="month"
            value={
              referenceMonth
            }
            disabled={
              generating
            }
            onChange={
              (event) => {
                setReferenceMonth(
                  event.target.value,
                )

                setError(null)
                setResult(null)
              }
            }
            required
          />
        </label>

        <button
          type="submit"
          className="primary-button"
          disabled={
            generating ||
            !referenceMonth
          }
        >
          {generating
            ? 'Generating...'
            : 'Generate Payroll Cutoffs'}
        </button>
      </form>

      {error && (
        <div className="form-feedback form-feedback-error company-cutoff-generation-feedback">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="company-action-feedback company-action-feedback-success">
            Reference month {result.referenceMonth}: {result.createdCount} created, {result.existingCount} already existing.
          </div>

          <div className="company-cutoff-generation-results">
            {result.cutoffs.map(
              (item) => (
                <div
                  key={
                    item.cutoff.id
                  }
                  className="company-cutoff-generation-result"
                >
                  <div>
                    <strong>
                      {item.periodName}
                    </strong>

                    <span>
                      {item.periodCode}
                    </span>
                  </div>

                  <div>
                    <span>
                      Cutoff
                    </span>

                    <strong>
                      {formatDate(
                        item.cutoff.startDate,
                      )}
                      {' → '}
                      {formatDate(
                        item.cutoff.endDate,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Pay Date
                    </span>

                    <strong>
                      {formatDate(
                        item.cutoff.payDate,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Result
                    </span>

                    <strong>
                      {item.created
                        ? 'Created'
                        : 'Already Existing'}
                    </strong>
                  </div>
                </div>
              ),
            )}
          </div>
        </>
      )}
    </div>
  )
}
