package auth

import (
	"context"
	"strings"

	"github.com/andyp1xe1/bookshelf/internal/api"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
	"github.com/clerk/clerk-sdk-go/v2/user"
	"github.com/gofiber/fiber/v2"
)

type AuthData struct {
	ID    string
	Email string
	Name  string
}

type authDataKeyType struct{}

var authDataKey = authDataKeyType{}

func WithAuthData(ctx context.Context, authData *AuthData) context.Context {
	return context.WithValue(ctx, authDataKey, authData)
}

func GetAuthData(ctx context.Context) (*AuthData, bool) {
	authData, ok := ctx.Value(authDataKey).(*AuthData)
	return authData, ok
}

func AuthMiddleware(f api.StrictHandlerFunc, operationID string) api.StrictHandlerFunc {
	return func(ctx *fiber.Ctx, args any) (any, error) {
		var mustAuth bool
		if ctx.Context().UserValue(api.BearerAuthScopes) != nil {
			mustAuth = true
		}
		header := ctx.Request().Header.Peek("Authorization")
		token := strings.TrimPrefix(string(header), "Bearer ")
		if token == "" {
			if !mustAuth {
				return f(ctx, args)
			}
			detail := "missing token"
			ctx.Status(fiber.StatusUnauthorized)
			_ = ctx.JSON(api.Problem{Title: "Unauthorized", Status: fiber.StatusUnauthorized, Detail: &detail})
			return nil, nil
		}

		claims, err := jwt.Verify(ctx.Context(), &jwt.VerifyParams{
			Token: string(token),
		})
		if err != nil {
			detail := "invalid token"
			ctx.Status(fiber.StatusUnauthorized)
			_ = ctx.JSON(api.Problem{Title: "Unauthorized", Status: fiber.StatusUnauthorized, Detail: &detail})
			return nil, nil
		}
		usr, err := user.Get(ctx.Context(), claims.Subject)
		if err != nil {
			detail := "user not found"
			ctx.Status(fiber.StatusUnauthorized)
			_ = ctx.JSON(api.Problem{Title: "Unauthorized", Status: fiber.StatusUnauthorized, Detail: &detail})
			return nil, nil
		}
		var email string
		if len(usr.EmailAddresses) > 0 {
			email = usr.EmailAddresses[0].EmailAddress
		}

		authData := &AuthData{
			ID:    usr.ID,
			Email: email,
			Name:  normalizeName(usr.FirstName, usr.LastName),
		}
		uCtx := WithAuthData(ctx.UserContext(), authData)
		ctx.SetUserContext(uCtx)
		return f(ctx, args)
	}
}

func normalizeName(fname, lname *string) string {
	var (
		firstName string
		lastName  string
		fullName  string
	)
	if fname != nil {
		firstName = *fname
	}
	if lname != nil {
		lastName = *lname
	}
	fullName = strings.Join([]string{firstName, lastName}, " ")
	if fullName == "" {
		return "Unknown"
	}
	return strings.TrimSpace(fullName)
}
