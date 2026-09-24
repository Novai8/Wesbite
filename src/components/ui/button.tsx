import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("btn", {
  variants: {
    variant: {
      primary: "btn-primary",
      secondary: "btn-secondary",
      ghost: "btn-ghost",
      outline: "btn-outline",
    },
    size: {
      default: "h-12 px-5 text-[15px]",
      sm: "h-10 px-3.5 text-sm",
      icon: "h-10 w-10 px-0",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "default",
  },
});

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  const isPrimary = (variant ?? "primary") === "primary";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
      {...(isPrimary ? { "data-cursor": "hover invert" } : {})}
    />
  );
}
