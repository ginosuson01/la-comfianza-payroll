import { useEffect, useState } from 'react'

import { ApiError } from '../api/client'
import { getDtr } from '../api/dtrs'
import type { DtrDetail, DtrEntry } from '../api/types'

interface SelectedDtrDetailProps {
  accessToken: string
  dtrId: string
  refreshKey: number
  canEdit: boolean
  deletingEntryId: string | null
  onEntriesChange: (entries: DtrEntry[]) => void
  onEditEntry: (entry: DtrEntry) => void
  onDeleteEntry: (entry: DtrEntry) => void
}

const ENTRIES_PER_COLUMN = 5
const COLUMNS_PER_PAGE = 3
const ENTRIES_PER_PAGE =
  ENTRIES_PER_COLUMN * COLUMNS_PER_PAGE

const shortMonthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to load DTR detail.'
}

function getWorkDateParts(value: string) {
  const [year, month, day] = value
    .slice(0, 10)
    .split('-')
    .map(Number)

  return {
    year,
    month,
    day,
  }
}

function formatWorkDate(value: string) {
  const { month, day } =
    getWorkDateParts(value)

  return `${shortMonthNames[month - 1]} ${String(day).padStart(2, '0')}`
}

function getOvertimeMinutes(entry: DtrEntry) {
  return entry.overtimeEntries.reduce(
    (total, overtime) =>
      total + overtime.minutes,
    0,
  )
}

function buildEntrySummary(entry: DtrEntry) {
  const parts = [
    `Regular ${entry.regularMinutes}m`,
  ]

  if (entry.lateMinutes > 0) {
    parts.push(
      `Late ${entry.lateMinutes}m`,
    )
  }

  if (entry.undertimeMinutes > 0) {
    parts.push(
      `Undertime ${entry.undertimeMinutes}m`,
    )
  }

  if (entry.absenceMinutes > 0) {
    parts.push(
      `Absence ${entry.absenceMinutes}m`,
    )
  }

  if (entry.leaveMinutes > 0) {
    parts.push(
      `${entry.leaveType?.name ?? 'Leave'} ${entry.leaveMinutes}m`,
    )
  }

  const overtimeMinutes =
    getOvertimeMinutes(entry)

  if (overtimeMinutes > 0) {
    parts.push(
      `OT ${overtimeMinutes}m`,
    )
  }

  if (
    entry.nightDifferentialMinutes > 0
  ) {
    parts.push(
      `Night Diff ${entry.nightDifferentialMinutes}m`,
    )
  }

  if (entry.restDay) {
    parts.push('Rest Day')
  }

  if (entry.holiday) {
    parts.push(entry.holiday.name)
  }

  return parts.join(' · ')
}

