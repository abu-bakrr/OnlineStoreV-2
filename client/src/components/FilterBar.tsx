import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SearchWithSuggestions from "./SearchWithSuggestions";

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
}

interface FilterBarProps {
  categories?: { id: string; name: string; icon?: string }[];
  selectedCategory?: string;
  selectedSort?: string;
  priceFrom?: string;
  priceTo?: string;
  searchQuery?: string;
  products?: Product[];
  isLoadingProducts?: boolean;
  onCategoryChange?: (category: string) => void;
  onSortChange?: (sort: string) => void;
  onPriceFromChange?: (price: string) => void;
  onPriceToChange?: (price: string) => void;
  onSearchChange?: (query: string) => void;
  onProductClick?: (id: string) => void;
  onReset?: () => void;
}

const sortOptions = [
  { id: "old", label: "Сначала старые" },
  { id: "new", label: "Сначала новые" },
  { id: "price-asc", label: "Дешевые" },
  { id: "price-desc", label: "Дорогие" },
];

export default function FilterBar({
  categories = [],
  selectedCategory = "all",
  selectedSort = "old",
  priceFrom = "",
  priceTo = "",
  searchQuery = "",
  products = [],
  isLoadingProducts = false,
  onCategoryChange,
  onSortChange,
  onPriceFromChange,
  onPriceToChange,
  onSearchChange,
  onProductClick,
  onReset,
}: FilterBarProps) {

  const hasActiveFilters = selectedCategory !== "all" || priceFrom !== "" || priceTo !== "" || selectedSort !== "old" || searchQuery !== "";

  return (
    <div className="sticky top-[61px] md:top-[69px] z-40 bg-background border-b border-border py-3 md:py-4" data-testid="filter-bar">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Search Bar with Suggestions */}
        <div className="mb-3">
          <SearchWithSuggestions
            products={products}
            searchQuery={searchQuery}
            onSearchChange={(query) => onSearchChange?.(query)}
            onProductClick={(id) => onProductClick?.(id)}
            isLoading={isLoadingProducts}
          />
        </div>

        {/* Filters */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-1 min-w-max items-center">
            {/* Categories */}
            <Button
              size="sm"
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => onCategoryChange?.("all")}
              className="rounded-full whitespace-nowrap"
              data-testid="filter-category-all"
            >
              Все
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                size="sm"
                variant={selectedCategory === cat.id ? "default" : "outline"}
                onClick={() => onCategoryChange?.(cat.id)}
                className="rounded-full whitespace-nowrap gap-1"
                data-testid={`filter-category-${cat.id}`}
              >
                {cat.icon && <span>{cat.icon}</span>}
                <span>{cat.name}</span>
              </Button>
            ))}

            {/* Price Range */}
            <div className="flex gap-1 items-center ml-2">
              <input
                type="number"
                placeholder="От"
                value={priceFrom}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d+$/.test(value)) {
                    onPriceFromChange?.(value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E' || e.key === '.') {
                    e.preventDefault();
                  }
                }}
                className="w-20 h-8 px-2 text-sm border border-border rounded-md bg-background focus:outline-none"
                data-testid="input-price-from"
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="number"
                placeholder="До"
                value={priceTo}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d+$/.test(value)) {
                    onPriceToChange?.(value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E' || e.key === '.') {
                    e.preventDefault();
                  }
                }}
                className="w-20 h-8 px-2 text-sm border border-border rounded-md bg-background focus:outline-none"
                data-testid="input-price-to"
              />
            </div>

            {/* Sort with Shadcn Select */}
            <Select value={selectedSort} onValueChange={onSortChange}>
              <SelectTrigger 
                className="w-[110px] h-8 rounded-full text-sm ml-2 focus:outline-none focus:!ring-0 focus:!ring-offset-0" 
                data-testid="filter-sort"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" sideOffset={4}>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reset Button */}
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onReset}
                className="rounded-full gap-1 ml-2"
                data-testid="button-reset-filters"
              >
                <X className="w-4 h-4" />
                Сбросить
              </Button>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
