import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  badge?: string;
  secondaryText?: string;
  disabled?: boolean;
}

export interface BrandedDropdownProps {
  id?: string;
  label?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  placeholder?: string;
  ariaLabel?: string;
  dataTestId?: string;
}

/**
 * BrandedDropdown — VeriCommit Design System Component
 *
 * Implements the locked VeriCommit brand palette:
 * - Deep navy: #0F293A
 * - Teal accent: #0F827A
 * - Warm ivory: #F7F1E7
 * - White: #FFFFFF
 *
 * Fully accessible with WAI-ARIA combobox/listbox pattern:
 * - Keyboard navigation (ArrowDown, ArrowUp, Home, End, Enter, Space, Escape, Tab)
 * - Outside-click dismissal
 * - Focus management and visible focus indicators
 * - Accessible 44px minimum touch targets
 */
export function BrandedDropdown({
  id: propId,
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  placeholder = 'Select an option...',
  ariaLabel,
  dataTestId = 'branded-dropdown'
}: BrandedDropdownProps) {
  const generatedId = useId();
  const dropdownId = propId || `vericommit-dropdown-${generatedId}`;
  const listboxId = `${dropdownId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selectedOption = options[selectedIndex];

  // Sync highlighted index when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [isOpen, selectedIndex]);

  // Outside-click dismissal
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside);

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, [isOpen]);

  // Scroll highlighted item into view when navigating with keyboard
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listboxRef.current) {
      const optionElements = listboxRef.current.querySelectorAll<HTMLLIElement>('[role="option"]');
      const activeEl = optionElements[highlightedIndex];
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, highlightedIndex]);

  const handleSelect = useCallback(
    (optValue: string) => {
      onChange(optValue);
      setIsOpen(false);
      buttonRef.current?.focus();
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;

      case 'Tab':
        setIsOpen(false);
        break;

      case 'ArrowDown': {
        e.preventDefault();
        let nextIndex = highlightedIndex + 1;
        while (nextIndex < options.length && options[nextIndex].disabled) {
          nextIndex++;
        }
        if (nextIndex < options.length) {
          setHighlightedIndex(nextIndex);
        }
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        let prevIndex = highlightedIndex - 1;
        while (prevIndex >= 0 && options[prevIndex].disabled) {
          prevIndex--;
        }
        if (prevIndex >= 0) {
          setHighlightedIndex(prevIndex);
        }
        break;
      }

      case 'Home': {
        e.preventDefault();
        const firstIndex = options.findIndex((opt) => !opt.disabled);
        if (firstIndex !== -1) {
          setHighlightedIndex(firstIndex);
        }
        break;
      }

      case 'End': {
        e.preventDefault();
        for (let i = options.length - 1; i >= 0; i--) {
          if (!options[i].disabled) {
            setHighlightedIndex(i);
            break;
          }
        }
        break;
      }

      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < options.length &&
          !options[highlightedIndex].disabled
        ) {
          handleSelect(options[highlightedIndex].value);
        }
        break;
      }

      default:
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label
          id={`${dropdownId}-label`}
          htmlFor={dropdownId}
          className="block text-xs font-bold uppercase tracking-wider text-[#0F293A] mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Main Trigger Button */}
      <button
        ref={buttonRef}
        id={dropdownId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel || label || 'Select option'}
        aria-labelledby={label ? `${dropdownId}-label ${dropdownId}` : undefined}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        data-testid={dataTestId}
        className={`w-full min-h-[44px] px-3.5 py-2.5 bg-white border border-[#0F293A]/25 rounded-lg text-left flex items-center justify-between gap-2.5 transition-all shadow-2xs cursor-pointer select-none
          hover:border-[#0F827A] hover:bg-[#F7F1E7]/20
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F827A] focus-visible:border-[#0F827A]
          disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
          ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption ? (
            <div className="flex items-center gap-2 min-w-0">
              {selectedOption.badge && (
                <span className="shrink-0 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#F7F1E7] text-[#0F293A] border border-[#0F293A]/15">
                  {selectedOption.badge}
                </span>
              )}
              <span className="text-xs sm:text-sm font-semibold text-[#0F293A] truncate">
                {selectedOption.label}
              </span>
            </div>
          ) : (
            <span className="text-xs sm:text-sm text-[#0F293A]/50 italic truncate">
              {placeholder}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-[#0F827A] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Options Listbox Popover */}
      {isOpen && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel || label || 'Options'}
          className={`absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto bg-white border border-[#0F293A]/20 rounded-xl shadow-lg py-1 divide-y divide-[#0F293A]/5 focus:outline-none ${menuClassName}`}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isHighlighted = idx === highlightedIndex;

            return (
              <li
                key={option.value}
                id={`${dropdownId}-opt-${option.value}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onClick={() => {
                  if (!option.disabled) {
                    handleSelect(option.value);
                  }
                }}
                onMouseEnter={() => {
                  if (!option.disabled) {
                    setHighlightedIndex(idx);
                  }
                }}
                className={`min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm cursor-pointer transition-colors select-none
                  ${
                    option.disabled
                      ? 'opacity-40 cursor-not-allowed bg-transparent text-gray-400'
                      : isSelected
                      ? 'bg-[#F7F1E7] text-[#0F293A] font-semibold'
                      : isHighlighted
                      ? 'bg-[#F7F1E7]/60 text-[#0F293A]'
                      : 'bg-white text-[#0F293A] hover:bg-[#F7F1E7]/40'
                  }`}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {option.badge && (
                      <span className="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white text-[#0F293A] border border-[#0F293A]/15">
                        {option.badge}
                      </span>
                    )}
                    <span className="truncate">{option.label}</span>
                  </div>
                  {option.secondaryText && (
                    <span className="text-[11px] text-[#5B6673] truncate mt-0.5">
                      {option.secondaryText}
                    </span>
                  )}
                </div>

                {isSelected && (
                  <Check
                    className="w-4 h-4 text-[#0F827A] shrink-0 font-bold"
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
