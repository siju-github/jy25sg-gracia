import { RegistrationData } from '../types';
import { saveRegistrationToFirestore, updateRegistrationInFirestore } from './firebase';

export async function sendConfirmationEmail(
  data: Omit<RegistrationData, 'id'> & { id?: string; docId?: string; isConferenceRegistered?: boolean; parish?: string }, 
  isUpdate?: boolean,
  pdfTicketBase64?: string
) {
  try {
    const res = await fetch('/api/send-confirmation-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        id: data.id || data.docId,
        docId: data.docId || data.id,
        isUpdate: !!isUpdate,
        pdfTicketBase64
      })
    });
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      console.error('Server returned non-JSON response:', text);
      json = { status: 'error', message: text };
    }
    console.log('Confirmation email status:', json);
    return json;
  } catch (err) {
    console.error('Failed to trigger confirmation email:', err);
    return { status: 'error', message: String(err) };
  }
}

export async function submitRegistration(
  data: Omit<RegistrationData, 'id'> & { id?: string; isConferenceRegistered?: boolean }, 
  customAppsScriptUrl?: string,
  existingDocId?: string,
  pdfTicketBase64?: string,
  skipEmail?: boolean
): Promise<{ success: boolean; message: string; docId?: string }> {
  // Save or update in Firestore
  let firestoreId: string | null = null;
  if (existingDocId) {
    const updated = await updateRegistrationInFirestore(existingDocId, data);
    if (!updated) {
      firestoreId = await saveRegistrationToFirestore(data);
    } else {
      firestoreId = existingDocId;
    }
  } else {
    firestoreId = await saveRegistrationToFirestore(data);
  }

  // Trigger automated confirmation email dispatch with attached PDF ticket unless skipped
  if (!skipEmail) {
    sendConfirmationEmail({ ...data, id: firestoreId || existingDocId }, !!existingDocId, pdfTicketBase64);
  }

  // Retrieve Apps Script URL from env or custom argument
  const appsScriptUrl = customAppsScriptUrl || (import.meta as any).env?.VITE_APPS_SCRIPT_URL;

  if (!appsScriptUrl || appsScriptUrl.includes('...')) {
    console.warn('Apps Script URL is not set or placeholder. Submission stored in Firestore.');
    return {
      success: true,
      message: existingDocId 
        ? 'Registration updated successfully!' 
        : 'Registration recorded successfully!'
    };
  }

  try {
    const payload = {
      formType: data.type,
      ...data,
      firestoreId,
      isUpdate: !!existingDocId
    };

    // Send data to Apps Script Web App
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Avoid preflight CORS issues with Apps Script
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { 
        success: true, 
        docId: firestoreId || undefined,
        message: existingDocId 
          ? 'Registration updated and synced to Google Sheets!' 
          : 'Registration submitted and synced to Google Sheets!' 
      };
    } else {
      return { 
        success: true, 
        docId: firestoreId || undefined,
        message: existingDocId 
          ? 'Registration updated locally!' 
          : 'Registration saved locally! (Sheets sync pending)' 
      };
    }
  } catch (err) {
    console.error('Error sending to Google Apps Script:', err);
    // Since Firestore write succeeded, return success with notice
    return {
      success: true,
      docId: firestoreId || undefined,
      message: existingDocId ? 'Registration updated successfully!' : 'Registration saved successfully!'
    };
  }
}
