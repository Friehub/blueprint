import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadCatalogFromRoot } from "./index.js";
import { buildGraph, renderAscii, renderMermaid } from "./graph.js";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("graph", () => {
  it("builds graph for a module with deps", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const graph = buildGraph(result.value!, "billing");

    assert.ok(graph.nodes.length > 0, "should have nodes");
    assert.ok(graph.edges.length > 0, "should have edges");

    const nodeNames = graph.nodes.map((n) => n.name);
    assert.ok(nodeNames.includes("billing"), "should include root module");
    assert.ok(nodeNames.includes("payments"), "should include hard dep");
    assert.ok(nodeNames.includes("users"), "should include hard dep");
  });

  it("builds graph for a module with no deps", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const graph = buildGraph(result.value!, "catalog");

    const nodeNames = graph.nodes.map((n) => n.name);
    assert.ok(nodeNames.includes("catalog"), "should include root module");
    assert.ok(!nodeNames.includes("payments"), "should not include unrelated modules");
  });

  it("returns empty graph for unknown module", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const graph = buildGraph(result.value!, "nonexistent");

    assert.equal(graph.nodes.length, 0);
    assert.equal(graph.edges.length, 0);
  });

  it("renders ASCII graph", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const graph = buildGraph(result.value!, "billing");
    const ascii = renderAscii(graph, "billing");

    assert.ok(ascii.includes("billing"), "should include root module name");
    assert.ok(ascii.includes("payments"), "should include hard dep");
    assert.ok(ascii.includes("users"), "should include hard dep");
    assert.ok(ascii.includes("hard"), "should label hard deps");
  });

  it("renders Mermaid graph", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const graph = buildGraph(result.value!, "billing");
    const mermaid = renderMermaid(graph, "billing");

    assert.ok(mermaid.includes("graph TD"), "should start with graph TD");
    assert.ok(mermaid.includes("-->"), "should have directed edges");
    assert.ok(mermaid.includes("hard"), "should label hard deps");
  });

  it("includes core inheritance in graph", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const graph = buildGraph(result.value!, "assignments");

    const nodeNames = graph.nodes.map((n) => n.name);
    assert.ok(nodeNames.includes("runtime_standards"), "should include inherited core");

    const coreNode = graph.nodes.find((n) => n.name === "runtime_standards");
    assert.equal(coreNode?.kind, "core", "runtime_standards should be marked as core");
  });
});
