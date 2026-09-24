"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogContent({
  className,
  children,
  variant = "modal",
  labelledBy,
}: {
  className?: string;
  children: React.ReactNode;
  variant?: "modal" | "drawer";
  labelledBy?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content
        className={cn(
          variant === "drawer" ? "dialog-drawer" : "dialog-modal",
          className,
        )}
        aria-labelledby={labelledBy}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogCloseButton({
  className,
  label = "Close",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <DialogPrimitive.Close
      className={cn("btn btn-ghost h-10 w-10 px-0", className)}
      aria-label={label}
    >
      <X className="h-4 w-4" aria-hidden />
    </DialogPrimitive.Close>
  );
}
