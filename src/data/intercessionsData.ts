import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface IntercessionTotals {
  holyMass: number;
  adoration: number;
  decadeRosary: number;
  rosary: number;
  divineMercy: number;
  fastMeal: number;
  abstainMeat: number;
  shortPrayers: number;
}

export interface IntercessionCommitmentRecord {
  id?: string;
  name?: string;
  email: string;
  phone: string;
  holyMass: number;
  adoration: number;
  decadeRosary: number;
  rosary: number;
  divineMercy: number;
  fastMeal: number;
  abstainMeat: number;
  shortPrayers: number;
  completedHolyMass?: number;
  completedAdoration?: number;
  completedDecadeRosary?: number;
  completedRosary?: number;
  completedDivineMercy?: number;
  completedFastMeal?: number;
  completedAbstainMeat?: number;
  completedShortPrayers?: number;
  createdAt: string;
  updatedAt?: string;
  itemLastUpdated?: Record<string, string>;
  pdpaAccepted: boolean;
  lastReminderSentAt?: string;
  lastReminderType?: 'email' | 'whatsapp' | 'batch_email';
}

export interface IntercessionItemDef {
  key: keyof IntercessionTotals;
  label: string;
  shortLabel: string;
  iconName: string;
  description: string;
  color: string;
  bgGradient: string;
  borderColor: string;
}

export const INTERCESSION_ITEMS: IntercessionItemDef[] = [
  {
    key: 'holyMass',
    label: 'Holy Mass',
    shortLabel: 'Holy Mass',
    iconName: 'holyMass',
    description: 'Mass intentions & Eucharistic commitments',
    color: 'text-amber-300',
    bgGradient: 'from-amber-500/20 via-amber-600/10 to-purple-900/30',
    borderColor: 'border-amber-400/40'
  },
  {
    key: 'divineMercy',
    label: 'No. of Divine Mercies',
    shortLabel: 'No. of Divine Mercies',
    iconName: 'divineMercy',
    description: 'Divine Mercy Chaplets committed',
    color: 'text-sky-300',
    bgGradient: 'from-sky-500/20 via-blue-600/10 to-purple-900/30',
    borderColor: 'border-sky-400/40'
  },
  {
    key: 'adoration',
    label: 'Adoration Hours',
    shortLabel: 'Adoration Hours',
    iconName: 'adoration',
    description: 'Hours of Eucharistic adoration committed',
    color: 'text-yellow-300',
    bgGradient: 'from-yellow-500/20 via-orange-500/10 to-purple-900/30',
    borderColor: 'border-yellow-400/40'
  },
  {
    key: 'fastMeal',
    label: 'No. of Meals Fasting',
    shortLabel: 'No. of Meals Fasting',
    iconName: 'fastMeal',
    description: 'Meals to fast for GRACIA',
    color: 'text-emerald-300',
    bgGradient: 'from-emerald-500/20 via-teal-600/10 to-purple-900/30',
    borderColor: 'border-emerald-400/40'
  },
  {
    key: 'decadeRosary',
    label: 'Decades of Rosary',
    shortLabel: 'Decades of Rosary',
    iconName: 'decadeRosary',
    description: 'Decades of the Holy Rosary committed',
    color: 'text-rose-300',
    bgGradient: 'from-rose-500/20 via-pink-600/10 to-purple-900/30',
    borderColor: 'border-rose-400/40'
  },
  {
    key: 'abstainMeat',
    label: 'Abstain from Meat',
    shortLabel: 'Abstain from Meat',
    iconName: 'abstainMeat',
    description: 'Days of abstaining from meat committed',
    color: 'text-orange-300',
    bgGradient: 'from-orange-500/20 via-amber-600/10 to-purple-900/30',
    borderColor: 'border-orange-400/40'
  },
  {
    key: 'rosary',
    label: 'Number of Rosaries',
    shortLabel: 'Number of Rosaries',
    iconName: 'rosary',
    description: 'Complete 5-decade Holy Rosaries committed',
    color: 'text-purple-300',
    bgGradient: 'from-purple-500/20 via-fuchsia-600/10 to-purple-900/30',
    borderColor: 'border-purple-400/40'
  },
  {
    key: 'shortPrayers',
    label: 'Short Prayers',
    shortLabel: 'Short Prayers',
    iconName: 'shortPrayers',
    description: "Memorare or Salve Regina or Apostles Creed or St.Micheal's",
    color: 'text-teal-300',
    bgGradient: 'from-teal-500/20 via-cyan-600/10 to-purple-900/30',
    borderColor: 'border-teal-400/40'
  }
];

