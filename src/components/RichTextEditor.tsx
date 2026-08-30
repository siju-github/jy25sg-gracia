import React, { useRef, useState } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Heading1, 
  Heading2, 
  List, 
  ListOrdered, 
  Quote, 
  Palette, 
  Type, 
  Eye, 
  Code, 
  Sparkles, 
  Highlighter, 
  RotateCcw,
  CornerDownLeft,
  Pilcrow
} from 'lucide-react';
import { FormattedText } from './FormattedText';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  id?: string;
  helpText?: string;
}

const COLOR_PRESETS = [
  { name: 'Deep Purple', hex: '#241226', bg: 'bg-[#241226]' },
  { name: 'Jubilee Gold', hex: '#E8B400', bg: 'bg-[#E8B400]' },
  { name: 'Magenta Pink', hex: '#C81E6E', bg: 'bg-[#C81E6E]' },
  { name: 'Royal Blue', hex: '#2242A6', bg: 'bg-[#2242A6]' },
  { name: 'Warm Orange', hex: '#E8752C', bg: 'bg-[#E8752C]' },
  { name: 'Emerald Green', hex: '#059669', bg: 'bg-emerald-600' },
  { name: 'Crimson Red', hex: '#DC2626', bg: 'bg-red-600' },
  { name: 'Purple Violet', hex: '#7C3AED', bg: 'bg-purple-600' },
];

const HIGHLIGHT_PRESETS = [
  { name: 'Yellow', hex: '#FEF3C7', bg: 'bg-amber-100 text-amber-900' },
  { name: 'Pink', hex: '#FCE7F3', bg: 'bg-pink-100 text-pink-900' },
  { name: 'Blue', hex: '#DBEAFE', bg: 'bg-blue-100 text-blue-900' },
  { name: 'Green', hex: '#D1FAE5', bg: 'bg-emerald-100 text-emerald-900' },
  { name: 'Purple', hex: '#F3E8FF', bg: 'bg-purple-100 text-purple-900' },
];

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Poster (Bold Header)', value: 'font-poster' },
  { label: 'Script (Handwritten)', value: 'font-script' },
  { label: 'Sans-Serif', value: 'font-sans' },
  { label: 'Serif', value: 'font-serif' },
  { label: 'Monospace', value: 'font-mono' },
];

