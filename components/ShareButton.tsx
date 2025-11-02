'use client';

import { useState } from 'react';
import { Location, Waypoint } from '@/types';
import { getShareableUrl } from '@/lib/urlEncoding';

interface ShareButtonProps {
  startPoint: Location | null;
  endPoint: Location | null;
  waypoints: Waypoint[];
}

export default function ShareButton({ startPoint, endPoint, waypoints }: ShareButtonProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [copied, setCopied] = useState(false);

  // Check if there's anything to share
  const hasRoute = startPoint || endPoint || waypoints.length > 0;

  if (!hasRoute) {
    return null;
  }

  const shareableUrl = getShareableUrl({ startPoint, endPoint, waypoints });

  const handleShare = () => {
    setShowPopup(true);
    setCopied(false);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = shareableUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleClosePopup = () => {
    setShowPopup(false);
    setCopied(false);
  };

  return (
    <>
      <button
        onClick={handleShare}
        className="w-full px-4 py-2 text-white rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
        style={{ backgroundColor: '#36399a' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2d3185'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#36399a'}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        Share Route
      </button>

      {showPopup && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={handleClosePopup}
          />
          
          {/* Popup */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Share Route</h3>
                <button
                  onClick={handleClosePopup}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shareable Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareableUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2"
                    style={{ 
                      '--tw-ring-color': '#36399a',
                    } as React.CSSProperties & { '--tw-ring-color': string }}
                    onFocus={(e) => {
                      e.currentTarget.style.boxShadow = '0 0 0 2px #36399a';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = '';
                    }}
                  />
                  <button
                    onClick={handleCopyToClipboard}
                    className="px-4 py-2 rounded-lg font-medium text-sm transition-colors text-white"
                    style={copied 
                      ? { backgroundColor: '#fee012', color: '#000' }
                      : { backgroundColor: '#36399a' }
                    }
                    onMouseEnter={(e) => {
                      if (!copied) {
                        e.currentTarget.style.backgroundColor = '#2d3185';
                      } else {
                        e.currentTarget.style.backgroundColor = '#e5cd0f';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!copied) {
                        e.currentTarget.style.backgroundColor = '#36399a';
                      } else {
                        e.currentTarget.style.backgroundColor = '#fee012';
                      }
                    }}
                  >
                    {copied ? (
                      <>
                        <svg
                          className="w-5 h-5 inline-block mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5 inline-block mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Anyone with this link can view and use your route.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

