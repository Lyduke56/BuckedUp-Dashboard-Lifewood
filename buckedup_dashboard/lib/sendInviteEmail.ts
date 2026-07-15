import nodemailer from "nodemailer";
import { buildInviteEmailHtml } from "./inviteEmailHtml";

// Gmail SMTP relay, used only when GMAIL_APP_PASSWORD is set — see
// app/api/admin/create-user/route.ts, which falls back to Supabase's
// built-in inviteUserByEmail() mailer otherwise. Chosen over Supabase's
// own SMTP settings (blocked: needs org-admin permissions the account
// running this doesn't have) and over Resend (blocked: needs a verified
// domain, and there's neither DNS access nor budget for one). Trade-off
// accepted: invites come from a personal-looking Gmail address, not a
// branded domain — free and zero-permission is the priority here.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

export async function sendInviteEmail(email: string, actionLink: string): Promise<{ error?: string }> {
  try {
    await getTransporter().sendMail({
      from: `BuckedUp Dashboard <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "You've been invited to the Video Production Monitor",
      html: buildInviteEmailHtml(email, actionLink),
      // A plain-text alternative alongside the HTML — HTML-only mail from
      // a personal Gmail relay (no domain reputation to lean on) reads as
      // more spam-like to filters than a proper multipart message.
      text: `You've been invited to the BuckedUp x Lifewood Video Production Monitor.\n\nAn admin created an account for ${email}. Accept the invite to set your password and get started:\n${actionLink}\n\nDidn't expect this invite? You can safely ignore this email.`,
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send invite email" };
  }
}
