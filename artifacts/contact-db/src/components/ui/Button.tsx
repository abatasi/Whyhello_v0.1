import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "danger";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary/90 dark:bg-indigo-700 dark:text-white dark:hover:bg-indigo-800",
      secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-800",
      outline: "border border-border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground dark:bg-transparent dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white",
      ghost: "hover:bg-accent hover:text-accent-foreground text-muted-foreground dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white",
      link: "text-primary underline-offset-4 hover:underline dark:text-slate-100 dark:hover:text-white",
      danger: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 dark:bg-red-700 dark:text-white dark:hover:bg-red-800",
    };

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-12 rounded-lg px-8 text-base",
      icon: "h-10 w-10",
    };

    return (
      <button
        ref={ref}
        data-slot="button"
        disabled={isLoading || disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-[color,background-color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
