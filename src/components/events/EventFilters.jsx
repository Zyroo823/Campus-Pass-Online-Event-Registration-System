/**
 * Event Filters Component
 * Plain JavaScript
 * FR-005: Search events by keyword and filter by category, date range, and seat availability
 */

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, RotateCcw } from 'lucide-react';

const CATEGORIES = [
  'All Categories',
  'Academic',
  'Sports',
  'Arts & Culture',
  'Career & Networking',
  'Community & Service',
  'Technology & STEM',
];

export const EventFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const keyword = searchParams.get('keyword') || '';
  const category = searchParams.get('category') || '';
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';
  const availableOnly = searchParams.get('available_only') === 'true';

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'All Categories') {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const resetFilters = () => {
    const when = searchParams.get('when');
    const next = new URLSearchParams();
    if (when) next.set('when', when);
    setSearchParams(next);
  };

  const hasActiveFilters = Boolean(keyword || category || startDate || endDate || availableOnly);

  return (
    <section
      aria-label="Event search and filters"
      className="bg-paper border-2 border-ink shadow-hard p-4 sm:p-5 mb-6"
    >
      <div className="flex flex-col gap-4">
        {/* Keyword Search Input */}
        <div className="relative">
          <label htmlFor="event-search" className="block text-xs font-mono font-bold uppercase text-ink mb-1">
            Search Events
          </label>
          <div className="relative">
            <input
              id="event-search"
              type="text"
              data-testid="search-input"
              value={keyword}
              onChange={e => updateParam('keyword', e.target.value)}
              placeholder="Search by title, topic, or venue"
              className="w-full pl-10 pr-4 py-2 border-2 border-ink bg-paper-light text-sm font-body text-ink placeholder:text-[#524C40] focus:bg-paper"
            />
            <Search className="w-4 h-4 text-[#38342B] absolute left-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Category Quick Chips (FR-005) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-mono font-bold uppercase text-ink mr-1">Categories:</span>
          {CATEGORIES.map(cat => {
            const isSelected = (cat === 'All Categories' && (!category || category === 'All Categories')) || category === cat;
            return (
              <button
                key={cat}
                type="button"
                data-testid={`category-chip-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                onClick={() => updateParam('category', cat)}
                className={`px-2.5 py-1 text-xs font-mono transition-colors border-2 border-ink cursor-pointer ${
                  isSelected
                    ? 'bg-ink text-paper font-bold shadow-hard-sm'
                    : 'bg-paper text-ink hover:bg-paper-dark'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Filter controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Category Select */}
          <div>
            <label htmlFor="filter-category" className="block text-xs font-mono font-bold text-ink mb-1">
              Category
            </label>
            <select
              id="filter-category"
              data-testid="filter-category"
              value={category || 'All Categories'}
              onChange={e => updateParam('category', e.target.value)}
              className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-xs font-mono text-ink focus:bg-paper cursor-pointer"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label htmlFor="filter-start-date" className="block text-xs font-mono font-bold text-ink mb-1">
              From Date
            </label>
            <input
              id="filter-start-date"
              type="date"
              data-testid="filter-start-date"
              value={startDate}
              onChange={e => updateParam('start_date', e.target.value)}
              className="w-full px-3 py-1.5 border-2 border-ink bg-paper-light text-xs font-mono text-ink focus:bg-paper"
            />
          </div>

          {/* End Date */}
          <div>
            <label htmlFor="filter-end-date" className="block text-xs font-mono font-bold text-ink mb-1">
              To Date
            </label>
            <input
              id="filter-end-date"
              type="date"
              data-testid="filter-end-date"
              value={endDate}
              onChange={e => updateParam('end_date', e.target.value)}
              className="w-full px-3 py-1.5 border-2 border-ink bg-paper-light text-xs font-mono text-ink focus:bg-paper"
            />
          </div>

          {/* Seat Availability & Reset */}
          <div className="flex flex-col justify-end gap-2">
            <label
              htmlFor="filter-available-only"
              className="flex items-center gap-2 text-xs font-mono font-bold text-ink cursor-pointer pt-2 select-none"
            >
              <input
                id="filter-available-only"
                type="checkbox"
                data-testid="filter-available-only"
                checked={availableOnly}
                onChange={e => updateParam('available_only', e.target.checked ? 'true' : null)}
                className="w-4 h-4 border-2 border-ink text-vermilion rounded-none cursor-pointer focus:ring-0"
              />
              <span>Seats available only</span>
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                data-testid="reset-filters-btn"
                onClick={resetFilters}
                className="self-start text-xs font-mono text-[#B83210] hover:underline flex items-center gap-1 cursor-pointer pt-0.5 font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset all filters</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
