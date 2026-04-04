// Current catalog: 27 capabilities (core set).
// Full set of 48 capabilities will be expanded in future sprints.
export type CapabilityType = "boolean" | "numeric";
export type FeatureTier = "starter" | "complete" | "pro" | "enterprise";

export interface CapabilityDefinition {
  key: string;
  type: CapabilityType;
  description: string;
  category: string;
  defaultValue: string;
}

export const ALL_CAPABILITIES: CapabilityDefinition[] = [
  // --- AUTH ---
  { key: "FEATURE_EMAIL_VERIFICATION", type: "boolean", description: "Email verification on signup", category: "Auth", defaultValue: "true" },
  { key: "FEATURE_2FA_TOTP", type: "boolean", description: "Two-factor authentication via TOTP", category: "Auth", defaultValue: "false" },
  { key: "FEATURE_SSO_SAML", type: "boolean", description: "Single Sign-On via SAML/OIDC", category: "Auth", defaultValue: "false" },
  { key: "FEATURE_SOCIAL_LOGIN", type: "boolean", description: "Login via Google, GitHub, etc.", category: "Auth", defaultValue: "true" },
  { key: "FEATURE_MAGIC_LINK", type: "boolean", description: "Passwordless login via email", category: "Auth", defaultValue: "false" },

  // --- TENANCY ---
  { key: "FEATURE_CUSTOM_DOMAIN", type: "boolean", description: "Custom domain per tenant", category: "Tenancy", defaultValue: "false" },
  { key: "FEATURE_WHITE_LABEL", type: "boolean", description: "Remove Kaven branding", category: "Tenancy", defaultValue: "false" },
  { key: "FEATURE_MULTI_BUSINESS", type: "boolean", description: "Multiple businesses per user", category: "Tenancy", defaultValue: "false" },
  { key: "FEATURE_AGENCY_HUB", type: "boolean", description: "Agency management dashboard", category: "Tenancy", defaultValue: "false" },
  { key: "FEATURE_TENANT_THEMES", type: "boolean", description: "Custom themes for tenants", category: "Tenancy", defaultValue: "true" },

  // --- BILLING ---
  { key: "FEATURE_SUBSCRIPTIONS", type: "boolean", description: "Subscription management", category: "Billing", defaultValue: "true" },
  { key: "FEATURE_INVOICING", type: "boolean", description: "Automatic invoicing", category: "Billing", defaultValue: "true" },
  { key: "FEATURE_USAGE_BILLING", type: "boolean", description: "Metered usage billing", category: "Billing", defaultValue: "false" },
  { key: "FEATURE_PADDLE_CHECKOUT", type: "boolean", description: "Paddle payment integration", category: "Billing", defaultValue: "true" },
  { key: "FEATURE_PAGUBIT_PIX", type: "boolean", description: "Pix payment support", category: "Billing", defaultValue: "false" },

  // --- API ---
  { key: "FEATURE_API_ACCESS", type: "boolean", description: "External API access", category: "API", defaultValue: "false" },
  { key: "FEATURE_WEBHOOKS", type: "boolean", description: "Outgoing webhooks", category: "API", defaultValue: "false" },
  { key: "FEATURE_MARKETPLACE_ACCESS", type: "boolean", description: "Kaven Marketplace access", category: "API", defaultValue: "true" },
  { key: "MAX_API_CALLS_MONTH", type: "numeric", description: "Maximum API calls per month", category: "API", defaultValue: "10000" },
  { key: "MAX_AGENT_API_CALLS_HOUR", type: "numeric", description: "Maximum agent calls per hour", category: "API", defaultValue: "100" },

  // --- LIMITS ---
  { key: "MAX_TEAM_MEMBERS", type: "numeric", description: "Maximum team members per tenant", category: "Limits", defaultValue: "5" },
  { key: "MAX_PROJECTS", type: "numeric", description: "Maximum projects per tenant", category: "Limits", defaultValue: "3" },
  { key: "MAX_STORAGE_GB", type: "numeric", description: "Maximum storage in GB", category: "Limits", defaultValue: "1" },
  { key: "MAX_TENANTS", type: "numeric", description: "Maximum sub-tenants", category: "Limits", defaultValue: "1" },

  // --- SUPPORT ---
  { key: "FEATURE_PRIORITY_SUPPORT", type: "boolean", description: "Priority support queue", category: "Support", defaultValue: "false" },
  { key: "FEATURE_AUDIT_COMPLIANCE", type: "boolean", description: "Audit logs and compliance", category: "Support", defaultValue: "false" },
  { key: "FEATURE_DATA_EXPORT", type: "boolean", description: "Customer data export", category: "Support", defaultValue: "true" },
];

export const TIER_DEFAULTS: Record<FeatureTier, Record<string, string | boolean>> = {
  starter: {
    FEATURE_EMAIL_VERIFICATION: true,
    FEATURE_SOCIAL_LOGIN: true,
    FEATURE_MARKETPLACE_ACCESS: true,
    MAX_TEAM_MEMBERS: "5",
    MAX_PROJECTS: "3",
    MAX_API_CALLS_MONTH: "10000",
  },
  complete: {
    FEATURE_EMAIL_VERIFICATION: true,
    FEATURE_SOCIAL_LOGIN: true,
    FEATURE_CUSTOM_DOMAIN: true,
    FEATURE_API_ACCESS: true,
    FEATURE_MARKETPLACE_ACCESS: true,
    MAX_TEAM_MEMBERS: "25",
    MAX_PROJECTS: "20",
    MAX_API_CALLS_MONTH: "100000",
  },
  pro: {
    FEATURE_EMAIL_VERIFICATION: true,
    FEATURE_SOCIAL_LOGIN: true,
    FEATURE_CUSTOM_DOMAIN: true,
    FEATURE_WHITE_LABEL: true,
    FEATURE_API_ACCESS: true,
    FEATURE_MARKETPLACE_ACCESS: true,
    MAX_TEAM_MEMBERS: "100",
    MAX_PROJECTS: "100",
    MAX_API_CALLS_MONTH: "1000000",
  },
  enterprise: {}
};
