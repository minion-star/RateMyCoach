import { Search, Star, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CoachWithRating {
  id: number;
  name: string;
  sport: string;
  instagram: string | null;
  imageUrl: string | null;
  calculatedRating: string;
  feedbackCount: number;
}

export function SearchHero() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: stats } = useQuery<{ coachCount: number; athleteCount: number }>({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: searchResults, isLoading } = useQuery<CoachWithRating[]>({
    queryKey: ["/api/coaches-with-ratings", searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];
      const res = await fetch(`/api/coaches-with-ratings?search=${encodeURIComponent(searchTerm)}`);
      if (!res.ok) throw new Error("Failed to fetch coaches");
      return res.json();
    },
    enabled: searchTerm.trim().length > 0,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchTerm.trim()) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, [searchTerm]);

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setShowResults(false);
  };

  return (
    <div className="relative py-16 md:py-24 lg:py-32 bg-[#F9F9F9] border-b border-black/5 overflow-hidden">
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-bl from-yellow-500/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/4 h-2/3 bg-gradient-to-tr from-gray-200/40 to-transparent pointer-events-none rounded-tr-[100px]" />
{/* LEFT NATIVE AD */}
<div className="hidden xl:flex absolute left-4 top-0 h-full w-[14.285%] items-center justify-center z-0">
  <a href="https://hga.com" target="_blank" className="w-full h-full flex items-center justify-center">
    <img
      src="/ads/left-ad.jpg"
      className="w-full h-[500px] object-cover opacity-40 hover:opacity-70 transition rounded-lg"
    />
  </a>
</div>

{/* RIGHT NATIVE AD */}
<div className="hidden xl:flex absolute right-4 top-0 h-full w-[14.285%] items-center justify-center z-0">
  <a href="https://hga.com" target="_blank" className="w-full h-full flex items-center justify-center">
    <img
      src="/ads/right-ad.jpg"
      className="w-full h-[500px] object-cover opacity-40 hover:opacity-70 transition rounded-lg"
    />
  </a>
</div>

      <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center max-w-4xl">
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#202020] tracking-tight mb-4"
        >
          Rate My Coach
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="text-lg md:text-xl text-[#666666] mb-10 max-w-2xl font-medium"
        >
          Read real, honest reviews from athletes before you commit. 
          Find the perfect mentor for your journey.
        </motion.p>

        <motion.div 
          ref={searchRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="w-full max-w-2xl relative"
        >
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Search by coach name"
              className="w-full h-14 pl-12 pr-12 rounded-full border border-gray-200 shadow-sm 
                       focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 
                       text-lg transition-all duration-200 placeholder:text-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => searchTerm.trim() && setShowResults(true)}
              data-testid="input-search"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600"
                data-testid="button-clear-search"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {showResults && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
                data-testid="search-results-dropdown"
              >
                {isLoading ? (
                  <div className="p-4 text-center text-gray-500">
                    <div className="animate-spin w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-2"></div>
                    Searching...
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  <div className="max-h-80 overflow-y-auto">
                    {searchResults.map((coach) => (
                      <Link 
                        key={coach.id} 
                        href={`/coach/${coach.id}`}
                        onClick={() => setShowResults(false)}
                      >
                        <div 
                          className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-b-0"
                          data-testid={`search-result-${coach.id}`}
                        >
                          <Avatar className="h-12 w-12 border border-gray-200">
                            <AvatarImage src={coach.imageUrl || undefined} alt={coach.name} />
                            <AvatarFallback className="bg-[#F5C518] text-[#202020] font-bold">
                              {getInitials(coach.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-left">
                            <h4 className="font-bold text-[#202020]">{coach.name}</h4>
                            {coach.instagram && (
                              <p className="text-sm text-[#666666]">@{coach.instagram}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-[#F5C518] text-[#F5C518]" />
                              <span className="font-bold text-[#333333]">{coach.calculatedRating}</span>
                            </div>
                            <span className="text-sm text-[#666666]">
                              {coach.feedbackCount} {coach.feedbackCount === 1 ? 'review' : 'reviews'}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-gray-500 mb-1">No coaches found</p>
                    <p className="text-sm text-gray-400">Try a different search term</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 flex items-center gap-4 text-sm font-semibold text-[#333333] bg-white px-6 py-3 rounded-full shadow-sm border border-gray-100"
          data-testid="stats-ticker"
        >
          <div className="flex items-center gap-2">
            <span className="text-[#F5C518] font-extrabold text-lg" data-testid="stats-coach-count">{stats?.coachCount ?? 0}</span>
            <span>Coaches</span>
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-[#F5C518] font-extrabold text-lg" data-testid="stats-athlete-count">{stats?.athleteCount ?? 0}</span>
            <span>Athletes</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
