// Plain-TS port of supabase/email-templates/invite.html, for sending via
// our own mailer (lib/sendInviteEmail.ts) instead of Supabase's Go-template
// engine. Same table-based, inline-styled, email-client-safe markup — see
// that file's header comment for the full design rationale. Kept in sync
// by hand; supabase/email-templates/invite.html stays as the reference for
// anyone who later gets Supabase SMTP-settings permissions and wants to
// paste it in there instead.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildInviteEmailHtml(email: string, actionLink: string): string {
  const safeEmail = escapeHtml(email);
  const safeLink = escapeHtml(actionLink);

  return `
<div style="margin:0; padding:0; background-color:#070908; width:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#070908; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#0f1713; border:1px solid rgba(255,255,255,0.08); border-radius:20px; overflow:hidden;">

          <tr>
            <td align="center" style="padding:36px 40px 0 40px;">
              <span style="font-family:Arial,Helvetica,sans-serif; font-size:15px; font-weight:800; letter-spacing:0.04em; color:#ffffff;">LIFEWOOD</span>
              <span style="font-family:Arial,Helvetica,sans-serif; font-size:13px; color:rgba(255,255,255,0.35); margin:0 8px;">&times;</span>
              <span style="font-family:Arial,Helvetica,sans-serif; font-size:15px; font-weight:800; letter-spacing:0.04em; color:#d98324;">BUCKEDUP</span>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 40px 0 40px;">
              <span style="display:inline-block; font-family:Arial,Helvetica,sans-serif; font-size:10px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#ff9f1c; background-color:rgba(217,131,36,0.12); border:1px solid rgba(217,131,36,0.3); border-radius:20px; padding:4px 12px;">
                You've been invited
              </span>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 40px 0 40px;">
              <h1 style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:22px; font-weight:900; letter-spacing:-0.02em; color:#ffffff;">
                Join the Video Production Monitor
              </h1>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:14px 40px 0 40px;">
              <p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.6; color:rgba(255,255,255,0.55);">
                An super-admin created an account for <strong style="color:rgba(255,255,255,0.8);">${safeEmail}</strong> on the BuckedUp &times; Lifewood dashboard. Accept the invite below to set your password and get started.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 40px 0 40px;">
              <a href="${safeLink}"
                 style="display:inline-block; font-family:Arial,Helvetica,sans-serif; font-size:14px; font-weight:800; color:#04120e; text-decoration:none; background-color:#10b981; background-image:linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius:12px; padding:14px 32px;">
                Accept invitation
              </a>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 40px 0 40px;">
              <p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:1.6; color:rgba(255,255,255,0.35); word-break:break-all;">
                Button not working? Paste this link into your browser:<br />
                <a href="${safeLink}" style="color:#d98324;">${safeLink}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 40px 32px 40px; border-top:1px solid rgba(255,255,255,0.06); margin-top:24px;">
              <p style="margin:20px 0 0 0; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:1.6; color:rgba(255,255,255,0.3);">
                Didn't expect this invite? You can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</div>
`;
}
