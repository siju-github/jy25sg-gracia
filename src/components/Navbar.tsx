import React, { useState, useEffect } from 'react';
import { NavTab } from '../types';
import { JYLogo } from './JYLogo';
import { JubileeLogo } from './JubileeLogo';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Menu, X, Sparkles, Music, Calendar, Mail, Shield, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  hiddenPages?: string[];
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, hiddenPages }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => unsubscribe();
  }, []);

  const allNavItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'conference', label: 'GRACIA Conference', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'musical', label: 'GRACIA Musical Concert', icon: <Music className="w-4 h-4" /> },
    { id: 'jubilee', label: 'Jubilee Memories', icon: <Calendar className="w-4 h-4" /> },
    { id: 'contact', label: 'Contact Us', icon: <Mail className="w-4 h-4" /> },
    { id: 'portal', label: currentUser ? 'My Portal' : 'My Portal / Login', icon: <UserIcon className="w-4 h-4" /> },
  ];

  const navItems = allNavItems.filter(item => !hiddenPages?.includes(item.id));

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 glass-nav transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo / Brand Wordmark */}
          <button 
            onClick={() => handleTabClick('conference')} 
            className="group flex items-center space-x-3 text-left focus:outline-none cursor-pointer"
            id="nav-logo-btn"
          >
            <div className="group-hover:scale-105 transition-transform duration-300 flex items-center shrink-0">
              <JYLogo className="h-10 w-auto" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-poster text-2xl tracking-widest text-signature-animated">GRACIA</span>
                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#C81E6E]/20 text-[#E8752C] border border-[#C81E6E]/30">
                  JUBILEE
                </span>
              </div>
              <p className="font-script text-xs text-[#E8B400] -mt-0.5 hidden sm:block whitespace-nowrap">
                Celebrating 25 Years of Grace
              </p>
            </div>
          </button>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center space-x-1 sm:space-x-2" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  id={`nav-item-${item.id}`}
                  className={`relative px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 flex items-center space-x-2 ${
                    isActive 
                      ? 'text-white font-semibold' 
                      : 'text-[#FBF6EC]/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className={isActive ? 'text-[#E8752C]' : 'text-white/50'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>

                  {/* Animated Signature Underline */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-2 right-2 h-1 rounded-full bg-signature-gradient"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              id="mobile-menu-toggle"
              className="p-2.5 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6 text-[#E8752C]" /> : <Menu className="w-6 h-6 text-white" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/10 bg-[#1a0b22]/95 backdrop-blur-2xl overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left font-medium text-base transition-all ${
                      isActive 
                        ? 'bg-signature-gradient text-white shadow-lg' 
                        : 'text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
