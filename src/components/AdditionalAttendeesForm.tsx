import React, { useEffect, useState } from 'react';
import { AdditionalAttendee } from '../types';
import { User, Mail, Phone, Users, Info, Camera, Trash2, AlertCircle, CheckCircle2, Link2 } from 'lucide-react';
import { toProperCase } from '../lib/utils';
import { checkExistingParticipantByContact, ExistingParticipantMatch } from '../lib/firebase';

interface AdditionalAttendeesFormProps {
  adultsCount: number;
  teensCount: number;
  preteensCount: number;
  childrenCount: number;
  kidsCount?: number;
  toddlersCount?: number;
  attendees: AdditionalAttendee[];
  onChange: (updated: AdditionalAttendee[]) => void;
  errors?: { [key: string]: string };
}

export function buildExpectedAttendees(
  adultsCount: number,
  teensCount: number,
  preteensCount: number,
  childrenCount: number,
  currentAttendees: AdditionalAttendee[],
  kidsCount?: number,
  toddlersCount?: number
): AdditionalAttendee[] {
  const result: AdditionalAttendee[] = [];
  const list = currentAttendees || [];
  const currentMap = new Map(list.map(a => [a.id, a]));

  const categoryGroups: { [key: string]: AdditionalAttendee[] } = {
    adult: list.filter(a => a.category === 'adult'),
    teen: list.filter(a => a.category === 'teen'),
    preteen: list.filter(a => a.category === 'preteen'),
    child: list.filter(a => a.category === 'child'),
    kid: list.filter(a => a.category === 'kid'),
    toddler: list.filter(a => a.category === 'toddler')
  };

  const findExisting = (id: string, category: string, index: number): AdditionalAttendee | undefined => {
    if (currentMap.has(id)) {
      return currentMap.get(id);
    }
    const catList = categoryGroups[category] || [];
    if (catList[index]) {
      return catList[index];
    }
    return undefined;
  };

  const safeAdults = Math.max(0, Number(adultsCount) || 0);
  const safeTeens = Math.max(0, Number(teensCount) || 0);

  // Primary participant determination:
  // - If safeAdults > 0: Adult #1 is primary participant. Additional adults start at Adult #2. Teens start at Teen #1.
  // - If safeAdults === 0 and safeTeens > 0: Teen #1 is primary participant. Additional adults: none. Teens start at Teen #2.
  const startAdultIndex = 2;
  const startTeenIndex = (safeAdults === 0 && safeTeens > 0) ? 2 : 1;

  // Additional Adults
  for (let i = startAdultIndex; i <= safeAdults; i++) {
    const id = `adult-${i}`;
    const existing = findExisting(id, 'adult', i - startAdultIndex);
    result.push({
      id,
      category: 'adult',
      categoryLabel: `Adult #${i}`,
      name: existing?.name || '',
      email: existing?.email || '',
      phone: existing?.phone || '',
      photoUrl: existing?.photoUrl || undefined,
      passId: existing?.passId,
      isLinkedExistingPass: existing?.isLinkedExistingPass,
      linkedDocId: existing?.linkedDocId,
      linkedPrimaryContactName: existing?.linkedPrimaryContactName
    });
  }

  // Teens
  for (let i = startTeenIndex; i <= safeTeens; i++) {
    const id = `teen-${i}`;
    const existing = findExisting(id, 'teen', i - startTeenIndex);
    result.push({
      id,
      category: 'teen',
      categoryLabel: `Teen / Youth #${i}`,
      name: existing?.name || '',
      email: existing?.email || '',
      phone: existing?.phone || '',
      photoUrl: existing?.photoUrl || undefined,
      passId: existing?.passId,
      isLinkedExistingPass: existing?.isLinkedExistingPass,
      linkedDocId: existing?.linkedDocId,
      linkedPrimaryContactName: existing?.linkedPrimaryContactName
    });
  }

  // Pre-Teens
  for (let i = 1; i <= (preteensCount || 0); i++) {
    const id = `preteen-${i}`;
    const existing = findExisting(id, 'preteen', i - 1);
    result.push({
      id,
      category: 'preteen',
      categoryLabel: `Pre-Teen #${i}`,
      name: existing?.name || '',
      email: undefined,
      phone: undefined,
      photoUrl: existing?.photoUrl || undefined,
      passId: existing?.passId,
      isLinkedExistingPass: existing?.isLinkedExistingPass,
      linkedDocId: existing?.linkedDocId,
      linkedPrimaryContactName: existing?.linkedPrimaryContactName
    });
  }

  // Children
  for (let i = 1; i <= (childrenCount || 0); i++) {
    const id = `child-${i}`;
    const existing = findExisting(id, 'child', i - 1);
    result.push({
      id,
      category: 'child',
      categoryLabel: `Child #${i}`,
      name: existing?.name || '',
      email: undefined,
      phone: undefined,
      photoUrl: existing?.photoUrl || undefined,
      passId: existing?.passId,
      isLinkedExistingPass: existing?.isLinkedExistingPass,
      linkedDocId: existing?.linkedDocId,
      linkedPrimaryContactName: existing?.linkedPrimaryContactName
    });
  }

  // Kids (3-5)
  for (let i = 1; i <= (kidsCount || 0); i++) {
    const id = `kid-${i}`;
    const existing = findExisting(id, 'kid', i - 1);
    result.push({
      id,
      category: 'kid',
      categoryLabel: `Kid (3-5) #${i}`,
      name: existing?.name || '',
      email: undefined,
      phone: undefined,
      photoUrl: existing?.photoUrl || undefined,
      passId: existing?.passId,
      isLinkedExistingPass: existing?.isLinkedExistingPass,
      linkedDocId: existing?.linkedDocId,
      linkedPrimaryContactName: existing?.linkedPrimaryContactName
    });
  }

  // Toddlers (2 & below)
  for (let i = 1; i <= (toddlersCount || 0); i++) {
    const id = `toddler-${i}`;
    const existing = findExisting(id, 'toddler', i - 1);
    result.push({
      id,
      category: 'toddler',
      categoryLabel: `Toddler (2 & below) #${i}`,
      name: existing?.name || '',
      email: undefined,
      phone: undefined,
      photoUrl: existing?.photoUrl || undefined,
      passId: existing?.passId,
      isLinkedExistingPass: existing?.isLinkedExistingPass,
      linkedDocId: existing?.linkedDocId,
      linkedPrimaryContactName: existing?.linkedPrimaryContactName
    });
  }

  return result;
}

