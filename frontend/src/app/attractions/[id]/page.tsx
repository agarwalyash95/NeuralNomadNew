'use client';

import { AttractionCard } from '@/components/ui-custom/attraction-card';
import GlassCard from '@/components/ui-custom/glass-card';
import { useAttractions } from '@/hooks/use-attractions';
import { Search, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';

// Mapped directly to Django's models.py CATEGORY_CHOICES
const CATEGORIES = [
  { id: 'All', label: 'All' },
  { id: 'museum', label: 'Museum' },
  { id: 'monument', label: 'Monument' },
  { id: 'temple', label: 'Temple' },
  { id: 'park', label: 'Park & Nature' },
  { id: 'beach', label: 'Beach' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'shopping', label: 'Shopping' },
];

export default function AttractionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search input by 500ms to prevent API spam
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1); // Reset to page 1 on category change
  };

  // Wire into the server-side API hook
  const { attractions, loading, hasNextPage, loadMore, totalCount } = useAttractions({
    search: debouncedSearch || undefined,
    category: selectedCategory === 'All' ? undefined : selectedCategory,
    // Page is handled by the initial load in the hook, then incremented via loadMore
  });

  const handleLoadMore = () => {
    if (hasNextPage) {
      loadMore(currentPage);
      setCurrentPage((prev) => prev + 1);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Hero Section */}
      <section className="relative h-[40vh] min-h-[300px] flex items-center justify-center">
        <div
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=2070&auto=format&fit=crop)',
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>

        <div className="container relative z-10 text-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Discover Local Wonders</h1>
          <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Find the best places to visit, eat, and explore on your journey.
          </p>

          {/* Search Bar */}
          <GlassCard className="max-w-2xl mx-auto p-2 rounded-full flex items-center">
            <div className="flex-1 flex items-center pl-4">
              <Search className="text-white/70 mr-2" size={20} />
              <input
                type="text"
                placeholder="Search attractions, cities..."
                className="w-full bg-transparent border-none text-white placeholder:text-white/70 focus:outline-none focus:ring-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-full font-medium transition-colors">
              Search
            </button>
          </GlassCard>
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold">Popular Attractions</h2>
            {!loading && totalCount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Showing {attractions.length} of {totalCount} results
              </p>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 w-full md:w-auto hide-scrollbar gap-2">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80 text-foreground'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results Grid */}
        {loading && attractions.length === 0 ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : attractions.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {attractions.map((attraction) => (
                <AttractionCard key={attraction.id} attraction={attraction} />
              ))}
            </div>

            {/* Pagination / Load More */}
            {hasNextPage && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-8 py-3 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-full transition-colors disabled:opacity-50 flex items-center"
                >
                  {loading ? (
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-foreground mr-2"></span>
                  ) : null}
                  {loading ? 'Loading...' : 'Load More Experiences'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 bg-secondary/30 rounded-2xl">
            <MapPin size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No attractions found</h3>
            <p className="text-muted-foreground">Try adjusting your search or category filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}
