import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { JubileePrayerCard } from './JubileePrayerCard';
import { 
  Church, 
  Sun, 
  Heart, 
  Disc, 
  Flame, 
  UtensilsCrossed, 
  Ban, 
  MessageSquareQuote,
  Sparkles,
  Plus,
  Check,
  X,
  Lock,
  Mail,
  Phone,
  User,
  ShieldCheck,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  INTERCESSION_ITEMS, 
  INITIAL_EXCEL_TOTALS, 
  IntercessionTotals, 
  getAggregatedIntercessionTotals, 
  saveIntercessionCommitment,
  IntercessionItemDef
} from '../data/intercessionsData';

// Custom SVG Clipart Icons matching the GRACIA Spiritual Bouquet Poster
const HolyMassIcon = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="18" r="11" fill="#FFFDF0" stroke="#F59E0B" strokeWidth="2.5" />
    <path d="M32 12V24M26 18H38" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M18 28C18 40 25 44 32 44C39 44 46 40 46 28H18Z" fill="url(#chaliceGrad)" stroke="#F59E0B" strokeWidth="2" />
    <path d="M32 44V54M22 56H42M26 48H38" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
    <defs>
      <linearGradient id="chaliceGrad" x1="18" y1="28" x2="46" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FBBF24" />
        <stop offset="1" stopColor="#D97706" />
      </linearGradient>
    </defs>
  </svg>
);

const AdorationIcon = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
      <line
        key={i}
        x1="32"
        y1="22"
        x2={32 + 18 * Math.cos((angle * Math.PI) / 180)}
        y2={22 + 18 * Math.sin((angle * Math.PI) / 180)}
        stroke="#FBBF24"
        strokeWidth={i % 2 === 0 ? "2.5" : "1.5"}
        strokeLinecap="round"
      />
    ))}
    <circle cx="32" cy="22" r="12" fill="url(#monstranceGrad)" stroke="#F59E0B" strokeWidth="2" />
    <circle cx="32" cy="22" r="7" fill="#FFFDF0" stroke="#D97706" strokeWidth="1.5" />
    <path d="M32 18V26M28 22H36" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M32 34V52M20 54H44M26 44H38" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
    <defs>
      <linearGradient id="monstranceGrad" x1="20" y1="10" x2="44" y2="34" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDE047" />
        <stop offset="1" stopColor="#CA8A04" />
      </linearGradient>
    </defs>
  </svg>
);

const DivineMercyIcon = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <polygon points="32,26 8,56 22,58" fill="#EF4444" opacity="0.9" />
    <polygon points="32,26 14,58 30,60" fill="#F87171" opacity="0.8" />
    <polygon points="32,26 34,60 50,58" fill="#38BDF8" opacity="0.8" />
    <polygon points="32,26 42,58 56,56" fill="#0284C7" opacity="0.9" />
    <circle cx="32" cy="14" r="6" stroke="#FDE047" strokeWidth="1.5" fill="none" />
    <path d="M32 12C34.5 12 36.5 14 36.5 16.5C36.5 19 32 26 32 26C32 26 27.5 19 27.5 16.5C27.5 14 29.5 12 32 12Z" fill="#FEF08A" />
    <path d="M25 24C25 24 20 38 18 54H46C44 38 39 24 39 24Z" fill="#FFFDF0" stroke="#CBD5E1" strokeWidth="1" />
    <circle cx="32" cy="27" r="3" fill="#EF4444" />
  </svg>
);

const DecadeRosaryIcon = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="24" r="16" stroke="#FBBF24" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
    {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((angle, i) => (
      <circle
        key={i}
        cx={32 + 16 * Math.cos((angle * Math.PI) / 180)}
        cy={24 + 16 * Math.sin((angle * Math.PI) / 180)}
        r="2.5"
        fill="#F59E0B"
      />
    ))}
    <path d="M32 40V58M26 48H38" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const FullRosaryIcon = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M32 38C20 26 14 18 20 12C26 6 32 16 32 16C32 16 38 6 44 12C50 18 44 26 32 38Z"
      stroke="#F59E0B"
      strokeWidth="2"
      strokeDasharray="2 3"
      fill="none"
    />
    <path d="M32 38V56M25 46H39" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="32" cy="38" r="2.5" fill="#FBBF24" />
    <circle cx="20" cy="12" r="2.5" fill="#FBBF24" />
    <circle cx="44" cy="12" r="2.5" fill="#FBBF24" />
    <circle cx="24" cy="24" r="2.5" fill="#FBBF24" />
    <circle cx="40" cy="24" r="2.5" fill="#FBBF24" />
  </svg>
);

