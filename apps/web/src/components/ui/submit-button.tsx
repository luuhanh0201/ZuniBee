import { Loader2 } from "lucide-react";

type SubmitButtonProps = {
  isSubmitting: boolean;
  label: string;
  loadingLabel: string;
};

export function SubmitButton({
  isSubmitting,
  label,
  loadingLabel,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 py-3 font-bold text-foreground shadow-brutal-md transition-[transform,box-shadow] duration-200 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-xs disabled:cursor-not-allowed disabled:opacity-70 disabled:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {isSubmitting ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      ) : null}
      {isSubmitting ? loadingLabel : label}
    </button>
  );
}
