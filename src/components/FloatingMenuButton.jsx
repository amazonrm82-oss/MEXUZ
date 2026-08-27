import React, { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { colors } from "../lib/theme";

const STORAGE_KEY = "crm-floating-menu-btn-pos";
const SIZE = 40;
const MARGIN = 10;
const DRAG_THRESHOLD = 6;

function clamp(pos) {
  const maxX = Math.max(window.innerWidth - SIZE - MARGIN, MARGIN);
  const maxY = Math.max(window.innerHeight - SIZE - MARGIN, MARGIN);
  return { x: Math.min(Math.max(pos.x, MARGIN), maxX), y: Math.min(Math.max(pos.y, MARGIN), maxY) };
}

function loadPos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return clamp(JSON.parse(raw));
  } catch {
    // ignore malformed/inaccessible storage — fall through to the default corner
  }
  return clamp({ x: window.innerWidth - SIZE - MARGIN, y: MARGIN });
}

// Mobile-only hamburger button, fixed above everything else on screen — which means it can land
// right on top of something the user needs to tap (e.g. a lead drawer's own close button). Making
// it draggable lets them shove it out of the way; a plain tap (no real movement) still opens the
// sidebar, and a dragged spot is remembered per device.
export default function FloatingMenuButton({ onClick }) {
  const [pos, setPos] = useState(loadPos);
  const posRef = useRef(pos);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  useEffect(() => { posRef.current = pos; }, [pos]);

  function handlePointerDown(e) {
    draggingRef.current = true;
    movedRef.current = false;
    startRef.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!draggingRef.current) return;
    const next = clamp({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
    if (Math.abs(next.x - posRef.current.x) > DRAG_THRESHOLD || Math.abs(next.y - posRef.current.y) > DRAG_THRESHOLD) {
      movedRef.current = true;
    }
    posRef.current = next;
    setPos(next);
  }

  function handlePointerUp(e) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (movedRef.current) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current)); } catch {
        // best-effort persistence only
      }
    } else {
      onClick();
    }
  }

  return (
    <button
      className="mobile-menu-btn"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        left: pos.x, top: pos.y,
        alignItems: "center", justifyContent: "center", width: SIZE, height: SIZE, borderRadius: "50%",
        border: "none", background: colors.header, color: "#fff", cursor: "grab", boxShadow: "0 2px 10px rgba(0,0,0,.2)",
        touchAction: "none",
      }}
    >
      <Menu size={20} />
    </button>
  );
}
