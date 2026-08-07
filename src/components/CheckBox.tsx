"use client";
import React, { SetStateAction, useState,  Dispatch, useEffect } from "react";
import { filters } from "@/components/types/filters";

interface CheckBoxProps {
    text: string;
    filter?: Partial<filters>;
    onChange: (checked: boolean) => void;
}


const CheckBox: React.FC<CheckBoxProps> = ({ text, filter, onChange }) => {

  const checked = filter?.tags?.includes(text.toLowerCase()) ?? false;


 
  
  return (
    <label className="flex items-center space-x-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />

      <span>{text}</span>
    </label>
  );
};

export default CheckBox;