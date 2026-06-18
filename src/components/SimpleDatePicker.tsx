import { useState } from "react";
import { format } from "date-fns";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function SimpleDatePicker({ date, onSelect, disableFuture = true }: { date?: Date; onSelect: (d: Date) => void; disableFuture?: boolean }) {
  const [viewMonth, setViewMonth] = useState(new Date());
  const [showMonthOverlay, setShowMonthOverlay] = useState(false);
  const [showYearOverlay, setShowYearOverlay] = useState(false);
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startDow + lastDay.getDate()) / 7) * 7;
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const selectMonth = (i: number) => {
    setViewMonth(prev => new Date(prev.getFullYear(), i, 1));
    setShowMonthOverlay(false);
  };

  const selectYear = (y: number) => {
    setViewMonth(prev => new Date(y, prev.getMonth(), 1));
    setShowYearOverlay(false);
  };

  const yearStart = viewMonth.getFullYear() - 12;
  const yearEnd = viewMonth.getFullYear() + 12;
  const years = [];
  for (let y = yearStart; y <= yearEnd; y++) years.push(y);

  const cells: JSX.Element[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startDow;
    let d: Date;
    let isOther = false;
    if (dayOffset < 0) {
      d = new Date(year, month, dayOffset + 1);
      isOther = true;
    } else if (dayOffset >= lastDay.getDate()) {
      d = new Date(year, month + 1, dayOffset - lastDay.getDate() + 1);
      isOther = true;
    } else {
      d = new Date(year, month, dayOffset + 1);
    }
    const key = format(d, "yyyy-MM-dd");
    const isToday = key === todayKey;
    const isSelected = date && format(date, "yyyy-MM-dd") === key && !isOther;
    const isFuture = d > new Date(new Date().toDateString());

    cells.push(
      <div
        key={key}
        className={`day-cell${isOther ? " other-month" : ""}${isFuture && disableFuture ? " disabled" : ""}`}
        onClick={() => { if (!isFuture || !disableFuture) onSelect(d); }}
      >
        <div className={`day-num${isToday ? " today-border" : ""}${isSelected ? " selected" : ""}`}>
          {d.getDate()}
        </div>
      </div>
    );
  }

  return (
    <div className="cal-card">
      <div className="cal-header">
        <button className="nav-btn" onClick={() => setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div className="header-center">
          <button className="picker-btn" onClick={() => { setShowMonthOverlay(true); setShowYearOverlay(false); }} type="button">
            <span>{MONTHS_FULL[month]}</span>
            <span className="caret" />
          </button>
          <button className="picker-btn" onClick={() => { setShowYearOverlay(true); setShowMonthOverlay(false); }} type="button">
            <span>{year}</span>
            <span className="caret" />
          </button>
        </div>
        <button className="nav-btn" onClick={() => setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div className="dow-grid">
        {DAYS.map(d => <div key={d} className="dow-cell">{d}</div>)}
      </div>
      <div className="days-grid">
        {cells}
      </div>

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
                className={`picker-item${i === month ? " active" : ""}`}
                onClick={() => selectMonth(i)}
              >
                {m}
              </div>
            ))}
          </div>
        </div>
      )}

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
                className={`picker-item${y === year ? " active" : ""}`}
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
          width: 320px;
          position: relative;
          box-shadow: 0 4px 24px rgba(0,0,0,0.1);
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
          font-size: 14px;
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
        .day-cell.disabled .day-num { opacity: 0.2; }
        .day-num {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.12s, color 0.12s;
        }
        .day-cell:hover .day-num { background: #f0fdf4; color: #16a34a; }
        .day-num.today-border { border: 1.5px solid #16a34a; }
        .day-num.selected { background: #16a34a !important; color: #ffffff !important; font-weight: 600; }
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
