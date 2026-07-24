import * as React from "react";

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  'data-testid'?: string;
}

export function Select({ value, onValueChange, children, 'data-testid': dataTestId }: SelectProps) {
  return (
    <select
      className="border rounded px-3 py-2"
      value={value}
      onChange={e => onValueChange(e.target.value)}
      data-testid={dataTestId}
    >
      {children}
    </select>
  );
}

interface SelectTriggerProps {
  className?: string;
  children: React.ReactNode;
}
export function SelectTrigger({ className = "", children }: SelectTriggerProps) {
  return <>{children}</>;
}

interface SelectValueProps {
  placeholder?: string;
}
export function SelectValue({ placeholder }: SelectValueProps) {
  return <option value="">{placeholder}</option>;
}

interface SelectContentProps {
  children: React.ReactNode;
}
export function SelectContent({ children }: SelectContentProps) {
  return <>{children}</>;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}
export function SelectItem({ value, children }: SelectItemProps) {
  return <option value={value}>{children}</option>;
} 