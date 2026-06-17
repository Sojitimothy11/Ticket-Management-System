import { test, expect, TEST_USER, TEST_API_URL } from "../fixtures";

test.describe("Authentication", () => {
  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("sign up with valid credentials redirects to home", async ({ page }) => {
    await page.goto("/signup");

    await page.getByLabel("Full Name").fill("New User");
    await page.getByLabel("Email").fill("newuser@test.example");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page).toHaveURL("/");
  });

  test("sign in with valid credentials redirects to home", async ({ page }) => {
    // Seed a user directly via API
    await page.request.post(`${TEST_API_URL}/api/auth/sign-up/email`, {
      data: TEST_USER,
    });
    // Sign-up logs the browser context in immediately; clear that session so the
    // sign-in form below is actually exercised instead of bouncing off the redirect-if-authed check.
    await page.context().clearCookies();

    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL("/");
  });

  test("sign in with wrong password shows error", async ({ page }) => {
    await page.request.post(`${TEST_API_URL}/api/auth/sign-up/email`, {
      data: TEST_USER,
    });
    await page.context().clearCookies();

    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.locator("p.text-red-600")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("authenticated user can access the home page", async ({ authenticatedPage }) => {
    await expect(authenticatedPage).toHaveURL("/");
  });

  test("already signed-in user is redirected away from /login", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/login");
    await expect(authenticatedPage).toHaveURL("/");
  });
});
