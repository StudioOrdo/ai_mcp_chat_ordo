import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Mock next/navigation globally so components using useRouter don't crash in tests


// Automatically cleanup after each test
afterEach(() => {
    cleanup();
});
