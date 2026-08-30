import { TimelineItem, PrayerGroupItem, SiteContentData, VideoSceneItem } from '../types';
import jubileeLogoImg from '../assets/images/regenerated_image_1785464306003.png';

export const DEFAULT_VIDEO_PRESETS: VideoSceneItem[] = [
  {
    id: 'auditorium',
    name: 'Grand Auditorium Concert Stage',
    icon: '🏛️',
    url: 'https://videos.pexels.com/video-files/853889/853889-hd_1280_720_25fps.mp4',
    alt: 'Live Concert Stage with Band & Spotlights'
  },
  {
    id: 'spotlights',
    name: 'Spotlight Arena Atmosphere',
    icon: '✨',
    url: 'https://videos.pexels.com/video-files/2795383/2795383-hd_1280_720_25fps.mp4',
    alt: 'Dynamic Stage Spotlights and Beams'
  },
  {
    id: 'beams',
    name: 'Concert Stage Beams & Glow',
    icon: '💜',
    url: 'https://videos.pexels.com/video-files/2795382/2795382-hd_1280_720_25fps.mp4',
    alt: 'Royal Purple Arena Stage Beams'
  }
];

export const INITIAL_TIMELINE: TimelineItem[] = [
  {
    id: 't1',
    year: '2001',
    title: 'The Seed is Sown in Singapore',
    description: 'A small group of young Catholics filled with the Spirit gathered in Singapore to begin Jesus Youth prayer meetings, bringing vibrant worship and Catholic fellowship to youth.',
    imageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=800',
    imageUrls: [
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=800'
    ],
    order: 1,
    likesCount: 42
  },
  {
    id: 't2',
    year: '2006',
    title: 'First Regional Youth Encounter',
    description: 'Expanded across university campuses and parishes, organizing the first major Singapore youth retreat with dynamic music, adoration, and missionary sharing.',
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800',
    imageUrls: [
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800'
    ],
    order: 2,
    likesCount: 38
  },
  {
    id: 't3',
    year: '2011',
    title: 'Decade of Grace & Family Ministries',
    description: 'Marking 10 years, Jesus Youth Singapore formed dedicated Family and Teen ministries, empowering young couples, families, and teenagers to live as joyful witnesses.',
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=800',
    imageUrls: [
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=800'
    ],
    order: 3,
    likesCount: 56
  },
  {
    id: 't4',
    year: '2016',
    title: 'Pontifical Recognition & World Youth Day',
    description: 'Celebrating Pontifical Recognition of Jesus Youth as an International Association of the Faithful. Singapore delegates carried the flame to WYD Krakow.',
    imageUrl: 'https://images.unsplash.com/photo-1543807535-eceef0bc6599?auto=format&fit=crop&q=80&w=800',
    imageUrls: [
      'https://images.unsplash.com/photo-1543807535-eceef0bc6599?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800'
    ],
    order: 4,
    likesCount: 71
  },
  {
    id: 't5',
    year: '2021',
    title: '20 Years of Hope & Digital Outreach',
    description: 'Adapted through pandemic times with virtual prayer towers, online rosary chains, and creative digital music outreach, strengthening bonds of faith.',
    imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&q=80&w=800',
    imageUrls: [
      'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800'
    ],
    order: 5,
    likesCount: 63
  },
  {
    id: 't6',
    year: '2026',
    title: 'GRACIA — 25 Years Jubilee Festival',
    description: 'Faithful Witness, Joyful Missionary! Celebrating a quarter-century of God\'s abundant grace with the Jubilee Conference, Thanksgiving Mass, and Musical Concert at Caritas Agape Village.',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=800',
    imageUrls: [
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800'
    ],
    order: 6,
    likesCount: 128
  }
];

