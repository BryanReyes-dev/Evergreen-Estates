import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_ACCOUNT_PREFERENCES,
  isAccountPreferences,
  normalizeAccountPreferences,
} from "@/lib/account-preferences";

describe("account preference normalization — pure unit tests", () => {
  it("provides stable default sorting and grid layout when input is absent", () => {
    expect(normalizeAccountPreferences(undefined)).toEqual(DEFAULT_ACCOUNT_PREFERENCES);
    expect(normalizeAccountPreferences(null)).toEqual(DEFAULT_ACCOUNT_PREFERENCES);
  });

  it("does not treat arrays or primitives as preference objects", () => {
    expect(normalizeAccountPreferences([])).toEqual(DEFAULT_ACCOUNT_PREFERENCES);
    expect(normalizeAccountPreferences("newest")).toEqual(DEFAULT_ACCOUNT_PREFERENCES);
  });

  it("preserves a fully supported preference object", () => {
    expect(normalizeAccountPreferences({
      defaultSort: "price-high",
      viewMode: "list",
    })).toEqual({
      defaultSort: "price-high",
      viewMode: "list",
    });
  });

  it("normalizes invalid sort and layout members independently to safe defaults", () => {
    expect(normalizeAccountPreferences({
      defaultSort: "random",
      viewMode: "list",
    })).toEqual({
      defaultSort: "newest",
      viewMode: "list",
    });
    expect(normalizeAccountPreferences({
      defaultSort: "price-low",
      viewMode: "cards",
    })).toEqual({
      defaultSort: "price-low",
      viewMode: "grid",
    });
  });

  it("accepts exactly the two supported preference fields and values", () => {
    expect(isAccountPreferences({ defaultSort: "newest", viewMode: "grid" })).toBe(true);
    expect(isAccountPreferences({ defaultSort: "price-low", viewMode: "list" })).toBe(true);
    expect(isAccountPreferences({ defaultSort: "recent", viewMode: "grid" })).toBe(false);
    expect(isAccountPreferences({ defaultSort: "newest" })).toBe(false);
    expect(isAccountPreferences({ defaultSort: "newest", viewMode: "grid", name: "extra" })).toBe(false);
    expect(isAccountPreferences(null)).toBe(false);
  });
});
