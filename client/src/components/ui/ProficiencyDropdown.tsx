import { useState, useRef, useEffect } from "react";
import { Award, ChevronDown, Check } from "lucide-react";

export interface ProficiencyLevel {
  value: string;
  label: string;
  tier: string;
  desc: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}

export const PROFICIENCY_OPTIONS: ProficiencyLevel[] = [
  {
    value: "Beginner",
    label: "Beginner",
    tier: "Level 1",
    desc: "Starting out & learning core basics",
    color: "#059669",
    bgColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    dotColor: "#10b981",
  },
  {
    value: "Intermediate",
    label: "Intermediate",
    tier: "Level 2",
    desc: "Comfortable with practical real-world skills",
    color: "#1d4ed8",
    bgColor: "#eff6ff",
    borderColor: "#bfdbfe",
    dotColor: "#2563eb",
  },
  {
    value: "Advanced",
    label: "Advanced",
    tier: "Level 3",
    desc: "Deep knowledge & complex problem solving",
    color: "#7c3aed",
    bgColor: "#f5f3ff",
    borderColor: "#ddd6fe",
    dotColor: "#8b5cf6",
  },
  {
    value: "Expert",
    label: "Expert",
    tier: "Level 4",
    desc: "Mastery, mentoring & industry expertise",
    color: "#d97706",
    bgColor: "#fffbeb",
    borderColor: "#fde68a",
    dotColor: "#f59e0b",
  },
];

interface ProficiencyDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ProficiencyDropdown({
  value,
  onChange,
}: ProficiencyDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected =
    PROFICIENCY_OPTIONS.find(
      (opt) => opt.value.toLowerCase() === (value || "").toLowerCase()
    ) || PROFICIENCY_OPTIONS[1];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="prof-dropdown-wrapper" ref={dropdownRef}>
      <div className="prof-dropdown-header">
        <label className="prof-dropdown-label" id="prof-dropdown-label">
          <Award size={14} className="prof-label-icon" />
          <span>Proficiency Level</span>
        </label>
        <span
          className="prof-current-badge"
          style={{
            color: selected.color,
            backgroundColor: selected.bgColor,
            borderColor: selected.borderColor,
          }}
        >
          {selected.tier} • {selected.label}
        </span>
      </div>

      <div className="prof-dropdown-box">
        <button
          type="button"
          className={`prof-trigger-btn ${isOpen ? "open" : ""}`}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby="prof-dropdown-label"
        >
          <div className="prof-trigger-content">
            <span
              className="prof-indicator-dot"
              style={{ backgroundColor: selected.dotColor }}
            />
            <span className="prof-selected-title">{selected.label}</span>
            <span className="prof-selected-desc">— {selected.desc}</span>
          </div>

          <span className={`prof-chevron-wrap ${isOpen ? "rotated" : ""}`}>
            <ChevronDown size={15} />
          </span>
        </button>

        {isOpen && (
          <ul
            className="prof-menu-list"
            role="listbox"
            aria-labelledby="prof-dropdown-label"
          >
            {PROFICIENCY_OPTIONS.map((option) => {
              const isSelected =
                option.value.toLowerCase() === selected.value.toLowerCase();
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`prof-menu-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  <div className="prof-item-main">
                    <span
                      className="prof-item-tier-badge"
                      style={{
                        color: option.color,
                        backgroundColor: option.bgColor,
                        borderColor: option.borderColor,
                      }}
                    >
                      {option.tier}
                    </span>
                    <div className="prof-item-details">
                      <span className="prof-item-title">{option.label}</span>
                      <span className="prof-item-desc">{option.desc}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <span
                      className="prof-item-check"
                      style={{ color: option.color }}
                    >
                      <Check size={16} strokeWidth={2.8} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