// Baseline totals calculated directly from the historical Excel sheet data (54 submissions)
export const INITIAL_EXCEL_TOTALS: IntercessionTotals = {
  holyMass: 1468,
  adoration: 966,
  decadeRosary: 1956,
  rosary: 1175,
  divineMercy: 1124,
  fastMeal: 475,
  abstainMeat: 510,
  shortPrayers: 9060
};

export const HISTORICAL_INTERCESSION_RECORDS: IntercessionCommitmentRecord[] = [
  { id: 'csv-hist-1', createdAt: '2026-07-26T11:28:58.000Z', email: 'aleenaminoy@gmail.com', name: 'aleena minoy', phone: '88537120', holyMass: 25, adoration: 40, decadeRosary: 0, rosary: 75, divineMercy: 50, fastMeal: 10, abstainMeat: 10, shortPrayers: 750, pdpaAccepted: true },
  { id: 'csv-hist-2', createdAt: '2026-07-26T13:28:59.000Z', email: 'alexsunny1998@gmail.com', name: 'ALEX SUNNY', phone: '82383637', holyMass: 25, adoration: 10, decadeRosary: 75, rosary: 100, divineMercy: 10, fastMeal: 10, abstainMeat: 25, shortPrayers: 75, pdpaAccepted: true },
  { id: 'csv-hist-3', createdAt: '2026-07-26T17:36:00.000Z', email: 'rosetinatom@gmail.com', name: 'Rose Mary Tom', phone: '81384257', holyMass: 10, adoration: 0, decadeRosary: 75, rosary: 10, divineMercy: 10, fastMeal: 10, abstainMeat: 10, shortPrayers: 750, pdpaAccepted: true },
  { id: 'csv-hist-4', createdAt: '2026-07-26T17:36:35.000Z', email: 'jacobthomas007@gmail.com', name: 'Jacob Thomas', phone: '98767415', holyMass: 0, adoration: 0, decadeRosary: 0, rosary: 0, divineMercy: 0, fastMeal: 0, abstainMeat: 10, shortPrayers: 0, pdpaAccepted: true },
  { id: 'csv-hist-5', createdAt: '2026-07-26T17:36:50.000Z', email: '007gresh@gmail.com', name: 'Gresh Sebastian', phone: '81421934', holyMass: 50, adoration: 25, decadeRosary: 0, rosary: 75, divineMercy: 0, fastMeal: 10, abstainMeat: 0, shortPrayers: 0, pdpaAccepted: true },
  { id: 'csv-hist-6', createdAt: '2026-07-26T17:37:38.000Z', email: 'albinsojan333@gmail.com', name: 'Albin Sojan', phone: '', holyMass: 70, adoration: 25, decadeRosary: 50, rosary: 50, divineMercy: 50, fastMeal: 25, abstainMeat: 25, shortPrayers: 50, pdpaAccepted: true },
  { id: 'csv-hist-7', createdAt: '2026-07-26T19:33:35.000Z', email: 'aniljohnk@gmail.com', name: 'Anil John', phone: '88186098', holyMass: 70, adoration: 25, decadeRosary: 75, rosary: 100, divineMercy: 100, fastMeal: 25, abstainMeat: 25, shortPrayers: 750, pdpaAccepted: true },
  { id: 'csv-hist-8', createdAt: '2026-07-26T19:47:16.000Z', email: 'jollymariyaajoe@gmail.com', name: 'Jolly Mariyaa Joe', phone: '', holyMass: 0, adoration: 0, decadeRosary: 25, rosary: 0, divineMercy: 0, fastMeal: 10, abstainMeat: 0, shortPrayers: 0, pdpaAccepted: true },
  { id: 'csv-hist-9', createdAt: '2026-07-26T20:34:57.000Z', email: 'maria93mec@gmail.com', name: 'Maria Merin Antony', phone: '83146933', holyMass: 25, adoration: 10, decadeRosary: 75, rosary: 25, divineMercy: 75, fastMeal: 10, abstainMeat: 10, shortPrayers: 750, pdpaAccepted: true },
  { id: 'csv-hist-10', createdAt: '2026-07-26T20:35:47.000Z', email: 'sijumonabraham@gmail.com', name: 'Sijumon Abraham', phone: '90691457', holyMass: 75, adoration: 25, decadeRosary: 0, rosary: 25, divineMercy: 25, fastMeal: 10, abstainMeat: 10, shortPrayers: 75, pdpaAccepted: true },
  { id: 'csv-hist-11', createdAt: '2026-07-26T22:43:01.000Z', email: 'alexgkoppara@gmail.com', name: 'Alex Koppara', phone: '82332166', holyMass: 25, adoration: 25, decadeRosary: 75, rosary: 25, divineMercy: 0, fastMeal: 10, abstainMeat: 10, shortPrayers: 75, pdpaAccepted: true },
  { id: 'csv-hist-12', createdAt: '2026-07-26T23:39:22.000Z', email: 'ejohnthomas@gmail.com', name: 'John Thomas (Vinod)', phone: '91507608', holyMass: 0, adoration: 0, decadeRosary: 0, rosary: 0, divineMercy: 0, fastMeal: 0, abstainMeat: 0, shortPrayers: 75, pdpaAccepted: true },
  { id: 'csv-hist-13', createdAt: '2026-07-27T08:01:05.000Z', email: 'angelsbabu90@gmail.com', name: 'Angel christopher', phone: '92988646', holyMass: 0, adoration: 0, decadeRosary: 0, rosary: 75, divineMercy: 0, fastMeal: 0, abstainMeat: 0, shortPrayers: 75, pdpaAccepted: true },
  { id: 'csv-hist-14', createdAt: '2026-07-27T08:15:11.000Z', email: 'nedhinjohn@gmail.com', name: 'Nidheesh Thomas', phone: '98635682', holyMass: 40, adoration: 0, decadeRosary: 50, rosary: 0, divineMercy: 0, fastMeal: 10, abstainMeat: 0, shortPrayers: 0, pdpaAccepted: true },
  { id: 'csv-hist-15', createdAt: '2026-07-27T13:25:23.000Z', email: 'naveensvp@gmail.com', name: 'Ruban Whenish', phone: '82452709', holyMass: 25, adoration: 25, decadeRosary: 50, rosary: 50, divineMercy: 75, fastMeal: 25, abstainMeat: 50, shortPrayers: 75, pdpaAccepted: true },
  { id: 'csv-hist-16', createdAt: '2026-07-27T13:50:59.000Z', email: 'sanits212@gmail.com', name: 'Sanit Sabu', phone: '93282755', holyMass: 30, adoration: 0, decadeRosary: 40, rosary: 0, divineMercy: 0, fastMeal: 0, abstainMeat: 0, shortPrayers: 75, pdpaAccepted: true },
  { id: 'csv-hist-17', createdAt: '2026-07-27T14:07:23.000Z', email: 'shimystephen@gmail.com', name: 'Shimy Stephen', phone: '9567355715', holyMass: 70, adoration: 50, decadeRosary: 50, rosary: 0, divineMercy: 25, fastMeal: 0, abstainMeat: 25, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-18', createdAt: '2026-07-27T14:10:22.000Z', email: '4ujesus222@gmail.com', name: 'Aji George', phone: '83391887', holyMass: 10, adoration: 25, decadeRosary: 75, rosary: 25, divineMercy: 25, fastMeal: 0, abstainMeat: 0, shortPrayers: 75, pdpaAccepted: true },
  { id: 'csv-hist-19', createdAt: '2026-07-27T14:13:29.000Z', email: 'ashishsiju9@gmail.com', name: 'Ashish Siju', phone: '93406371', holyMass: 0, adoration: 0, decadeRosary: 25, rosary: 0, divineMercy: 0, fastMeal: 0, abstainMeat: 0, shortPrayers: 0, pdpaAccepted: true },
  { id: 'csv-hist-20', createdAt: '2026-07-27T14:13:59.000Z', email: 'ashishkurian666@gmail.com', name: 'Ashish Kurian', phone: '91543997', holyMass: 20, adoration: 5, decadeRosary: 25, rosary: 0, divineMercy: 0, fastMeal: 0, abstainMeat: 0, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-21', createdAt: '2026-07-27T17:17:51.000Z', email: 'julies.aec@gmail.com', name: 'Julius Arjun Fernandez', phone: '98572646', holyMass: 30, adoration: 40, decadeRosary: 50, rosary: 25, divineMercy: 25, fastMeal: 25, abstainMeat: 25, shortPrayers: 75, pdpaAccepted: true },
  { id: 'csv-hist-22', createdAt: '2026-07-27T19:33:08.000Z', email: 'jiyoantony78@gmail.com', name: 'JIYO ANTONY', phone: '83166331', holyMass: 25, adoration: 25, decadeRosary: 25, rosary: 25, divineMercy: 25, fastMeal: 25, abstainMeat: 25, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-23', createdAt: '2026-07-27T19:38:21.000Z', email: 'nobinjy@gmail.com', name: 'Nobin', phone: '90922091', holyMass: 50, adoration: 25, decadeRosary: 75, rosary: 0, divineMercy: 75, fastMeal: 10, abstainMeat: 10, shortPrayers: 750, pdpaAccepted: true },
  { id: 'csv-hist-24', createdAt: '2026-07-27T23:17:29.000Z', email: 'primeshjoseo92@gmail.com', name: 'Primesh Jose', phone: '96456793', holyMass: 25, adoration: 0, decadeRosary: 75, rosary: 0, divineMercy: 25, fastMeal: 0, abstainMeat: 10, shortPrayers: 75, pdpaAccepted: true },
  { id: 'csv-hist-25', createdAt: '2026-07-28T08:47:22.000Z', email: 'fransijjs98@gmail.com', name: 'Fransi Joseph', phone: '96257762', holyMass: 25, adoration: 0, decadeRosary: 40, rosary: 50, divineMercy: 0, fastMeal: 0, abstainMeat: 0, shortPrayers: 50, pdpaAccepted: true },
  { id: 'csv-hist-26', createdAt: '2026-07-28T13:09:07.000Z', email: 'anju777ponnu@gmail.com', name: 'Anju', phone: '86121832', holyMass: 0, adoration: 0, decadeRosary: 75, rosary: 0, divineMercy: 0, fastMeal: 0, abstainMeat: 0, shortPrayers: 750, pdpaAccepted: true },
  { id: 'csv-hist-27', createdAt: '2026-07-28T15:47:15.000Z', email: 'jnbindu@gmail.com', name: 'Bindhu', phone: '91821819', holyMass: 50, adoration: 10, decadeRosary: 40, rosary: 0, divineMercy: 10, fastMeal: 10, abstainMeat: 10, shortPrayers: 50, pdpaAccepted: true },
  { id: 'csv-hist-28', createdAt: '2026-07-28T17:23:50.000Z', email: 'sheenamol27@gmail.com', name: 'Sheenamol Pottemplackal', phone: '88213220', holyMass: 70, adoration: 50, decadeRosary: 75, rosary: 75, divineMercy: 75, fastMeal: 25, abstainMeat: 25, shortPrayers: 750, pdpaAccepted: true },
  { id: 'csv-hist-29', createdAt: '2026-07-28T20:45:43.000Z', email: 'babumj7@gmail.com', name: 'Augustine', phone: '83115654', holyMass: 25, adoration: 5, decadeRosary: 75, rosary: 0, divineMercy: 25, fastMeal: 0, abstainMeat: 10, shortPrayers: 75, pdpaAccepted: true },
  { id: 'csv-hist-30', createdAt: '2026-07-28T21:46:44.000Z', email: 'sindhusiju@gmail.com', name: 'Sindhu Mathew', phone: '97389346', holyMass: 25, adoration: 25, decadeRosary: 25, rosary: 25, divineMercy: 25, fastMeal: 10, abstainMeat: 10, shortPrayers: 50, pdpaAccepted: true },
  { id: 'csv-hist-31', createdAt: '2026-07-28T23:17:44.000Z', email: 'sindhuta@gmail.com', name: 'Sindhu Thekinath Antony', phone: '90888667', holyMass: 30, adoration: 25, decadeRosary: 0, rosary: 0, divineMercy: 25, fastMeal: 0, abstainMeat: 0, shortPrayers: 0, pdpaAccepted: true },
  { id: 'csv-hist-32', createdAt: '2026-07-29T10:10:50.000Z', email: 'francis.savio26@gmail.com', name: 'Savio Francies', phone: '90219798', holyMass: 30, adoration: 25, decadeRosary: 50, rosary: 50, divineMercy: 25, fastMeal: 10, abstainMeat: 10, shortPrayers: 50, pdpaAccepted: true },
  { id: 'csv-hist-33', createdAt: '2026-07-29T13:03:37.000Z', email: 'kripapadinjarayil@gmail.com', name: 'Kripa', phone: '82840625', holyMass: 25, adoration: 25, decadeRosary: 25, rosary: 25, divineMercy: 3, fastMeal: 10, abstainMeat: 35, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-34', createdAt: '2026-07-29T17:23:25.000Z', email: 'vinunthomas@gmail.com', name: 'Vinu', phone: '91153141', holyMass: 0, adoration: 0, decadeRosary: 0, rosary: 15, divineMercy: 10, fastMeal: 0, abstainMeat: 0, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-35', createdAt: '2026-07-29T17:51:51.000Z', email: 'sinijoshypj@gmail.com', name: 'Sini Varghese', phone: '81301055', holyMass: 30, adoration: 40, decadeRosary: 40, rosary: 0, divineMercy: 25, fastMeal: 0, abstainMeat: 0, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-36', createdAt: '2026-07-29T18:06:47.000Z', email: 'jaysjohn09@gmail.com', name: 'Jays', phone: '90077490', holyMass: 25, adoration: 25, decadeRosary: 0, rosary: 0, divineMercy: 0, fastMeal: 0, abstainMeat: 0, shortPrayers: 0, pdpaAccepted: true },
  { id: 'csv-hist-37', createdAt: '2026-07-29T18:12:24.000Z', email: 'annarose4637@gmail.com', name: 'Anna Rose Benny', phone: '80299508', holyMass: 30, adoration: 25, decadeRosary: 25, rosary: 0, divineMercy: 0, fastMeal: 10, abstainMeat: 0, shortPrayers: 0, pdpaAccepted: true },
  { id: 'csv-hist-38', createdAt: '2026-07-29T19:48:52.000Z', email: 'jilunobin@gmail.com', name: 'Jilu Mathew', phone: '93294529', holyMass: 25, adoration: 25, decadeRosary: 25, rosary: 0, divineMercy: 0, fastMeal: 0, abstainMeat: 10, shortPrayers: 0, pdpaAccepted: true },
  { id: 'csv-hist-39', createdAt: '2026-07-30T09:16:21.000Z', email: 'sincymercy@gmail.com', name: 'Sincy Antony', phone: '85089646', holyMass: 25, adoration: 25, decadeRosary: 0, rosary: 25, divineMercy: 25, fastMeal: 10, abstainMeat: 0, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-40', createdAt: '2026-07-30T09:58:33.000Z', email: 'sibythomas054@gmail.com', name: 'Thomas Siby', phone: '81573898', holyMass: 30, adoration: 10, decadeRosary: 75, rosary: 0, divineMercy: 0, fastMeal: 0, abstainMeat: 0, shortPrayers: 750, pdpaAccepted: true },
  { id: 'csv-hist-41', createdAt: '2026-07-30T15:56:41.000Z', email: 'vid.aiswayra@gmail.com', name: 'Vidya', phone: '94698615', holyMass: 0, adoration: 0, decadeRosary: 25, rosary: 0, divineMercy: 0, fastMeal: 0, abstainMeat: 0, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-42', createdAt: '2026-07-30T16:26:19.000Z', email: 'johnjosephpeter@gmail.com', name: 'John Joseph Peter', phone: '89168403', holyMass: 70, adoration: 0, decadeRosary: 0, rosary: 0, divineMercy: 0, fastMeal: 40, abstainMeat: 0, shortPrayers: 0, pdpaAccepted: true },
  { id: 'csv-hist-43', createdAt: '2026-07-30T16:42:10.000Z', email: 'jeremyjamesk2911@gmail.com', name: 'jeremy james', phone: '91017194', holyMass: 20, adoration: 50, decadeRosary: 25, rosary: 0, divineMercy: 10, fastMeal: 0, abstainMeat: 0, shortPrayers: 0, pdpaAccepted: true },
  { id: 'csv-hist-44', createdAt: '2026-07-30T16:50:03.000Z', email: 'reubenjoshy24@gmail.com', name: 'Reuben Joshy', phone: '87252250', holyMass: 50, adoration: 50, decadeRosary: 50, rosary: 50, divineMercy: 50, fastMeal: 10, abstainMeat: 25, shortPrayers: 50, pdpaAccepted: true },
  { id: 'csv-hist-45', createdAt: '2026-07-30T17:35:19.000Z', email: 'brittobabu2000@gmail.com', name: 'Britto Babu', phone: '81229567', holyMass: 25, adoration: 25, decadeRosary: 25, rosary: 25, divineMercy: 25, fastMeal: 40, abstainMeat: 25, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-46', createdAt: '2026-07-30T22:32:30.000Z', email: 'shoyalsabu004@gmail.com', name: 'Shoyal sabu', phone: '85065384', holyMass: 25, adoration: 25, decadeRosary: 25, rosary: 25, divineMercy: 25, fastMeal: 10, abstainMeat: 10, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-47', createdAt: '2026-07-30T23:38:45.000Z', email: 'godwinkl1831@gmail.com', name: 'Godwin K L', phone: '82383625', holyMass: 71, adoration: 71, decadeRosary: 71, rosary: 25, divineMercy: 71, fastMeal: 25, abstainMeat: 10, shortPrayers: 710, pdpaAccepted: true },
  { id: 'csv-hist-48', createdAt: '2026-07-31T06:32:08.000Z', email: 'johndebravo@gmail.com', name: 'John Varghese', phone: '91064412', holyMass: 10, adoration: 0, decadeRosary: 0, rosary: 25, divineMercy: 25, fastMeal: 10, abstainMeat: 10, shortPrayers: 75, pdpaAccepted: true },
  { id: 'csv-hist-49', createdAt: '2026-07-31T10:00:33.000Z', email: 'maryseema@gmail.com', name: 'Seema Thomas', phone: '97531414', holyMass: 25, adoration: 25, decadeRosary: 0, rosary: 25, divineMercy: 25, fastMeal: 10, abstainMeat: 10, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-50', createdAt: '2026-07-31T15:18:53.000Z', email: 'soumyafrans@gmail.com', name: 'Soumya', phone: '96479715', holyMass: 10, adoration: 15, decadeRosary: 75, rosary: 25, divineMercy: 25, fastMeal: 10, abstainMeat: 10, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-51', createdAt: '2026-07-31T16:14:25.000Z', email: 'christeenathurackal25@gmail.com', name: 'Christeena Elizabeth tc', phone: '98982466', holyMass: 7, adoration: 0, decadeRosary: 25, rosary: 0, divineMercy: 0, fastMeal: 10, abstainMeat: 10, shortPrayers: 750, pdpaAccepted: true },
  { id: 'csv-hist-52', createdAt: '2026-07-31T21:35:14.000Z', email: 'mirandabenty@gmail.com', name: 'Miranda', phone: '94653695', holyMass: 0, adoration: 0, decadeRosary: 25, rosary: 25, divineMercy: 25, fastMeal: 0, abstainMeat: 10, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-53', createdAt: '2026-08-01T09:53:18.000Z', email: 'anuselmajose6@gmail.com', name: 'Anu Selma Jose', phone: '97227664', holyMass: 0, adoration: 0, decadeRosary: 0, rosary: 0, divineMercy: 0, fastMeal: 0, abstainMeat: 0, shortPrayers: 25, pdpaAccepted: true },
  { id: 'csv-hist-54', createdAt: '2026-08-03T11:37:33.000Z', email: 'layona.swisstwiss@gmail.com', name: 'LAYONA SEBASTIAN', phone: '91192744', holyMass: 10, adoration: 10, decadeRosary: 50, rosary: 0, divineMercy: 0, fastMeal: 0, abstainMeat: 0, shortPrayers: 50, pdpaAccepted: true }
];

// Fetch all new user commitments from Firestore and merge with Excel initial totals
export async function getAggregatedIntercessionTotals(): Promise<{
  totals: IntercessionTotals;
  recordCount: number;
}> {
  const allRecords = await getAllIntercessionCommitments();
  const totals: IntercessionTotals = {
    holyMass: 0,
    adoration: 0,
    decadeRosary: 0,
    rosary: 0,
    divineMercy: 0,
    fastMeal: 0,
    abstainMeat: 0,
    shortPrayers: 0
  };

  allRecords.forEach((rec) => {
    totals.holyMass += Number(rec.holyMass) || 0;
    totals.adoration += Number(rec.adoration) || 0;
    totals.decadeRosary += Number(rec.decadeRosary) || 0;
    totals.rosary += Number(rec.rosary) || 0;
    totals.divineMercy += Number(rec.divineMercy) || 0;
    totals.fastMeal += Number(rec.fastMeal) || 0;
    totals.abstainMeat += Number(rec.abstainMeat) || 0;
    totals.shortPrayers += Number(rec.shortPrayers) || 0;
  });

  return {
    totals,
    recordCount: allRecords.length
  };
}

// Save a new intercession commitment to Firestore
export async function saveIntercessionCommitment(
  record: Omit<IntercessionCommitmentRecord, 'id' | 'createdAt'>
): Promise<string> {
  const payload: Record<string, any> = {
    ...record,
    createdAt: new Date().toISOString()
  };

  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([_, v]) => v !== undefined)
  );

  const docRef = await addDoc(collection(db, 'intercessions'), cleanPayload);
  return docRef.id;
}

// Fetch all individual intercession commitment records from Firestore (including historical excel dataset)
export async function getAllIntercessionCommitments(): Promise<IntercessionCommitmentRecord[]> {
  try {
    const colRef = collection(db, 'intercessions');
    const snapshot = await getDocs(colRef);
    const dbRecords: IntercessionCommitmentRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.deleted) {
        dbRecords.push({
          id: docSnap.id,
          ...(data as Omit<IntercessionCommitmentRecord, 'id'>)
        });
      }
    });

    // Sort in memory by createdAt desc (or default to 0)
    dbRecords.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const dbRecordIds = new Set(dbRecords.map(r => r.id));
    const remainingHistorical = HISTORICAL_INTERCESSION_RECORDS.filter(r => !dbRecordIds.has(r.id));

    return [...dbRecords, ...remainingHistorical];
  } catch (err) {
    console.error('Error fetching intercession commitments:', err);
    return HISTORICAL_INTERCESSION_RECORDS;
  }
}

// Subscribe to real-time updates for intercession commitments
export function subscribeToIntercessionCommitments(
  callback: (records: IntercessionCommitmentRecord[]) => void
) {
  const colRef = collection(db, 'intercessions');
  return onSnapshot(colRef, (snapshot) => {
    const dbRecords: IntercessionCommitmentRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.deleted) {
        dbRecords.push({
          id: docSnap.id,
          ...(data as Omit<IntercessionCommitmentRecord, 'id'>)
        });
      }
    });

    dbRecords.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const dbRecordIds = new Set(dbRecords.map(r => r.id));
    const remainingHistorical = HISTORICAL_INTERCESSION_RECORDS.filter(r => !dbRecordIds.has(r.id));

    callback([...dbRecords, ...remainingHistorical]);
  }, (err) => {
    console.error('Error in intercessions snapshot listener:', err);
  });
}

