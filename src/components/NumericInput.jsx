import { useState } from "react";
import { formatInteger, parseInteger, formatMoneyDisplay, formatDecimal, parseDecimal, formatDecimalDisplay, formatMoney, parseMoney } from "../utils/numberFormat";

export function MoneyInput({ value, onChange, className, placeholder, disabled, id }) {
  const [isFocused, setIsFocused] = useState(false);
  const [localText, setLocalText] = useState("");

  const displayValue = isFocused ? localText : formatMoneyDisplay(value, false);

  const handleChange = (e) => {
    const text = e.target.value;
    const formatted = formatMoney(text);
    setLocalText(formatted);
    
    const raw = parseMoney(text);
    onChange(raw);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setLocalText(formatMoneyDisplay(value, true));
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}

export function IntegerInput({ value, onChange, className, placeholder, disabled, id, min, max }) {
  const [isFocused, setIsFocused] = useState(false);
  const [localText, setLocalText] = useState("");

  const displayValue = isFocused ? localText : formatInteger(value);

  const handleChange = (e) => {
    const text = e.target.value;
    const formatted = formatInteger(text);
    setLocalText(formatted);

    let raw = parseInteger(text);
    if (raw !== "" && min !== undefined && raw < min) raw = min;
    if (raw !== "" && max !== undefined && raw > max) raw = max;
    onChange(raw);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setLocalText(formatInteger(value));
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}

export function DecimalInput({ value, onChange, className, placeholder, disabled, id, min, max }) {
  const [isFocused, setIsFocused] = useState(false);
  const [localText, setLocalText] = useState("");

  const displayValue = isFocused ? localText : formatDecimalDisplay(value);

  const handleChange = (e) => {
    const text = e.target.value;
    const formatted = formatDecimal(text);
    setLocalText(formatted);

    let raw = parseDecimal(text);
    if (raw !== "" && min !== undefined && raw < min) raw = min;
    if (raw !== "" && max !== undefined && raw > max) raw = max;
    onChange(raw);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setLocalText(formatDecimal(value));
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}
