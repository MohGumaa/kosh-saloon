'use client';
 
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

const InvoicesError = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-full flex-col items-center justify-center">
      <h2 className="text-center font-medium">حدث خطأ ما!</h2>
      <Button
        className="ks-btn ks-btn-primary text-white mt-4"
        onClick={
          // Attempt to recover by trying to re-render the invoices route
          () => reset()
        }
      >
        حاول مرة أخري
      </Button>
    </main>
  )
}

export default InvoicesError