// Helper to get matching icon/emoji for commitment item
export function getCommitmentIcon(itemText: string): string {
  const lower = itemText.toLowerCase();
  if (lower.includes('mass')) return '✝️';
  if (lower.includes('adoration')) return '🕯️';
  if (lower.includes('rosary') || lower.includes('decade')) return '📿';
  if (lower.includes('divine mercy') || lower.includes('chaplet')) return '🕊️';
  if (lower.includes('fasting') || lower.includes('meal')) return '🍞';
  if (lower.includes('meat') || lower.includes('abstain')) return '🥦';
  if (lower.includes('short prayer') || lower.includes('memorare') || lower.includes('creed') || lower.includes('salve') || lower.includes('michael')) return '🤲';
  return '🌸';
}

// Helper to format a user's commitment record as text
export function formatCommitmentsSummary(rec: Partial<IntercessionCommitmentRecord>): string {
  const items: string[] = [];
  if (rec.holyMass) items.push(`${rec.holyMass} Holy Mass(es)`);
  if (rec.adoration) items.push(`${Math.floor(rec.adoration / 2)} Hour(s) of Eucharistic Adoration`);
  if (rec.rosary) items.push(`${rec.rosary} Full Rosary(ies)`);
  if (rec.decadeRosary) items.push(`${rec.decadeRosary} Decade(s) of Rosary`);
  if (rec.divineMercy) items.push(`${rec.divineMercy} Divine Mercy Chaplet(s)`);
  if (rec.fastMeal) items.push(`${rec.fastMeal} Meal(s) Fasting`);
  if (rec.abstainMeat) items.push(`${rec.abstainMeat} Day(s) Abstain from Meat`);
  if (rec.shortPrayers) items.push(`${rec.shortPrayers} Short Prayer(s) (Memorare/Salve Regina/Apostles Creed/St. Michael)`);

  return items.length > 0 ? items.join(', ') : 'Spiritual bouquet commitment';
}

