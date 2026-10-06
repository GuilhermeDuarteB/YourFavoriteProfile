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
    "/api/users/{username}",
    "/api/users/me",
    "/api/media/trending",
    "/api/media/latest-episodes",
    "/api/media/discover",
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
    assert.deepEqual(document.paths[route][method].security, [{ bearerAuth: [] }]);
  }

  for (const [route, method] of [
    ["/api/auth/register", "post"],
    ["/api/auth/login", "post"],
    ["/api/users/search", "get"],
    ["/api/media/trending", "get"],
    ["/api/media/latest-episodes", "get"],
    ["/api/media/discover", "get"],
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
