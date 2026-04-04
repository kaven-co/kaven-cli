export interface KavenModule {
  id: string;
  name: string;
  description: string;
  models: string[];
  dependsOn: string[];
}

export const MODULE_REGISTRY: KavenModule[] = [
  {
    id: "core",
    name: "Core",
    description: "Base models — always active, cannot be deactivated",
    models: ["Tenant", "User", "Role", "Capability", "AuthSession", "AuditLog", "RefreshToken", "EmailVerification"],
    dependsOn: [],
  },
  {
    id: "billing",
    name: "Billing",
    description: "Subscriptions, invoices, orders, payments",
    models: ["Invoice", "Order", "Subscription", "Plan", "Payment", "Product"],
    dependsOn: ["core"],
  },
  {
    id: "projects",
    name: "Projects",
    description: "Spaces, projects, tasks — project management features",
    models: ["Space", "Project", "Task"],
    dependsOn: ["core"],
  },
  {
    id: "notifications",
    name: "Notifications",
    description: "In-app notifications and user preferences",
    models: ["Notification", "UserPreference"],
    dependsOn: ["core"],
  },
  {
    id: "service-tokens",
    name: "Service Tokens",
    description: "Agent authentication tokens for AIOX integration",
    models: ["ServiceToken"],
    dependsOn: ["core"],
  },
];
