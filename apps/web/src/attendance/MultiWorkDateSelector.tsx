interface HolidayReference {
  date: string
  name: string
}

interface MultiWorkDateSelectorProps {
  startDate: string
  endDate: string
  selectedDates: string[]
  disabledDates: string[]
  holidays: HolidayReference[]
  disabled?: boolean
  onChange: (dates: string[]) => void
}

function toDateOnly(value: string) {
  return value.slice(0, 10)
}

function parseDateOnly(value: string) {
  const [year, month, day] = value
    .slice(0, 10)
    .split('-')
    .map(Number)

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
    ),
  )
}

function toDateString(value: Date) {
  return value
    .toISOString()
    .slice(0, 10)
}

function buildDateRange(
  startDate: string,
  endDate: string,
) {
  const start =
    parseDateOnly(startDate)

  const end =
    parseDateOnly(endDate)

  const dates: string[] = []

  for (
    let current =
      new Date(start);
    current <= end;
    current = new Date(
      current.getTime() +
        24 * 60 * 60 * 1000,
    )
  ) {
    dates.push(
      toDateString(current),
    )
  }

  return dates
}

function formatDate(value: string) {
  const date =
    parseDateOnly(value)

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: '2-digit',
      timeZone: 'UTC',
    },
  ).format(date)
}

function formatWeekday(value: string) {
  const date =
    parseDateOnly(value)

  return new Intl.DateTimeFormat(
    'en-US',
    {
      weekday: 'short',
      timeZone: 'UTC',
    },
  ).format(date)
}

export function MultiWorkDateSelector({
  startDate,
  endDate,
  selectedDates,
  disabledDates,
  holidays,
  disabled = false,
  onChange,
}: MultiWorkDateSelectorProps) {
  const availableDates =
    buildDateRange(
      startDate,
      endDate,
    )

  const disabledDateSet =
    new Set(
      disabledDates.map(
        toDateOnly,
      ),
    )

  const selectedDateSet =
    new Set(
      selectedDates.map(
        toDateOnly,
      ),
    )

  const holidayByDate =
    new Map(
      holidays.map(
        (holiday) => [
          toDateOnly(
            holiday.date,
          ),
          holiday.name,
        ],
      ),
    )

  function toggleDate(
    workDate: string,
  ) {
    if (
      disabled ||
      disabledDateSet.has(
        workDate,
      )
    ) {
      return
    }

    const nextDates =
      selectedDateSet.has(
        workDate,
      )
        ? selectedDates.filter(
            (date) =>
              date !==
              workDate,
          )
        : [
            ...selectedDates,
            workDate,
          ]

    onChange(
      [...nextDates].sort(),
    )
  }

  function selectAllAvailable() {
    if (disabled) {
      return
    }

    onChange(
      availableDates.filter(
        (date) =>
          !disabledDateSet.has(
            date,
          ),
      ),
    )
  }

  function clearSelection() {
    if (disabled) {
      return
    }

    onChange([])
  }

  const selectableCount =
    availableDates.filter(
      (date) =>
        !disabledDateSet.has(
          date,
        ),
    ).length

  return (
    <div className="multi-work-date-selector">
      <div className="multi-work-date-toolbar">
        <div>
          <strong>
            Work Dates
          </strong>

          <span>
            {selectedDates.length}{' '}
            {selectedDates.length ===
            1
              ? 'date selected'
              : 'dates selected'}
          </span>
        </div>

        <div className="multi-work-date-actions">
          <button
            type="button"
            className="inline-action-button"
            disabled={
              disabled ||
              selectableCount ===
                0
            }
            onClick={
              selectAllAvailable
            }
          >
            Select All Available
          </button>

          <button
            type="button"
            className="inline-action-button"
            disabled={
              disabled ||
              selectedDates.length ===
                0
            }
            onClick={
              clearSelection
            }
          >
            Clear
          </button>
        </div>
      </div>

      <div className="multi-work-date-grid">
        {availableDates.map(
          (workDate) => {
            const recorded =
              disabledDateSet.has(
                workDate,
              )

            const selected =
              selectedDateSet.has(
                workDate,
              )

            const holidayName =
              holidayByDate.get(
                workDate,
              )

            return (
              <button
                key={workDate}
                type="button"
                className={[
                  'multi-work-date-option',
                  selected
                    ? 'multi-work-date-selected'
                    : '',
                  recorded
                    ? 'multi-work-date-recorded'
                    : '',
                  holidayName
                    ? 'multi-work-date-holiday'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={
                  disabled ||
                  recorded
                }
                aria-pressed={
                  selected
                }
                onClick={() =>
                  toggleDate(
                    workDate,
                  )
                }
              >
                <span className="multi-work-date-weekday">
                  {formatWeekday(
                    workDate,
                  )}
                </span>

                <strong>
                  {formatDate(
                    workDate,
                  )}
                </strong>

                {recorded ? (
                  <small>
                    Recorded
                  </small>
                ) : selected ? (
                  <small>
                    Selected
                  </small>
                ) : holidayName ? (
                  <small title={holidayName}>
                    Holiday
                  </small>
                ) : (
                  <small>
                    Available
                  </small>
                )}
              </button>
            )
          },
        )}
      </div>

      <p className="multi-work-date-help">
        Recorded dates cannot be selected again. Select one or more
        available dates that will use the same attendance values.
        Special dates such as leave, rest day, holiday, or different
        overtime can be handled individually afterward.
      </p>
    </div>
  )
}