const MealsFastingIcon = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="24" stroke="#94A3B8" strokeWidth="2" fill="#1E293B" />
    <path d="M22 20V28C22 30 24 31 26 31V44" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
    <path d="M22 20V24M26 20V24" stroke="#CBD5E1" strokeWidth="1.5" />
    <path d="M42 20V44M42 20C38 24 38 28 42 32" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
    <circle cx="32" cy="32" r="25" stroke="#EF4444" strokeWidth="3.5" fill="none" />
    <line x1="14" y1="14" x2="50" y2="50" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

const AbstainMeatIcon = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 32C22 14 46 20 54 32C46 44 22 50 10 32Z"
      fill="url(#fishGrad)"
      stroke="#F59E0B"
      strokeWidth="2"
    />
    <path d="M48 32L58 20V44L48 32Z" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1.5" />
    <circle cx="22" cy="28" r="2.5" fill="#78350F" />
    <defs>
      <linearGradient id="fishGrad" x1="10" y1="14" x2="54" y2="50" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDE047" />
        <stop offset="1" stopColor="#D97706" />
      </linearGradient>
    </defs>
  </svg>
);

const ShortPrayersIcon = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M28 14C28 14 30 26 30 36C30 42 26 48 20 50L18 38L24 24L28 14Z" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" />
    <path d="M36 14C36 14 34 26 34 36C34 42 38 48 44 50L46 38L40 24L36 14Z" fill="#FDE047" stroke="#D97706" strokeWidth="1.5" />
    <path d="M16 48H30V56H16Z" fill="#7C3AED" stroke="#5B21B6" strokeWidth="1" />
    <path d="M34 48H48V56H34Z" fill="#7C3AED" stroke="#5B21B6" strokeWidth="1" />
    <path d="M32 6V10M22 8L24 11M42 8L40 11M14 16L17 18M50 16L47 18" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Map icon string key to dedicated SVG icon component
const ICON_MAP: Record<string, React.ElementType> = {
  holyMass: HolyMassIcon,
  adoration: AdorationIcon,
  decadeRosary: DecadeRosaryIcon,
  rosary: FullRosaryIcon,
  divineMercy: DivineMercyIcon,
  fastMeal: MealsFastingIcon,
  abstainMeat: AbstainMeatIcon,
  shortPrayers: ShortPrayersIcon
};

