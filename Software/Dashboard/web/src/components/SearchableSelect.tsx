import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "./ui/input";
import { cn } from "./ui/utils";

export type SearchableOption = {
  value: string;
  label: string;
  /** RM / product code — used for search and display in suggestions. */
  code?: string;
  keywords?: string;
};

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function optionSearchHaystack(option: SearchableOption): string {
  return `${option.label} ${option.code ?? ""} ${option.keywords ?? ""}`.trim();
}

export function optionMatchesQuery(option: SearchableOption, q: string): boolean {
  if (!q) return true;
  const hay = normalizeSearchText(optionSearchHaystack(option));
  if (hay.includes(q)) return true;
  if (option.code && normalizeSearchText(option.code).includes(q)) {
    return true;
  }
  return false;
}

export function findMatchingOption(
  query: string,
  options: SearchableOption[],
): SearchableOption | undefined {
  const q = normalizeSearchText(query);
  if (!q) return undefined;

  const byCodeExact = options.find(
    (option) => option.code && normalizeSearchText(option.code) === q,
  );
  if (byCodeExact) return byCodeExact;

  const exactLabel = options.find(
    (option) => normalizeSearchText(option.label) === q,
  );
  if (exactLabel) return exactLabel;

  const codePartial = options.filter(
    (option) => option.code && normalizeSearchText(option.code).includes(q),
  );
  if (codePartial.length === 1) return codePartial[0];

  const partial = options.filter((option) => optionMatchesQuery(option, q));
  if (partial.length === 1) return partial[0];

  const prefixCode = options.filter(
    (option) => option.code && normalizeSearchText(option.code).startsWith(q),
  );
  if (prefixCode.length === 1) return prefixCode[0];

  const prefixLabel = options.filter((option) =>
    normalizeSearchText(option.label).startsWith(q),
  );
  if (prefixLabel.length === 1) return prefixLabel[0];

  return undefined;
}

type SearchableSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
  /** Max suggestions shown (default 80). */
  maxSuggestions?: number;
};

/**
 * Searchable combobox: type to filter, pick from a visible list (works in Electron; no datalist).
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  className,
  maxSuggestions = 80,
}: SearchableSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const selectedLabel = selected?.label || "";
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  const q = normalizeSearchText(query);
  const filteredOptions = useMemo(() => {
    const list = q.length === 0
      ? options
      : options.filter((option) => optionMatchesQuery(option, q));
    return list.slice(0, maxSuggestions);
  }, [options, q, maxSuggestions]);

  const commitSelection = (option: SearchableOption) => {
    onValueChange(option.value);
    setQuery(option.label);
    setOpen(false);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (rootRef.current?.contains(document.activeElement)) {
        return;
      }
      setOpen(false);
      const match = findMatchingOption(query, options);
      if (match) {
        commitSelection(match);
        return;
      }
      if (value) {
        setQuery(selectedLabel);
      } else {
        setQuery("");
      }
    }, 120);
  };

  const showList = open && !disabled && filteredOptions.length > 0;

  return (
    <div ref={rootRef} className="relative w-full">
      <Input
        value={query}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setOpen(true);
          const match = findMatchingOption(nextQuery, options);
          if (match) {
            onValueChange(match.value);
          }
        }}
        onFocus={() => {
          if (!disabled) setOpen(true);
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
      />
      {showList && (
        <ul
          className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border border-[#d7ccc8] bg-white py-1 shadow-lg"
          role="listbox"
        >
          {filteredOptions.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-[#f5ebe0]",
                  option.value === value && "bg-[#efebe9] font-medium",
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commitSelection(option);
                }}
              >
                <span className="block truncate text-[#3e2723]">{option.label}</span>
                {option.code && !option.label.includes(option.code) ? (
                  <span className="block font-mono text-xs text-[#8d6e63] truncate">
                    {option.code}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !disabled && options.length === 0 && (
        <p className="absolute z-50 mt-1 w-full rounded-md border border-[#d7ccc8] bg-white px-3 py-2 text-xs text-[#8d6e63] shadow">
          Tidak ada pilihan
        </p>
      )}
      {open &&
        !disabled &&
        options.length > 0 &&
        filteredOptions.length === 0 &&
        q.length > 0 && (
          <p className="absolute z-50 mt-1 w-full rounded-md border border-[#d7ccc8] bg-white px-3 py-2 text-xs text-[#8d6e63] shadow">
            Tidak ada yang cocok
          </p>
        )}
    </div>
  );
}
