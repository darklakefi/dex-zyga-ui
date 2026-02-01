import { useEffect } from 'react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}

export function TransactionModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'success'
}: TransactionModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Parse message and convert URLs to clickable links
  const renderMessageWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        // Reset regex lastIndex since we're reusing it
        urlRegex.lastIndex = 0;
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="tx-modal-link"
          >
            {part}
          </a>
        );
      }
      // Handle newlines
      return part.split('\n').map((line, lineIndex) => (
        <span key={`${index}-${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {line}
        </span>
      ));
    });
  };

  const iconMap = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="tx-modal-content" onClick={e => e.stopPropagation()}>
        <div className={`tx-modal-icon tx-modal-icon-${type}`}>
          {iconMap[type]}
        </div>
        <h2 className="tx-modal-title">{title}</h2>
        <div className="tx-modal-message">
          {renderMessageWithLinks(message)}
        </div>
        <button className="tx-modal-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
