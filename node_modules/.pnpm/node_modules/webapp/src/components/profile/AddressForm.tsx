import React from "react";
import { FormField, inputStyle, textareaStyle } from "../common/FormField";

export function AddressForm({
  city,
  place,
  specialReference,
  onChange,
}: {
  city: string;
  place: string;
  specialReference: string;
  onChange: (f: { city: string; place: string; specialReference: string }) => void;
}) {
  return (
    <>
      <FormField label="City">
        <input style={inputStyle} value={city} onChange={(e) => onChange({ city: e.target.value, place, specialReference })} />
      </FormField>
      <FormField label="Place">
        <input style={inputStyle} value={place} onChange={(e) => onChange({ city, place: e.target.value, specialReference })} placeholder="Neighborhood / area" />
      </FormField>
      <FormField label="Special reference">
        <textarea style={textareaStyle} rows={2} value={specialReference} onChange={(e) => onChange({ city, place, specialReference: e.target.value })} placeholder="Landmark / directions" />
      </FormField>
    </>
  );
}
