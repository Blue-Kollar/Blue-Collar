"use client";

import { useState } from "react";
import { Eye, EyeOff, Star, MapPin, Phone, Mail, Wallet } from "lucide-react";
import { cn, formatStellarAddress } from "@/lib/utils";
import type { PortfolioImage } from "@/components/PortfolioGallery";
import VerificationBadges from "@/components/VerificationBadges";

interface Props {
  name: string;
  bio?: string;
  categoryName?: string;
  phone?: string;
  email?: string;
  walletAddress?: string;
  avatarUrl?: string | null;
  isVerified: boolean;
  averageRating?: number | null;
  reviewCount?: number;
  portfolioImages: PortfolioImage[];
  className?: string;
}

export default function ProfilePreview({
  name,
  bio,
  categoryName,
  phone,
  email,
  walletAddress,
  avatarUrl,
  isVerified,
  averageRating,
  reviewCount = 0,
  portfolioImages,
  className,
}: Props) {
  const [visible, setVisible] = useState(true);

  return (
    <div className={cn("rounded-xl border bg-white shadow-sm", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-800">Live Preview</h3>
        <button
          onClick={() => setVisible((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          {visible ? <EyeOff size={13} /> : <Eye size={13} />}
          {visible ? "Hide" : "Show"}
        </button>
      </div>

      {visible && (
        <div className="p-4">
          <div className="rounded-xl border bg-gradient-to-b from-blue-50/50 to-white p-4">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gray-100">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={name || "Profile"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold text-gray-300">
                    {(name || "?")[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-base font-bold text-gray-900 truncate">
                  {name || "Worker Name"}
                </h4>
                {categoryName && (
                  <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    {categoryName}
                  </span>
                )}
                <div className="mt-1 flex items-center gap-2">
                  {averageRating !== null && averageRating !== undefined && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-600">
                      <Star size={12} fill="currentColor" />
                      {averageRating.toFixed(1)}
                      <span className="text-gray-400">({reviewCount})</span>
                    </span>
                  )}
                  <VerificationBadges
                    isVerified={isVerified}
                    hasPhone={!!phone}
                    hasEmail={!!email}
                    hasWallet={!!walletAddress}
                    hasAvatar={!!avatarUrl}
                    compact
                  />
                </div>
              </div>
            </div>

            {/* Bio */}
            {bio && (
              <p className="mt-3 text-xs text-gray-600 leading-relaxed line-clamp-3">
                {bio}
              </p>
            )}

            {/* Contact info */}
            <div className="mt-3 space-y-1">
              {phone && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Phone size={11} />
                  <span>{phone}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Mail size={11} />
                  <span>{email}</span>
                </div>
              )}
              {walletAddress && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Wallet size={11} />
                  <span>{formatStellarAddress(walletAddress)}</span>
                </div>
              )}
            </div>

            {/* Portfolio thumbnails */}
            {portfolioImages.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                  Portfolio
                </p>
                <div className="flex gap-1.5 overflow-hidden">
                  {portfolioImages.slice(0, 4).map((img) => (
                    <div
                      key={img.id}
                      className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.caption ?? "Portfolio"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                  {portfolioImages.length > 4 && (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                      +{portfolioImages.length - 4}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="mt-2 text-center text-[10px] text-gray-400">
            This is how clients will see your profile
          </p>
        </div>
      )}
    </div>
  );
}
