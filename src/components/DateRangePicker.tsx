import { useState, useRef, type JSX } from "react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths, subMonths } from "date-fns";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function cmp(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
  onMonthSelect?: (month: Date) => void;
  onYearSelect?: (year: Date) => void;
}

export default function DateRangePicker({ startDate, endDate, onChange, onMonthSelect, onYearSelect }: DateRangePickerProps) {
  const [viewMonth, setViewMonth] = useState(() => startDate || new Date());
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [showMonthOverlay, setShowMonthOverlay] = useState(false);
  const [showYearOverlay, setShowYearOverlay] = useState(false);

  const lastClickTime = useRef<number>(0);
  const lastClickKey = useRef<string | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const daysGridRef = useRef<HTMLDivElement>(null);

  const startKey = startDate ? dateKey(startDate) : null;
  const endKey = endDate ? dateKey(endDate) : null;

  let normalStart = startKey;
  let normalEnd = endKey;
  if (startKey && endKey && cmp(startKey, endKey) > 0) {
    normalStart = endKey;
    normalEnd = startKey;
  }

  // Effective range including live hover preview, capped at today
  let effStart = normalStart;
  let effEnd = normalEnd;
  if (normalStart && !normalEnd && hoverDate) {
    if (cmp(hoverDate, normalStart) >= 0) {
      effEnd = hoverDate;
    } else {
      effStart = hoverDate;
      effEnd = normalStart;
    }
  }

  const handleDayClick = (key: string) => {
    const now = Date.now();

    // Detect double-click: same key clicked within 400ms
    if (key === lastClickKey.current && now - lastClickTime.current < 400) {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = null;
      // Double-click → daily report for this single date
      const d = new Date(key + "T00:00:00");
      onChange(d, d);
      return;
    }

    lastClickTime.current = now;
    lastClickKey.current = key;

    // Single-click → range selection logic
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      if (!startKey || (startKey && endKey)) {
        // Start new range selection
        const d = new Date(key + "T00:00:00");
        onChange(d, null);
      } else {
        // Complete the range
        const d = new Date(key + "T00:00:00");
        if (cmp(key, startKey) < 0) {
          onChange(d, startDate);
        } else {
          onChange(startDate, d);
        }
      }
    }, 300);
  };

  const goPrevMonth = () => setViewMonth(m => subMonths(m, 1));
  const goNextMonth = () => setViewMonth(m => addMonths(m, 1));

  const selectMonth = (i: number) => {
    const newMonth = new Date(viewMonth.getFullYear(), i, 1);
    setViewMonth(newMonth);
    setShowMonthOverlay(false);
    // Trigger monthly report directly
    if (onMonthSelect) onMonthSelect(newMonth);
  };

  const selectYear = (y: number) => {
    const newYear = new Date(y, viewMonth.getMonth(), 1);
    setViewMonth(newYear);
    setShowYearOverlay(false);
    // Trigger yearly report directly
    if (onYearSelect) onYearSelect(new Date(y, 0, 1));
  };

  const today = dateKey(new Date());

  // Cap effective range at today
  if (effStart && effStart > today) effStart = today;
  if (effEnd && effEnd > today) effEnd = today;

  // Render day cells
  const renderDays = () => {
    const cells: JSX.Element[] = [];
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalCells = Math.ceil((startDow + lastDay.getDate()) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const dayOffset = i - startDow;
      let cellKey: string;
      let isOther = false;

      if (dayOffset < 0) {
        const prev = new Date(year, month, dayOffset + 1);
        cellKey = dateKey(prev);
        isOther = true;
      } else if (dayOffset >= lastDay.getDate()) {
        const next = new Date(year, month + 1, dayOffset - lastDay.getDate() + 1);
        cellKey = dateKey(next);
        isOther = true;
      } else {
        cellKey = dateKey(new Date(year, month, dayOffset + 1));
      }

      const isToday = cellKey === today;
      const isSelectedStart = startKey && cellKey === startKey;
      const isSelectedEnd = endKey && cellKey === endKey;
      const isInRange = effStart && effEnd && cellKey > effStart && cellKey < effEnd;
      const isRangeEdge = effStart && effEnd && (cellKey === effStart || cellKey === effEnd) && cmp(effStart, effEnd) < 0;

      const col = i % 7;
      const isFuture = cellKey > today;

      let classes = "day-cell";
      if (isOther) classes += " other-month";
      if (isToday) classes += " today";
      if (isFuture) classes += " disabled";
      if (isSelectedStart || isSelectedEnd) classes += " selected";
      if (isInRange) {
        classes += " in-range";
        if (col === 0) classes += " row-start";
        if (col === 6) classes += " row-end";
      }
      if (isRangeEdge && cellKey === effStart) classes += " range-start-edge";
      if (isRangeEdge && cellKey === effEnd) classes += " range-end-edge";

      cells.push(
        <div
          key={cellKey}
          className={classes}
          onClick={() => !isFuture && handleDayClick(cellKey)}
          onMouseEnter={() => !isFuture && setHoverDate(cellKey)}
        >
          <div className="day-num">{parseInt(cellKey.split("-")[2])}</div>
        </div>
      );
    }

    return cells;
  };

  const clearHover = () => setHoverDate(null);

  const rangeLabel = (() => {
    if (!startKey) return "Select dates";
    if (startKey && !endKey) {
      const d = new Date(startKey + "T00:00:00");
      return `${format(d, "dd MMM yyyy")} — select end date`;
    }
    if (startKey && endKey && startKey === endKey) {
      const d = new Date(startKey + "T00:00:00");
      return `${format(d, "dd MMM yyyy")} — daily report`;
    }
    const s = new Date(normalStart! + "T00:00:00");
    const e = new Date(normalEnd! + "T00:00:00");
    const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    return `${format(s, "dd MMM yyyy")} → ${format(e, "dd MMM yyyy")} (${days} day${days !== 1 ? "s" : ""})`;
  })();

  // Year picker range around current view year
  const yearStart = viewMonth.getFullYear() - 12;
  const yearEnd = viewMonth.getFullYear() + 12;
  const years = [];
  for (let y = yearStart; y <= yearEnd; y++) years.push(y);

  return (
    <div className="cal-card" onMouseLeave={clearHover}>
      {/* Header */}
      <div className="cal-header">
        <button className="nav-btn" onClick={goPrevMonth} type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div className="header-center">
          <button className="picker-btn" onClick={() => { setShowMonthOverlay(true); setShowYearOverlay(false); }} type="button">
            <span>{MONTHS_FULL[viewMonth.getMonth()]}</span>
            <span className="caret" />
          </button>
          <button className="picker-btn" onClick={() => { setShowYearOverlay(true); setShowMonthOverlay(false); }} type="button">
            <span>{viewMonth.getFullYear()}</span>
            <span className="caret" />
          </button>
        </div>
        <button className="nav-btn" onClick={goNextMonth} type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Day-of-week */}
      <div className="dow-grid">
        {DAYS.map(d => <div key={d} className="dow-cell">{d}</div>)}
      </div>

      {/* Day cells */}
      <div className="days-grid" ref={daysGridRef}>
        {renderDays()}
      </div>

      {/* Info bar */}
      <div className="info-bar">{rangeLabel}</div>

      {/* Month overlay */}
      {showMonthOverlay && (
        <div className="overlay visible">
          <div className="overlay-header">
            <span className="overlay-title">Select month</span>
            <button className="close-btn" onClick={() => setShowMonthOverlay(false)} type="button">×</button>
          </div>
          <div className="picker-grid">
            {MONTHS_SHORT.map((m, i) => (
              <div
                key={m}
                className={`picker-item${i === viewMonth.getMonth() ? " active" : ""}`}
                onClick={() => selectMonth(i)}
              >
                {m}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Year overlay */}
      {showYearOverlay && (
        <div className="overlay visible">
          <div className="overlay-header">
            <span className="overlay-title">Select year</span>
            <button className="close-btn" onClick={() => setShowYearOverlay(false)} type="button">×</button>
          </div>
          <div className="year-scroll">
            {years.map(y => (
              <div
                key={y}
                className={`picker-item${y === viewMonth.getFullYear() ? " active" : ""}`}
                onClick={() => selectYear(y)}
              >
                {y}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .cal-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          padding: 20px 24px 16px;
          width: 360px;
          position: relative;
          box-shadow: 0 4px 24px rgba(0,0,0,0.07);
          user-select: none;
        }
        .cal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .nav-btn {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #374151;
          transition: background 0.15s;
        }
        .nav-btn:hover { background: #f3f4f6; }
        .header-center { display: flex; gap: 6px; align-items: center; }
        .picker-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
          font-family: inherit;
          padding: 4px 8px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: background 0.12s;
        }
        .picker-btn:hover { background: #f3f4f6; }
        .picker-btn .caret {
          width: 6px;
          height: 6px;
          border-right: 2px solid #16a34a;
          border-bottom: 2px solid #16a34a;
          display: inline-block;
          transform: rotate(45deg) translateY(-2px);
        }
        .dow-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          margin-bottom: 4px;
        }
        .dow-cell {
          text-align: center;
          font-size: 12px;
          font-weight: 500;
          color: #9ca3af;
          padding: 4px 0 8px;
        }
        .days-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          row-gap: 2px;
        }
        .day-cell {
          position: relative;
          text-align: center;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13.5px;
          font-weight: 400;
          color: #111827;
        }
        .day-cell.other-month { color: #d1d5db; }
        .day-cell.disabled { cursor: default; pointer-events: none; }
        .day-cell.disabled .day-num { color: #111827; background: transparent !important; opacity: 0.2; }
        .day-cell.disabled:hover .day-num { background: transparent !important; color: #111827; opacity: 0.2; }
        .day-cell.in-range { background: #dcfce7; color: #15803d; }
        .day-cell.in-range.row-start { border-radius: 20px 0 0 20px; }
        .day-cell.in-range.row-end { border-radius: 0 20px 20px 0; }
        .day-cell.range-start-edge { background: #dcfce7; border-radius: 20px 0 0 20px; }
        .day-cell.range-end-edge { background: #dcfce7; border-radius: 0 20px 20px 0; }
        .day-num {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          position: relative;
          z-index: 1;
          transition: background 0.12s, color 0.12s;
        }
        .day-cell:hover .day-num { background: #f0fdf4; color: #16a34a; }
        .day-cell.today .day-num { border: 1.5px solid #16a34a; }
        .day-cell.selected .day-num,
        .day-cell.range-end .day-num {
          background: #16a34a !important;
          color: #ffffff !important;
          font-weight: 600;
        }
        .info-bar {
          margin-top: 14px;
          padding: 8px 12px;
          background: #f9fafb;
          border-radius: 10px;
          font-size: 12px;
          color: #6b7280;
          min-height: 36px;
          display: flex;
          align-items: center;
          border: 1px solid #f3f4f6;
        }
        .overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: #ffffff;
          border-radius: 20px;
          z-index: 10;
          padding: 16px;
          display: flex;
          flex-direction: column;
          border: 1px solid #e5e7eb;
        }
        .overlay.visible { display: flex; }
        .overlay-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .overlay-title { font-size: 15px; font-weight: 600; color: #111827; }
        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 20px;
          color: #6b7280;
          line-height: 1;
          padding: 2px 6px;
          border-radius: 8px;
        }
        .close-btn:hover { background: #f3f4f6; }
        .picker-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          flex: 1;
          align-content: start;
        }
        .picker-item {
          padding: 10px 4px;
          text-align: center;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13.5px;
          color: #374151;
          border: 1px solid transparent;
          transition: all 0.12s;
        }
        .picker-item:hover { background: #f0fdf4; color: #16a34a; }
        .picker-item.active { background: #16a34a; color: #ffffff; font-weight: 600; }
        .year-scroll {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          overflow-y: auto;
          max-height: 260px;
        }
        .year-scroll::-webkit-scrollbar { width: 4px; }
        .year-scroll::-webkit-scrollbar-track { background: #f3f4f6; border-radius: 4px; }
        .year-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
      `}</style>
    </div>
  );
}
