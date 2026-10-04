import {
  useEffect,
  useState,
} from 'react'
import type { FormEvent } from 'react'

import { ApiError } from '../api/client'
import {
  listCompanies,
  updateCompanyStatus,
  type CompanyStatus,
  type CompanyView,
} from '../api/companies'
import { CompanyCompensationPanel } from './CompanyCompensationPanel'
import { CompanyFormPanel } from './CompanyFormPanel'
import { CompanyPayrollSetupPanel } from './CompanyPayrollSetupPanel'

import './CompanyManagementWorkspace.css'

interface CompanyManagementWorkspaceProps {
  accessToken: string
}

type CompanyStatusFilter =
  | 'ALL'
  | CompanyStatus

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to load company data.'
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

function formatDateTime(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    'en-PH',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    },
  ).format(new Date(value))
}

function displayValue(
  value: string | null,
): string {
  return value?.trim() || '—'
}

export function CompanyManagementWorkspace({
  accessToken,
}: CompanyManagementWorkspaceProps) {
  const [
    companies,
    setCompanies,
  ] = useState<CompanyView[]>([])

  const [
    selectedCompanyId,
    setSelectedCompanyId,
  ] = useState('')

  const [
    searchDraft,
    setSearchDraft,
  ] = useState('')

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    status,
    setStatus,
  ] =
    useState<CompanyStatusFilter>('ALL')

  const [
    page,
    setPage,
  ] = useState(1)

  const [
    total,
    setTotal,
  ] = useState(0)

  const [
    totalPages,
    setTotalPages,
  ] = useState(0)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  const [
    formMode,
    setFormMode,
  ] = useState<'CREATE' | 'EDIT' | null>(null)

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0)

  const [
    statusSaving,
    setStatusSaving,
  ] = useState(false)

  const [
    actionMessage,
    setActionMessage,
  ] = useState<string | null>(null)

  const [
    actionError,
    setActionError,
  ] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCompanies() {
      setLoading(true)
      setError(null)

      try {
        const response =
          await listCompanies(
            accessToken,
            {
              search:
                search ||
                undefined,

              status:
                status === 'ALL'
                  ? undefined
                  : status,

              page,

              pageSize: 25,
            },
          )

        if (cancelled) {
          return
        }

        setCompanies(
          response.items,
        )

        setTotal(
          response.pagination.total,
        )

        setTotalPages(
          response.pagination.totalPages,
        )

        setSelectedCompanyId(
          (currentCompanyId) => {
            if (
              currentCompanyId &&
              response.items.some(
                (company) =>
                  company.id ===
                  currentCompanyId,
              )
            ) {
              return currentCompanyId
            }

            return (
              response.items[0]?.id ??
              ''
            )
          },
        )
      } catch (loadError: unknown) {
        if (cancelled) {
          return
        }

        setCompanies([])
        setTotal(0)
        setTotalPages(0)
        setSelectedCompanyId('')

        setError(
          getErrorMessage(
            loadError,
          ),
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCompanies()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    page,
    refreshKey,
    search,
    status,
  ])

  const selectedCompany =
    companies.find(
      (company) =>
        company.id ===
        selectedCompanyId,
    ) ?? null

  function handleSearchSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setPage(1)
    setSearch(
      searchDraft.trim(),
    )
  }

  function handleClearSearch() {
    setSearchDraft('')
    setSearch('')
    setPage(1)
  }

  function handleStatusChange(
    nextStatus:
      CompanyStatusFilter,
  ) {
    setStatus(nextStatus)
    setPage(1)
  }

  function handleCompanySaved(
    savedCompany: CompanyView,
  ) {
    setActionMessage(
      `Company ${savedCompany.name} saved successfully.`,
    )
    setActionError(null)

    setSearchDraft('')
    setSearch('')
    setStatus('ALL')
    setPage(1)
    setSelectedCompanyId(
      savedCompany.id,
    )
    setFormMode(null)

    setRefreshKey(
      (current) =>
        current + 1,
    )
  }

  async function handleCompanyStatusChange() {
    if (
      !selectedCompany ||
      statusSaving
    ) {
      return
    }

    const nextStatus: CompanyStatus =
      selectedCompany.status === 'ACTIVE'
        ? 'INACTIVE'
        : 'ACTIVE'

    const actionLabel =
      nextStatus === 'INACTIVE'
        ? 'deactivate'
        : 'reactivate'

    const confirmed =
      window.confirm(
        `Are you sure you want to ${actionLabel} ${selectedCompany.name}?`,
      )

    if (!confirmed) {
      return
    }

    setStatusSaving(true)
    setActionMessage(null)
    setActionError(null)

    try {
      const updatedCompany =
        await updateCompanyStatus(
          accessToken,
          selectedCompany.id,
          nextStatus,
        )

      setSelectedCompanyId(
        updatedCompany.id,
      )

      setActionMessage(
        `Company ${updatedCompany.name} ${
          nextStatus === 'INACTIVE'
            ? 'deactivated'
            : 'reactivated'
        } successfully.`,
      )

      setRefreshKey(
        (current) =>
          current + 1,
      )
    } catch (statusError: unknown) {
      setActionError(
        getErrorMessage(
          statusError,
        ),
      )
    } finally {
      setStatusSaving(false)
    }
  }

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            Phase 1 · Payroll Manager
          </p>

          <h1>
            Company Management
          </h1>

          <p className="page-description">
            Manage each client company or
            branch as its own company
            profile.
          </p>
        </div>

        <div className="topbar-actions">
          <span className="environment-badge">
            Development
          </span>
        </div>
      </header>

      <section className="filter-card">
        <div className="filter-heading company-directory-heading">
          <div>
            <h2>
              Company Directory
            </h2>

            <p>
              Search by company code, name,
              address, or contact details.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              setFormMode('CREATE')
            }
          >
            New Company
          </button>
        </div>

        <form
          className="company-management-filters"
          onSubmit={
            handleSearchSubmit
          }
        >
          <label className="company-search-field">
            <span>
              Search
            </span>

            <input
              type="search"
              value={searchDraft}
              placeholder="Code, company, branch, address, contact..."
              onChange={(event) =>
                setSearchDraft(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Status
            </span>

            <select
              value={status}
              onChange={(event) =>
                handleStatusChange(
                  event.target
                    .value as CompanyStatusFilter,
                )
              }
            >
              <option value="ALL">
                All Companies
              </option>

              <option value="ACTIVE">
                Active
              </option>

              <option value="INACTIVE">
                Inactive
              </option>
            </select>
          </label>

          <div className="company-filter-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              Search
            </button>

            {(search ||
              searchDraft) && (
              <button
                type="button"
                className="secondary-button"
                disabled={loading}
                onClick={
                  handleClearSearch
                }
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {error && (
          <div
            className="form-feedback form-feedback-error"
            role="alert"
          >
            {error}
          </div>
        )}
      </section>

      {actionMessage && (
        <div
          className="company-action-feedback company-action-feedback-success"
          role="status"
        >
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div
          className="company-action-feedback company-action-feedback-error"
          role="alert"
        >
          {actionError}
        </div>
      )}

      <div className="workspace company-management-workspace">
        <section className="dtr-list-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">
                Client Companies
              </p>

              <h2>
                Companies
              </h2>
            </div>

            <span className="record-count">
              {total}{' '}
              {total === 1
                ? 'company'
                : 'companies'}
            </span>
          </div>

          <div className="company-management-list">
            {loading && (
              <div className="empty-state">
                Loading companies...
              </div>
            )}

            {!loading &&
              !error &&
              companies.map(
                (company) => (
                  <button
                    key={company.id}
                    type="button"
                    className={`company-management-row ${
                      selectedCompanyId ===
                      company.id
                        ? 'selected'
                        : ''
                    }`}
                    aria-pressed={
                      selectedCompanyId ===
                      company.id
                    }
                    onClick={() =>
                      setSelectedCompanyId(
                        company.id,
                      )
                    }
                  >
                    <div className="company-management-row-heading">
                      <strong>
                        {company.name}
                      </strong>

                      <span
                        className={`status-badge company-status-${company.status.toLowerCase()}`}
                      >
                        {formatStatus(
                          company.status,
                        )}
                      </span>
                    </div>

                    <span className="company-code">
                      {company.code}
                    </span>

                    <span className="company-address">
                      {company.formattedAddress ||
                        'No address configured'}
                    </span>
                  </button>
                ),
              )}

            {!loading &&
              !error &&
              companies.length ===
                0 && (
                <div className="empty-state">
                  No companies match the
                  selected filters.
                </div>
              )}
          </div>

          {!loading &&
            !error &&
            totalPages > 1 && (
              <div className="company-pagination">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(
                          1,
                          current - 1,
                        ),
                    )
                  }
                >
                  Previous
                </button>

                <span>
                  Page {page} of{' '}
                  {totalPages}
                </span>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    page >=
                    totalPages
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.min(
                          totalPages,
                          current + 1,
                        ),
                    )
                  }
                >
                  Next
                </button>
              </div>
            )}
        </section>

        <section className="attendance-card">
          {formMode ? (
            <CompanyFormPanel
              accessToken={accessToken}
              company={
                formMode === 'EDIT'
                  ? selectedCompany
                  : null
              }
              mode={formMode}
              onCancel={() =>
                setFormMode(null)
              }
              onSaved={
                handleCompanySaved
              }
            />
          ) : selectedCompany ? (
            <>
              <div className="card-header company-profile-header">
                <div>
                  <p className="eyebrow">
                    Company Profile
                  </p>

                  <h2>
                    {selectedCompany.name}
                  </h2>

                  <p>
                    Stable company code:{' '}
                    <strong>
                      {
                        selectedCompany.code
                      }
                    </strong>
                  </p>
                </div>

                <div className="company-profile-header-actions">
                  <span
                    className={`status-badge company-status-${selectedCompany.status.toLowerCase()}`}
                  >
                    {formatStatus(
                      selectedCompany.status,
                    )}
                  </span>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      statusSaving ||
                      selectedCompany.status === 'INACTIVE'
                    }
                    title={
                      selectedCompany.status === 'INACTIVE'
                        ? 'Reactivate the company before editing.'
                        : undefined
                    }
                    onClick={() => {
                      setActionMessage(null)
                      setActionError(null)
                      setFormMode('EDIT')
                    }}
                  >
                    Edit Company
                  </button>

                  <button
                    type="button"
                    className={
                      selectedCompany.status === 'ACTIVE'
                        ? 'company-danger-button'
                        : 'primary-button'
                    }
                    disabled={statusSaving}
                    onClick={() =>
                      void handleCompanyStatusChange()
                    }
                  >
                    {statusSaving
                      ? 'Saving...'
                      : selectedCompany.status === 'ACTIVE'
                        ? 'Deactivate Company'
                        : 'Reactivate Company'}
                  </button>
                </div>
              </div>

              <div className="company-profile-section">
                <div className="company-profile-section-heading">
                  <h3>
                    Address
                  </h3>
                </div>

                <div className="company-profile-grid">
                  <div>
                    <span>
                      Address Line 1
                    </span>

                    <strong>
                      {displayValue(
                        selectedCompany.addressLine1,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Address Line 2
                    </span>

                    <strong>
                      {displayValue(
                        selectedCompany.addressLine2,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Barangay
                    </span>

                    <strong>
                      {displayValue(
                        selectedCompany.barangay,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      City
                    </span>

                    <strong>
                      {displayValue(
                        selectedCompany.city,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Province
                    </span>

                    <strong>
                      {displayValue(
                        selectedCompany.province,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Postal Code
                    </span>

                    <strong>
                      {displayValue(
                        selectedCompany.postalCode,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Country
                    </span>

                    <strong>
                      {
                        selectedCompany.country
                      }
                    </strong>
                  </div>

                  <div className="company-profile-wide">
                    <span>
                      Formatted Address
                    </span>

                    <strong>
                      {selectedCompany.formattedAddress ||
                        '—'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="company-profile-section">
                <div className="company-profile-section-heading">
                  <h3>
                    Contact Information
                  </h3>
                </div>

                <div className="company-profile-grid">
                  <div>
                    <span>
                      Contact Name
                    </span>

                    <strong>
                      {displayValue(
                        selectedCompany.contactName,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Email
                    </span>

                    <strong>
                      {displayValue(
                        selectedCompany.contactEmail,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Phone
                    </span>

                    <strong>
                      {displayValue(
                        selectedCompany.contactPhone,
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              <CompanyCompensationPanel
                accessToken={accessToken}
                companyId={selectedCompany.id}
              />

              <CompanyPayrollSetupPanel
                accessToken={accessToken}
                companyId={selectedCompany.id}
              />

              <div className="company-profile-section">
                <div className="company-profile-section-heading">
                  <h3>
                    Record Information
                  </h3>
                </div>

                <div className="company-profile-grid">
                  <div>
                    <span>
                      Created
                    </span>

                    <strong>
                      {formatDateTime(
                        selectedCompany.createdAt,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Last Updated
                    </span>

                    <strong>
                      {formatDateTime(
                        selectedCompany.updatedAt,
                      )}
                    </strong>
                  </div>
                </div>
              </div>

            </>
          ) : (
            <div className="empty-state">
              {loading
                ? 'Loading company profile...'
                : 'Select a company to review its profile.'}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
