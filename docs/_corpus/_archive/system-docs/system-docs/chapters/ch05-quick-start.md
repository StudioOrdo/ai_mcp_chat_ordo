# Getting Started: Installation and Operations

## Overview

This guide provides the necessary steps to initialize Studio Ordo and execute essential development and operational commands.

---

## Infrastructure Requirements

Before beginning the installation, ensure the following environment conditions are met:
*   **Node.js**: Version 20 or higher.
*   **NPM**: Version 10 or higher.
*   **API Credentials**: 
    *   Anthropic API Key (Required for core reasoning).
    *   OpenAI API Key (Optional for specialized tasks).

No separate database server, queue service, search server, or vector database is required for local development. The system runs with a compact local footprint centered on SQLite and the application runtime.

---

## Installation and Initialization

The initial setup follows a standard Node.js development workflow:

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Environment Configuration**:
    Copy the example environment file and update it with your specific credentials:
    ```bash
    cp .env.example .env.local
    ```
3.  **Validate Configuration**:
    Run the environment validation script to ensure all required variables are correctly set:
    ```bash
    npm run validate:env
    ```
4.  **Start Development Server**:
    Launch the local development environment:
    ```bash
    npm run dev
    ```

---

## Essential Commands

The platform includes a comprehensive set of scripts for managing the development and operational lifecycle.

### Development and Build
*   `npm run dev`: Starts the local development server with hot reloading.
*   `npm run build`: Compiles the application for production deployment.
*   `npm run start`: Starts the application in production mode.

### Quality Assurance
*   `npm run typecheck`: Runs the TypeScript compiler to check for type errors.
*   `npm run test`: Executes the unit and integration test suite using Vitest.
*   `npm run browser:verify`: Runs automated browser-based verification tests.
*   `npm run scan:secrets`: Scans the codebase for accidentally committed credentials.

### Data Management
*   `npm run build:search-index:force`: Rebuilds the search index for the knowledge corpus.

### Integrity Reporting
*   `npm run release:evidence`: Generates a structured report of system integrity and performance before release.

**Summary**: By following these steps and utilizing the provided scripts, you can establish a reliable and well-governed development environment with minimal infrastructure overhead. Regular use of the quality assurance and integrity reporting commands is recommended to ensure system stability.
