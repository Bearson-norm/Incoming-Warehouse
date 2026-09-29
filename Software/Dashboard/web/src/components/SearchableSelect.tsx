import { useEffect, useId, useState } from "react";
import { Input } from "./ui/input";

type SearchableOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
};

/** A native datalist-backed selector: users can search by typing or pick from suggestions. */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  className,
}: SearchableSelectProps) {
  const listId = useId();
  const selectedLabel = options.find((option) => option.value === value)?.label || "";
  const [query, setQuery] = useState(selectedLabel);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  const selectMatchingOption = (nextQuery: string) => {
    const match = options.find(
      (option) => option.label.toLocaleLowerCase() === nextQuery.trim().toLocaleLowerCase(),
    );
    onValueChange(match?.value || "");
  };

  return (
    <>
      <Input
        value={query}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          selectMatchingOption(nextQuery);
        }}
        onBlur={() => selectMatchingOption(query)}
        list={listId}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.label} />
        ))}
      </datalist>
    </>
  );
}
