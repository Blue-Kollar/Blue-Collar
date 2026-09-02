'use client'

import { BadgeCheck, MapPin, Star } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { useCompare } from '@/context/CompareContext'
import type { Worker } from '@/types'

import BookmarkButton from './BookmarkButton'
import StarRating from './StarRating'

type CardVariant = 'compact' | 'standard' | 'featured'

interface WorkerCardVariantProps {
  worker: Worker
  variant?: CardVariant
}

export function CompactWorkerCard({ worker }: WorkerCardVariantProps) {
  const { toggle, isSelected, isFull } = useCompare()
  const checked = isSelected(worker.id)

  const initials = worker.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="relative group flex flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm transition-all duration-200 hover:shadow-md">
      <label
        className="absolute top-2 right-2 flex items-center gap-1 cursor-pointer z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={!checked && isFull}
          onChange={() => toggle(worker)}
          className="h-3 w-3 rounded border-gray-300 accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
          aria-label={`Compare ${worker.name}`}
        />
      </label>

      <Link href={`/workers/${worker.id}`} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {worker.avatar ? (
            <Image
              src={worker.avatar}
              alt={worker.name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover ring-1 ring-blue-100"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-xs">
              {initials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 font-semibold text-sm text-gray-800 truncate">
              <span className="truncate">{worker.name}</span>
              {worker.isVerified && <BadgeCheck size={14} className="shrink-0 text-blue-500" />}
            </div>
            <span className="text-xs text-gray-500">{worker.category.name}</span>
          </div>

          <BookmarkButton workerId={worker.id} />
        </div>

        {worker.averageRating != null && (
          <div className="flex items-center gap-1">
            <Star size={12} className="text-yellow-400 fill-yellow-400" />
            <span className="text-xs text-gray-600">
              {worker.averageRating.toFixed(1)} ({worker.reviewCount})
            </span>
          </div>
        )}
      </Link>
    </div>
  )
}

export function StandardWorkerCard({ worker }: WorkerCardVariantProps) {
  const { toggle, isSelected, isFull } = useCompare()
  const checked = isSelected(worker.id)

  const initials = worker.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="relative group flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
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

        {worker.averageRating != null && (
          <div className="flex items-center gap-1.5">
            <StarRating rating={worker.averageRating} />
            <span className="text-xs text-gray-400">
              {worker.averageRating.toFixed(1)} ({worker.reviewCount})
            </span>
          </div>
        )}

        {worker.bio && (
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{worker.bio}</p>
        )}

        {worker.location && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <MapPin size={12} />
            <span>{worker.location}</span>
          </div>
        )}

        <div className="mt-auto pt-1">
          <span className="inline-block w-full rounded-md border border-blue-600 py-1.5 text-center text-sm font-medium text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
            View Profile
          </span>
        </div>
      </Link>
    </div>
  )
}

export function FeaturedWorkerCard({ worker }: WorkerCardVariantProps) {
  const initials = worker.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <Link href={`/workers/${worker.id}`}>
      <div className="relative group flex flex-col gap-4 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-md transition-all duration-200 hover:shadow-xl hover:border-blue-400">
        {/* Status badge */}
        {worker.isActive && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
            <div className="h-2 w-2 rounded-full bg-green-600" />
            Active
          </div>
        )}

        {/* Avatar section */}
        <div className="flex items-start gap-4">
          {worker.avatar ? (
            <Image
              src={worker.avatar}
              alt={worker.name}
              width={80}
              height={80}
              className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-md"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-blue-200 text-blue-700 font-bold text-2xl ring-4 ring-white shadow-md">
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 truncate">{worker.name}</h3>
              {worker.isVerified && (
                <BadgeCheck size={20} className="shrink-0 text-blue-600" aria-label="Verified" />
              )}
            </div>

            <div className="mt-1 inline-block rounded-lg bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
              {worker.category.name}
            </div>

            {worker.averageRating != null && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={i < Math.round(worker.averageRating!) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-gray-700">
                  {worker.averageRating.toFixed(1)} ({worker.reviewCount} reviews)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {worker.bio && (
          <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">{worker.bio}</p>
        )}

        {/* Location */}
        {worker.location && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={16} className="shrink-0" />
            <span>{worker.location}</span>
          </div>
        )}

        {/* CTA */}
        <div className="mt-2 pt-4 border-t border-blue-100">
          <span className="inline-block w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white transition-colors group-hover:bg-blue-700">
            View Full Profile
          </span>
        </div>
      </div>
    </Link>
  )
}
