'use client';

import { useTranslations } from 'next-intl';
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import ErrorState from '@/components/ErrorState';
import { logger } from '@/lib/logger';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}

interface FallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}

function buildReport(error: Error & { digest?: string }) {
  return {
    message: error.message,
    name: error.name,
    stack: error.stack,
    digest: error.digest,
    url: typeof window !== 'undefined' ? window.location.href : '',
    timestamp: new Date().toISOString(),
  };
}

function ErrorFallback({ error, reset, title, description }: FallbackProps) {
  const t = useTranslations('errors');
  const [reported, setReported] = useState(false);

  const handleReport = () => {
    const report = buildReport(error);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(report, null, 2)).catch(() => {});
    }
    setReported(true);
  };

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
      <ErrorState
        title={title ?? t('genericTitle')}
        message={description ?? t('genericDescription')}
        onRetry={reset}
        retryLabel={t('tryAgain')}
      />
      <div className="mt-5 flex flex-wrap items-center gap-3 justify-center">
        <button
          onClick={handleReport}
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {reported ? t('copiedToClipboard') : t('reportError')}
        </button>
      </div>
      {error.digest && (
        <p className="mt-4 text-xs text-gray-400 font-mono">
          {t('errorId', { digest: error.digest })}
        </p>
      )}
    </div>
  );
}

export default function ErrorBoundary({ error, reset, title, description }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorFallback error={error} reset={reset} title={title} description={description} />;
}

interface WrapperProps {
  children: ReactNode;
  title?: string;
  description?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface WrapperState {
  error: (Error & { digest?: string }) | null;
}

export class ErrorBoundaryWrapper extends Component<WrapperProps, WrapperState> {
  state: WrapperState = { error: null };

  static getDerivedStateFromError(error: Error): WrapperState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <ErrorFallback
          error={error}
          reset={this.reset}
          title={this.props.title}
          description={this.props.description}
        />
      );
    }
    return this.props.children;
  }
}
