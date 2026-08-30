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
  registrationData?: any,
  options?: { isUpdate?: boolean; isResend?: boolean }
): Promise<{ success: boolean; recipients?: string[]; error?: string }> => {
  try {
    const formattedPrimary = (primaryEmail || '').trim().toLowerCase();
    const forceUpdate = Boolean(options?.isUpdate || options?.isResend || registrationData?.isUpdate || registrationData?.isResend);
    
    // Process attendees into both string email list and full attendee object list
    const attendeeEmails: string[] = [];
    const normalizedAdditionalAttendees: any[] = [];

    (attendees || []).forEach((a: any, idx: number) => {
      if (typeof a === 'string') {
        const cleanE = a.trim().toLowerCase();
        if (cleanE) {
          attendeeEmails.push(cleanE);
          normalizedAdditionalAttendees.push({
            name: `Delegate Member ${idx + 1}`,
            email: cleanE,
            category: 'adult',
            categoryLabel: 'Delegate Member'
          });
        }
      } else if (a && typeof a === 'object') {
        const cleanE = (a.email || a.recipientEmail || '').trim().toLowerCase();
        if (cleanE) attendeeEmails.push(cleanE);
        normalizedAdditionalAttendees.push({
          ...a,
          name: a.name || a.fullName || `Delegate Member ${idx + 1}`,
          email: cleanE,
          category: a.category || 'adult',
          categoryLabel: a.categoryLabel || a.category || 'Delegate Member',
          passId: a.passId || undefined
        });
      }
    });

    const payload = {
      action: 'send-confirmation',
      refNumber: ref,
      passId: ref,
      docId: ref,
      primaryEmail: formattedPrimary,
      email: formattedPrimary,
      isUpdate: forceUpdate,
      isResend: forceUpdate,
      attendeeEmails: Array.from(new Set(attendeeEmails)),
      additionalAttendees: normalizedAdditionalAttendees,
      registrationData: registrationData ? {
        ...registrationData,
        email: registrationData.email || formattedPrimary,
        primaryEmail: registrationData.primaryEmail || formattedPrimary,
        refNumber: registrationData.refNumber || ref,
        passId: registrationData.passId || ref,
        isUpdate: forceUpdate,
        isResend: forceUpdate,
        additionalAttendees: registrationData.additionalAttendees || normalizedAdditionalAttendees
      } : undefined
    };

    let response: Response;
    try {
      response = await fetch('/api/send-confirmation-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.status === 404) {
        response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch (netErr: any) {
      response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    const text = await response.text();
    let result: any = {};
    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      console.error('Email API returned non-JSON response:', text);
      const cleanText = text ? text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150) : 'Empty response from server';
      return {
        success: false,
        error: `Server error (${response.status}): ${cleanText}`
      };
    }

    if (!response.ok || (result.status !== 'sent' && result.status !== 'already_sent' && !result.success)) {
      console.error('Email dispatch failed:', result.message || result.error || result.details || result);
      return { success: false, error: result.message || result.error || result.details || 'Email dispatch failed' };
    } else {
      console.log('Confirmation email successfully dispatched:', result.sentEmails || result.recipients || []);
      return { success: true, recipients: result.sentEmails || result.recipients };
    }
  } catch (err: any) {
    console.error('Network error triggering email dispatch:', err);
    return { success: false, error: err.message || 'Network error' };
  }
};
