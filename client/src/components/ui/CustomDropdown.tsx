import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './CustomDropdown.css';

interface CustomDropdownProps {
  label: string;
  value: string;
  options: string[];
  icon?: LucideIcon;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: 'filter' | 'period' | 'act-filter';
}

export default function CustomDropdown({
  label,
  value,
  options,
  icon: Icon,
  onChange,
  placeholder = 'Select an option',
  variant = 'filter',
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(options.indexOf(value));
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          onChange(options[highlightedIndex]);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const displayValue = value || placeholder;
  const hasValue = !!value;

  return (
    <div
      className={`cdrop cdrop--${variant} ${isOpen ? 'cdrop--open' : ''}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {variant === 'filter' && label && (
        <span className="cdrop__label">{label}</span>
      )}

      <button
        type="button"
        className={`cdrop__trigger ${!hasValue ? 'cdrop__trigger--placeholder' : ''}`}
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) setHighlightedIndex(options.indexOf(value));
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label}
      >
        {Icon && (
          <span className="cdrop__trigger-icon">
            <Icon size={variant === 'period' || variant === 'act-filter' ? 14 : 16} strokeWidth={2.2} />
          </span>
        )}
        <span className="cdrop__trigger-text">{displayValue}</span>
        <span className={`cdrop__chevron ${isOpen ? 'cdrop__chevron--rotated' : ''}`}>
          <ChevronDown size={variant === 'period' ? 13 : 15} />
        </span>
      </button>

      <div className={`cdrop__menu-wrapper ${isOpen ? 'cdrop__menu-wrapper--visible' : ''}`}>
        <ul
          className="cdrop__menu"
          role="listbox"
          ref={listRef}
          aria-label={label}
        >
          {!options.length && (
            <li className="cdrop__item cdrop__item--empty">No options available</li>
          )}
          {options.map((opt, index) => {
            const isSelected = opt === value;
            const isHighlighted = index === highlightedIndex;
            return (
              <li
                key={opt}
                role="option"
                aria-selected={isSelected}
                className={`cdrop__item ${isSelected ? 'cdrop__item--selected' : ''} ${isHighlighted ? 'cdrop__item--highlighted' : ''}`}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className="cdrop__item-text">{opt}</span>
                {isSelected && (
                  <span className="cdrop__item-check">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
