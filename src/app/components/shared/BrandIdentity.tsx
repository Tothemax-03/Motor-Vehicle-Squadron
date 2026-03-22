import { useState } from "react";
import { Shield } from "lucide-react";
import { cn } from "../ui/utils";

const BRAND_LOGO_SRC = "/mvsm-logo.png";

interface BrandIdentityProps {
  collapsed?: boolean;
  eyebrow?: string;
  title?: string;
  wrapperClassName?: string;
  iconContainerClassName?: string;
  imageClassName?: string;
  eyebrowClassName?: string;
  titleClassName?: string;
  fallbackIconClassName?: string;
}

export function BrandIdentity({
  collapsed = false,
  eyebrow = "Motor Vehicle Squadron",
  title = "Management System",
  wrapperClassName,
  iconContainerClassName,
  imageClassName,
  eyebrowClassName,
  titleClassName,
  fallbackIconClassName,
}: BrandIdentityProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={cn("flex items-center gap-3", wrapperClassName)}>
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/95 p-1 shadow-lg",
          iconContainerClassName
        )}
      >
        {!imageFailed ? (
          <img
            src={BRAND_LOGO_SRC}
            alt="Motor Vehicle Squadron logo"
            className={cn("h-full w-full object-contain", imageClassName)}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Shield className={cn("h-6 w-6 text-[#1e6b3c]", fallbackIconClassName)} />
        )}
      </div>

      {!collapsed ? (
        <div className="overflow-hidden">
          <p
            className={cn(
              "truncate text-[11px] uppercase tracking-[0.16em] text-emerald-300",
              eyebrowClassName
            )}
          >
            {eyebrow}
          </p>
          <p className={cn("truncate text-sm text-white", titleClassName)}>{title}</p>
        </div>
      ) : null}
    </div>
  );
}
