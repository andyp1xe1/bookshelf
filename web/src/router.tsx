import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router"

import { HomePage } from "@/pages/home"
import { BookCreatePage } from "@/pages/book-create"
import { BookEditPage } from "@/pages/book-edit"
import { BookViewPage } from "@/pages/book-view"

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
})

const bookCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/books/new",
  component: BookCreatePage,
})

const bookEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/books/$bookId/edit",
  component: BookEditPage,
})

const bookViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/books/$bookId",
  component: BookViewPage,
})

const routeTree = rootRoute.addChildren([indexRoute, bookCreateRoute, bookEditRoute, bookViewRoute])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
