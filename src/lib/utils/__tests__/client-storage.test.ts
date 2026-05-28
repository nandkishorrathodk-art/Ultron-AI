import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  readSelectedModel,
  writeSelectedModel,
  clearSelectedModelFromStorage,
  hasAuthenticatedBefore,
  markHasAuthenticatedBefore,
} from "../client-storage";

const STORAGE_KEY = "selected_model";
const LEGACY_ASK_KEY = `${STORAGE_KEY}_ask`;
const LEGACY_AGENT_KEY = `${STORAGE_KEY}_agent`;

describe("client-storage selected model", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("readSelectedModel", () => {
    it("returns null when nothing is stored", () => {
      expect(readSelectedModel()).toBeNull();
    });

    it("returns the value stored under the unified key", () => {
      window.localStorage.setItem(STORAGE_KEY, "Ultron-AI-pro");
      expect(readSelectedModel()).toBe("Ultron-AI-pro");
    });

    it("rejects invalid stored values", () => {
      window.localStorage.setItem(STORAGE_KEY, "not-a-real-model");
      expect(readSelectedModel()).toBeNull();
    });

    it("migrates legacy underlying-model ids to Ultron-AI tiers", () => {
      window.localStorage.setItem(STORAGE_KEY, "opus-4.6");
      expect(readSelectedModel()).toBe("Ultron-AI-max");
      // The migration rewrites the unified key to the tier id.
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("Ultron-AI-max");
    });

    it("maps legacy gemini-3-flash and kimi-k2.6 both to Ultron-AI-standard", () => {
      window.localStorage.setItem(STORAGE_KEY, "gemini-3-flash");
      expect(readSelectedModel()).toBe("Ultron-AI-standard");

      window.localStorage.setItem(STORAGE_KEY, "kimi-k2.6");
      expect(readSelectedModel()).toBe("Ultron-AI-standard");
    });

    it("migrates the short-lived Ultron-AI-lite tier id to Ultron-AI-standard", () => {
      window.localStorage.setItem(STORAGE_KEY, "Ultron-AI-lite");
      expect(readSelectedModel()).toBe("Ultron-AI-standard");
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe(
        "Ultron-AI-standard",
      );
    });

    it("migrates removed Grok ids to Ultron-AI-standard", () => {
      window.localStorage.setItem(STORAGE_KEY, "grok-4.1");
      expect(readSelectedModel()).toBe("Ultron-AI-standard");

      window.localStorage.setItem(STORAGE_KEY, "grok-4.3");
      expect(readSelectedModel()).toBe("Ultron-AI-standard");
    });

    it("does not match inherited Object.prototype keys via the legacy map", () => {
      // Without Object.hasOwn, "toString" / "constructor" would resolve to
      // inherited functions, not SelectedModel values.
      window.localStorage.setItem(STORAGE_KEY, "toString");
      expect(readSelectedModel()).toBeNull();

      window.localStorage.setItem(STORAGE_KEY, "constructor");
      expect(readSelectedModel()).toBeNull();

      window.localStorage.setItem(STORAGE_KEY, "hasOwnProperty");
      expect(readSelectedModel()).toBeNull();
    });

    it("migrates from legacy selected_model_ask key when unified key is empty", () => {
      window.localStorage.setItem(LEGACY_ASK_KEY, "opus-4.6");
      window.localStorage.setItem(LEGACY_AGENT_KEY, "sonnet-4.6");

      expect(readSelectedModel()).toBe("Ultron-AI-max");
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("Ultron-AI-max");
      expect(window.localStorage.getItem(LEGACY_ASK_KEY)).toBeNull();
      expect(window.localStorage.getItem(LEGACY_AGENT_KEY)).toBeNull();
    });

    it("falls back to legacy selected_model_agent key when ask is missing", () => {
      window.localStorage.setItem(LEGACY_AGENT_KEY, "kimi-k2.6");

      expect(readSelectedModel()).toBe("Ultron-AI-standard");
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe(
        "Ultron-AI-standard",
      );
      expect(window.localStorage.getItem(LEGACY_AGENT_KEY)).toBeNull();
    });

    it("ignores legacy keys with unrecognized values and returns null", () => {
      window.localStorage.setItem(LEGACY_ASK_KEY, "totally-fake-model");
      window.localStorage.setItem(LEGACY_AGENT_KEY, "another-bogus-id");

      expect(readSelectedModel()).toBeNull();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("does not migrate from legacy keys when unified key is already a tier id", () => {
      window.localStorage.setItem(STORAGE_KEY, "Ultron-AI-pro");
      window.localStorage.setItem(LEGACY_ASK_KEY, "opus-4.6");

      expect(readSelectedModel()).toBe("Ultron-AI-pro");
      // Legacy key is left alone when unified key is valid.
      expect(window.localStorage.getItem(LEGACY_ASK_KEY)).toBe("opus-4.6");
    });
  });

  describe("writeSelectedModel", () => {
    it("persists under the unified key", () => {
      writeSelectedModel("Ultron-AI-max");
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("Ultron-AI-max");
    });
  });

  describe("clearSelectedModelFromStorage", () => {
    it("removes the unified key and legacy per-mode keys", () => {
      window.localStorage.setItem(STORAGE_KEY, "Ultron-AI-pro");
      window.localStorage.setItem(LEGACY_ASK_KEY, "opus-4.6");
      window.localStorage.setItem(LEGACY_AGENT_KEY, "kimi-k2.6");

      clearSelectedModelFromStorage();

      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(window.localStorage.getItem(LEGACY_ASK_KEY)).toBeNull();
      expect(window.localStorage.getItem(LEGACY_AGENT_KEY)).toBeNull();
    });
  });
});

describe("client-storage auth marker", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns false before the browser has authenticated", () => {
    expect(hasAuthenticatedBefore()).toBe(false);
  });

  it("persists that this browser has authenticated before", () => {
    markHasAuthenticatedBefore();
    expect(hasAuthenticatedBefore()).toBe(true);
  });
});
