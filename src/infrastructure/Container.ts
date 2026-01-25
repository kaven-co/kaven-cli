// Removing unused Constructor type for now
type Factory<T = unknown> = () => T;

export class Container {
  private services = new Map<string, unknown>();
  private factories = new Map<string, Factory>();

  register<T>(name: string, factory: Factory<T>): void {
    this.factories.set(name, factory as Factory);
  }

  registerSingleton<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  resolve<T>(name: string): T {
    // Check singletons first
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    // Check factories
    if (this.factories.has(name)) {
      const factory = this.factories.get(name);
      if (factory) {
        const instance = factory() as T;
        // Cache as singleton
        this.services.set(name, instance);
        return instance;
      }
    }

    throw new Error(`Service not found: ${name}`);
  }

  clear(): void {
    this.services.clear();
    this.factories.clear();
  }
}

// Global container instance
export const container = new Container();

