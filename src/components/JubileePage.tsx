import React, { useEffect, useState } from 'react';
import { TimelineItem } from '../types';
import { fetchTimelineEvents, toggleTimelineLike } from '../lib/firebase';
import { INITIAL_TIMELINE } from '../data/initialData';
import { Calendar, Sparkles, Image as ImageIcon, Heart, ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FormattedText } from './FormattedText';
import { JubileeLogo } from './JubileeLogo';

interface TimelineLikeButtonProps {
  item: TimelineItem;
}

const TimelineLikeButton: React.FC<TimelineLikeButtonProps> = ({ item }) => {
  const [likes, setLikes] = useState<number>(item.likesCount ?? 0);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [showParticle, setShowParticle] = useState<boolean>(false);

  useEffect(() => {
    if (item.likesCount !== undefined && item.likesCount !== null) {
      setLikes(item.likesCount);
    }
    try {
      const stored = localStorage.getItem('gracia_liked_timeline_events');
      if (stored) {
        const likedArray: string[] = JSON.parse(stored);
        if (likedArray.includes(item.id)) {
          setHasLiked(true);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [item.id, item.likesCount]);

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);

    let likedArray: string[] = [];
    try {
      const stored = localStorage.getItem('gracia_liked_timeline_events');
      if (stored) {
        likedArray = JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }

    if (!hasLiked) {
      const newLikes = likes + 1;
      setLikes(newLikes);
      setHasLiked(true);
      setShowParticle(true);
      setTimeout(() => setShowParticle(false), 900);

      if (!likedArray.includes(item.id)) {
        likedArray.push(item.id);
        localStorage.setItem('gracia_liked_timeline_events', JSON.stringify(likedArray));
      }
      toggleTimelineLike(item.id, 1);
    } else {
      const newLikes = Math.max(0, likes - 1);
      setLikes(newLikes);
      setHasLiked(false);

      likedArray = likedArray.filter(id => id !== item.id);
      localStorage.setItem('gracia_liked_timeline_events', JSON.stringify(likedArray));
      toggleTimelineLike(item.id, -1);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      {/* Floating particle animation on click */}
      <AnimatePresence>
        {showParticle && (
          <motion.span
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -28, scale: 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute -top-6 right-2 text-xs font-bold text-rose-400 pointer-events-none z-20 flex items-center gap-0.5 drop-shadow"
          >
            +1 ❤️
          </motion.span>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={handleToggleLike}
        className={`px-3.5 py-1.5 rounded-full flex items-center space-x-1.5 transition-all duration-300 cursor-pointer select-none border ${
          hasLiked
            ? 'bg-[#C81E6E]/30 border-[#C81E6E]/60 text-white shadow-[0_0_15px_rgba(200,30,110,0.4)] font-bold'
            : 'bg-white/10 hover:bg-[#C81E6E]/20 border-white/20 text-slate-200 hover:text-white'
        }`}
        title={hasLiked ? "Unlike memory" : "Like this memory"}
        aria-label="Like memory"
      >
        <motion.div
          animate={isAnimating ? { scale: [1, 1.45, 0.85, 1.15, 1], rotate: [0, -18, 18, -6, 0] } : { scale: 1, rotate: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              hasLiked ? 'text-rose-400 fill-rose-400' : 'text-slate-300 group-hover:text-rose-400'
            }`}
          />
        </motion.div>
        <span className="font-bold text-xs sm:text-sm tracking-tight text-white">
          {likes}
        </span>
      </motion.button>
    </div>
  );
};

interface TimelineImageSliderProps {
  images: string[];
  title: string;
}

const TimelineImageSlider: React.FC<TimelineImageSliderProps> = ({ images, title }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Ensure index remains valid if images change
  useEffect(() => {
    if (currentIndex >= images.length) {
      setCurrentIndex(0);
    }
  }, [images, currentIndex]);

  // Auto-slide photos every 2 seconds (2000ms)
  useEffect(() => {
    if (!images || images.length <= 1 || lightboxOpen || isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [images, images.length, lightboxOpen, isHovered]);

  if (!images || images.length === 0) return null;

  const nextSlide = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevSlide = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <>
      <div 
        className="relative rounded-2xl overflow-hidden border border-amber-500/30 bg-black shadow-xl group/slider select-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        
        {/* Main Image Stage */}
        <div className="relative h-72 sm:h-96 md:h-[420px] w-full overflow-hidden bg-black/90">
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            alt={`${title} - Photo ${currentIndex + 1}`}
            initial={{ opacity: 0.3, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute inset-0 w-full h-full object-cover object-center cursor-pointer transition-transform duration-500 group-hover/slider:scale-105"
            onClick={() => setLightboxOpen(true)}
            loading="lazy"
          />

          {/* Expand Lightbox Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(true);
            }}
            className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white/90 border border-white/20 backdrop-blur-md opacity-0 group-hover/slider:opacity-100 transition-opacity cursor-pointer z-10"
            title="Expand Photo"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Image Counter Badge */}
          {images.length > 1 && (
            <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 border border-white/20 backdrop-blur-md text-white text-[11px] font-bold tracking-wide z-10">
              {currentIndex + 1} / {images.length}
            </div>
          )}

          {/* Slide Navigation Buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-[#E8752C] text-white border border-white/20 backdrop-blur-md opacity-80 sm:opacity-0 group-hover/slider:opacity-100 transition-all cursor-pointer z-10 hover:scale-110 active:scale-95 shadow-md"
                aria-label="Previous Photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={nextSlide}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-[#E8752C] text-white border border-white/20 backdrop-blur-md opacity-80 sm:opacity-0 group-hover/slider:opacity-100 transition-all cursor-pointer z-10 hover:scale-110 active:scale-95 shadow-md"
                aria-label="Next Photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Dots Indicator */}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-black/50 border border-white/20 backdrop-blur-md z-10">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    currentIndex === idx 
                      ? 'w-6 bg-[#E8B400]' 
                      : 'w-2 bg-white/50 hover:bg-white'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer z-50"
          >
            <X className="w-6 h-6" />
          </button>

          <div 
            className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={images[currentIndex]} 
              alt={title}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute left-2 p-3 rounded-full bg-black/60 hover:bg-[#E8752C] text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-2 p-3 rounded-full bg-black/60 hover:bg-[#E8752C] text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer z-10"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/70 border border-white/20 text-white font-mono text-xs">
              {currentIndex + 1} of {images.length} — {title}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const JubileePage: React.FC = () => {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>(INITIAL_TIMELINE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTimeline = async () => {
      const items = await fetchTimelineEvents();
      if (items && items.length > 0) {
        const publicItems = items.filter(item => item.isPublic !== false);
        setTimelineItems(publicItems);
      }
      setLoading(false);
    };
    loadTimeline();
  }, []);

  return (
    <div className="relative min-h-screen pb-24 overflow-hidden">
      
      {/* Background ambient light matching Contact Us GRACIA theme */}
      <div className="absolute top-1/4 right-10 w-96 h-96 bg-[#2242A6]/20 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      <div className="absolute top-1/3 left-10 w-96 h-96 bg-[#E8752C]/15 blur-[120px] rounded-full pointer-events-none -z-10"></div>

      {/* HEADER SECTION */}
      <section className="pt-12 pb-12 px-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto">
        
        <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-[#2242A6]/20 border border-[#2242A6]/40 text-[#3B82F6] mb-6">
          <Sparkles className="w-4 h-4 text-[#3B82F6]" />
          <span className="text-xs font-bold uppercase tracking-widest">
            25 YEARS OF GOD'S FIDELITY (2001 – 2026)
          </span>
        </div>

        <h1 className="font-poster text-5xl sm:text-7xl tracking-wider text-white uppercase drop-shadow-2xl mb-3">
          JUBILEE <span className="text-signature-animated">MEMORIES</span>
        </h1>

        <p className="font-script text-3xl sm:text-4xl text-[#E8B400] mb-6">
          A Journey of Faith, Fellowship, and Mission
        </p>

        <p className="text-sm sm:text-base text-white/80 max-w-2xl mx-auto leading-relaxed">
          Step back into 25 years of memorable youth encounters, parish retreats, World Youth Day pilgrimages, and family gatherings in Singapore.
        </p>
      </section>

      {/* TIMELINE & INTRO SECTION */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Intro Banner Card matching Contact Page GRACIA styling */}
        <div className="relative rounded-3xl bg-gradient-to-br from-[#2D1645]/95 via-[#1E0F30]/95 to-[#130822]/95 border-2 border-amber-500/40 p-8 sm:p-10 shadow-2xl text-white overflow-hidden backdrop-blur-2xl mb-12">
          <div className="absolute -top-16 -right-16 w-72 h-72 bg-amber-500/10 blur-3xl rounded-full pointer-events-none"></div>
          <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-purple-600/20 blur-3xl rounded-full pointer-events-none"></div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 mb-6 text-center sm:text-left">
            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/20 shadow-lg backdrop-blur-md shrink-0 flex items-center justify-center">
              <JubileeLogo className="w-16 h-16" />
            </div>
            <div>
              <h2 className="font-poster text-2xl sm:text-3xl text-white tracking-wide drop-shadow-md">
                25 YEARS OF HISTORICAL MILESTONES
              </h2>
              <p className="font-script text-lg sm:text-xl text-amber-300">
                Celebrating God's abundant graces upon Jesus Youth Singapore since 2001
              </p>
            </div>
          </div>

          <p className="relative z-10 text-xs sm:text-sm text-slate-200/90 leading-relaxed font-normal mb-6">
            Explore our interactive chronological memory archive. From humble prayer group gatherings to major youth conferences, intercession nights, and community outreach — witness how God has guided and shaped Jesus Youth in Singapore across two and a half decades.
          </p>

          <div className="relative z-10 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-300">
            <span className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Timeline: <strong className="text-white">2001 – 2026</strong></span>
            </span>
            <span className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              <Heart className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Interactive: <strong className="text-white">Click ❤️ to like memories</strong></span>
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-white/60 space-y-3">
            <Sparkles className="w-8 h-8 text-[#E8B400] animate-spin mx-auto" />
            <p>Loading Jubilee Timeline...</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-amber-500/40 ml-4 sm:ml-32 pl-6 sm:pl-10 space-y-12">
            
            {timelineItems.map((item, index) => {
              const photos = item.imageUrls && item.imageUrls.length > 0
                ? item.imageUrls
                : item.imageUrl
                ? [item.imageUrl]
                : [];

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="relative group"
                >
                  {/* Year Marker Badge on Timeline */}
                  <div className="absolute -left-[31px] sm:-left-[53px] top-0 w-12 sm:w-16 h-12 sm:h-16 rounded-2xl bg-signature-gradient p-0.5 shadow-2xl group-hover:scale-110 transition-transform z-10">
                    <div className="w-full h-full bg-[#130822] border border-amber-500/40 rounded-[14px] flex items-center justify-center font-poster text-sm sm:text-xl text-[#E8B400] shadow-inner">
                      {item.year}
                    </div>
                  </div>

                  {/* Content Card with GRACIA styling */}
                  <div className="relative rounded-3xl bg-gradient-to-br from-[#2D1645]/95 via-[#1E0F30]/90 to-[#130822]/95 border-2 border-amber-500/30 p-6 sm:p-8 space-y-4 hover:border-amber-400/60 shadow-2xl backdrop-blur-2xl transition-all duration-300 text-white">
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/15 pb-3">
                      <h3 className="font-poster text-2xl sm:text-3xl text-white tracking-wide drop-shadow-sm">
                        {item.title}
                      </h3>
                      <span className="text-xs font-bold text-[#E8B400] uppercase tracking-widest bg-[#E8B400]/15 border border-[#E8B400]/30 px-3 py-1 rounded-full self-start sm:self-auto shadow-xs">
                        Jubilee Year {item.year}
                      </span>
                    </div>

                    <div className="text-sm sm:text-base text-slate-200/90 leading-relaxed font-normal">
                      <FormattedText content={item.description} />
                    </div>

                    {/* Photo / Image Slider Container */}
                    {photos.length > 0 && (
                      <TimelineImageSlider images={photos} title={item.title} />
                    )}

                    <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-white/10">
                      <span className="italic flex items-center space-x-1.5 text-slate-300">
                        <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{photos.length > 1 ? `${photos.length} photos available — use arrows to slide` : photos.length === 1 ? '1 photo available' : 'No photos'}</span>
                      </span>
                      <TimelineLikeButton item={item} />
                    </div>

                  </div>

                </motion.div>
              );
            })}

          </div>
        )}

      </section>

    </div>
  );
};
