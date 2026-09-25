import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocalMetrobusNetwork,
  planLocalMetrobusJourney,
} from "../vite.config.js";

test("the local Metrobús API exposes the bundled network", () => {
  const network = createLocalMetrobusNetwork();
  assert.equal(network.source, "local");
  assert.equal(network.routes.length, 7);
  assert.ok(network.stops.length > 150);
  assert.ok(network.routes.every((route) => network.shapes[route.route_id]?.length > 1));
});

test("the local Metrobús API plans journeys without Python or MySQL", () => {
  const journey = planLocalMetrobusJourney("Indios Verdes", "El Caminero", 1_700_000_000);
  assert.equal(journey.found, true);
  assert.equal(journey.source, "local");
  assert.ok(journey.minutes > 0);
  assert.equal(journey.transfers, 0);
  assert.equal(journey.segments[0].fromName, "Indios Verdes");
  assert.equal(journey.segments.at(-1).toName, "El Caminero");
});

