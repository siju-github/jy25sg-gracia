import React from 'react';

interface FormattedTextProps {
  content: string;
  className?: string;
  id?: string;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ content, className = '', id }) => {
  if (!content) return null;

  // Check if content contains HTML tags
  const hasHtml = /<[a-z][\s\S]*>/i.test(content);

  if (hasHtml) {
    return (
      <div
        id={id}
        className={`formatted-html-content space-y-2 leading-relaxed [&_p]:mb-3 [&_h3]:font-poster [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_h4]:font-bold [&_h4]:text-lg [&_h4]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-[#E8B400] [&_blockquote]:pl-3 [&_blockquote]:italic ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Fallback for plain text: split by double newlines into paragraphs, single newlines into <br />
  const paragraphs = content.split(/\n\s*\n/);
  return (
    <div id={id} className={`space-y-3 leading-relaxed ${className}`}>
      {paragraphs.map((paragraph, idx) => (
        <p key={idx} className="leading-relaxed">
          {paragraph.split('\n').map((line, lineIdx, arr) => (
            <React.Fragment key={lineIdx}>
              {line}
              {lineIdx < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      ))}
    </div>
  );
};
