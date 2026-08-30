import re

with open("src/components/RegistrationPage.tsx", "r", encoding="utf-8") as f:
    text = f.read()

idx1 = text.find("{/* TOTAL FEE SUMMARY & SUBMIT */}")
idx_form_end = text.find("</form>", idx1)

prefix = text[:idx1]
suffix = text[idx_form_end:]

new_fee_section = """{/* TOTAL FEE SUMMARY & SUBMIT */}
            <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20 p-5 rounded-2xl border border-amber-400/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              {isAlreadyConfirmed && amountToCharge <= 0 ? (
                <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-300 uppercase tracking-wider bg-emerald-950/90 px-3 py-0.5 rounded-full border border-emerald-500/50">
                          Already Registered &amp; Confirmed
                        </span>
                        {previouslyPaidAmount > 0 && (
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            (${previouslyPaidAmount}.00 SGD Paid)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-emerald-100 font-medium leading-relaxed">
                        A confirmed registration record already exists for <strong className="text-white font-extrabold">{toProperCase(formData.name || displayName)}</strong> ({formData.email}). Your digital pass is active. You do not need to pay again.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const activeRef = refNumber || formData.email;
                      const cleanName = toProperCase(formData.name || displayName);
                      const cleanAttendees = (additionalAttendees || []).map(a => ({ ...a, name: toProperCase(a.name) }));
                      const passes = generatePassesForGroup(cleanName, formData.email, formData.phone, formData.parish, activeRef, cleanAttendees);
                      setAllPasses(passes);
                      setActiveStep(3);
                      updateUrl(3, activeRef);
                    }}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:opacity-90 text-slate-950 font-black text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                    <span>View Your Digital Pass &amp; Confirmation</span>
                    <ArrowRight className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3 flex-1 w-full sm:w-auto">
                    <span className="text-xs font-black text-amber-200 uppercase tracking-wider block flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                      <span>Registration Love Offering Summary:</span>
                    </span>

                    {/* Calculated Amounts Card */}
                    <div className="bg-[#18092B]/95 border border-amber-500/40 p-3.5 sm:p-4 rounded-2xl space-y-3 shadow-inner">
                      {/* Actual Amount ($150 per person) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-white block">Actual Event Love Offering Rate:</span>
                          <span className="text-[11px] text-amber-200/80 block">
                            $150.00 SGD per person ({payingPax} Adult / Youth / Teen{payingPax === 1 ? '' : 's'})
                          </span>
                        </div>
                        <span className={`font-mono text-base font-extrabold ${useDiscountedRate ? 'text-amber-300/60 line-through' : 'text-amber-300'}`}>
                          ${actualFullLoveOffering}.00 SGD
                        </span>
                      </div>

                      {/* Checkbox for Subsidized/Discounted Rate ($25/person) */}
                      <div className="flex items-start gap-2.5 bg-amber-950/50 border border-amber-500/30 p-2.5 sm:p-3 rounded-xl">
                        <input
                          type="checkbox"
                          id="useDiscountedRate"
                          checked={useDiscountedRate}
                          onChange={(e) => setUseDiscountedRate(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                        />
                        <label htmlFor="useDiscountedRate" className="text-xs text-amber-100 font-semibold cursor-pointer leading-relaxed">
                          Apply discounted rate of <strong className="text-amber-300 font-extrabold">$25.00 SGD</strong> per Adult / Youth / Teen
                          {payingPax >= 4 && useDiscountedRate && (
                            <span className="text-emerald-300 font-extrabold ml-1.5 bg-emerald-950/90 px-2 py-0.5 rounded-md border border-emerald-500/40 inline-block">
                              Family Cap Applied: Max $100.00 SGD
                            </span>
                          )}
                        </label>
                      </div>

                      {/* Mention Pre-teens, Children, Kids, Toddlers are Free */}
                      <div className="text-[11px] text-emerald-300 font-semibold flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl">
                        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Pre-teens, Children, Kids, and Toddlers attend for <strong>FREE</strong> ($0.00 SGD).</span>
                      </div>
                    </div>

                    {existingRecordLoaded && previouslyPaidAmount > 0 ? (
                      <div className="space-y-1">
                        <div className="text-xs text-gray-300 flex items-center gap-2">
                          <span>Previously Paid:</span>
                          <span className="font-mono font-bold text-emerald-400">${previouslyPaidAmount}.00 SGD</span>
                        </div>
                        <div className="text-xs text-gray-300 flex items-center gap-2">
                          <span>Updated Total Love Offering:</span>
                          <span className="font-mono font-bold text-amber-300">${currentTotalFee}.00 SGD</span>
                        </div>
                        <div className="flex items-baseline gap-2 pt-1 border-t border-amber-500/20">
                          <span className="text-xs font-extrabold text-amber-200 uppercase">Additional Amount Due:</span>
                          <span className="text-2xl font-black text-amber-300 font-mono">${amountToCharge}.00 SGD</span>
                        </div>
                        {isParticipantReduced && (
                          <p className="text-[11px] text-amber-300 font-medium flex items-center gap-1.5 mt-1 bg-amber-950/80 p-2 rounded-lg border border-amber-500/30">
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Note: Participant count reduced from previously paid amount (${previouslyPaidAmount}.00 SGD). No refund will be issued.</span>
                          </p>
                        )}
                        {isParticipantAdded && (
                          <p className="text-[11px] text-emerald-300 font-medium flex items-center gap-1.5 mt-1 bg-emerald-950/80 p-2 rounded-lg border border-emerald-500/30">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Additional participant added! You will only be charged the difference of +${amountToCharge}.00 SGD.</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-amber-200 font-bold uppercase">Total Payable:</span>
                        <span className="text-3xl font-black text-amber-300 font-mono">${totalAmount}.00 SGD</span>
                        {payingPax >= 4 && useDiscountedRate && (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                            Family Cap ($100 Max)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-signature-gradient hover:opacity-90 text-white font-extrabold text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <span>Proceed to Payment Checkout</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          """

with open("src/components/RegistrationPage.tsx", "w", encoding="utf-8") as f:
    f.write(prefix + new_fee_section + suffix)

print("RegistrationPage.tsx updated successfully!")
