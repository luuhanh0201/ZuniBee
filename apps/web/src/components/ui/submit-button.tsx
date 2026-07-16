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
      className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 py-3 font-semibold text-on-primary shadow-brutal-sm transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px hover:bg-primary-hover hover:shadow-brutal-md active:translate-y-0 active:shadow-brutal-xs disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring motion-reduce:transform-none"
    >
      {isSubmitting ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      ) : null}
      {isSubmitting ? loadingLabel : label}
    </button>
  );
}
