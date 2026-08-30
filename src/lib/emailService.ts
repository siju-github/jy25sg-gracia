/**
 * Email Dispatch Utility
 * Triggers confirmation email dispatch with digital passes upon payment completion.
 */

export interface DispatchConfirmationEmailParams {
  refNumber: string;
  primaryEmail: string;
  attendees?: any[];
  registrationData?: any;
}

export const dispatchConfirmationEmails = async (
  ref: string,
  primaryEmail: string,
  attendees: any[] = [],
  registrationData?: any
): Promise<{ success: boolean; recipients?: string[]; error?: string }> => {
  try {
    const formattedPrimary = (primaryEmail || '').trim().toLowerCase();
    const formattedAttendees = (attendees || [])
      .map((a: any) => (typeof a === 'string' ? a : a?.email)?.trim().toLowerCase())
      .filter(Boolean);

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send-confirmation',
        refNumber: ref,
        primaryEmail: formattedPrimary,
        attendeeEmails: formattedAttendees,
        registrationData: registrationData || undefined
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      console.error('Email dispatch failed:', result.error || result);
      return { success: false, error: result.error || 'Email dispatch failed' };
    } else {
      console.log('Confirmation email successfully dispatched to recipients:', result.recipients || []);
      return { success: true, recipients: result.recipients };
    }
  } catch (err: any) {
    console.error('Network error triggering email dispatch:', err);
    return { success: false, error: err.message || 'Network error' };
  }
};