// Helper to format a user's commitment pledges with latest completed progress
export function formatProgressSummary(rec: Partial<IntercessionCommitmentRecord>): string {
  const lines: string[] = [];
  
  if (rec.holyMass) {
    const p = Number(rec.holyMass) || 0;
    const c = Number(rec.completedHolyMass) || 0;
    const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
    lines.push(`• ✝️ Holy Mass: ${c} / ${p} completed (${pct}%)`);
  }
  if (rec.adoration) {
    const pSlots = Number(rec.adoration) || 0;
    const cSlots = Number(rec.completedAdoration) || 0;
    const pHours = Math.floor(pSlots / 2);
    const cHours = (cSlots * 0.5).toFixed(1).replace('.0', '');
    const pct = pSlots > 0 ? Math.min(100, Math.round((cSlots / pSlots) * 100)) : 0;
    lines.push(`• 🕯️ Eucharistic Adoration: ${cHours} / ${pHours} Hr(s) completed (${pct}%)`);
  }
  if (rec.rosary) {
    const p = Number(rec.rosary) || 0;
    const c = Number(rec.completedRosary) || 0;
    const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
    lines.push(`• 📿 Full Rosary: ${c} / ${p} completed (${pct}%)`);
  }
  if (rec.decadeRosary) {
    const p = Number(rec.decadeRosary) || 0;
    const c = Number(rec.completedDecadeRosary) || 0;
    const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
    lines.push(`• 📿 Decade of Rosary: ${c} / ${p} completed (${pct}%)`);
  }
  if (rec.divineMercy) {
    const p = Number(rec.divineMercy) || 0;
    const c = Number(rec.completedDivineMercy) || 0;
    const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
    lines.push(`• 🕊️ Divine Mercy Chaplet: ${c} / ${p} completed (${pct}%)`);
  }
  if (rec.fastMeal) {
    const p = Number(rec.fastMeal) || 0;
    const c = Number(rec.completedFastMeal) || 0;
    const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
    lines.push(`• 🍞 Meal Fasting: ${c} / ${p} completed (${pct}%)`);
  }
  if (rec.abstainMeat) {
    const p = Number(rec.abstainMeat) || 0;
    const c = Number(rec.completedAbstainMeat) || 0;
    const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
    lines.push(`• 🥦 Abstain from Meat: ${c} / ${p} completed (${pct}%)`);
  }
  if (rec.shortPrayers) {
    const p = Number(rec.shortPrayers) || 0;
    const c = Number(rec.completedShortPrayers) || 0;
    const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
    lines.push(`• 🤲 Short Prayers: ${c} / ${p} completed (${pct}%)`);
  }

  return lines.length > 0 ? lines.join('\n') : 'Spiritual bouquet commitment';
}

export async function updateIntercessionReminderStatus(
  id: string,
  reminderType: 'email' | 'whatsapp' | 'batch_email'
): Promise<boolean> {
  if (!id) return false;
  try {
    const docRef = doc(db, 'intercessions', id);
    await setDoc(docRef, {
      lastReminderSentAt: new Date().toISOString(),
      lastReminderType: reminderType
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('Error updating intercession reminder timestamp:', err);
    return false;
  }
}

export async function updateIntercessionCommitment(
  id: string,
  updates: Partial<IntercessionCommitmentRecord>
): Promise<boolean> {
  if (!id) return false;
  try {
    const docRef = doc(db, 'intercessions', id);
    await setDoc(docRef, updates, { merge: true });
    return true;
  } catch (err) {
    console.error('Error updating intercession commitment:', err);
    return false;
  }
}

export async function deleteIntercessionCommitment(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const docRef = doc(db, 'intercessions', id);
    if (id.startsWith('excel-hist-')) {
      await setDoc(docRef, { deleted: true, updatedAt: new Date().toISOString() }, { merge: true });
    } else {
      await deleteDoc(docRef);
    }
    return true;
  } catch (err) {
    console.error('Error deleting intercession commitment:', err);
    return false;
  }
}
