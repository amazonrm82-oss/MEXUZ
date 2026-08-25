import React, { useEffect, useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import startOfMonth from "date-fns/startOfMonth";
import endOfMonth from "date-fns/endOfMonth";
import startOfWeek from "date-fns/startOfWeek";
import endOfWeek from "date-fns/endOfWeek";
import eachDayOfInterval from "date-fns/eachDayOfInterval";
import addMonths from "date-fns/addMonths";
import subMonths from "date-fns/subMonths";
import isSameMonth from "date-fns/isSameMonth";
import isSameDay from "date-fns/isSameDay";
import isToday from "date-fns/isToday";
import { he } from "date-fns/locale";
import { colors } from "../lib/theme";
import { useLanguage } from "../lib/LanguageContext";

const WEEKDAY_LETTERS_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const WEEKDAY_LETTERS_EN = ["S", "M", "T", "W", "T", "F", "S"];

// A small Google-Calendar-style month navigator: jump the main calendar to any date without
// changing which view (month/week/day) it's showing.
export default function MiniMonthPicker({ date, onSelect }) {
  const { lang } = useLanguage();
  const weekdayLetters = lang === "en" ? WEEKDAY_LETTERS_EN : WEEKDAY_LETTERS_HE;
  const [cursor, setCursor] = useState(startOfMonth(date));

  useEffect(() => { setCursor(startOfMonth(date)); }, [date]);

  const gridStart = startOfWeek(startOfMonth(cursor), { locale: he });
  const gridEnd = endOfWeek(endOfMonth(cursor), { locale: he });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,.06)", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button onClick={() => setCursor((c) => subMonths(c, 1))} style={navBtnStyle}><ChevronRight size={14} /></button>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{cursor.toLocaleDateString(lang === "en" ? "en-US" : "he-IL", { month: "long", year: "numeric" })}</div>
        <button onClick={() => setCursor((c) => addMonths(c, 1))} style={navBtnStyle}><ChevronLeft size={14} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
        {weekdayLetters.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, color: colors.muted, fontWeight: 700 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {days.map((d) => {
          const inMonth = isSameMonth(d, cursor);
          const today = isToday(d);
          const selected = isSameDay(d, date);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(d)}
              style={{
                aspectRatio: "1", border: "none", borderRadius: "50%", cursor: "pointer", fontSize: 11,
                background: selected ? colors.accent : today ? `${colors.accent}22` : "transparent",
                color: selected ? "#fff" : !inMonth ? colors.border : today ? colors.accent : colors.text,
                fontWeight: today || selected ? 700 : 400,
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const navBtnStyle = { border: "none", background: "none", cursor: "pointer", color: colors.muted, display: "flex", padding: 3 };
