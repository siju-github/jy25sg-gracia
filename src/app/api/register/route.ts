export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, passId, phone, parish, additionalAttendees, categoryLabel, type, selectedSeats } = body || {};

    if (!email || !name) {
      return Response.json({ success: false, error: 'Name and email are required' }, { status: 400 });
    }

    // Construct combined list of all attendees
    const primaryAttendee = {
      name,
      email: email.trim().toLowerCase(),
      passId: passId || 'GRA-PASS-01',
      categoryLabel: categoryLabel || 'Primary Delegate Registrant',
      isPrimary: true
    };

    const secondaryAttendees = (Array.isArray(additionalAttendees) ? additionalAttendees : [])
      .filter((a: any) => a && a.name && a.email && typeof a.email === 'string' && a.email.trim().length > 0)
      .map((a: any, idx: number) => ({
        name: a.name,
        email: a.email.trim().toLowerCase(),
        passId: a.passId || `${primaryAttendee.passId}-${idx + 1}`,
        categoryLabel: a.categoryLabel || a.category || 'Delegate Member',
        isPrimary: false
      }));

    const allAttendees = [primaryAttendee, ...secondaryAttendees];
    const dispatchedEmails: string[] = [];

    // Loop through every attendee and invoke email dispatch inside individual try/catch blocks
    for (const attendee of allAttendees) {
      try {
        if (!attendee.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email)) {
          continue;
        }

        // Call registration email dispatch endpoint
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/send-confirmation-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: attendee.name,
            email: attendee.email,
            passId: attendee.passId,
            phone,
            parish,
            categoryLabel: attendee.categoryLabel,
            type: type || 'conference',
            additionalAttendees: attendee.isPrimary ? secondaryAttendees : [],
            selectedSeats
          })
        });

        if (res.ok) {
          dispatchedEmails.push(attendee.email);
        }
      } catch (err) {
        console.error(`[Register Route Error] Failed to send email to ${attendee.email}:`, err);
        // Individual try/catch ensures failure for one attendee does NOT fail the overall registration or transaction
      }
    }

    return Response.json({
      success: true,
      message: `Registration processed successfully. Dispatched emails to ${dispatchedEmails.length} attendee(s).`,
      dispatchedEmails
    });
  } catch (error: any) {
    console.error('Error in /api/register/route:', error);
    return Response.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