// Animated Number Counter Component - 25s initial counting + motion animation on last 2 digits
function AnimatedNumber({ value, duration = 25000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startValueRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const isFinishedRef = useRef(false);

  useEffect(() => {
    startValueRef.current = displayValue;
    startTimeRef.current = null;
    isFinishedRef.current = false;

    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth ease-out quadratic over 25 seconds
      const easedProgress = 1 - Math.pow(1 - progress, 2);
      const current = Math.floor(startValueRef.current + (value - startValueRef.current) * easedProgress);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        isFinishedRef.current = true;
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  // Randomized continuous live increase per item (4s to 15s random independent intervals)
  useEffect(() => {
    let timerId: NodeJS.Timeout;

    const scheduleNextIncrement = () => {
      const randomDelay = Math.floor(Math.random() * 11000) + 4000;
      timerId = setTimeout(() => {
        if (isFinishedRef.current) {
          const randomInc = Math.random() > 0.85 ? 2 : 1;
          setDisplayValue(prev => prev + randomInc);
        }
        scheduleNextIncrement();
      }, randomDelay);
    };

    scheduleNextIncrement();

    return () => clearTimeout(timerId);
  }, []);

  return (
    <span className="font-poster tracking-tight inline-block text-center leading-none">
      {displayValue.toLocaleString()}
    </span>
  );
}

export const IntercessionCounter: React.FC = () => {
  const [totals, setTotals] = useState<IntercessionTotals>(INITIAL_EXCEL_TOTALS);
  const [recordCount, setRecordCount] = useState<number>(54);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  // Form State for commitments popup
  const [formName, setFormName] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [pdpaAccepted, setPdpaAccepted] = useState<boolean>(false);
  const [formValues, setFormValues] = useState<IntercessionTotals>({
    holyMass: 0,
    adoration: 0,
    decadeRosary: 0,
    rosary: 0,
    divineMercy: 0,
    fastMeal: 0,
    abstainMeat: 0,
    shortPrayers: 0
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Load aggregated totals from Firestore + Excel initial dataset
  const refreshTotals = async () => {
    setIsLoading(true);
    try {
      const res = await getAggregatedIntercessionTotals();
      setTotals(res.totals);
      setRecordCount(res.recordCount);
    } catch (err) {
      console.error('Failed to load intercession totals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshTotals();
  }, []);

  // Compute Grand Total of all intercessions
  const grandTotal: number = (Object.values(totals) as number[]).reduce((acc: number, curr: number) => acc + curr, 0);

  // Compute total committed in current popup session
  const currentSubmissionTotal: number = (Object.values(formValues) as number[]).reduce((acc: number, curr: number) => acc + curr, 0);

  const handleBundleAdd = (key: keyof IntercessionTotals, amount: number) => {
    setFormValues(prev => ({
      ...prev,
      [key]: Math.max(0, prev[key] + amount)
    }));
  };

  const handleSetZero = (key: keyof IntercessionTotals) => {
    setFormValues(prev => ({ ...prev, [key]: 0 }));
  };

  const handleOpenModal = () => {
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmitCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Please enter your name.');
      return;
    }

    if (!formEmail.trim() || !formEmail.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (!formPhone.trim() || formPhone.trim().length < 7) {
      setFormError('Please enter a valid phone number.');
      return;
    }

    if (!pdpaAccepted) {
      setFormError('Please accept the PDPA privacy consent to proceed.');
      return;
    }

    if (currentSubmissionTotal === 0) {
      setFormError('Please select at least one intercession commitment bundle before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      await saveIntercessionCommitment({
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        holyMass: formValues.holyMass,
        adoration: formValues.adoration,
        decadeRosary: formValues.decadeRosary,
        rosary: formValues.rosary,
        divineMercy: formValues.divineMercy,
        fastMeal: formValues.fastMeal,
        abstainMeat: formValues.abstainMeat,
        shortPrayers: formValues.shortPrayers,
        pdpaAccepted: true
      });

      // Update local state and re-fetch from Firestore
      await refreshTotals();

      setIsSubmitting(false);
      setIsModalOpen(false);

      // Reset form commitment inputs
      setFormValues({
        holyMass: 0,
        adoration: 0,
        decadeRosary: 0,
        rosary: 0,
        divineMercy: 0,
        fastMeal: 0,
        abstainMeat: 0,
        shortPrayers: 0
      });

      // Show toast & celebratory confetti
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);

      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#EC4899', '#3B82F6', '#10B981', '#8B5CF6']
      });

    } catch (err) {
      console.error('Error saving commitment:', err);
      setFormError('Failed to record commitment. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  const BUNDLE_OPTIONS = [1, 10, 25, 50, 75, 100];

  return (
    <div id="intercession-counter-section" className="w-full mt-2">
      {/* SUCCESS TOAST NOTIFICATION */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-6 py-4 rounded-2xl shadow-2xl border border-emerald-300 flex items-center space-x-3 max-w-md w-11/12"
          >
            <Sparkles className="w-6 h-6 text-amber-300 animate-spin" />
            <div className="text-left flex-1">
              <h5 className="font-bold text-sm text-white">Commitment Registered!</h5>
              <p className="text-xs text-emerald-100">Thank you for uniting in prayer for GRACIA. May God bless you!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTAINER (Matching Countdown Card styling) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#1c0d2b]/95 border-2 border-amber-400/30 backdrop-blur-xl relative overflow-hidden shadow-2xl text-white">
        
        {/* Ambient Glow Accents */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header Block */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pb-8 border-b border-white/10 text-center lg:text-left relative z-10">
          
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-black tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>GRACIA SPIRITUAL BOUQUET</span>
            </div>

            <h3 className="font-poster text-3xl sm:text-4xl text-white tracking-wide">
              INTERCESSION COMMITMENTS
            </h3>

            <p className="text-sm sm:text-base text-white/80 leading-relaxed">
              Pledging our spiritual commitments, masses, rosaries, and sacrifices across Singapore to be completed before October 10 for the GRACIA 25 Years of Grace Celebration.
            </p>
          </div>

          {/* Grand Total Badge & CTA Button */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-4 shrink-0 w-full sm:w-auto">
            
            {/* Grand Total Card */}
            <div className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-purple-900/40 to-black/60 border border-amber-400/40 text-center shadow-lg">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 block">
                Grand Total Committed
              </span>
              <div className="font-poster text-3xl sm:text-4xl text-amber-300 tracking-tight">
                <AnimatedNumber value={grandTotal} duration={25000} />
              </div>
              <span className="text-[11px] text-amber-200/80 font-semibold block">
                Still Counting...
              </span>
            </div>

            {/* Add Commitment Button */}
            <button
              type="button"
              onClick={handleOpenModal}
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-[#C81E6E] hover:brightness-110 text-white font-poster text-base tracking-wider shadow-xl transition-all cursor-pointer flex items-center justify-center space-x-2 active:scale-95 group shrink-0"
            >
              <Plus className="w-5 h-5 text-white transition-transform group-hover:rotate-90" />
              <span>Add Your Commitment</span>
              <ChevronRight className="w-4 h-4 text-white/80 transition-transform group-hover:translate-x-1" />
            </button>

          </div>

        </div>

        {/* PRAYER FOR THE JUBILEE CARD REMOVED FROM INSIDE INTERCESSION COUNTER CARD - NOW RENDERED BELOW IT */}

        {/* GRID OF 8 INTERCESSION ITEMS (Styling matched to Countdown timer tiles) */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-8 relative z-10">
          {INTERCESSION_ITEMS.map((item) => {
            const IconComp = ICON_MAP[item.key] || ICON_MAP[item.iconName] || HolyMassIcon;
            const rawCount = totals[item.key] || 0;
            // 966 slots = 483 hours (as shown in GRACIA poster)
            const countValue = item.key === 'adoration' ? Math.floor(rawCount / 2) : rawCount;

            return (
              <motion.div
                key={item.key}
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-b ${item.bgGradient} border ${item.borderColor} backdrop-blur-md shadow-lg flex flex-col items-center justify-between text-center relative overflow-hidden group min-h-[160px] sm:min-h-[180px]`}
              >
                {/* Visual Icon / Clipart Ring */}
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-black/50 border border-white/20 flex items-center justify-center shadow-inner mb-2 group-hover:scale-110 transition-transform">
                  <IconComp className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>

                {/* Counter Value (25s count up to final value with live last-2-digit motion) */}
                <div className="my-1">
                  <div className={`font-poster text-3xl sm:text-4xl tracking-tight leading-none ${item.color}`}>
                    <AnimatedNumber value={countValue} duration={25000} />
                  </div>
                </div>

                {/* Label & Description */}
                <div className="space-y-0.5">
                  <span className="text-xs sm:text-sm font-extrabold text-white block uppercase tracking-wide leading-tight">
                    {item.shortLabel}
                  </span>
                  <span className="text-[10px] sm:text-xs text-white/60 block line-clamp-1">
                    {item.description}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ADD COMMITMENT POPUP MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Dialog Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-3xl bg-[#1b0b29] border-2 border-amber-400/40 rounded-3xl p-6 sm:p-8 text-white shadow-2xl my-8 max-h-[90vh] overflow-y-auto z-10"
            >
              
              {/* Close Button */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="absolute top-5 right-5 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="text-center space-y-2 pb-6 border-b border-white/10 pr-8">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Spiritual Bouquet Commitment</span>
                </div>
                
                <h3 className="font-poster text-2xl sm:text-3xl text-white tracking-wide">
                  ADD YOUR INTERCESSION COMMITMENT
                </h3>
                
                <p className="text-xs sm:text-sm text-white/70 max-w-lg mx-auto">
                  Select bundles for each item below to commit your prayers and sacrifices to be completed before October 10 for GRACIA.
                </p>

                <JubileePrayerCard />
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmitCommitment} className="space-y-6 mt-6">
                
                {/* Contact Information Section */}
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center space-x-2">
                    <User className="w-4 h-4 text-amber-300" />
                    <span>Your Contact Details</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Name (Required) */}
                    <div>
                      <label className="block text-xs font-semibold text-white/80 mb-1">
                        Name <span className="text-amber-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                          type="text"
                          required
                          value={formName || ''}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full bg-black/40 border border-white/15 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {/* Email (Required) */}
                    <div>
                      <label className="block text-xs font-semibold text-white/80 mb-1">
                        Email Address <span className="text-amber-400">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                          type="email"
                          required
                          value={formEmail || ''}
                          onChange={(e) => setFormEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="w-full bg-black/40 border border-white/15 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {/* Phone (Required) */}
                    <div>
                      <label className="block text-xs font-semibold text-white/80 mb-1">
                        Phone Number <span className="text-amber-400">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                          type="tel"
                          required
                          value={formPhone || ''}
                          onChange={(e) => setFormPhone(e.target.value)}
                          placeholder="Singapore Phone No."
                          className="w-full bg-black/40 border border-white/15 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items & Bundles Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Select Intercession Bundles</span>
                    </h4>

                    {currentSubmissionTotal > 0 && (
                      <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-400/40">
                        Total Selected: {currentSubmissionTotal.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {INTERCESSION_ITEMS.map((item) => {
                      const IconComp = ICON_MAP[item.key] || ICON_MAP[item.iconName] || HolyMassIcon;
                      const selectedVal = formValues[item.key];

                      return (
                        <div
                          key={item.key}
                          className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                        >
                          {/* Item Info */}
                          <div className="flex items-center space-x-3 shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-black/50 border border-white/20 flex items-center justify-center shrink-0">
                              <IconComp className="w-6 h-6 shrink-0" />
                            </div>
                            <div>
                              <h5 className="font-bold text-sm text-white">{item.label}</h5>
                              <p className="text-[11px] text-white/60">{item.description}</p>
                            </div>
                          </div>

                          {/* Quick Add Bundle Buttons (1, 10, 25, 50, 75, 100) */}
                          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-end">
                            {BUNDLE_OPTIONS.map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => handleBundleAdd(item.key, num)}
                                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-amber-400 hover:text-black font-extrabold text-xs text-white transition-all cursor-pointer active:scale-95 border border-white/10"
                              >
                                +{num}
                              </button>
                            ))}

                            {selectedVal > 0 && (
                              <button
                                type="button"
                                onClick={() => handleSetZero(item.key)}
                                className="px-2 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-xs font-bold transition-colors border border-rose-500/30 ml-1"
                                title="Reset count to 0"
                              >
                                Reset
                              </button>
                            )}

                            {/* Current Count Pill */}
                            <div className="ml-2 px-3 py-1.5 rounded-xl bg-amber-400/20 border border-amber-400/40 font-mono font-bold text-amber-300 text-xs shrink-0 min-w-[50px] text-center">
                              {selectedVal.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PDPA Privacy Clause */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-2">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="pdpaConsent"
                      checked={pdpaAccepted}
                      onChange={(e) => setPdpaAccepted(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-amber-400 text-amber-500 focus:ring-amber-400 bg-black/50 shrink-0 cursor-pointer"
                    />
                    <label htmlFor="pdpaConsent" className="text-xs text-amber-100/90 leading-relaxed cursor-pointer select-none">
                      <strong className="text-amber-300 font-bold block mb-0.5">Personal Data Protection & Consent Form:</strong>
                      By submitting this form, I acknowledge that I have read and agree to the privacy policy outlined in the Personal Data Protection Act at{' '}
                      <a
                        href="https://singapore.jesusyouth.org/jy-data-protection-act/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-amber-300 hover:text-amber-200 font-medium break-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        https://singapore.jesusyouth.org/jy-data-protection-act/
                      </a>.
                    </label>
                  </div>
                </div>

                {/* Error Banner */}
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-semibold text-center">
                    {formError}
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-[#C81E6E] hover:brightness-110 text-white font-poster text-sm tracking-wider shadow-xl transition-all cursor-pointer flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Recording Commitment...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Submit Intercession Commitment ({currentSubmissionTotal.toLocaleString()})</span>
                      </>
                    )}
                  </button>
                </div>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
