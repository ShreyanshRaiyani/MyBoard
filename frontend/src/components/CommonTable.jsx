import React, { useMemo, useState } from 'react';

// columns: [{ key: 'name', label: 'Name', render: (row)=>... }]
// data: array of objects
// initialPageSize: number
// pageSizes: array
// onPageChange: function(pageIndex, pageSize)

export default function CommonTable({
  columns = [],
  data = [],
  initialPageSize = 10,
  pageSizes = [5, 10, 20, 50],
  onPageChange,
  className = '',
}) {
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [pageIndex, setPageIndex] = useState(0);

  const total = data.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const currentData = useMemo(() => {
    const start = pageIndex * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, pageIndex, pageSize]);

  function gotoPage(index) {
    const next = Math.min(Math.max(0, index), pageCount - 1);
    setPageIndex(next);
    if (onPageChange) onPageChange(next, pageSize);
  }

  function prevPage() {
    gotoPage(pageIndex - 1);
  }
  function nextPage() {
    gotoPage(pageIndex + 1);
  }

  function changePageSize(e) {
    const newSize = Number(e.target.value) || initialPageSize;
    const currentItem = pageIndex * pageSize;
    const newPage = Math.floor(currentItem / newSize);
    setPageSize(newSize);
    setPageIndex(newPage);
    if (onPageChange) onPageChange(newPage, newSize);
  }

  // render a short pager: first, prev, numbers around current, next, last
  function pagerRange() {
    const range = [];
    const maxButtons = 5;
    let start = Math.max(0, pageIndex - 2);
    let end = Math.min(pageCount - 1, start + maxButtons - 1);
    if (end - start < maxButtons - 1) start = Math.max(0, end - maxButtons + 1);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  }

  return (
    <div className={"common-table " + className}>
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key || c.label}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentData.length ? currentData.map((row, rIdx) => (
              <tr key={row.id ?? rIdx}>
                {columns.map((c) => (
                  <td key={c.key || c.label}>
                    {c.render ? c.render(row) : (row[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '18px 8px' }}>
                  No records
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
        <div className="page-size">
          <label style={{ marginRight: 8, fontWeight: 600 }}>Rows</label>
          <select value={pageSize} onChange={changePageSize} aria-label="Rows per page">
            {pageSizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="pager" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => gotoPage(0)} disabled={pageIndex === 0} aria-label="First page">«</button>
          <button onClick={prevPage} disabled={pageIndex === 0} aria-label="Previous page">‹</button>

          {pagerRange().map(i => (
            <button
              key={i}
              onClick={() => gotoPage(i)}
              aria-current={i === pageIndex ? 'page' : undefined}
              className={i === pageIndex ? 'active' : ''}
            >{i + 1}</button>
          ))}

          <button onClick={nextPage} disabled={pageIndex >= pageCount - 1} aria-label="Next page">›</button>
          <button onClick={() => gotoPage(pageCount - 1)} disabled={pageIndex >= pageCount - 1} aria-label="Last page">»</button>
        </div>

        <div className="page-info" style={{ fontSize: 13, color: '#444' }}>
          <span>Page {pageIndex + 1} of {pageCount} — {total} items</span>
        </div>
      </div>
    </div>
  );
}
