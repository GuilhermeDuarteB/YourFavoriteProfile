import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const openApiPath = path.join(testDirectory, "../docs/openapi.yaml");

test("OpenAPI document parses and covers the mounted API groups", () => {
  const document = YAML.parse(fs.readFileSync(openApiPath, "utf8"));

  assert.equal(document.openapi, "3.0.3");
  assert.ok(document.paths);
  assert.ok(document.components?.securitySchemes?.bearerAuth);

  const expectedPaths = [
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/me/email",
    "/api/auth/me/username",
    "/api/auth/me",
    "/api/users/search",
    "/api/users/{username}/reviews",
    "/api/users/{username}",
    "/api/users/me",
    "/api/media/trending",
    "/api/media/latest-episodes",
    "/api/media/discover",
    "/api/media/series/{id}/season/{seasonNumber}",
    "/api/media/{type}/{id}",
    "/api/reviews",
    "/api/reviews/media/{mediaId}",
    "/api/reviews/episode/{episodeId}",
    "/api/reviews/{id}",
    "/api/watchlist",
    "/api/watchlist/me",
    "/api/watchlist/{mediaId}",
    "/api/follow/{username}",
    "/api/top-five",
    "/api/top-five/{username}",
  ];

  assert.deepEqual(Object.keys(document.paths), expectedPaths);
  assert.deepEqual(
    document.tags.map((tag) => tag.name),
    ["Auth", "Users", "Media", "Reviews", "Follow", "Watchlist", "Top Five"],
  );

  const protectedPaths = [
    ["/api/auth/me/email", "put"],
    ["/api/auth/me/username", "put"],
    ["/api/auth/me", "delete"],
    ["/api/users/me", "put"],
    ["/api/reviews", "post"],
    ["/api/reviews/{id}", "put"],
    ["/api/reviews/{id}", "delete"],
    ["/api/watchlist", "post"],
    ["/api/watchlist/me", "get"],
    ["/api/watchlist/{mediaId}", "get"],
    ["/api/watchlist/{mediaId}", "delete"],
    ["/api/follow/{username}", "post"],
    ["/api/follow/{username}", "delete"],
    ["/api/top-five", "put"],
  ];

  for (const [route, method] of protectedPaths) {
    assert.deepEqual(document.paths[route][method].security, [
      { bearerAuth: [] },
    ]);
  }

  for (const [route, method] of [
    ["/api/auth/register", "post"],
    ["/api/auth/login", "post"],
    ["/api/users/search", "get"],
    ["/api/users/{username}/reviews", "get"],
    ["/api/media/trending", "get"],
    ["/api/media/latest-episodes", "get"],
    ["/api/media/discover", "get"],
    ["/api/media/series/{id}/season/{seasonNumber}", "get"],
    ["/api/media/{type}/{id}", "get"],
    ["/api/reviews/media/{mediaId}", "get"],
    ["/api/reviews/episode/{episodeId}", "get"],
    ["/api/top-five/{username}", "get"],
  ]) {
    assert.equal(document.paths[route][method].security, undefined);
  }

  assert.deepEqual(document.paths["/api/users/{username}"].get.security, [
    {},
    { bearerAuth: [] },
  ]);
});

test("documented methods match Express routes and all schema references resolve", async () => {
  const document = YAML.parse(fs.readFileSync(openApiPath, "utf8"));
  const actual = [];
  for (const [prefix, file] of [
    ["auth", "authRoutes"],
    ["users", "userRoutes"],
    ["media", "mediaRoutes"],
    ["reviews", "reviewRoutes"],
    ["watchlist", "watchlistRoutes"],
    ["follow", "followRoutes"],
    ["top-five", "topFiveRoutes"],
  ]) {
    const { default: router } = await import(`../src/routes/${file}.js`);
    for (const { route } of router.stack) {
      if (!route) continue;
      const routePath =
        `/api/${prefix}${route.path === "/" ? "" : route.path}`.replace(
          /:([A-Za-z][A-Za-z0-9]*)/g,
          "{$1}",
        );
      for (const method of Object.keys(route.methods))
        actual.push(`${method} ${routePath}`);
    }
  }
  const documented = Object.entries(document.paths).flatMap(
    ([route, methods]) =>
      Object.keys(methods).map((method) => `${method} ${route}`),
  );
  assert.deepEqual(documented.sort(), actual.sort());
  function checkReferences(value) {
    if (!value || typeof value !== "object") return;
    if (value.$ref) {
      assert.ok(value.$ref.startsWith("#/"));
      assert.ok(
        value.$ref
          .slice(2)
          .split("/")
          .reduce((current, key) => current?.[key], document),
        `Unresolved ${value.$ref}`,
      );
    }
    Object.values(value).forEach(checkReferences);
  }
  checkReferences(document);
  const request =
    document.paths["/api/reviews"].post.requestBody.content["application/json"]
      .schema;
  assert.deepEqual(request.oneOf, [
    { required: ["mediaId"] },
    { required: ["episodeId"] },
  ]);
  assert.equal(
    document.components.schemas.MediaDetails.properties.communityScore.nullable,
    true,
  );
});

test("review scores use OpenAPI 3.0 exclusive minimum and allow positive fractions", () => {
  const document = YAML.parse(fs.readFileSync(openApiPath, "utf8"));
  const schemas = [
    document.components.schemas.Review.properties.score,
    document.components.schemas.UserReview.properties.score,
    document.components.schemas.RecentReview.properties.score.oneOf[0],
    document.paths["/api/reviews"].post.requestBody.content["application/json"]
      .schema.properties.score,
    document.paths["/api/reviews/{id}"].put.requestBody.content[
      "application/json"
    ].schema.properties.score,
  ];
  for (const score of schemas) {
    assert.equal(score.type, "number");
    assert.equal(score.minimum, 0);
    assert.equal(score.exclusiveMinimum, true);
    assert.equal(score.maximum, 10);
    assert.ok(8.5 > score.minimum && 8.5 <= score.maximum);
  }
});
