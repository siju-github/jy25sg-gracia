export interface AttendeeRecord {
  name: string;
  category?: string;
  parish?: string;
  email?: string;
  passId: string;
}

export interface ConfirmationEmailOptions {
  primaryName: string;
  primaryEmail: string;
  phoneNumber: string;
  totalSeats: number;
  attendeeBreakdown: string;
  passes: AttendeeRecord[];
  primaryPassId?: string;
}

export function generateConfirmationEmailHtml(registration: ConfirmationEmailOptions): string {
  const primaryPassId = registration.primaryPassId || (registration.passes && registration.passes[0]?.passId) || 'GRACIA-JUBILEE';

  const passesHtml = (registration.passes || [])
    .map((pass, index) => {
      const initials = (pass.name || 'GA')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(pass.passId || '')}&format=png`;
      const badgeTitle = index === 0 ? 'PRIMARY DELEGATE' : `DELEGATE #${index + 1}`;

      return `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 20px;">
        <div style="background-color: #0f172a; color: #ffffff; text-align: center; padding: 8px; font-size: 9px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
          ${badgeTitle} • CONFERENCE PASS
        </div>
        <div style="padding: 16px; text-align: center;">
          <table align="center" cellpadding="0" cellspacing="0" style="margin: 0 auto 10px auto;">
            <tr>
              <td>
                <div style="width: 44px; height: 44px; border-radius: 50%; background-color: #fef08a; color: #854d0e; font-size: 15px; font-weight: 800; line-height: 44px; text-align: center; margin-right: 10px;">
                  ${initials}
                </div>
              </td>
              <td align="left">
                <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${pass.name}</div>
                ${pass.parish ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">📍 ${pass.parish}</div>` : ''}
              </td>
            </tr>
          </table>

          <div style="color: #ea580c; font-size: 8px; margin: 4px 0;">◆</div>
          <div style="font-size: 11px; font-weight: 900; letter-spacing: 3px; color: #0f172a;">G R A C I A</div>
          <div style="font-size: 8px; font-weight: 700; letter-spacing: 1px; color: #dc2626; margin-bottom: 10px;">CONFERENCE PASS</div>

          <div style="padding: 8px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; display: inline-block; margin-bottom: 8px;">
            <img src="${qrUrl}" alt="QR Code" width="130" height="130" style="display: block; margin: 0 auto;" />
          </div>

          <div style="font-size: 9px; font-weight: 800; color: #64748b; font-family: monospace;">
            PASS ID: <span style="color: #0f172a;">${pass.passId}</span>
          </div>
        </div>
      </div>
      `;
    })
    .join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
    <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
      
      <!-- HERO HEADER (RESPONSIVE & BALANCED) -->
      <div style="background-color: #120924; padding: 28px 16px; text-align: center;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout: fixed; margin: 0 auto; max-width: 580px;">
          <tr>
            <!-- LEFT FLANK: JY LOGO -->
            <td width="20%" align="center" valign="middle" style="padding: 0 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td align="center" valign="middle">
                    <img src="https://gracia2026.vercel.app/jysg_logo.png" alt="Jesus Youth Singapore" width="52" style="display: block; width: 100%; max-width: 52px; height: auto; border: 0;" />
                  </td>
                </tr>
              </table>
            </td>

            <!-- CENTER CONTENT: TITLES & MOTTO -->
            <td width="60%" align="center" valign="middle" style="padding: 0 4px;">
              <div style="color: #94a3b8; font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; line-height: 1.2;">
                JESUS YOUTH SINGAPORE
              </div>
              <div style="font-size: 28px; font-weight: 900; letter-spacing: 4px; margin: 4px 0; line-height: 1;">
                <span style="color: #6366f1;">G</span><span style="color: #ec4899;">R</span><span style="color: #06b6d4;">A</span><span style="color: #eab308;">C</span><span style="color: #8b5cf6;">I</span><span style="color: #ef4444;">A</span>
              </div>
              <div style="color: #ffffff; font-size: 10px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; line-height: 1.3;">
                25 YEARS OF GRACE IN SINGAPORE
              </div>
              <div style="color: #f59e0b; font-size: 8px; font-weight: 700; letter-spacing: 1.5px; margin-top: 4px; text-transform: uppercase; line-height: 1.2;">
                FAITHFUL WITNESS. JOYFUL MISSIONARY.
              </div>
            </td>

            <!-- RIGHT FLANK: JUBILEE 25 LOGO -->
            <td width="20%" align="center" valign="middle" style="padding: 0 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td align="center" valign="middle">
                    <img src="https://gracia2026.vercel.app/jysg_jubilee_logo.png" alt="25th Jubilee" width="46" style="display: block; width: 100%; max-width: 46px; height: auto; border: 0;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding: 28px 20px;">
        <!-- CONFIRMATION BADGE -->
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="display: inline-block; border: 1.5px solid #cbd5e1; border-radius: 9999px; padding: 6px 18px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #0f172a; text-transform: uppercase;">
            <span style="color: #ef4444; margin-right: 4px;">✓</span> REGISTRATION CONFIRMED
          </span>
        </div>

        <div style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; font-size: 15px;">Dear <strong>${registration.primaryName}</strong>,</p>
          <p style="margin: 0;">Thank you for registering for the <strong>GRACIA - Jubilee Conference, 25 years of grace in Singapore</strong>. We're delighted to confirm your reservation. Your conference pass is ready and can be presented during check-in.</p>
        </div>

        <!-- TWO-COLUMN PASSES & BOOKING DETAILS -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
          <tr>
            <!-- LEFT: PASS CARDS LIST -->
            <td width="48%" valign="top">
              ${passesHtml}
            </td>

            <td width="4%"></td>

            <!-- RIGHT: LIGHT BOOKING DETAILS -->
            <td width="48%" valign="top" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 14px;">
              <div style="font-size: 10px; font-weight: 800; letter-spacing: 1px; color: #0f172a; margin-bottom: 12px; text-transform: uppercase;">
                📅 BOOKING DETAILS
              </div>
              <div style="margin-bottom: 10px;">
                <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">🏷️ BOOKING REFERENCE / PASS ID</div>
                <div style="font-size: 11px; font-weight: 800; color: #4f46e5; font-family: monospace;">${primaryPassId}</div>
              </div>
              <div style="margin-bottom: 10px;">
                <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">🗓️ EVENT</div>
                <div style="font-size: 11px; font-weight: 700; color: #0f172a;">GRACIA - Jubilee Conference</div>
              </div>
              <div style="margin-bottom: 10px;">
                <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">🕒 DATE & TIME</div>
                <div style="font-size: 11px; font-weight: 600; color: #0f172a;">10 – 11 October 2026</div>
              </div>
              <div style="margin-bottom: 10px;">
                <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">📍 VENUE</div>
                <div style="font-size: 11px; font-weight: 600; color: #0f172a;">Caritas Agape Village, 7A Lorong 8 Toa Payoh, Singapore 319264</div>
              </div>
              <div style="margin-bottom: 10px;">
                <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">👤 PRIMARY CONTACT</div>
                <div style="font-size: 11px; font-weight: 700; color: #0f172a;">${registration.primaryName}</div>
                <div style="font-size: 10px; color: #2563eb;">${registration.primaryEmail}</div>
                <div style="font-size: 10px; color: #64748b;">${registration.phoneNumber}</div>
              </div>
              <div style="margin-bottom: 12px;">
                <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">👥 ATTENDEES</div>
                <div style="font-size: 11px; color: #334155;">${registration.attendeeBreakdown}</div>
              </div>
              <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase;">TOTAL SEATS</div>
                  <div style="font-size: 10px; font-weight: 600; color: #0f172a;">Confirmed</div>
                </div>
                <div style="font-size: 22px; font-weight: 900; color: #0f172a;">${registration.totalSeats}</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- PARTIAL INDULGENCE CARD -->
        <div style="background-color: #fff7ed; border: 1px solid #ffedd5; border-left: 4px solid #f97316; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.5px; color: #9a3412; text-transform: uppercase; margin-bottom: 4px;">
            🕊️ A SPECIAL GIFT OF GRACE: PARTIAL INDULGENCE
          </div>
          <div style="font-size: 11px; line-height: 1.5; color: #7c2d12;">
            A Partial Indulgence has been granted by the Apostolic Penitentiary to all the faithful who, after fulfilling the customary conditions, participate in the Thanksgiving Mass celebrated by His Eminence William Cardinal Goh.
          </div>
        </div>

        <!-- PORTAL ACCESS CTA -->
        <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <p style="font-size: 13px; color: #334155; margin: 0 0 12px 0;">
            You can view your conference pass and update attendee details anytime before <strong>September 25, 2026</strong>.
          </p>
          <a href="https://gracia2026.vercel.app/portal" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 10px 24px; border-radius: 8px;">
            Access Registration Portal ➔
          </a>
        </div>

        <!-- SIGN-OFF -->
        <div style="padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569;">
          <p style="margin: 0 0 4px 0;">In Christ,</p>
          <p style="margin: 0 0 16px 0; font-weight: 700; color: #0f172a;">Jesus Youth Singapore GRACIA Jubilee Conference Team</p>
        </div>

        <!-- CLEAN FOOTER LINKS ONLY -->
        <div style="text-align: center; font-size: 11px; color: #64748b; padding-top: 10px; border-top: 1px solid #f1f5f9;">
          <a href="https://singapore.jesusyouth.org" style="color: #4f46e5; text-decoration: none; margin: 0 6px;">singapore.jesusyouth.org</a> | 
          <a href="mailto:jysg25@jesusyouth.org" style="color: #4f46e5; text-decoration: none; margin: 0 6px;">jysg25@jesusyouth.org</a>
        </div>

      </div>
    </div>
  </body>
  </html>
  `;
}
