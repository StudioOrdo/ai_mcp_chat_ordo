import path from "node:path";

const resolve = {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "@mcp": path.resolve(__dirname, "./mcp"),
  },
};

export default [
  {
    extends: "./vitest.config.ts",
    resolve,
    test: {
      name: "unit",
      environment: "node",
      include: ["src/core/**/*.{test,spec}.ts", "src/adapters/**/*.{test,spec}.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    resolve,
    test: {
      name: "lib",
      environment: "node",
      include: ["src/lib/**/*.{test,spec}.ts", "mcp/**/*.{test,spec}.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    resolve,
    test: {
      name: "integration",
      environment: "node",
      include: ["tests/**/*.{test,spec}.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    resolve,
    test: {
      name: "ui",
      environment: "jsdom",
      include: [
        "src/**/*.{test,spec}.tsx",
        "tests/**/*.{test,spec}.tsx",
        "src/app/**/*.{test,spec}.ts",
        "src/hooks/**/*.{test,spec}.ts",
        "src/components/**/*.{test,spec}.ts",
        "src/frameworks/**/*.{test,spec}.ts"
      ],
      setupFiles: ["./tests/setup-ui.ts"],
    },
  },
];
