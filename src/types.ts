export type NavTab = 'conference' | 'musical' | 'jubilee' | 'contact' | 'admin' | 'portal' | 'register';

export interface PortalUserLogItem {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  timestamp: string;
  action: string;
  details?: string;
  loginMethod?: string;
}

export interface RegistrationAuditLog {
  id?: string;
  action: 'create' | 'edit' | 'delete' | 'bulk_delete' | 'restore';
  adminEmail: string;
  adminName: string;
  registrationId: string;
  registrantName: string;
  registrantEmail: string;
  registrantPhone?: string;
  registrationType: 'conference' | 'musical';
  snapshot: RegistrationData;
  changes?: string;
  details?: string;
  timestamp: string;
}

export interface AdditionalAttendee {
  id: string;
  category: 'adult' | 'teen' | 'preteen' | 'child' | 'kid' | 'toddler';
  categoryLabel: string;
  name: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  passId?: string;
  isLinkedExistingPass?: boolean;
  linkedDocId?: string;
  linkedPrimaryContactName?: string;
}

export interface RegistrationData {
  id?: string;
  passId?: string;
  type: 'conference' | 'musical';
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
  adultsCount: number;
  teensCount?: number;
  preteensCount: number;
  childrenCount: number;
  kidsCount?: number;
  toddlersCount: number;
  comments?: string;
  additionalAttendees?: AdditionalAttendee[];
  selectedSeats?: string[];
  createdAt: string;
  status?: 'confirmed' | 'cancelled' | 'pending_payment' | 'Pending Payment';
  syncedToSheets?: boolean;
  email_sent?: boolean;
  confirmation_email_sent?: boolean;
  confirmationEmailSent?: boolean;
  isLinkedExistingPass?: boolean;
  linkedDocId?: string;
  linkedPrimaryContactId?: string;
  linkedPrimaryContactName?: string;
  linkedPrimaryContactEmail?: string;
  linkedPrimaryContactPhone?: string;
  paymentScreenshotUrl?: string;
  paymentStatus?: 'pending' | 'verified' | 'unpaid' | 'paid' | 'completed' | 'pending_verification' | 'succeeded' | 'failed';
  paymentAmount?: number;
  paymentReference?: string;
  additionalContribution?: number;
  hitpayError?: any;
  hitpayPayload?: any;
  hitpayResponse?: any;
  hitpayChargeId?: string;
  hitpayPaymentRequestId?: string;
  checkedIn?: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
  scannedPassIds?: string[];
  invalidatedPassIds?: string[];
  isPassInvalid?: boolean;
  invalidPassReason?: string;
  isAdditionalAttendee?: boolean;
  primaryContactId?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  category?: 'adult' | 'teen' | 'preteen' | 'child' | 'kid' | 'toddler';
  categoryLabel?: string;
  source_type?: 'CONFERENCE_ATTENDEE' | 'INVITATION_CODE';
  conference_registration_id?: string;
  invitation_code_id?: string;
  invitation_code?: string;
  invitationCode?: string;
  reminder_requested?: boolean;
  reminder_requested_at?: string;
  isClergyVip?: boolean;
  designation?: string;
  parish?: string;
  seatsReserved?: number;
  seatsNeeded?: number;
}

import { InvitationAdminRole } from './data/invitationsData';

export interface ApprovedAdminData {
  email: string;
  displayName?: string;
  requestedNote?: string;
  approvedBy?: string;
  dateApproved?: string;
  requestedAt?: string;
  status: 'approved' | 'pending' | 'revoked';
  role?: 'full_admin' | 'admin' | 'content_admin' | 'support_admin' | 'super_admin' | 'ticket_admin' | 'intercession_coordinator' | 'invitation_admin' | 'program_admin' | 'registration_admin';
  invitationRoles?: InvitationAdminRole[];
}

export interface ContactMessageReply {
  id: string;
  repliedByEmail: string;
  repliedByName?: string;
  replyText: string;
  sentAt: string;
  aiGenerated?: boolean;
}

export interface ContactMessageItem {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  createdAt: string;
  status: 'unread' | 'replied' | 'archived';
  replies?: ContactMessageReply[];
}

export interface TimelineItem {
  id: string;
  year: string;
  title: string;
  description: string;
  imageUrl?: string;
  imageUrls?: string[];
  order: number;
  likesCount?: number;
  isPublic?: boolean;
}

export interface PrayerGroupItem {
  id: string;
  name: string;
  area: string;
  meetingTime: string;
  contactPerson: string;
  contactPhone: string;
  order: number;
}

export interface VideoSceneItem {
  id: string;
  name: string;
  url: string;
  icon?: string;
  alt?: string;
  isCustom?: boolean;
}

export interface SiteContentData {
  aboutText: string;
  contactEmail: string;
  contactPhone?: string;
  hqAddress?: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  websiteUrl?: string;
  appsScriptUrl?: string;
  jubileeLogoUrl?: string;
  customVideoScenes?: VideoSceneItem[];
  activeVideoId?: string;
  activeVideoUrl?: string;
  removedVideoIds?: string[];
  hiddenPages?: string[];
  enableGoogleLogin?: boolean;
  enablePassIdLogin?: boolean;
  enableEmailLogin?: boolean;
  enableEmailCodeLogin?: boolean;
  googleLoginSuperAdminOnly?: boolean;
}
