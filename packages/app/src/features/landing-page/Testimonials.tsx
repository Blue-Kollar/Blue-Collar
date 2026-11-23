'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

const TESTIMONIALS = [
  {
    id: 1,
    name: 'Sarah Johnson',
    role: 'Homeowner',
    content:
      'Found an amazing electrician through BlueCollar. Professional, reliable, and fair pricing. Highly recommend!',
    rating: 5,
    avatar: '👩‍💼',
  },
  {
    id: 2,
    name: 'Marcus Chen',
    role: 'Plumber',
    content:
      'BlueCollar helped me reach more customers. The platform is easy to use and payments are secure.',
    rating: 5,
    avatar: '👨‍🔧',
  },
  {
    id: 3,
    name: 'Amara Okafor',
    role: 'Business Owner',
    content:
      'We use BlueCollar for all our maintenance needs. Consistent quality and quick response times.',
    rating: 5,
    avatar: '👩‍💼',
  },
];

export default function Testimonials() {
  const t = useTranslations('testimonials');

  return (
    <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{t('title')}</h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="text-3xl">{testimonial.avatar}</div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{testimonial.role}</p>
                </div>
              </div>

              <div className="flex gap-1 mb-3">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                &ldquo;{testimonial.content}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
