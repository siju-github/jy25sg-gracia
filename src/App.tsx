import React, { useState, useEffect } from 'react';
import { NavTab, SiteContentData } from './types';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ConferencePage } from './components/ConferencePage';
import { MusicalPage } from './components/MusicalPage';
import { JubileePage } from './components/JubileePage';
import { ContactPage } from './components/ContactPage';
import { AdminPanel } from './components/AdminPanel';
import { ParticipantPortal } from './components/ParticipantPortal';
import { PaymentCompletePage } from './components/PaymentCompletePage';
import { RegistrationPage } from './components/RegistrationPage';
import { fetchSiteContent } from './lib/firebase';
import { EyeOff, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('conference');
  const [siteContent, setSiteContent] = useState<SiteContentData | null>(null);
  const isPaymentCompleteRoute = window.location.pathname.toLowerCase().startsWith('/payment-complete');

  if (isPaymentCompleteRoute) {
    return <PaymentCompletePage />;
  }

  // Load site content for page visibility
  useEffect(() => {
    fetchSiteContent().then(content => {
      if (content) setSiteContent(content);
    }).catch(err => console.error("Error fetching site content in App:", err));
  }, [activeTab]);

  // Client-side URL sync
  useEffect(() => {
    const path = window.location.pathname.replace('/', '').toLowerCase();
    if (path === 'register') {
      setActiveTab('register');
    } else if (path === 'musical') {
      setActiveTab('musical');
    } else if (path === 'jubilee' || path === 'moments') {
      setActiveTab('jubilee');
    } else if (path === 'contact') {
      setActiveTab('contact');
    } else if (path === 'admin' || path === 'admin/scan' || path === 'scan') {
      setActiveTab('admin');
    } else if (path === 'portal' || path === 'login' || path === 'account') {
      setActiveTab('portal');
    } else {
      setActiveTab('conference');
    }

    const handlePopState = () => {
      const p = window.location.pathname.replace('/', '').toLowerCase();
      if (p === 'register') setActiveTab('register');
      else if (p === 'musical') setActiveTab('musical');
      else if (p === 'jubilee') setActiveTab('jubilee');
      else if (p === 'contact') setActiveTab('contact');
      else if (p === 'admin') setActiveTab('admin');
      else if (p === 'portal' || p === 'login' || p === 'account') setActiveTab('portal');
      else setActiveTab('conference');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Scroll to top whenever tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    const targetPath = tab === 'conference' ? '/' : `/${tab}`;
    window.history.pushState({}, '', targetPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hiddenPages = siteContent?.hiddenPages || [];
  const isPageHidden = hiddenPages.includes(activeTab) && activeTab !== 'admin';

  return (
    <div className="min-h-screen flex flex-col bg-[#1a0b22] text-[#FBF6EC] selection:bg-[#E8752C] selection:text-white">
      {/* Sticky Navigation Bar */}
      <Navbar activeTab={activeTab} onSelectTab={handleSelectTab} hiddenPages={hiddenPages} />

      {/* Main Content Area with Fade/Slide Route Transitions */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            {isPageHidden ? (
              <div className="max-w-2xl mx-auto my-20 px-6 text-center">
                <div className="rounded-3xl bg-gradient-to-br from-[#2D1645]/95 via-[#1E0F30]/95 to-[#130822]/95 border-2 border-amber-500/40 p-8 sm:p-12 text-white space-y-6 shadow-2xl backdrop-blur-2xl">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
                    <EyeOff className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="font-poster text-3xl sm:text-4xl text-white tracking-wide">
                      PAGE TEMPORARILY HIDDEN
                    </h2>
                    <p className="font-script text-xl text-amber-300">
                      GRACIA Jubilee 2026 Event Updates
                    </p>
                  </div>

                  <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                    This page is currently undergoing content updates or has been temporarily hidden by the event organizers. Please check back later.
                  </p>

                  <div className="pt-4 border-t border-white/10">
                    <button
                      onClick={() => handleSelectTab('conference')}
                      className="px-6 py-3 rounded-2xl bg-signature-gradient text-white font-bold text-sm shadow-xl hover:brightness-110 transition-all cursor-pointer inline-flex items-center space-x-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Return to GRACIA Conference</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {activeTab === 'register' && (
                  <RegistrationPage 
                    onNavigateToConference={() => handleSelectTab('conference')}
                    onNavigateToPortal={() => handleSelectTab('portal')} 
                  />
                )}

                {activeTab === 'conference' && (
                  <ConferencePage onNavigateToMusical={() => handleSelectTab('musical')} />
                )}

                {activeTab === 'musical' && (
                  <MusicalPage 
                    onClose={() => handleSelectTab('conference')} 
                    onNavigateToPortal={() => handleSelectTab('portal')} 
                  />
                )}

                {activeTab === 'jubilee' && (
                  <JubileePage />
                )}

                {activeTab === 'contact' && (
                  <ContactPage />
                )}

                {activeTab === 'admin' && (
                  <ParticipantPortal 
                    initialView="admin"
                    onNavigateToConference={() => handleSelectTab('conference')} 
                    onNavigateToMusical={() => handleSelectTab('musical')} 
                  />
                )}

                {activeTab === 'portal' && (
                  <ParticipantPortal 
                    onNavigateToConference={() => handleSelectTab('conference')} 
                    onNavigateToMusical={() => handleSelectTab('musical')} 
                  />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Component */}
      <Footer onSelectTab={handleSelectTab} hiddenPages={hiddenPages} />
    </div>
  );
}
