import * as React from "react"

import { useQuery } from "@tanstack/react-query"

import {
  listBooksOptions,
  searchBooksOptions,
} from "@/client/@tanstack/react-query.gen"
import type { Book } from "@/client/types.gen"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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

function BookCard({ book }: { book: Book }) {
  return (
    <Card size="sm" className="bg-background/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{book.title}</CardTitle>
            <CardDescription>{book.author}</CardDescription>
          </div>
          <Badge variant="secondary">{book.publishedYear}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-muted-foreground text-xs uppercase tracking-wide">
          ISBN
        </div>
        <div className="text-sm font-medium">{book.isbn}</div>
        {book.genre ? (
          <div className="flex flex-wrap gap-2">
            <Badge>{book.genre}</Badge>
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="text-muted-foreground text-xs">
        Catalog ID #{book.id}
      </CardFooter>
    </Card>
  )
}

function LibraryApp() {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [sortKey, setSortKey] = React.useState<SortKey>("title")

  const normalizedSearch = searchTerm.trim()
  const isSearching = normalizedSearch.length > 0

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
  const statusLabel = activeQuery.isFetching ? "Syncing" : "Up to date"
  const errorMessage =
    activeQuery.error instanceof Error
      ? activeQuery.error.message
      : "Unable to load books right now."

  return (
    <div className="dark min-h-screen bg-muted text-muted-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary">Chillguys present</Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-primary">
              Bookshelf
            </h1>
            <p className="text-muted-foreground text-sm">
              Explore our book catalog, search and filter.
            </p>
          </div>
          <Card size="sm" className="w-full md:w-72">
            <CardHeader>
              <CardTitle>Catalog Status</CardTitle>
              <CardDescription>Live reads from the books API.</CardDescription>
              <CardAction>
                <Badge variant="secondary">{statusLabel}</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex items-start">
              <div>
                <div className="text-muted-foreground text-xs">Total titles</div>
                <div className="text-lg font-semibold">{total}</div>
              </div>
            </CardContent>
          </Card>
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
                  placeholder="e.g. Ursula Le Guin"
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

        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <div>
            {isSearching
              ? `Searching for "${normalizedSearch}"`
              : "Showing latest titles"}
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            {activeQuery.isFetching ? "Updating from API" : "Synced"}
          </div>
        </div>

        <Separator />

        {activeQuery.isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Loading catalog...
            </CardContent>
          </Card>
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
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function App() {
  return <LibraryApp />
}

export default App