export const INITIAL_PRAYER_GROUPS: PrayerGroupItem[] = [
  {
    id: 'p1',
    name: 'Agape Village Central Prayer Group',
    area: 'Central / Toa Payoh',
    meetingTime: 'Every Friday, 7:45 PM – 9:30 PM',
    contactPerson: 'Bro. Emmanuel & Sis. Clare',
    contactPhone: '+65 9123 4567',
    order: 1
  },
  {
    id: 'p2',
    name: 'East Coast Youth Fellowship',
    area: 'East / Tampines & Marine Parade',
    meetingTime: '2nd & 4th Saturdays, 4:00 PM – 6:00 PM',
    contactPerson: 'Joseph & Maria',
    contactPhone: '+65 9234 5678',
    order: 2
  },
  {
    id: 'p3',
    name: 'West Parish Couples & Family Group',
    area: 'West / Jurong & Clementi',
    meetingTime: '1st & 3rd Sundays, 5:00 PM – 7:00 PM',
    contactPerson: 'Mathew & Teresa',
    contactPhone: '+65 9345 6789',
    order: 3
  },
  {
    id: 'p4',
    name: 'Campus Teens & University Circle',
    area: 'North / Yishun & Woodlands',
    meetingTime: 'Every Wednesday, 7:00 PM – 8:30 PM',
    contactPerson: 'Francis & Rita',
    contactPhone: '+65 9456 7890',
    order: 4
  }
];

export const INITIAL_SITE_CONTENT: SiteContentData = {
  aboutText: `Jesus Youth is an international Catholic movement that began in Kerala, India, in the late 1970s and has since spread to over 35 countries. In Singapore, Jesus Youth has been active since 2001, fostering a lifestyle centered on six pillars: Daily Prayer, Word of God, Sacraments, Fellowship, Evangelization, and Option for the Poor. Through youth rallies, family encounters, music ministry, and small prayer groups, Jesus Youth Singapore empowers young people and families to be 'Faithful Witnesses and Joyful Missionaries' in everyday life.`,
  contactEmail: 'singapore@jesusyouth.org',
  contactPhone: '+65 9123 4567',
  hqAddress: 'Caritas Agape Village, Lorong 8 Toa Payoh',
  instagramUrl: 'https://www.instagram.com/jesusyouth_singapore',
  facebookUrl: 'https://www.facebook.com/jy15sg',
  youtubeUrl: 'https://www.youtube.com/@JesusYouthSingapore',
  websiteUrl: 'https://singapore.jesusyouth.org/',
  appsScriptUrl: '',
  jubileeLogoUrl: '/jubilee-25-logo.png',
  customVideoScenes: DEFAULT_VIDEO_PRESETS,
  activeVideoId: 'auditorium',
  activeVideoUrl: 'https://videos.pexels.com/video-files/853889/853889-hd_1280_720_25fps.mp4',
  removedVideoIds: [],
  hiddenPages: [],
  enableGoogleLogin: true,
  enablePassIdLogin: false,
  enableEmailLogin: false
};

export const APPS_SCRIPT_TEMPLATE = `/**
 * GRACIA - Google Apps Script Web App Code
 * 1. Open your Google Sheet ("GRACIA Registrations").
 * 2. Rename Tab 1 to "Conference Registrations" and Tab 2 to "Musical Registrations".
 * 3. Go to Extensions > Apps Script.
 * 4. Paste this code, save, and click Deploy > New deployment.
 * 5. Select type "Web App", set Execute as "Me", and "Who has access" to "Anyone".
 * 6. Copy the Web App URL and set it in the Admin Panel or VITE_APPS_SCRIPT_URL.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Support relaying confirmation emails via GmailApp
    if (data.action === 'send_email' && data.to && data.html) {
      GmailApp.sendEmail(data.to, data.subject || 'GRACIA - Jesus Youth Singapore', '', {
        htmlBody: data.html,
        name: 'Jesus Youth Singapore (GRACIA)'
      });
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Email dispatched via GmailApp' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var formType = data.formType || data.type || 'conference';
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = (formType === 'musical') ? 'Musical Registrations' : 'Conference Registrations';
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      // Setup headers if new sheet
      var headers = ['Timestamp', 'Name', 'Email', 'Phone', 'Adults/Youths (20+)', 'Teens (13-19)', 'Pre-teens (9-12)', 'Children (6-8)', 'Kids (3-5)', 'Toddlers (2 & Below)', 'Comments / Restrictions'];
      sheet.appendRow(headers);
    }
    
    var timestamp = new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" });
    
    sheet.appendRow([
      timestamp,
      data.name || '',
      data.email || '',
      "'" + (data.phone || ''),
      data.adultsCount || 0,
      data.teensCount || 0,
      data.preteensCount || 0,
      data.childrenCount || 0,
      data.kidsCount || 0,
      data.toddlersCount || 0,
      data.comments || ''
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Registration saved successfully' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ status: 'active', message: 'GRACIA Registrations API is online' }))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
