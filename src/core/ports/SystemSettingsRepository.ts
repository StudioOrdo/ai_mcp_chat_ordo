export interface SystemSetting {
  key: string;
  valueJson: string;
  updatedAt: string;
}

export interface SystemSettingsRepository {
  getAll(): Promise<SystemSetting[]>;
  get(key: string): Promise<SystemSetting | null>;
  set(key: string, valueJson: string): Promise<void>;
  delete(key: string): Promise<void>;
}
