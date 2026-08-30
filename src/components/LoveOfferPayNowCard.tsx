import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Heart, ShieldCheck, QrCode, Upload, CheckCircle2, Image as ImageIcon, Camera } from 'lucide-react';
import paynowQrImg from '../assets/images/regenerated_image_1785556021273.jpg';
import { updateRegistrationInFirestore } from '../lib/firebase';

interface LoveOfferPayNowCardProps {
  className?: string;
  registrationId?: string;
  initialScreenshotUrl?: string;
  onScreenshotUploaded?: (url: string) => void;
}

export const LoveOfferPayNowCard: React.FC<LoveOfferPayNowCardProps> = ({ 
  className = '',
  registrationId,
  initialScreenshotUrl,
  onScreenshotUploaded
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string>(initialScreenshotUrl || '');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const paynowNumber = '201605888W';
  const paynowName = 'HitPay Payment Solutions (JESUS YOUTH SINGAPORE)';

  useEffect(() => {
    if (initialScreenshotUrl) {
      setScreenshotUrl(initialScreenshotUrl);
    }
  }, [initialScreenshotUrl]);

  useEffect(() => {
    setQrDataUrl(paynowQrImg);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(paynowNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('File size exceeds 8MB. Please choose a smaller image.');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setScreenshotUrl(dataUrl);

      if (registrationId) {
        await updateRegistrationInFirestore(registrationId, {
          paymentScreenshotUrl: dataUrl,
          paymentStatus: 'pending'
        });
      }

      if (onScreenshotUploaded) {
        onScreenshotUploaded(dataUrl);
      }

      setIsUploading(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`p-6 rounded-3xl bg-gradient-to-b from-amber-50/90 to-orange-50/70 border-2 border-[#E8752C]/30 shadow-lg text-[#241226] text-left space-y-5 ${className}`}>
      
      {/* Love Offering Banner Header */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-[#C81E6E] font-bold text-xs uppercase tracking-wider">
          <Heart className="w-4 h-4 text-[#C81E6E] fill-[#C81E6E]/20 shrink-0" />
          <span>Love Offering Contribution</span>
        </div>

        <h4 className="font-poster text-xl sm:text-2xl text-[#241226] tracking-wide leading-snug">
          Love Offering: $25 / person <span className="text-[#E8752C] font-normal">|</span> Family Cap: $100 max
        </h4>

        <p className="text-xs sm:text-sm text-[#241226]/80 leading-relaxed bg-white/60 p-3.5 rounded-2xl border border-amber-200/60">
          While the actual cost is $150 per person, this conference is heavily subsidized through the support of Jesus Youth Singapore members. We are committed to making this event accessible to all!
        </p>
      </div>

      {/* PayNow QR Code Box */}
      <div className="bg-white rounded-2xl p-5 border border-amber-200/80 shadow-sm flex flex-col items-center text-center space-y-4">
        
        {/* PayNow SG Badge */}
        <div className="flex items-center justify-center space-x-2 bg-[#7B1113] text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-wider shadow-sm">
          <QrCode className="w-4 h-4" />
          <span>PAYNOW SG</span>
        </div>

        {/* QR Code Canvas / Image */}
        <div className="relative p-3 bg-white rounded-2xl border-2 border-[#7B1113]/20 shadow-inner flex items-center justify-center">
          <img 
            src={qrDataUrl || paynowQrImg} 
            alt="PayNow QR Code for 82982404" 
            className="w-52 h-52 sm:w-64 sm:h-64 object-contain rounded-lg"
          />
        </div>

        {/* Scan instruction */}
        <p className="text-xs sm:text-sm font-semibold text-[#241226]/90 max-w-sm">
          Scan the QR code above to PayNow or use the below Number:
        </p>

        {/* PayNow Number & Name Details */}
        <div className="w-full max-w-sm bg-gray-50/90 rounded-2xl p-4 border border-gray-200 text-left space-y-2.5">
          
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">PayNow Number</span>
              <span className="font-mono text-lg font-bold text-[#2242A6] tracking-wide">{paynowNumber}</span>
            </div>
            
            <button
              type="button"
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer ${
                copied 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-[#2242A6] hover:bg-[#1a3384] text-white shadow-sm'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-2 border-t border-gray-200/80">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">Account Name</span>
            <span className="font-medium text-xs sm:text-sm text-[#241226] tracking-tight break-all font-mono">
              {paynowName}
            </span>
          </div>

        </div>

        {/* UPLOAD PAYMENT SCREENSHOT FUNCTION */}
        <div className="w-full max-w-sm bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-amber-300/80 rounded-2xl p-4 text-left text-xs text-[#241226] space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-[#2242A6] text-sm flex items-center space-x-1.5">
              <Camera className="w-4 h-4 text-[#E8752C] shrink-0" />
              <span>Payment Confirmation Notice</span>
            </p>
            {screenshotUrl && (
              <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center space-x-1 border border-emerald-300">
                <Check className="w-3 h-3" />
                <span>Uploaded</span>
              </span>
            )}
          </div>

          <p className="text-[#241226]/80 leading-relaxed text-[11px] sm:text-xs">
            Once PayNow transfer is complete, please upload your payment screenshot below for verification.
          </p>

          {screenshotUrl ? (
            <div className="space-y-2 bg-white p-3 rounded-xl border border-emerald-300 shadow-sm">
              <div className="relative rounded-lg overflow-hidden max-h-48 border border-gray-200 bg-black/5">
                <img src={screenshotUrl} alt="Payment Screenshot" className="w-full object-contain max-h-48" />
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-emerald-700 font-bold flex items-center space-x-1 text-[11px]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{uploadSuccess ? 'Saved successfully!' : 'Screenshot attached!'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-bold text-[#2242A6] underline hover:text-[#C81E6E] cursor-pointer"
                >
                  Change Photo
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#2242A6]/50 hover:border-[#2242A6] bg-white hover:bg-amber-50/60 rounded-xl cursor-pointer transition-all space-y-1.5 shadow-xs"
              >
                <Upload className="w-6 h-6 text-[#2242A6] animate-bounce" />
                <span className="font-bold text-xs text-[#2242A6]">
                  {isUploading ? 'Uploading Screenshot...' : '📷 Upload PayNow Screenshot'}
                </span>
                <span className="text-[10px] text-gray-500 font-medium">Click to select receipt image from gallery</span>
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="flex items-center space-x-1.5 text-[11px] text-gray-500 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>PayNow transfers are processed directly via your banking app</span>
        </div>

      </div>

    </div>
  );
};