const FONT_SIZES = [
  { label: 'Small', tag: 'span', style: 'font-size: 0.875rem' },
  { label: 'Normal', tag: 'span', style: 'font-size: 1rem' },
  { label: 'Large (18px)', tag: 'span', style: 'font-size: 1.125rem' },
  { label: 'Extra Large (20px)', tag: 'span', style: 'font-size: 1.25rem' },
  { label: 'Heading 3 (24px)', tag: 'h3', style: '' },
  { label: 'Heading 4 (20px)', tag: 'h4', style: '' },
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Write content here... HTML formatting and styles supported.',
  rows = 5,
  required = false,
  id,
  helpText
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  // Helper to wrap selected text in textarea
  const wrapSelection = (prefix: string, suffix: string, defaultText = 'Formatted text') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;

    const selectedText = currentVal.substring(start, end) || defaultText;
    const replacement = `${prefix}${selectedText}${suffix}`;
    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);

    onChange(newVal);

    // Restore focus & selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  const applyColor = (hex: string) => {
    wrapSelection(`<span style="color: ${hex}">`, '</span>');
    setShowColorPicker(false);
  };

  const applyHighlight = (hex: string) => {
    wrapSelection(`<span style="background-color: ${hex}; padding: 2px 6px; border-radius: 4px;">`, '</span>');
    setShowHighlightPicker(false);
  };

  const applyFontFamily = (className: string) => {
    if (!className) return;
    wrapSelection(`<span className="${className}">`, '</span>');
  };

  const applyFontSize = (sizeOption: typeof FONT_SIZES[0]) => {
    if (sizeOption.tag === 'h3') {
      wrapSelection('<h3 className="font-poster text-xl font-bold text-[#241226]">', '</h3>');
    } else if (sizeOption.tag === 'h4') {
      wrapSelection('<h4 className="font-bold text-lg text-[#241226]">', '</h4>');
    } else {
      wrapSelection(`<span style="${sizeOption.style}">`, '</span>');
    }
  };

  const applyBulletList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end) || 'List item 1\nList item 2';
    
    const items = selected.split('\n').map(line => `  <li>${line.trim()}</li>`).join('\n');
    const formatted = `<ul className="list-disc pl-5 space-y-1 my-2">\n${items}\n</ul>`;
    
    wrapSelection('', '', formatted);
  };

  const applyParagraph = () => {
    wrapSelection('<p className="mb-3 leading-relaxed">', '</p>');
  };

  const applyLineBreak = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const currentVal = textarea.value;
    const newVal = currentVal.substring(0, start) + '<br />' + currentVal.substring(start);
    onChange(newVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 6, start + 6);
    }, 0);
  };

  const clearFormatting = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const selectedText = currentVal.substring(start, end);
    if (!selectedText) return;

    // Strip basic HTML tags
    const cleaned = selectedText.replace(/<[^>]*>/g, '');
    const newVal = currentVal.substring(0, start) + cleaned + currentVal.substring(end);
    onChange(newVal);
  };

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block font-bold text-[11px] uppercase tracking-wider text-[#241226]">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          <div className="flex items-center space-x-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-2 py-0.5 rounded-md transition-all flex items-center space-x-1 ${
                activeTab === 'editor' 
                  ? 'bg-white text-[#2242A6] shadow-xs font-black' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Code className="w-3 h-3" />
              <span>Editor & Styles</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-2 py-0.5 rounded-md transition-all flex items-center space-x-1 ${
                activeTab === 'preview' 
                  ? 'bg-[#2242A6] text-white shadow-xs font-black' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Live Preview</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="border border-[#241226]/20 rounded-xl overflow-hidden bg-white shadow-xs focus-within:ring-2 focus-within:ring-[#2242A6]">
        
        {/* Formatting Toolbar */}
        {activeTab === 'editor' && (
          <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap items-center gap-1.5 text-xs select-none">
            
            {/* Basic Formatting */}
            <div className="flex items-center space-x-1 border-r border-gray-300 pr-1.5">
              <button
                type="button"
                onClick={() => wrapSelection('<b>', '</b>')}
                title="Bold (<b>)"
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 font-bold cursor-pointer transition-colors"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => wrapSelection('<i>', '</i>')}
                title="Italic (<i>)"
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 cursor-pointer transition-colors"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => wrapSelection('<u>', '</u>')}
                title="Underline (<u>)"
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 cursor-pointer transition-colors"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => wrapSelection('<s>', '</s>')}
                title="Strikethrough (<s>)"
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 cursor-pointer transition-colors"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Structure & Headings */}
            <div className="flex items-center space-x-1 border-r border-gray-300 pr-1.5">
              <button
                type="button"
                onClick={() => wrapSelection('<h3 className="font-poster text-xl font-bold text-[#241226] mb-2">', '</h3>')}
                title="Heading 3 (Large Title)"
                className="px-1.5 py-1 rounded hover:bg-gray-200 text-gray-800 font-bold text-[11px] cursor-pointer transition-colors"
              >
                H3
              </button>
              <button
                type="button"
                onClick={() => wrapSelection('<h4 className="font-bold text-lg text-[#2242A6] mb-1">', '</h4>')}
                title="Heading 4 (Subtitle)"
                className="px-1.5 py-1 rounded hover:bg-gray-200 text-gray-800 font-bold text-[11px] cursor-pointer transition-colors"
              >
                H4
              </button>
              <button
                type="button"
                onClick={applyParagraph}
                title="Wrap in Paragraph (<p>)"
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 cursor-pointer transition-colors"
              >
                <Pilcrow className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={applyLineBreak}
                title="Insert Line Break (<br />)"
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 cursor-pointer transition-colors"
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Colors Dropdown */}
            <div className="relative border-r border-gray-300 pr-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowHighlightPicker(false);
                }}
                title="Text Color"
                className="px-2 py-1 rounded hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Palette className="w-3.5 h-3.5 text-[#C81E6E]" />
                <span className="text-[11px]">Color</span>
              </button>

              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-xl shadow-xl border border-gray-200 z-30 w-44 space-y-1.5 animate-in fade-in duration-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Choose Text Color</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => applyColor(color.hex)}
                        title={color.name}
                        className={`w-7 h-7 rounded-lg ${color.bg} hover:scale-110 transition-transform shadow-xs border border-gray-200`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Text Highlight Dropdown */}
            <div className="relative border-r border-gray-300 pr-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowHighlightPicker(!showHighlightPicker);
                  setShowColorPicker(false);
                }}
                title="Highlight Background"
                className="px-2 py-1 rounded hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Highlighter className="w-3.5 h-3.5 text-[#E8B400]" />
                <span className="text-[11px]">Highlight</span>
              </button>

              {showHighlightPicker && (
                <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-xl shadow-xl border border-gray-200 z-30 w-40 space-y-1.5 animate-in fade-in duration-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Background Highlight</div>
                  <div className="space-y-1">
                    {HIGHLIGHT_PRESETS.map((hl) => (
                      <button
                        key={hl.hex}
                        type="button"
                        onClick={() => applyHighlight(hl.hex)}
                        className={`w-full text-left px-2 py-1 rounded-md text-xs font-bold ${hl.bg} hover:opacity-80 transition-opacity`}
                      >
                        {hl.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Font Family Selector */}
            <div className="border-r border-gray-300 pr-1.5">
              <select
                onChange={(e) => applyFontFamily(e.target.value)}
                defaultValue=""
                className="px-2 py-1 bg-white border border-gray-300 rounded text-[11px] font-semibold text-gray-700 focus:outline-none cursor-pointer"
                title="Font Family"
              >
                <option value="" disabled>Font Family</option>
                {FONT_FAMILIES.map(f => (
                  <option key={f.label} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Font Size Selector */}
            <div className="border-r border-gray-300 pr-1.5">
              <select
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  if (!isNaN(idx) && FONT_SIZES[idx]) {
                    applyFontSize(FONT_SIZES[idx]);
                  }
                }}
                defaultValue=""
                className="px-2 py-1 bg-white border border-gray-300 rounded text-[11px] font-semibold text-gray-700 focus:outline-none cursor-pointer"
                title="Font Size & Style"
              >
                <option value="" disabled>Font Size</option>
                {FONT_SIZES.map((fs, i) => (
                  <option key={fs.label} value={i}>{fs.label}</option>
                ))}
              </select>
            </div>

            {/* List & Quote */}
            <div className="flex items-center space-x-1 border-r border-gray-300 pr-1.5">
              <button
                type="button"
                onClick={applyBulletList}
                title="Bullet List (<ul>)"
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 cursor-pointer transition-colors"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => wrapSelection('<blockquote className="border-l-4 border-[#E8B400] pl-3 py-1 my-2 italic text-[#241226]/80 bg-amber-50/50 rounded-r-lg">', '</blockquote>')}
                title="Quote (<blockquote>)"
                className="p-1.5 rounded hover:bg-gray-200 text-gray-700 cursor-pointer transition-colors"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Clear Formatting */}
            <button
              type="button"
              onClick={clearFormatting}
              title="Clear HTML formatting on selection"
              className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer transition-colors flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">Clear</span>
            </button>
          </div>
        )}

        {/* Editor Body */}
        {activeTab === 'editor' ? (
          <textarea
            ref={textareaRef}
            id={id}
            rows={rows}
            required={required}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full p-3 bg-white text-xs sm:text-sm text-[#241226] font-mono leading-relaxed focus:outline-none resize-y min-h-[120px]"
          />
        ) : (
          <div className="p-4 bg-gray-50/70 min-h-[140px] max-h-[350px] overflow-y-auto">
            <div className="text-[10px] font-bold text-[#2242A6] uppercase tracking-wider mb-2 flex items-center space-x-1 border-b border-gray-200 pb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#E8B400]" />
              <span>Formatted Output Preview:</span>
            </div>
            {value.trim() ? (
              <FormattedText content={value} className="text-sm text-[#241226]" />
            ) : (
              <p className="text-xs text-gray-400 italic">No text entered yet. Type or format text above to preview styles.</p>
            )}
          </div>
        )}
      </div>

      {helpText && (
        <p className="text-[11px] text-[#241226]/60 italic">
          {helpText}
        </p>
      )}
    </div>
  );
};
