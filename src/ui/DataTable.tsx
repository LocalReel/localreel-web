import type { ReactNode } from 'react'

import { Empty } from './Empty'
import { LoadingRow } from './Spinner'
import styles from './primitives.module.css'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  align?: 'left' | 'right'
  width?: string
  /** Applied to the cell, for truncation or mono text. */
  cellClassName?: string
}

export interface DataTableProps<T> {
  columns: Array<Column<T>>
  rows: T[]
  rowKey: (row: T) => string | number
  loading?: boolean
  loadingLabel?: string
  empty?: ReactNode
  emptyBody?: ReactNode
}

/**
 * A table with the three states every admin list needs: loading, empty, rows.
 *
 * Columns are declared as data rather than markup so a row cannot silently drop
 * a cell, and so the header and the body always agree on the column count.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  loadingLabel = 'Loading…',
  empty,
  emptyBody,
}: DataTableProps<T>) {
  if (loading && rows.length === 0) return <LoadingRow>{loadingLabel}</LoadingRow>
  if (!loading && rows.length === 0) {
    return <Empty title={empty ?? 'Nothing here yet'} body={emptyBody} />
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map(column => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={column.align === 'right' ? styles.numeric : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={rowKey(row)}>
              {columns.map(column => (
                <td
                  key={column.key}
                  className={[column.align === 'right' ? styles.numeric : '', column.cellClassName ?? '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
