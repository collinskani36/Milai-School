// src/Components/Admin/AdminErrorBoundary.tsx
import React from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/Components/ui/button';

interface BoundaryProps {
  children: React.ReactNode;
  queryClient: QueryClient;
  /** When this value changes (e.g. the user switches sidebar tab) the error state clears. */
  resetKey?: string;
}

interface BoundaryState {
  error: Error | null;
}

class Boundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // This is the line that tells us the real cause of the white screen.
    console.error('[AdminErrorBoundary] render crash:', error, info.componentStack);
  }

  componentDidUpdate(prev: BoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  handleRetry = () => {
    // Drop cached data so a bad cache entry can't re-trigger the same crash.
    this.props.queryClient.clear();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
        <p className="font-semibold text-red-700">This section hit an error</p>
        <p className="text-xs mt-1 text-red-400 break-words">{error.message}</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-red-200 text-red-700 hover:bg-red-100"
            onClick={this.handleRetry}
          >
            Try again
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-red-200 text-red-700 hover:bg-red-100"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </div>
      </div>
    );
  }
}

export default function AdminErrorBoundary({
  children,
  resetKey,
}: {
  children: React.ReactNode;
  resetKey?: string;
}) {
  const queryClient = useQueryClient();
  return (
    <Boundary queryClient={queryClient} resetKey={resetKey}>
      {children}
    </Boundary>
  );
}
