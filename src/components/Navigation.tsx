import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PenSquare, User, LogOut, LogIn, UserPlus, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { getRecentSearches, addRecentSearch, removeRecentSearch } from '@/lib/searchUtils';
import { cn } from '@/lib/utils';

export const Navigation = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [, setRecentRefresh] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const recentSearches = getRecentSearches();
  const showDropdown = dropdownOpen && recentSearches.length > 0;

  const handleRemoveRecent = (e: React.MouseEvent, term: string) => {
    e.preventDefault();
    e.stopPropagation();
    removeRecentSearch(term);
    setRecentRefresh((r) => r + 1);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const goSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    addRecentSearch(trimmed);
    setSearchValue('');
    setDropdownOpen(false);
    setSelectedIndex(-1);
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < recentSearches.length) {
      goSearch(recentSearches[selectedIndex]);
    } else {
      goSearch(searchValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'Escape') setDropdownOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i < recentSearches.length - 1 ? i + 1 : i));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i > 0 ? i - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < recentSearches.length) {
      e.preventDefault();
      goSearch(recentSearches[selectedIndex]);
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
      setSelectedIndex(-1);
    }
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (q != null) setSearchValue(q);
  }, [searchParams]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchValue, recentSearches.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center gap-4">
          <Link
            to="/"
            className="shrink-0 text-4xl font-semibold tracking-tight text-foreground pb-2 hover:text-primary transition-colors duration-200"
          >
            myblog
          </Link>

          {/* 검색창 */}
          <div ref={containerRef} className="flex-1 max-w-xl min-w-0 relative">
            <form onSubmit={handleSearchSubmit} className="relative">
              {!searchValue && (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none shrink-0" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder=""
                className={cn(
                  'w-full h-11 pr-10 rounded-lg border bg-muted/30 text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                  searchValue ? 'pl-4' : 'pl-14'
                )}
                aria-label="검색"
                aria-autocomplete="list"
                aria-expanded={showDropdown}
                aria-controls="recent-search-list"
              />
              {searchValue.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchValue('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                  aria-label="검색어 지우기"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </form>

            {/* 최근 검색어 추천 */}
            {showDropdown && (
              <ul
                id="recent-search-list"
                className="absolute top-full left-0 right-0 mt-1 py-2 rounded-lg border bg-background shadow-lg z-50 max-h-60 overflow-y-auto"
                role="listbox"
              >
                <li className="px-3 py-2 text-xs text-muted-foreground border-b" role="presentation">
                  최근 검색어
                </li>
                {recentSearches.map((term, i) => (
                  <li key={`${term}-${i}`} role="option" aria-selected={selectedIndex === i}>
                    <div
                      className={cn(
                        'flex items-center gap-1 group px-4 py-2.5 text-sm hover:bg-muted/50 cursor-pointer',
                        selectedIndex === i && 'bg-muted'
                      )}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      <button
                        type="button"
                        onClick={() => goSearch(term)}
                        className="flex-1 min-w-0 text-left truncate"
                      >
                        {term}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveRecent(e, term)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 opacity-60 group-hover:opacity-100"
                        aria-label={`"${term}" 검색어 삭제`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-3 items-center shrink-0 ml-auto">
            {user ? (
              <>
                <Button
                  asChild
                  variant="default"
                  size="lg"
                  className="gap-2.5 h-12 px-7 rounded-xl text-base font-medium shadow-sm hover:shadow transition-shadow"
                >
                  <Link to="/write">
                    <PenSquare className="w-5 h-5 shrink-0" />
                    <span>글쓰기</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="gap-2.5 h-12 px-6 rounded-xl text-base font-medium border-muted-foreground/30 hover:bg-muted/50 hover:border-muted-foreground/50"
                >
                  <Link to="/mypage">
                    <User className="w-5 h-5 shrink-0" />
                    <span>{profile?.nickname || '프로필'}</span>
                  </Link>
                </Button>
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  size="lg"
                  className="gap-2.5 h-12 px-6 rounded-xl text-base font-medium border-muted-foreground/30 hover:bg-muted/50 hover:border-muted-foreground/50"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span>로그아웃</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="gap-2.5 h-12 px-6 rounded-xl text-base font-medium border-muted-foreground/30 hover:bg-muted/50"
                >
                  <Link to="/login">
                    <LogIn className="w-5 h-5 shrink-0" />
                    <span>로그인</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="gap-2.5 h-12 px-7 rounded-xl text-base font-medium shadow-sm hover:shadow transition-shadow"
                >
                  <Link to="/signup">
                    <UserPlus className="w-5 h-5 shrink-0" />
                    <span>회원가입</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
