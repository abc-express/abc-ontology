import { SetMetadata } from "@nestjs/common";

/** Nest metadata key (not a credential). */
export const WEBHOOK_AUTH_KEY = Symbol.for("daemon.gateway.webhookRoute");

/**
 * Machine ingress routes (webhooks, listeners). No user session required;
 * tenant scope is derived from the source catalog, not client headers.
 */
export const WebhookAuth = () => SetMetadata(WEBHOOK_AUTH_KEY, true);
