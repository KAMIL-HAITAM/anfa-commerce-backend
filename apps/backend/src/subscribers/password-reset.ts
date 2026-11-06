
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";

type PasswordResetEvent = {
  entity_id: string;
  token: string;
  actor_type: string;
};

export default async function passwordResetHandler({
  event,
  container,
}: SubscriberArgs<PasswordResetEvent>) {
  const { entity_id: email, token, actor_type } = event.data;

  // This subscriber is for customer accounts, not admin accounts.
  if (actor_type !== "customer") {
    return;
  }

  const notificationService = container.resolve(Modules.NOTIFICATION);

  const storefrontUrl = (
    process.env.STOREFRONT_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  const resetUrl = new URL(
    "/account/reset-password",
    storefrontUrl
  );

  resetUrl.searchParams.set("token", token);
  resetUrl.searchParams.set("email", email);

  await notificationService.createNotifications({
    to: email,
    channel: "email",
    template: "password-reset",
    data: {
      reset_url: resetUrl.toString(),
    },
  });
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
};
