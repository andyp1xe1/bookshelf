import { SignedIn } from "@clerk/clerk-react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import * as React from "react"
import { useDebounce } from "use-debounce"

import {
  listBooksOptions,
  searchBooksOptions,
} from "@/client/@tanstack/react-query.gen"
import type { Book } from "@/client/types.gen"
import { BookCard } from "@/components/books/book-card"
import { BookCardSkeleton } from "@/components/books/book-card-skeleton"
import { BookDetailDialog } from "@/components/books/book-detail-dialog"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const sortOptions = [
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "year", label: "Published year" },
] as const

type SortKey = (typeof sortOptions)[number]["value"]

const sortBooks = (books: Book[], sortKey: SortKey) => {
  const sorted = [...books]
  sorted.sort((first, second) => {
    if (sortKey === "year") {
      const firstYear = Number.parseInt(first.publishedYear, 10) || 0
      const secondYear = Number.parseInt(second.publishedYear, 10) || 0
      return secondYear - firstYear
    }

    if (sortKey === "author") {
      return first.author.localeCompare(second.author)
    }

    return first.title.localeCompare(second.title)
  })
  return sorted
}

export function HomePage() {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500)
  const [sortKey, setSortKey] = React.useState<SortKey>("title")
  const [selectedBook, setSelectedBook] = React.useState<Book | null>(null)

  const normalizedSearch = debouncedSearchTerm.trim()
  const isSearching = normalizedSearch.length > 0
  const isDebouncing = searchTerm.trim() !== debouncedSearchTerm.trim()

  const listQuery = useQuery(
    listBooksOptions({ query: { limit: 12, offset: 0 } })
  )
  const searchQuery = useQuery({
    ...searchBooksOptions({
      query: { q: normalizedSearch, limit: 12, offset: 0 },
    }),
    enabled: isSearching,
  })

  const activeQuery = isSearching ? searchQuery : listQuery
  const activeItems = activeQuery.data?.items ?? []
  const books = React.useMemo(
    () => sortBooks(activeItems, sortKey),
    [activeItems, sortKey]
  )
  const total = activeQuery.data?.total ?? 0
  const errorMessage =
    activeQuery.error instanceof Error
      ? activeQuery.error.message
      : "Unable to load books right now."

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary pb-2">
              Chillguys present
            </h1>
            <p className="text-sm text-muted-foreground">
              A shared digital library · {total} {total === 1 ? "book" : "books"}
            </p>
          </div>
          <SignedIn>
            <Link to="/books/new">
              <Button>Create Book</Button>
            </Link>
          </SignedIn>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Find a book</CardTitle>
            <CardDescription>
              Search by title or author, then refine your sort order.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1.5fr_0.8fr_auto]">
            <Field>
              <FieldLabel htmlFor="search-books">Search</FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">Find</InputGroupAddon>
                <InputGroupInput
                  id="search-books"
                  placeholder="e.g. The Fellowship of the Ring"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                {searchTerm ? (
                  <InputGroupButton
                    type="button"
                    variant="ghost"
                    onClick={() => setSearchTerm("")}
                  >
                    Clear
                  </InputGroupButton>
                ) : null}
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="sort-books">Sort by</FieldLabel>
              <Select
                value={sortKey}
                onValueChange={(value) => setSortKey(value as SortKey)}
              >
                <SelectTrigger id="sort-books">
                  <SelectValue placeholder="Pick a sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="default"
                onClick={() => activeQuery.refetch()}
              >
                Refresh
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSearchTerm("")}
                disabled={!searchTerm}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {isSearching
              ? `Searching for "${normalizedSearch}"`
              : `Showing ${books.length} of ${total} books`}
          </div>
          <div className="flex items-center gap-2">
            {(isDebouncing || activeQuery.isFetching) &&
              <div
                className={`h-2 w-2 rounded-full bg-yellow-500 animate-pulse`}
              />
            }
            {isDebouncing
              ? "Typing..."
              : activeQuery.isFetching
                ? "Loading..."
                : "Result loaded"}
          </div>
        </div>

        <Separator />

        {activeQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <BookCardSkeleton key={index} />
            ))}
          </div>
        ) : activeQuery.isError ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">
              {errorMessage}
            </CardContent>
          </Card>
        ) : books.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No books match that search yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onOpenDetail={setSelectedBook}
              />
            ))}
          </div>
        )}

        <BookDetailDialog
          book={selectedBook}
          open={selectedBook !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedBook(null)
          }}
        />
      </div>
    </AppLayout>
  )
}