export function SelectedDtrDetail({
  accessToken,
  dtrId,
  refreshKey,
  canEdit,
  deletingEntryId,
  onEntriesChange,
  onEditEntry,
  onDeleteEntry,
}: SelectedDtrDetailProps) {
  const [detail, setDetail] =
    useState<DtrDetail | null>(null)

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [
    selectedEntryId,
    setSelectedEntryId,
  ] = useState<string | null>(null)

  const [page, setPage] =
    useState(1)

  useEffect(() => {
    setSelectedEntryId(null)
    setPage(1)
  }, [dtrId])

  useEffect(() => {
    let cancelled = false

    if (!dtrId) {
      setDetail(null)
      setError(null)
      setLoading(false)
      onEntriesChange([])

      return () => {
        cancelled = true
      }
    }

    async function loadDetail() {
      setLoading(true)
      setError(null)

      try {
        const response =
          await getDtr(
            accessToken,
            dtrId,
          )

        if (cancelled) {
          return
        }

        setDetail(response)
        onEntriesChange(response.entries)

        setSelectedEntryId(
          (current) => {
            if (!current) {
              return null
            }

            return response.entries.some(
              (entry) =>
                entry.id === current,
            )
              ? current
              : null
          },
        )
      } catch (
        loadError: unknown
      ) {
        if (cancelled) {
          return
        }

        setDetail(null)
        setSelectedEntryId(null)
        onEntriesChange([])

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

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    dtrId,
    refreshKey,
    onEntriesChange,
  ])

  const entries =
    detail?.entries ?? []

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        entries.length /
          ENTRIES_PER_PAGE,
      ),
    )

  const safePage =
    Math.min(
      page,
      totalPages,
    )

  const pageStart =
    (safePage - 1) *
    ENTRIES_PER_PAGE

  const pageEntries =
    entries.slice(
      pageStart,
      pageStart +
        ENTRIES_PER_PAGE,
    )

  const entryColumns =
    Array.from(
      {
        length:
          COLUMNS_PER_PAGE,
      },
      (_, columnIndex) => {
        const start =
          columnIndex *
          ENTRIES_PER_COLUMN

        return pageEntries.slice(
          start,
          start +
            ENTRIES_PER_COLUMN,
        )
      },
    ).filter(
      (column) =>
        column.length > 0,
    )

  function handleEntrySelection(
    entryId: string,
  ) {
    if (!canEdit) {
      return
    }

    setSelectedEntryId(
      (current) =>
        current === entryId
          ? null
          : entryId,
    )
  }

  function handlePageChange(
    nextPage: number,
  ) {
    setPage(nextPage)
    setSelectedEntryId(null)
  }

  function renderEntry(
    entry: DtrEntry,
    index: number,
  ) {
    const selected =
      selectedEntryId ===
      entry.id

    const entryNumber =
      pageStart +
      index +
      1

    return (
      <div
        key={entry.id}
        className={`recorded-entry-card ${
          selected
            ? 'recorded-entry-selected'
            : ''
        }`}
      >
        <button
          type="button"
          className="recorded-entry-select"
          onClick={() =>
            handleEntrySelection(
              entry.id,
            )
          }
        >
          <span className="recorded-entry-number">
            {String(
              entryNumber,
            ).padStart(2, '0')}
          </span>

          <span className="recorded-entry-content">
            <strong>
              {formatWorkDate(
                entry.workDate,
              )}
            </strong>

            <small>
              {buildEntrySummary(
                entry,
              )}
            </small>
          </span>
        </button>

        {selected &&
          canEdit && (
            <div className="recorded-entry-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={
                  deletingEntryId ===
                  entry.id
                }
                onClick={() =>
                  onEditEntry(entry)
                }
              >
                Edit
              </button>

              <button
                type="button"
                className="secondary-button"
                disabled={
                  deletingEntryId ===
                  entry.id
                }
                onClick={() =>
                  onDeleteEntry(
                    entry,
                  )
                }
              >
                {deletingEntryId ===
                entry.id
                  ? 'Deleting...'
                  : 'Delete'}
              </button>
            </div>
          )}
      </div>
    )
  }

  const firstVisibleEntry =
    entries.length === 0
      ? 0
      : pageStart + 1

  const lastVisibleEntry =
    Math.min(
      pageStart +
        ENTRIES_PER_PAGE,
      entries.length,
    )

  return (
    <div className="recorded-entries-section">
      <div className="section-title">
        <div>
          <h3>
            Recorded Daily Entries
          </h3>

          <p>
            Attendance entries already recorded for the selected employee and payroll cutoff.
          </p>

          {canEdit &&
            entries.length >
              0 && (
              <small className="recorded-entry-help">
                Select an entry to show Edit and Delete actions.
              </small>
            )}
        </div>

        {detail && (
          <span className="record-count">
            {
              detail.entries
                .length
            }{' '}
            entries
          </span>
        )}
      </div>

      {loading && (
        <div className="empty-state">
          Loading DTR detail...
        </div>
      )}

      {!loading &&
        error && (
          <div className="empty-state">
            {error}
          </div>
        )}

      {!loading &&
        !error &&
        detail &&
        entries.length ===
          0 && (
          <div className="empty-state">
            No daily attendance entries have been recorded yet.
          </div>
        )}

      {!loading &&
        !error &&
        detail &&
        entries.length >
          0 && (
          <>
            <div className="recorded-entries-grid recorded-entries-grid-three-columns">
              {entryColumns.map(
                (
                  columnEntries,
                  columnIndex,
                ) => (
                  <div
                    key={`column-${columnIndex + 1}`}
                    className="recorded-entry-column"
                  >
                    {columnEntries.map(
                      (
                        entry,
                        rowIndex,
                      ) =>
                        renderEntry(
                          entry,
                          columnIndex *
                            ENTRIES_PER_COLUMN +
                            rowIndex,
                        ),
                    )}
                  </div>
                ),
              )}
            </div>

            {entries.length >
              ENTRIES_PER_PAGE && (
              <div className="recorded-entry-pagination">
                <span>
                  Showing{' '}
                  {
                    firstVisibleEntry
                  }
                  –
                  {
                    lastVisibleEntry
                  }{' '}
                  of{' '}
                  {
                    entries.length
                  }
                </span>

                <div className="review-buttons">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      safePage ===
                      1
                    }
                    onClick={() =>
                      handlePageChange(
                        safePage -
                          1,
                      )
                    }
                  >
                    Previous
                  </button>

                  <span className="recorded-entry-page-number">
                    Page{' '}
                    {safePage}{' '}
                    of{' '}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      safePage ===
                      totalPages
                    }
                    onClick={() =>
                      handlePageChange(
                        safePage +
                          1,
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
    </div>
  )
}
