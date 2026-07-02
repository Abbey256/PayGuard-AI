// Feature: liveness-verification
// VerificationPage — public worker-facing verification page (Task 8.1)
// Accessed via /verify/:token — no Supabase auth required.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { LivenessScanner, VerificationResult } from '../../components/liveness/LivenessScanner';
import { ChallengeType } from '../../components/liveness/challengeEngine';

type PageState = 'loading' | 'ready' | 'error' | 'done';

interface WorkerInfo {
  workerName: string;
  organizationName: string;
  photoUrl?: string;
  challengeNonce?: string;
  challengeSequence?: ChallengeType[];
}

export default function VerificationPage() {
  const { token } = useParams<{ token: string }>();

  const [pageState, setPageState] = useState<PageState>(() =>
    token ? 'loading' : 'error'
  );
  const [workerInfo, setWorkerInfo] = useState<WorkerInfo | null>(null);
  const [errorText, setErrorText] = useState(
    'This verification link is invalid or has expired.'
  );
  const [result, setResult] = useState<VerificationResult | null>(null);

  // -------------------------------------------------------------------------
  // Validate token on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!token) return; // already set to 'error'

    const controller = new AbortController();

    async function validate() {
      try {
        let apiUrl = import.meta.env.VITE_API_URL || '';
        if (!apiUrl || apiUrl.startsWith('/')) {
          apiUrl = window.location.origin;
        }
        
        // Handle Mixed Content: if page is HTTPS, force API to HTTPS 
        if (window.location.protocol === 'https:' && apiUrl.startsWith('http://') && !apiUrl.includes('localhost')) {
          apiUrl = apiUrl.replace('http://', 'https://');
        }

        const resp = await fetch(`${apiUrl}/api/verify/${token}`, {
          signal: controller.signal,
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          setErrorText(
            body.message ?? 'This verification link is invalid or has expired.'
          );
          setPageState('error');
          return;
        }

        const data = await resp.json();
        
        // If staff has no photo, we cannot do face matching — block immediately
        if (!data.photoUrl) {
          setErrorText('Your verification photo has not been uploaded by your HR department. Please contact HR to add your photo before verification can proceed.');
          setPageState('error');
          return;
        }

        setWorkerInfo({
          workerName: data.workerName ?? 'Employee',
          organizationName: data.organizationName ?? 'Your Organisation',
          photoUrl: data.photoUrl,
          challengeNonce: data.challengeNonce,
          challengeSequence: data.challengeSequence,
        });
        setPageState('ready');
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setErrorText('This verification link is invalid or has expired.');
        setPageState('error');
      }
    }

    validate();
    return () => controller.abort();
  }, [token]);

  // -------------------------------------------------------------------------
  // onComplete from LivenessScanner
  // -------------------------------------------------------------------------
  const handleComplete = (scanResult: VerificationResult) => {
    setResult(scanResult);
    setPageState('done');
  };

  // -------------------------------------------------------------------------
  // Shared outer wrapper styles
  // -------------------------------------------------------------------------
  const outerStyle: React.CSSProperties = {
    minHeight: '100dvh',
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  if (pageState === 'loading') {
    return (
      <div style={outerStyle}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{
            width: '48px', height: '48px', border: '3px solid #1e293b',
            borderTop: '3px solid #22c55e', borderRadius: '50%',
            margin: '0 auto 1rem', animation: 'spin 1s linear infinite',
          }} />
          <p style={{ fontSize: '0.95rem' }}>Validating your verification link…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error (invalid / expired / 4xx)
  // -------------------------------------------------------------------------
  if (pageState === 'error') {
    return (
      <div style={outerStyle}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          {/* Red X */}
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: '#7f1d1d', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 1.5rem',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <h1 style={{ color: '#f8fafc', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Link Unavailable
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>
            {errorText}
          </p>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '1.5rem' }}>
            Contact your HR department if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Done — show result screen
  // -------------------------------------------------------------------------
  if (pageState === 'done' && result) {
    const isVerified = result.verdict === 'verified';

    return (
      <div style={outerStyle}>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          {/* Icon */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: isVerified ? '#14532d' : '#7f1d1d',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}>
            {isVerified ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </div>

          {/* Heading */}
          <h1 style={{
            color: '#f8fafc', fontSize: '1.6rem', fontWeight: 700,
            marginBottom: '0.75rem',
          }}>
            {isVerified ? 'Verification Successful' : 'Verification Unsuccessful'}
          </h1>

          {/* Trust score badge */}
          <div style={{
            display: 'inline-block',
            background: isVerified ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${isVerified ? '#22c55e' : '#ef4444'}`,
            borderRadius: '999px', padding: '0.25rem 1rem',
            color: isVerified ? '#22c55e' : '#ef4444',
            fontSize: '0.85rem', fontWeight: 600,
            marginBottom: '1.25rem',
          }}>
            Trust Score: {result.trustScore}
          </div>

          {/* Message */}
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.7 }}>
            {isVerified
              ? 'Your salary will be processed shortly. You may now close this page.'
              : 'Please contact your HR department for assistance.'}
          </p>

          {/* PayGuard branding */}
          <p style={{ color: '#334155', fontSize: '0.7rem', marginTop: '2rem' }}>
            Verified by PayGuard AI · Secured biometric verification
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Ready — show worker info then LivenessScanner
  // -------------------------------------------------------------------------
  return (
    <div style={{ minHeight: '100dvh', background: '#0f172a' }}>
      {/* Worker info header bar */}
      {workerInfo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #1e293b',
          padding: '0.75rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 2C16 2 6 6 6 14c0 8 10 14 10 14s10-6 10-14c0-8-10-12-10-12z" fill="#16a34a" />
          </svg>
          <div style={{ flex: 1 }}>
            <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem' }}>
              {workerInfo.workerName}
            </span>
            <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
              · {workerInfo.organizationName}
            </span>
          </div>
        </div>
      )}

      {/* LivenessScanner fills the screen */}
      {token && (
        <LivenessScanner 
          token={token} 
          adminPhotoUrl={workerInfo?.photoUrl}
          challengeNonce={workerInfo?.challengeNonce}
          serverChallengeSequence={workerInfo?.challengeSequence}
          onComplete={handleComplete} 
        />
      )}
    </div>
  );
}
