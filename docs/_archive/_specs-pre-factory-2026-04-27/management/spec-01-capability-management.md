# Specification 01: Capability Management (The Plugin System)

## 1. Goal
To introduce a Drupal-style extensibility model to Ordo. Owners should be able to browse available MCP tools, toggle them on/off, and securely configure API keys or settings via an auto-generated GUI without writing code.

## 2. Core Architecture

### 2.1 Capability Catalog Extensions
Update the `CapabilityDefinition` facet in `src/core/capability-catalog/capability-definition.ts` to include:
- `defaultEnabled: boolean`
- `configSchema: JSONSchema` (Defines the shape of the required settings, e.g., `{ api_key: string }`)

### 2.2 State Persistence
Extend `SystemSettingsDataMapper` to store:
1.  **Active Capabilities**: An array of `toolNames` that are enabled.
2.  **Capability Configuration**: A JSON blob containing the user-saved settings mapping to the `configSchema`.

### 2.3 Runtime Filtering & Injection
-   **Filtering**: When the system prompt is generated, tools absent from the `active_capabilities` array must be stripped from the LLM context.
-   **Injection**: In `runtime-tool-binding.ts`, intercept tool execution to inject the saved configuration into the `ToolExecutionContext`.

## 3. User Interface
Create a new Admin page (`/admin/plugins`):
-   Iterate over the `CAPABILITY_CATALOG`.
-   Render a card for each tool featuring the `label`, `mcpDescription`, and a toggle switch.
-   Utilize a library (e.g., `react-jsonschema-form`) to dynamically render a settings form based on the tool's `configSchema` when the user clicks "Configure".

## 4. Test Cases
1.  **Toggle Verification**: Disabling `admin_web_search` successfully removes its schema from the LLM prompt.
2.  **Configuration Verification**: Entering an API key in the auto-generated UI saves correctly to SQLite and is accessible within the tool's `execute` function.
