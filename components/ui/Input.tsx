import { cn } from "@/lib/utils";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[var(--text-secondary)] font-sans">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-3 text-sm font-sans bg-[var(--bg)] border border-[var(--border)]",
            "text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]",
            "focus:outline-none focus:border-[var(--accent)] transition-colors",
            error && "border-[var(--red)] focus:border-[var(--red)]",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-[var(--red)] font-sans">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-[var(--text-tertiary)] font-sans">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[var(--text-secondary)] font-sans">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full px-4 py-3 text-sm font-sans bg-[var(--bg)] border border-[var(--border)]",
            "text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]",
            "focus:outline-none focus:border-[var(--accent)] transition-colors",
            "resize-none leading-relaxed",
            error && "border-[var(--red)] focus:border-[var(--red)]",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-[var(--red)] font-sans">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-[var(--text-tertiary)] font-sans">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
