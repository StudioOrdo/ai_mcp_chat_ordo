import { getSystemSettingsDataMapper } from "@/adapters/RepositoryFactory";
import { resolveInstallState } from "@/lib/appliance/install/install-state";

/**
 * The ConfigurationService is responsible for resolving system configuration.
 * It provides a unified fallback mechanism:
 * 1. Process Environment Variables (e.g., from Docker or .env.local)
 * 2. SQLite 'system_settings' table
 *
 * This enables the "Drupal-like" installation process where a Docker
 * container can boot without an .env file, prompt the user for setup,
 * and persist those keys to SQLite for future runs.
 */
export class ConfigurationService {
  /**
   * Retrieves a string configuration value synchronously.
   */
  static getString(key: string): string | null {
    // 1. Check Process Environment
    const envValue = process.env[key];
    if (envValue !== undefined && envValue !== "") {
      return envValue;
    }

    // 2. Fallback to System Settings DB
    try {
      const repo = getSystemSettingsDataMapper();
      const setting = repo.getSync(key);
      if (setting && setting.valueJson) {
        return JSON.parse(setting.valueJson);
      }
    } catch {
      // If DB is not initialized yet or running in an edge context without DB
      return null;
    }

    return null;
  }

  /**
   * Helper to check if the system is fully initialized.
   */
  static isSystemInitialized(): boolean {
    return resolveInstallState().ownerConfigured;
  }

  /**
   * Persists a string setting to the SQLite DB.
   */
  static setString(key: string, value: string): void {
    const repo = getSystemSettingsDataMapper();
    repo.setSync(key, JSON.stringify(value));
  }

  /**
   * Removes a SQLite-backed setting. Environment values still take precedence
   * and cannot be removed through runtime settings.
   */
  static async deleteString(key: string): Promise<void> {
    const repo = getSystemSettingsDataMapper();
    await repo.delete(key);
  }
}