export const AdditionalAttendeesForm: React.FC<AdditionalAttendeesFormProps> = ({
  adultsCount,
  teensCount,
  preteensCount,
  childrenCount,
  kidsCount = 0,
  toddlersCount = 0,
  attendees,
  onChange,
  errors = {}
}) => {
  const [duplicateMatches, setDuplicateMatches] = useState<{ [itemId: string]: ExistingParticipantMatch }>({});

  // Sync list whenever counts change
  useEffect(() => {
    const expected = buildExpectedAttendees(
      adultsCount,
      teensCount,
      preteensCount,
      childrenCount,
      attendees,
      kidsCount,
      toddlersCount
    );

    // Check if structure or length changed
    const isDifferent =
      expected.length !== (attendees || []).length ||
      expected.some((exp, index) => {
        const curr = (attendees || [])[index];
        return !curr || curr.id !== exp.id;
      });

    if (isDifferent) {
      onChange(expected);
    }
  }, [adultsCount, teensCount, preteensCount, childrenCount, kidsCount, toddlersCount]);

  const expectedList = buildExpectedAttendees(
    adultsCount,
    teensCount,
    preteensCount,
    childrenCount,
    attendees,
    kidsCount,
    toddlersCount
  );

  if (expectedList.length === 0) {
    return null;
  }

  const handleFieldChange = (id: string, field: 'name' | 'email' | 'phone' | 'photoUrl', value: string | undefined) => {
    const updated = expectedList.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(updated);
  };

  const handleCheckDuplicate = async (item: AdditionalAttendee) => {
    if (item.isLinkedExistingPass) return;
    if ((item.email && item.email.includes('@')) || (item.phone && item.phone.length >= 8)) {
      const match = await checkExistingParticipantByContact(item.email, item.phone);
      if (match) {
        setDuplicateMatches(prev => ({ ...prev, [item.id]: match }));
      } else {
        setDuplicateMatches(prev => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }
    }
  };

  const handleLinkParticipant = (itemId: string, match: ExistingParticipantMatch) => {
    const updated = expectedList.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          name: match.name,
          email: match.email,
          phone: match.phone,
          passId: match.passId,
          isLinkedExistingPass: true,
          linkedDocId: match.docId,
          linkedPrimaryContactName: match.primaryContactName || match.name
        };
      }
      return item;
    });
    onChange(updated);
    setDuplicateMatches(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleUnlinkParticipant = (itemId: string) => {
    const updated = expectedList.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          passId: undefined,
          isLinkedExistingPass: false,
          linkedDocId: undefined,
          linkedPrimaryContactName: undefined
        };
      }
      return item;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-4 pt-4 border-t border-purple-500/20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
        <h3 className="font-poster text-base sm:text-lg text-amber-300 flex items-center space-x-2">
          <span className="w-6 h-6 rounded-full bg-[#C81E6E] text-white text-xs flex items-center justify-center font-bold">3</span>
          <span>ADDITIONAL ATTENDEE DETAILS</span>
        </h3>
        <p className="text-xs text-slate-300 flex items-center space-x-1">
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Name, email & phone required for Adults & Teens; Full name required for Pre-Teens & Children.</span>
        </p>
      </div>

      <div className="space-y-3">
        {expectedList.map((item) => {
          const isAdultOrTeen = item.category === 'adult' || item.category === 'teen';
          const nameError = errors[`${item.id}-name`];
          const emailError = errors[`${item.id}-email`];
          const phoneError = errors[`${item.id}-phone`];
          const dupMatch = duplicateMatches[item.id];

          return (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-[#130720]/90 border border-amber-500/20 shadow-md space-y-3 hover:border-amber-400/40 transition-colors"
            >
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    item.category === 'adult'
                      ? 'bg-[#E8752C]/20 text-[#E8752C] border border-[#E8752C]/40'
                      : item.category === 'teen'
                      ? 'bg-[#C81E6E]/20 text-pink-300 border border-[#C81E6E]/40'
                      : item.category === 'preteen'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                      : item.category === 'child'
                      ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                      : item.category === 'kid'
                      ? 'bg-sky-950/60 text-sky-300 border border-sky-500/30'
                      : 'bg-purple-950/60 text-purple-300 border border-purple-500/30'
                  }`}>
                    {item.categoryLabel}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    {isAdultOrTeen ? '(Full details required)' : '(Name required)'}
                  </span>
                </div>

                {/* Participant Photo Button */}
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
                      {item.photoUrl ? (
                        <img src={item.photoUrl} alt={item.name || 'Participant'} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <label
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center cursor-pointer shadow-md hover:bg-amber-400 transition-all"
                      title="Upload or change participant photo"
                    >
                      <Camera className="w-3 h-3 font-bold" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              alert('Photo size must be less than 5MB');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const res = ev.target?.result as string;
                              if (res) handleFieldChange(item.id, 'photoUrl', res);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  {item.photoUrl && (
                    <button
                      type="button"
                      onClick={() => handleFieldChange(item.id, 'photoUrl', undefined)}
                      className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition-colors"
                      title="Remove photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Linked Existing Pass Banner */}
              {item.isLinkedExistingPass ? (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <span>Linked Existing Pass</span>
                        <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-emerald-900 text-emerald-200 border border-emerald-500/30 font-bold">
                          {item.passId}
                        </span>
                      </p>
                      <p className="text-[11px] text-emerald-200/90">
                        <strong>{item.name}</strong>'s pass is linked under your group booking. Both of you can view this pass.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnlinkParticipant(item.id)}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline shrink-0 ml-2"
                  >
                    Unlink
                  </button>
                </div>
              ) : dupMatch ? (
                /* Duplicate Match Alert Banner */
                <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-200 space-y-2">
                  <div className="flex items-start space-x-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-amber-300 flex items-center gap-1.5">
                        <span>Participant Already Registered</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-900 text-amber-200 border border-amber-500/30">
                          {dupMatch.passId}
                        </span>
                      </p>
                      <p className="text-amber-200/90 leading-relaxed">
                        <strong>{dupMatch.name}</strong> (<span className="underline">{dupMatch.email || dupMatch.phone}</span>) is already registered in GRACIA 2026. Duplicate registration is not permitted.
                      </p>
                      <p className="text-amber-200 font-medium pt-0.5">
                        Would you like to link <strong>{dupMatch.name}</strong> under your family/group booking? Both participants will be able to see this Pass ID.
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleLinkParticipant(item.id, dupMatch)}
                      className="px-3 py-1.5 rounded-xl bg-[#241226] border border-amber-400/40 text-white text-xs font-bold flex items-center space-x-1.5 hover:bg-[#3b1d3f] transition-all shadow-xs"
                    >
                      <Link2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Link Existing Pass ({dupMatch.passId}) to My Group</span>
                    </button>
                  </div>
                </div>
              ) : null}

              <div className={`grid grid-cols-1 ${isAdultOrTeen ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-3`}>
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Full Name <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id={`${item.id}-name`}
                    name={`${item.id}-name`}
                    type="text"
                    value={item.name || ''}
                    onChange={(e) => handleFieldChange(item.id, 'name', e.target.value)}
                    onBlur={() => {
                      if (item.name) {
                        handleFieldChange(item.id, 'name', toProperCase(item.name));
                      }
                      handleCheckDuplicate(item);
                    }}
                    placeholder={isAdultOrTeen ? "e.g. Mary Tan" : "e.g. Samuel Tan"}
                    className={`w-full px-3 py-2 rounded-xl bg-[#1D0C33] border ${
                      nameError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700/60 focus:border-amber-400'
                    } text-white placeholder:text-slate-400 text-xs focus:outline-none transition-all`}
                  />
                  {nameError && <p className="text-[10px] text-rose-400 font-semibold">{nameError}</p>}
                </div>

                {/* Email Address (Adults & Teens) */}
                {isAdultOrTeen && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-1">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>Email Address <span className="text-rose-400">*</span></span>
                    </label>
                    <input
                      id={`${item.id}-email`}
                      name={`${item.id}-email`}
                      type="email"
                      value={item.email || ''}
                      onChange={(e) => handleFieldChange(item.id, 'email', e.target.value)}
                      onBlur={() => handleCheckDuplicate(item)}
                      placeholder="mary@example.com"
                      className={`w-full px-3 py-2 rounded-xl bg-[#1D0C33] border ${
                        emailError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700/60 focus:border-amber-400'
                      } text-white placeholder:text-slate-400 text-xs focus:outline-none transition-all`}
                    />
                    {emailError && <p className="text-[10px] text-rose-400 font-semibold">{emailError}</p>}
                  </div>
                )}

                {/* Contact Number (Adults & Teens) */}
                {isAdultOrTeen && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>Contact Number <span className="text-rose-400">*</span></span>
                    </label>
                    <input
                      id={`${item.id}-phone`}
                      name={`${item.id}-phone`}
                      type="tel"
                      value={item.phone || ''}
                      onChange={(e) => handleFieldChange(item.id, 'phone', e.target.value)}
                      onBlur={() => handleCheckDuplicate(item)}
                      placeholder="+65 9123 4567"
                      className={`w-full px-3 py-2 rounded-xl bg-[#1D0C33] border ${
                        phoneError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700/60 focus:border-amber-400'
                      } text-white placeholder:text-slate-400 text-xs focus:outline-none transition-all`}
                    />
                    {phoneError && <p className="text-[10px] text-rose-400 font-semibold">{phoneError}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
