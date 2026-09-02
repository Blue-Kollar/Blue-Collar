"use client";

import { BadgeCheck, MapPin, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useCompare } from "@/context/CompareContext";
import type { Worker } from "@/types";

import BookmarkButton from "./BookmarkButton";
import StarRating from "./StarRating";

interface WorkerCardProps {
  worker: Worker;
  variant?: "standard" | "compact" | "featured";
}

export default function WorkerCard({ worker, variant = "standard" }: WorkerCardProps) {
  const t = useTranslations("workerCard");
  const { toggle, isSelected, isFull } = useCompare();
  const checked = isSelected(worker.id);

  const initials = worker.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Compact variant - minimal information
  if (variant === "compact") {
    return (
      <Link href={`/workers/${worker.id}`}>
        <div className="relative group flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-300">
          {worker.avatar ? (
            <Image
              src={worker.avatar}
              alt={worker.name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-xs">
              {initials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 font-semibold text-gray-800 truncate text-sm">
              <span className="truncate">{worker.name}</span>
              {worker.isVerified && (
                <BadgeCheck size={14} className="shrink-0 text-blue-500" aria-label={t("verified")} />
              )}
            </div>
            <span className="text-xs text-gray-500">{worker.category.name}</span>
          </div>

          {worker.averageRating != null && (
            <div className="flex items-center gap-0.5 shrink-0">
              <StarRating rating={worker.averageRating} size="sm" />
              <span className="text-xs text-gray-500">{worker.averageRating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </Link>
    );
  }

  // Featured variant - highlighted with more prominence
  if (variant === "featured") {
    return (
      <div className="relative group flex flex-col gap-4 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-md transition-all duration-200 hover:shadow-lg hover:border-blue-400">
        {/* Featured badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
          <Zap size={12} />
          {t("featured")}
        </div>

        {/* Compare checkbox */}
        <label
          className="absolute bottom-3 right-3 flex items-center gap-1.5 cursor-pointer z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={checked}
            disabled={!checked && isFull}
            onChange={() => toggle(worker)}
            className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
            aria-label={`Compare ${worker.name}`}
          />
          <span className="text-xs text-gray-500 select-none">{t("compare")}</span>
        </label>

        <Link href={`/workers/${worker.id}`} className="flex flex-col gap-4">
          {/* Avatar + name + category */}
          <div className="flex items-start gap-4">
            {worker.avatar ? (
              <Image
                src={worker.avatar}
                alt={worker.name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover ring-3 ring-blue-200"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-200 text-blue-700 font-bold text-xl">
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-bold text-gray-900 text-lg truncate">
                <span className="truncate">{worker.name}</span>
                {worker.isVerified && (
                  <BadgeCheck size={18} className="shrink-0 text-blue-600" aria-label="Verified" />
                )}
              </div>
              <span className="mt-1 inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                {worker.category.name}
              </span>
            </div>
          </div>

          {/* Rating - prominent */}
          {worker.averageRating != null && (
            <div className="flex items-center gap-2 bg-white rounded-lg p-3">
              <StarRating rating={worker.averageRating} />
              <span className="font-semibold text-gray-800">
                {worker.averageRating.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">({worker.reviewCount} {t("reviews")})</span>
            </div>
          )}

          {/* Bio */}
          {worker.bio && (
            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{worker.bio}</p>
          )}

          {/* Location */}
          {worker.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={14} className="shrink-0" />
              <span>{worker.location}</span>
            </div>
          )}

          <div className="mt-auto pt-2">
            <span className="inline-block w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white transition-colors group-hover:bg-blue-700">
                {t("viewProfile")}
              </span>
          </div>
        </Link>
      </div>
    );
  }

  // Standard variant (default)
  return (
    <div className="relative group flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      {/* Compare checkbox */}
      <label
        className="absolute top-3 right-3 flex items-center gap-1.5 cursor-pointer z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={!checked && isFull}
          onChange={() => toggle(worker)}
          className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
          aria-label={`Compare ${worker.name}`}
        />
        <span className="text-xs text-gray-500 select-none">Compare</span>
      </label>

      <Link href={`/workers/${worker.id}`} className="flex flex-col gap-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          {worker.avatar ? (
            <Image
              src={worker.avatar}
              alt={worker.name}
              width={56}
              height={56}
              className="h-14 w-14 rounded-full object-cover ring-2 ring-blue-100"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-lg">
              {initials}
            </div>
          )}

          <div className="min-w-0 flex-1 pr-16">
            <div className="flex items-center gap-1.5 font-semibold text-gray-800 truncate">
              <span className="truncate">{worker.name}</span>
              {worker.isVerified && (
                <BadgeCheck size={16} className="shrink-0 text-blue-500" aria-label="Verified" />
              )}
            </div>
            <span className="mt-0.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
              {worker.category.name}
            </span>
          </div>

          <BookmarkButton workerId={worker.id} />
        </div>

        {/* Rating - prominent in standard view */}
        {worker.averageRating != null && (
          <div className="flex items-center gap-1.5">
            <StarRating rating={worker.averageRating} />
            <span className="text-xs text-gray-500">
              {worker.averageRating.toFixed(1)} ({worker.reviewCount})
            </span>
          </div>
        )}

        {worker.bio && (
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{worker.bio}</p>
        )}

        {worker.location && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin size={12} aria-hidden="true" />
            <span>{worker.location}</span>
          </div>
        )}

        <div className="mt-auto pt-1">
          <span className="inline-block w-full rounded-md border border-blue-600 py-1.5 text-center text-sm font-medium text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
            {t("viewProfile")}
          </span>
        </div>
      </Link>
    </div>
  );
}
