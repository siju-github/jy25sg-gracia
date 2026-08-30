import React, { useEffect, useState } from 'react';
import { PrayerGroupItem, SiteContentData } from '../types';
import { fetchPrayerGroups, fetchSiteContent, sendContactMessage } from '../lib/firebase';
import { INITIAL_PRAYER_GROUPS, INITIAL_SITE_CONTENT } from '../data/initialData';
import { Mail, Phone, MapPin, Navigation, Users, Send, CheckCircle2, Instagram, Facebook, Youtube, Heart, Sparkles, Globe, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { FormattedText } from './FormattedText';
import { JYLogo } from './JYLogo';
import { LocationMapModal } from './LocationMapModal';

export const ContactPage: React.FC = () => {
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [prayerGroups, setPrayerGroups] = useState<PrayerGroupItem[]>(INITIAL_PRAYER_GROUPS);
  const [siteContent, setSiteContent] = useState<SiteContentData>(INITIAL_SITE_CONTENT);

  // Message Form State
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '', pdpaConsent: false });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const groups = await fetchPrayerGroups();
      if (groups && groups.length > 0) {
        setPrayerGroups(groups);
      }
      const content = await fetchSiteContent();
      if (content) {
        setSiteContent(content);
      }
    };
    loadData();
  }, []);

  const [errorMsg, setErrorMsg] = useState('');

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;

    if (!contactForm.pdpaConsent) {
      setErrorMsg('You must agree to the Personal Data Protection & Consent terms before sending a message.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      await sendContactMessage(contactForm.name, contactForm.email, contactForm.message);
      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting contact message:', err);
      setErrorMsg('Failed to send message. Please try again or email singapore@jesusyouth.org directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen pb-24 overflow-hidden">
      
      {/* Background Glow */}
      <div className="absolute top-1/4 right-10 w-96 h-96 bg-[#2242A6]/20 blur-[120px] rounded-full pointer-events-none -z-10"></div>

      {/* HEADER */}
      <section className="pt-12 pb-16 px-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-[#2242A6]/20 border border-[#2242A6]/40 text-[#3B82F6] mb-6">
          <Mail className="w-4 h-4 text-[#3B82F6]" />
          <span className="text-xs font-bold uppercase tracking-widest">
            GET IN TOUCH WITH JESUS YOUTH SINGAPORE
          </span>
        </div>

        <h1 className="font-poster text-5xl sm:text-7xl tracking-wider text-white uppercase drop-shadow-2xl mb-3">
          CONTACT <span className="text-signature-animated">US</span>
        </h1>

        <p className="font-script text-3xl sm:text-4xl text-[#E8B400] mb-6">
          Connect, Pray, and Celebrate with Us
        </p>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* ABOUT JESUS YOUTH SINGAPORE BLURB */}
        <section className="relative rounded-3xl bg-gradient-to-br from-[#2D1645]/95 via-[#1E0F30]/95 to-[#130822]/95 border-2 border-amber-500/40 p-8 sm:p-12 shadow-2xl text-white overflow-hidden backdrop-blur-2xl">
          {/* Ambient decorative glow */}
          <div className="absolute -top-16 -right-16 w-72 h-72 bg-amber-500/10 blur-3xl rounded-full pointer-events-none"></div>
          <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-purple-600/20 blur-3xl rounded-full pointer-events-none"></div>

          <div className="relative z-10 flex items-center space-x-4 mb-6">
            <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20 shadow-lg backdrop-blur-md shrink-0 flex items-center justify-center">
              <JYLogo className="w-12 h-12" />
            </div>
            <div>
              <h2 className="font-poster text-3xl sm:text-4xl text-white tracking-wide drop-shadow-md">
                ABOUT JESUS YOUTH SINGAPORE
              </h2>
              <p className="font-script text-xl sm:text-2xl text-amber-300">
                An International Catholic movement that challenges young people to live a meaningful, creative and fulfilling life.
              </p>
            </div>
          </div>

          <div className="relative z-10 mb-8 text-sm sm:text-base text-slate-200/90 leading-relaxed font-normal">
            <FormattedText content={siteContent.aboutText} />
          </div>

          <div className="relative z-10 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-300">
            <button
              type="button"
              onClick={() => setShowLocationModal(true)}
              className="flex items-center space-x-2 bg-white/5 hover:bg-white/15 px-3.5 py-2 rounded-xl border border-white/10 hover:border-amber-400/50 text-white transition-all cursor-pointer group"
              title="Click to view venue location map & directions"
            >
              <MapPin className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
              <span>Event Venue: <strong className="text-white">{siteContent.hqAddress || 'Caritas Agape Village, Lorong 8 Toa Payoh'}</strong></span>
              <Navigation className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-400 ml-1" />
            </button>
            <span className="flex items-center space-x-2 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10">
              <Mail className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Email: <strong className="text-white">{siteContent.contactEmail}</strong></span>
            </span>
            {siteContent.contactPhone && (
              <span className="flex items-center space-x-2 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Phone: <strong className="text-white">{siteContent.contactPhone}</strong></span>
              </span>
            )}
          </div>
        </section>

        {/* PRAYER GROUPS GRID */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="font-poster text-3xl sm:text-4xl text-white tracking-wide">
              SINGAPORE <span className="text-signature-animated">PRAYER GROUPS</span>
            </h2>
            <p className="text-sm text-white/70 max-w-xl mx-auto">
              Gatherings across Singapore for fellowship, praise, rosary, and Scripture sharing. All are welcome!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {prayerGroups.map((group) => (
              <motion.div
                key={group.id}
                whileHover={{ y: -4 }}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl text-white space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="font-poster text-2xl text-white tracking-wide">{group.name}</h3>
                  <span className="text-[10px] font-bold text-[#E8B400] bg-[#E8B400]/10 px-2.5 py-1 rounded-full border border-[#E8B400]/20">
                    {group.area}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-white/80">
                  <p className="flex items-center space-x-2">
                    <span className="font-bold text-[#E8752C]">Meeting Time:</span>
                    <span>{group.meetingTime}</span>
                  </p>
                  <p className="flex items-center space-x-2">
                    <span className="font-bold text-[#3B82F6]">Contact Person:</span>
                    <span>{group.contactPerson} ({group.contactPhone})</span>
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* DIRECT CONTACT FORM & SOCIALS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Contact Form */}
          <div className="relative rounded-3xl bg-gradient-to-br from-[#2B163F]/90 via-[#1E0F30]/90 to-[#130822]/90 border border-amber-500/30 p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl text-white">
            <h3 className="font-poster text-2xl text-white tracking-wide">SEND A MESSAGE TO GRACIA TEAM</h3>

            {submitted ? (
              <div className="text-center py-8 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="font-poster text-xl text-white">Message Sent!</h4>
                <p className="text-xs text-slate-300">Thank you for reaching out. We will respond shortly.</p>
                <button
                  onClick={() => { setSubmitted(false); setContactForm({ name: '', email: '', message: '', pdpaConsent: false }); }}
                  className="text-xs text-amber-300 hover:text-amber-200 font-bold underline cursor-pointer"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleMessageSubmit} className="space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-semibold">
                    {errorMsg}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold uppercase text-amber-200/90 mb-1 tracking-wider">Your Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.name || ''}
                    onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                    placeholder="e.g. Mary Lim"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-amber-200/90 mb-1 tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    value={contactForm.email || ''}
                    onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="e.g. mary@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-amber-200/90 mb-1 tracking-wider">Message</label>
                  <textarea
                    rows={3}
                    required
                    value={contactForm.message || ''}
                    onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Ask us anything about GRACIA..."
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400 transition-colors"
                  ></textarea>
                </div>

                {/* Personal Data Protection & Consent Form */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-white space-y-2">
                  <h4 className="font-bold text-[11px] uppercase tracking-wider text-amber-300 flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Personal Data Protection & Consent Form</span>
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    By submitting this form, I acknowledge that I have read and agree to the privacy policy outlined in the Personal Data Protection Act at{' '}
                    <a
                      href="https://singapore.jesusyouth.org/jy-data-protection-act/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-amber-300 hover:text-amber-200 font-medium break-all"
                    >
                      https://singapore.jesusyouth.org/jy-data-protection-act/
                    </a>.
                  </p>
                  <label className="flex items-start space-x-2 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={contactForm.pdpaConsent}
                      onChange={e => {
                        setContactForm({ ...contactForm, pdpaConsent: e.target.checked });
                        if (errorMsg) setErrorMsg('');
                      }}
                      className="mt-0.5 w-3.5 h-3.5 rounded border-white/30 bg-black/50 text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                    />
                    <span className="text-[11px] font-bold text-slate-200">
                      I agree to the terms and conditions above <span className="text-amber-400">*</span>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-signature-gradient text-white font-poster text-lg tracking-wider hover:brightness-110 transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg"
                >
                  <Send className="w-4 h-4" />
                  <span>{loading ? 'Sending...' : 'SEND MESSAGE'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Social Links Box */}
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <h3 className="font-poster text-2xl text-white">FOLLOW JESUS YOUTH SINGAPORE</h3>
              <p className="text-sm text-white/70">
                Stay updated with daily rosary prayers, youth retreat announcements, and behind-the-scenes rehearsals for GRACIA!
              </p>
            </div>

            <div className="space-y-3">
              <a 
                href={siteContent.instagramUrl} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center space-x-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-[#C81E6E]/20 text-white transition-all"
              >
                <Instagram className="w-6 h-6 text-[#C81E6E] shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Instagram: @jesusyouth_singapore</div>
                  <div className="text-[11px] text-white/50">instagram.com/jesusyouth_singapore</div>
                </div>
              </a>

              <a 
                href={siteContent.facebookUrl} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center space-x-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-[#2242A6]/20 text-white transition-all"
              >
                <Facebook className="w-6 h-6 text-[#2242A6] shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Facebook: facebook.com/jy15sg</div>
                  <div className="text-[11px] text-white/50">facebook.com/jy15sg</div>
                </div>
              </a>

              <a 
                href={siteContent.youtubeUrl} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center space-x-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-[#D62828]/20 text-white transition-all"
              >
                <Youtube className="w-6 h-6 text-[#D62828] shrink-0" />
                <div>
                  <div className="font-semibold text-sm">YouTube: @JesusYouthSingapore</div>
                  <div className="text-[11px] text-white/50">youtube.com/@JesusYouthSingapore</div>
                </div>
              </a>

              <a 
                href={siteContent.websiteUrl || 'https://singapore.jesusyouth.org/'} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center space-x-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-[#E8B400]/20 text-white transition-all"
              >
                <Globe className="w-6 h-6 text-[#E8B400] shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Official Website</div>
                  <div className="text-[11px] text-white/50">singapore.jesusyouth.org</div>
                </div>
              </a>
            </div>

            <p className="text-xs text-white/40 italic text-center">
              "To make Christ known to the youth, and youth known to Christ."
            </p>
          </div>

        </section>

      </div>

      {/* LOCATION MAP MODAL */}
      <LocationMapModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        venueName="Caritas Agape Village"
        address="7A Lorong 8 Toa Payoh, Singapore 319264"
        hallName="Jesus Youth Singapore Secretariat & Venue"
      />

    </div>
  );
};
