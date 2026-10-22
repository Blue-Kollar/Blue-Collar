import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocalStorage } from "@/hooks/useLocalStorage";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("useLocalStorage", () => {
  it("uses the initial value when stored JSON is corrupt", () => {
    window.localStorage.setItem("settings", "{invalid");

    const { result } = renderHook(() => useLocalStorage("settings", { theme: "light" }));

    expect(result.current[0]).toEqual({ theme: "light" });
    expect(window.localStorage.getItem("settings")).toBe(JSON.stringify({ theme: "light" }));
  });

  it("keeps working when storage is disabled", () => {
    const getStorage = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("Storage is disabled");
    });

    const { result } = renderHook(() => useLocalStorage("settings", "default"));

    expect(result.current[0]).toBe("default");
    expect(() => {
      act(() => result.current[1]("updated"));
    }).not.toThrow();
    expect(result.current[0]).toBe("updated");
    expect(getStorage).toHaveBeenCalled();
  });
});
